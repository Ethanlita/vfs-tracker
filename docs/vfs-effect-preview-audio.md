# VFS 效果预览：SoundTouch 和实时试听

`/vfs-effect-preview` 提供“录音对比”和“实时试听”两个模式。所有处理在本机进行，音频不会上传。页面的提示、原理说明和免责声明为三个独立的原生 `details`，默认收折，标题旁显示展开箭头。

## 统一变调定义

四种算法使用同一参考基频与比例：`ratio = (referenceF0 + shiftHz) / referenceF0`，`semitones = 12 * log2(ratio)`。例如 200 Hz 加 50 Hz 对应 1.25 倍、约 3.863 半音。Hz 控件代表参考点的增量，整段声音按比例变调，并不是每一帧都固定增加相同 Hz。

录音完成后以自相关估计参考基频；检测不可靠时显示可编辑的 150 Hz 参考值。用户可以手动修正。修改参考值或增量会停止旧播放并清除所有算法结果。处理期间冻结参数，任务通过代次和 AbortSignal 隔离，迟到结果不能覆盖当前录音。

## 引擎与模块

- `src/audio/effectAlgorithms.js`：四种算法的展示名、能力与结果缓存目录。
- `src/audio/soundtouch/`：基于 SoundTouch 1.7.0 整数 PCM 路径重建的 JavaScript DSP，支持小数半音；不是 VSC 原始源码或逐位一致模拟。
- `src/audio/offline-effect-worker.js`：SoundTouch 与 RubberBand 录音处理，主线程保留原始 PCM 副本供比较。
- `src/audio/rubberbandCore.js`：RubberBand WASM 的唯一加载和适配入口。离线模式先 study 再 process；实时模式明确启用 RealTime，单遍 process/retrieve。
- `src/audio/liveEffectMonitor.js` 和 `src/hooks/useLiveEffect.js`：实时会话、校准、取消、错误、资源所有权和 PWA 更新协调。
- `src/audio/live-io-worklet.js`：512 帧采集交接、播放环形缓冲；重 DSP 在 `effect-worker.js` 内执行。

SoundTouch 为 WSOLA 时长补偿、抗混叠 FIR 和重采样组合，不提供独立的共振峰保持。TD-PSOLA 与 WORLD 继续使用整段处理；WORLD 的 DIO、CheapTrick、D4C 与 Synthesis 接口未替换。

## 实时链路

麦克风 → AudioWorklet → MessageChannel → Worker 持续引擎 → AudioWorklet 播放队列 → Gain → 耳机。

自动校准时暂时静音，取多个人声帧的稳定基频；约三秒内没有可靠结果会停止并提示重试或填写参考值。校准完成后参考值固定，改变音高增量只更新比例，不持续追随每帧 F0。也可使用已录音的参考值或手动输入，跳过校准。

输入待确认数据限制为 150 ms，输出队列容量为 400 ms，首次输出另留 35 ms 的播放余量。过载时丢弃旧段并重新缓冲，不无限累积延迟。参数切换通过 epoch 隔离旧消息，短暂淡出后重新缓冲；缺帧时输出静音，不旁路泄漏原声。处理线程长时间无输出会停止会话。

SoundTouch 与 RubberBand 都保留跨块状态，不会每几十毫秒对一小段独立调用离线算法。RubberBand 实时适配使用 R3 短窗和 HighConsistency；先送入 `getPreferredStartPad()` 指定的静音，再丢弃 `getStartDelay()` 指定的起始输出。停止、切换模式、权限取消、设备断开和路由卸载都会释放本次资源。录音和实时采集互斥。

页面显示的播放缓冲不等于麦克风到扬声器的端到端延迟。校准时间、算法首次出帧等待、操作系统/设备缓冲和蓝牙延迟也不能由该数值代表。音量默认 50%，试听时建议使用耳机。

## 构建与分发

Worker 使用 Vite 的 `new URL(..., import.meta.url)` 入口和 ES module 格式，Worklet 为独立无依赖资源。生产 PWA 缓存须覆盖 Worker、Worklet、动态导入模块和 RubberBand WASM；实际离线运行需要安装更新后的 Service Worker。

开发服务启动时显式预优化 `rubberband-wasm`，避免用户第一次处理录音时才触发 Vite 依赖优化和整页刷新。新 worktree 需要自己的依赖和被 Git 忽略的公开前端配置；无需复制账号或契约测试环境。

SoundTouch 适配保留 LGPL-2.1-or-later 归属与许可证。页面提供 `/licenses/SoundTouch-LGPL-2.1.txt` 与 `/licenses/SoundTouch-source.zip` 下载。后者包括这次分发对应的完整 DSP 模块及归属文件。

## 验证

覆盖参数换算、校准信号/静音、SoundTouch 实际输出频率和时长、分块连续性、资源清理、迟到权限、取消任务、旧结果失效，以及三个说明区域的初始收折。浏览器验证使用隔离的模拟麦克风，不自动开启用户的真实麦克风；开发和生产构建均检查真实 Worker/Worklet/WASM 输出、动态变调、停止与切换模式。视觉检查覆盖桌面和移动端。

RubberBand 接入依据：[官方集成说明](https://www.breakfastquay.com/rubberband/integration.html)、[实时起始对齐 API](https://www.breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html)。

### 浏览器回归复现

先运行 `node scripts/prepare-vfs-audio-qa.mjs`，再用 Playwright CLI 的独立会话打开预览页，配置文件为 `output/playwright/vfs-audio-cli.json`。使用 `run-code --filename` 依次执行 `tests/browser/vfs-effect-preview/init.js`、`recorded.js`、`live.js`。生产构建使用同样流程，另执行 `offline.js` 验证已安装 PWA 在断网后仍可加载两种实时引擎。截图和数值结果保存在被 Git 忽略的 `output/playwright/`。模拟麦克风为 200 Hz，静音启动的 Chrome 不使用真实麦克风，也不向扬声器播放测试音。

独立 worktree 已对齐 `origin/master` 的 `7a5f16c`。完整单元集与效果预览页面回归共 1534 项，全部通过；完整集成测试另行运行，639 项全部通过（其中包含上述效果预览页面用例）。基线中的图表日期用例已由主分支修复，本功能未修改该测试文件。

本 worktree 开发预览使用 `npm run dev -- --port 3001`，生产预览使用 `npm run preview -- --port 4174`，与原工作区的 3000 端口分开。

2026-11-08 的 Chrome 模拟麦克风验证：开发和生产模式下，四算法处理 200 Hz 录音均输出约 250 Hz；SoundTouch 实时 +50/+70/0 Hz 分别输出约 250/270/200 Hz，RubberBand 实时 +50/+100 Hz 分别输出约 250/300 Hz。生产 PWA 断网重载后，两种实时引擎仍输出约 250 Hz，采样检查中的播放中断计数均为 0。生产构建、离线依赖清单预算和本次运行时代码的 ESLint 均通过。这里只验证模拟采集与渲染链路，没有测量真实设备的声学端到端延迟。
