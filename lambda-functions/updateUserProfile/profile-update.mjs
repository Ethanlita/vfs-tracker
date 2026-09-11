/** @file 构造个人资料的字段级更新，避免完整旧快照覆盖不相关字段。 */
const fields = new Set(['name', 'bio', 'avatarUrl', 'avatarKey', 'isNamePublic', 'areSocialsPublic', 'socials']);

/**
 * 校验资料补丁并生成DynamoDB原子更新表达式。
 * @param {object} profile - 请求中明确提供的资料字段，nickname仍由Cognito管理，setupSkipped由设置向导管理且保持原值。
 * @param {string} now - ISO更新时间。
 * @returns {object} UpdateCommand的表达式参数。
 * @throws {TypeError} 请求不是合法的非空补丁。
 */
export function buildProfileUpdate(profile, now) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new TypeError('profile must be an object');
  const entries = Object.entries(profile).filter(([key]) => key !== 'nickname' && key !== 'setupSkipped');
  if (!entries.length || entries.some(([key]) => !fields.has(key))) throw new TypeError('profile contains no writable fields or unsupported fields');
  for (const [key, value] of entries) {
    if (key === 'name' && (typeof value !== 'string' || !value.trim())) throw new TypeError('name must be a non-empty string');
    if (['bio', 'avatarUrl', 'avatarKey'].includes(key) && value !== null && typeof value !== 'string') throw new TypeError(key + ' must be a string or null');
    if (['isNamePublic', 'areSocialsPublic'].includes(key) && typeof value !== 'boolean') throw new TypeError(key + ' must be a boolean');
    if (key === 'socials' && (!Array.isArray(value) || value.some(item => !item || typeof item.platform !== 'string' || !item.platform || typeof item.handle !== 'string' || !item.handle))) throw new TypeError('socials must contain platform and handle');
  }
  const names = { '#profile': 'profile', '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': now, ':mapType': 'M' };
  const setters = entries.map(([key, value], index) => {
    names['#field' + index] = key;
    values[':value' + index] = value;
    return '#profile.#field' + index + ' = :value' + index;
  });
  return {
    UpdateExpression: 'SET ' + [...setters, '#updatedAt = :updatedAt'].join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    // 新用户由profile-setup创建完整map；更新接口不能悄悄创建缺少必需字段的资料。
    ConditionExpression: 'attribute_type(#profile, :mapType)'
  };
}
