/**
 * @file 构建期应用版本号。
 * @description 版本号取自"最后一次改动前端相关路径的提交"，因此只改后端或只改仓库文档的提交
 * 不会改变前端构建产物，也就不会让已安装的用户收到无意义的更新。
 */
import { execFileSync } from 'node:child_process'

/** 会影响前端构建产物的路径；只有这些路径变化时版本号才变化。 */
export const FRONTEND_VERSION_PATHS = [
  'src',
  'public',
  'posts',
  'index.html',
  'vite.config.js',
  'config',
  'package.json',
  'package-lock.json',
  'tailwind.config.js',
  'postcss.config.js',
]

/**
 * 运行 git 命令并返回标准输出。
 * @param {string[]} args - git 参数。
 * @returns {string} 命令输出。
 */
const runGit = args => execFileSync('git', args, { encoding: 'utf8' })

/**
 * 计算当前构建的版本号。
 * 开发服务器与 Vitest 没有可发布的构建产物，固定返回 `dev`；生产构建必须能从 git 历史得到提交，
 * 否则直接失败，避免发布一个无法追溯的版本。
 * @param {string} command - Vite 命令，`build` 表示生成可发布资源。
 * @param {(args: string[]) => string} [run] - git 执行函数，测试时可替换。
 * @returns {{commit: string, date: string}} 短提交哈希与提交日期（YYYY-MM-DD）。
 */
export const resolveAppVersion = (command, run = runGit) => {
  if (command !== 'build') return { commit: 'dev', date: '' }

  const output = run(['log', '-1', '--abbrev=7', '--format=%h %cs', '--', ...FRONTEND_VERSION_PATHS]).trim()
  const [commit, date] = output.split(' ')
  if (!commit || !date) {
    // CI 必须完整检出历史（fetch-depth: 0），否则无法找到最后一次前端改动。
    throw new Error('无法从 git 历史确定前端版本号：请在完整的 git 检出中构建（CI 需要 fetch-depth: 0）。')
  }
  return { commit, date }
}
