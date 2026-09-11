/** @file 资料设置的轻量运行时协议校验；可在断网时直接执行，不依赖延迟加载代码块。 */

/** 判断值是否为普通对象。 */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 判断对象是否只包含指定字段且数量完全一致。 */
const hasExactKeys = (value, keys) => isObject(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));

/** 校验资料设置的服务端版本。 */
export function assertProfileSetupBaseVersion(value) {
  if (!hasExactKeys(value, ['exists', 'updatedAt']) || typeof value.exists !== 'boolean' ||
      (value.updatedAt !== null && (typeof value.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.updatedAt)) || !value.updatedAt.includes('T'))) ||
      (value.exists === false && value.updatedAt !== null)) {
    throw new TypeError('资料草稿的服务端版本无效');
  }
  return value;
}

/** 校验完整资料或互斥的跳过协议。 */
export function assertProfileSetupPayload(value) {
  if (hasExactKeys(value, ['setupSkipped']) && value.setupSkipped === true) return value;
  const fields = ['name', 'bio', 'isNamePublic', 'socials', 'areSocialsPublic'];
  if (!hasExactKeys(value, fields) || typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.bio !== 'string' || typeof value.isNamePublic !== 'boolean' ||
      typeof value.areSocialsPublic !== 'boolean' || !Array.isArray(value.socials) ||
      value.socials.some(social => !hasExactKeys(social, ['platform', 'handle']) ||
        typeof social.platform !== 'string' || !social.platform.trim() ||
        typeof social.handle !== 'string' || !social.handle.trim())) {
    throw new TypeError('资料草稿的提交内容无效');
  }
  return value;
}

/** 校验发往资料设置端点的完整请求。 */
export function assertProfileSetupRequest(value) {
  if (!hasExactKeys(value, ['profile', 'baseVersion'])) throw new TypeError('资料设置请求结构无效');
  assertProfileSetupPayload(value.profile);
  assertProfileSetupBaseVersion(value.baseVersion);
  return value;
}

/**
 * 校验按账号隔离的 v2 草稿，并确保 kind 与提交路径一致。
 * @param {unknown} draft 待验证的本地存储内容。
 * @returns {object} 验证后的原对象。
 */
export function assertPendingProfileSetup(draft) {
  const fields = ['version', 'draftId', 'ownerUserId', 'payload', 'baseVersion', 'kind', 'savedAt', 'returnUrl'];
  if (!hasExactKeys(draft, fields) || draft.version !== 2 ||
      typeof draft.draftId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.draftId) ||
      typeof draft.ownerUserId !== 'string' || !draft.ownerUserId.trim() ||
      !hasExactKeys(draft.payload, ['profile']) || !Number.isInteger(draft.savedAt) || draft.savedAt < 0 ||
      typeof draft.returnUrl !== 'string' || !/^\/(?!\/)/.test(draft.returnUrl) ||
      !['complete', 'skip'].includes(draft.kind)) {
    throw new TypeError('离线资料草稿结构无效');
  }
  assertProfileSetupPayload(draft.payload.profile);
  if (draft.baseVersion !== null) assertProfileSetupBaseVersion(draft.baseVersion);
  const expectedKind = draft.payload.profile.setupSkipped === true ? 'skip' : 'complete';
  if (draft.kind !== expectedKind) throw new TypeError('资料草稿类型与提交内容不一致');
  return draft;
}
