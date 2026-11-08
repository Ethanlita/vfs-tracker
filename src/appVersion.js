/**
 * @file 当前运行中的应用版本。
 * @description `__APP_VERSION__` 由 vite.config.js 在构建期注入（见 config/appVersion.js）；
 * 页面、诊断信息统一从这里读取，避免各处直接引用构建常量。
 */

/** @type {{commit: string, date: string}} 当前构建的短提交哈希与提交日期；开发模式为 `dev`。 */
export const APP_VERSION = __APP_VERSION__;

/**
 * 生成面向用户的版本文本。
 * @param {{commit: string, date: string}} [version] - 版本信息，默认为当前构建。
 * @returns {string} 例如 `e057653（2026-11-08）`；开发模式只返回 `dev`。
 */
export const formatAppVersion = (version = APP_VERSION) => (
  version.date ? `${version.commit}（${version.date}）` : version.commit
);
