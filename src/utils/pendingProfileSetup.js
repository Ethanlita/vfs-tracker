/** @file 按账号持久化资料向导草稿，并用草稿ID保护跨标签页清理。 */
import { StorageError } from './apiError.js';
import { assertPendingProfileSetup } from './profileSetupProtocol.js';

export const LEGACY_PENDING_PROFILE_KEY = 'pendingProfileSetup:v1';
export const PENDING_PROFILE_EVENT = 'pending-profile-setup-updated';

/** 返回当前账号独立的资料草稿键。 */
export const pendingProfileKey = ownerUserId => `pendingProfileSetup:v2:${encodeURIComponent(ownerUserId)}`;

/** 根据当前服务端资料构造并发版本。 */
export function profileBaseVersion(userProfile) {
  const exists = userProfile?.exists === true || Boolean(userProfile?.profile || userProfile?.updatedAt);
  return { exists, updatedAt: exists ? (userProfile?.updatedAt || null) : null };
}

/** 在同源锁内执行资料草稿读写，避免同步成功清除另一标签页刚保存的新草稿。 */
async function withProfileLock(ownerUserId, operation) {
  try {
    if (!ownerUserId) throw new TypeError('缺少资料草稿所属账号');
    if (!navigator.locks?.request) throw new Error('浏览器不支持安全的资料草稿写入');
    return await navigator.locks.request(pendingProfileKey(ownerUserId), operation);
  } catch (cause) {
    if (cause instanceof StorageError) throw cause;
    throw new StorageError('无法安全更新离线资料草稿，请检查浏览器存储权限后重试。', { cause });
  }
}

/** 校验新版草稿；所有调用者共享同一数据契约。 */
function validateDraft(draft) {
  try {
    return assertPendingProfileSetup(draft);
  } catch (cause) {
    throw new StorageError('离线资料草稿格式不正确，原始内容未被修改。', { cause });
  }
}

/** 将属于当前账号的旧版单草稿转换为需要人工确认的新版草稿。 */
async function migrateLegacyDraft(ownerUserId) {
  const raw = localStorage.getItem(LEGACY_PENDING_PROFILE_KEY);
  if (raw === null) return null;
  let legacy;
  try { legacy = JSON.parse(raw); } catch (cause) {
    throw new StorageError('旧版离线资料草稿无法解析，原始内容未被修改。', { cause });
  }
  if (legacy?.userId !== ownerUserId || !legacy?.payload?.profile) return null;
  const legacyProfile = legacy.payload.profile.setupSkipped === true
    ? { setupSkipped: true }
    : {
        name: legacy.payload.profile.name,
        bio: legacy.payload.profile.bio || '',
        isNamePublic: legacy.payload.profile.isNamePublic,
        socials: legacy.payload.profile.socials || [],
        areSocialsPublic: legacy.payload.profile.areSocialsPublic,
      };
  const draft = await validateDraft({
    version: 2,
    draftId: crypto.randomUUID(),
    ownerUserId,
    payload: { profile: legacyProfile },
    baseVersion: null,
    kind: legacyProfile.setupSkipped === true ? 'skip' : 'complete',
    savedAt: Number.isFinite(legacy.savedAt) ? legacy.savedAt : Date.now(),
    returnUrl: '/mypage',
  });
  localStorage.setItem(pendingProfileKey(ownerUserId), JSON.stringify(draft));
  localStorage.removeItem(LEGACY_PENDING_PROFILE_KEY);
  return draft;
}

/** 读取当前账号草稿；键不存在才表示没有待同步资料。 */
export async function readPendingProfileSetup(ownerUserId) {
  try {
    const raw = localStorage.getItem(pendingProfileKey(ownerUserId));
    if (raw === null) return migrateLegacyDraft(ownerUserId);
    return validateDraft(JSON.parse(raw));
  } catch (cause) {
    if (cause instanceof StorageError) throw cause;
    throw new StorageError('无法读取离线资料草稿，请检查浏览器存储权限后重试。原始内容未被修改。', { cause });
  }
}

/** 保存完成或跳过草稿，存储失败时向调用方抛错。 */
export async function savePendingProfileSetup({ ownerUserId, payload, baseVersion, kind, returnUrl }) {
  const draft = await validateDraft({
    version: 2,
    draftId: crypto.randomUUID(),
    ownerUserId,
    payload,
    baseVersion,
    kind,
    savedAt: Date.now(),
    returnUrl,
  });
  await withProfileLock(ownerUserId, () => localStorage.setItem(pendingProfileKey(ownerUserId), JSON.stringify(draft)));
  window.dispatchEvent(new Event(PENDING_PROFILE_EVENT));
  return draft;
}

/** 只清除本次已确认同步的草稿ID，保留其他标签页后来保存的版本。 */
export async function removePendingProfileSetup(ownerUserId, draftId) {
  const removed = await withProfileLock(ownerUserId, async () => {
    const current = await readPendingProfileSetup(ownerUserId);
    if (!current || current.draftId !== draftId) return false;
    localStorage.removeItem(pendingProfileKey(ownerUserId));
    return true;
  });
  window.dispatchEvent(new Event(PENDING_PROFILE_EVENT));
  return removed;
}
