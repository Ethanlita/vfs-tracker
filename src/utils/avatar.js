/**
 * 头像生成和处理工具函数
 */

/**
 * 根据用户名生成默认头像URL
 * @param {string} name - 用户名
 * @param {number} size - 头像尺寸，默认40
 * @returns {string} 头像URL
 */
export const generateAvatarFromName = (name, size = 40) => {
  if (!name) return `https://ui-avatars.com/api/?name=?&size=${size}&background=E9D5FF&color=3730A3`;

  // 获取第一个字符，支持中英文
  const firstChar = name.trim().charAt(0).toUpperCase();

  // 为不同字符生成不同颜色
  const colors = [
    { bg: 'E9D5FF', text: '3730A3' }, // 紫色
    { bg: 'DBEAFE', text: '1E40AF' }, // 蓝色
    { bg: 'D1FAE5', text: '065F46' }, // 绿色
    { bg: 'FEE2E2', text: '991B1B' }, // 红色
    { bg: 'FEF3C7', text: '92400E' }, // 黄色
    { bg: 'E0E7FF', text: '3730A3' }, // 靛蓝
    { bg: 'FCE7F3', text: 'BE185D' }, // 粉色
    { bg: 'ECFDF5', text: '047857' }, // 翠绿
  ];

  // 根据字符的ASCII码选择颜色
  const colorIndex = firstChar.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];

  // 使用 ui-avatars.com 替代 placehold.co，因为后者有域名解析问题
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstChar)}&size=${size}&background=${color.bg}&color=${color.text}&format=png`;
};

/**
 * 生成头像URL - 修复后的函数，返回URL而不是JSX
 * @param {string} name - 用户名
 * @param {number} size - 头像尺寸，默认40
 * @returns {string} 头像URL
 */
export const generateAvatar = (name, size = 40) => {
  return generateAvatarFromName(name, size);
};

/**
 * 获取用户头像URL，优先使用用户上传的头像，否则生成默认头像
 * @param {Object} user - 用户对象
 * @param {number} size - 头像尺寸，默认40
 * @returns {string} 头像URL
 */
export const getUserAvatarUrl = (user, size = 40) => {
  // 优先使用用户上传的头像
  if (user?.attributes?.picture && user.attributes.picture !== '') {
    return user.attributes.picture;
  }

  // 获取用户名，优先使用Cognito的nickname，然后是name，最后是email的用户名部分
  const userName = user?.attributes?.nickname ||
    user?.attributes?.name ||
    user?.attributes?.preferred_username ||
    user?.username ||
    (user?.attributes?.email ? user.attributes.email.split('@')[0] : null);

  return generateAvatarFromName(userName, size);
};

/**
 * 获取用户显示名称
 * @param {Object} user - 用户对象
 * @returns {string} 用户显示名称
 */
export const getUserDisplayName = (user) => {
  // 优先级：nickname > name > preferred_username > username > email用户名部分
  return user?.attributes?.nickname ||
    user?.attributes?.name ||
    user?.attributes?.preferred_username ||
    user?.username ||
    (user?.attributes?.email ? user.attributes.email.split('@')[0] : '未知用户');
};
