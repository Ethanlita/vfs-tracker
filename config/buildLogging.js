/**
 * 返回构建期日志清理选项。
 * 浏览器生产包不具备可靠的敏感字段识别能力，因此构建时统一移除 console 与 debugger；
 * 开发服务器和测试保留诊断输出，避免改变本地排错能力。
 * @param {string} command Vite 命令，`build` 表示生成可发布资源。
 * @returns {{drop: string[]}|undefined} esbuild 配置。
 */
export const getBuildLoggingOptions = command => command === 'build'
  ? { drop: ['console', 'debugger'] }
  : undefined

const CONSOLE_GUARD_MARKER = 'data-vfs-production-console-guard';

/**
 * 在生产 HTML 的模块脚本之前关闭浏览器控制台输出。
 * 依赖包可能在入口执行前缓存 console 方法，因此必须由 HTML 先建立边界。
 * @returns {{name:string,apply:string,transformIndexHtml:(html:string)=>string}} Vite HTML 转换插件。
 */
export const createProductionConsoleGuardPlugin = () => ({
  name: 'vfs-production-console-guard',
  apply: 'build',
  transformIndexHtml(html) {
    if (html.includes(CONSOLE_GUARD_MARKER)) return html;
    const guard = `<script ${CONSOLE_GUARD_MARKER}>(()=>{const c=globalThis.console;if(!c)return;for(const m of ['log','debug','info','warn','error','group','groupCollapsed','groupEnd','table','dir','trace','time','timeEnd']){c[m]=()=>{}}})()</script>`;
    return html.replace('<head>', `<head>${guard}`);
  },
});
