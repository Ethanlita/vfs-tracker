# 爬音阶指导与音域测定（Scale Practice & Vocal Range）开发计划（鲁棒化版｜任务 #33）

## 0. 概述
- 在保持原多步向导与入口/路由不变的前提下，引入**基线校准、门控+稳定窗判定、个体自适应与失败保护**；
- 默认 `pitchy`，实现 `PitchTracker` 抽象以便后续切换 `tfjs-crepe`（实验）或 pYIN；
- 不新增后端；遵循 `isProductionReady` 与数据契约。

## 0.5 成功标准（更新）
- 校准步骤可产出 SFF 与 MAD，并驱动自适应阈值；
- 判定采用“能量+稳定度门控 → 半音误差 + 连续稳定窗”两阶段；
- 高波动样例下命中率较瞬时判定提升 ≥30%；
- UI 含稳定度进度环与结果建议；移动/桌面可用；
- 多注释与测试覆盖。

---

## 1. 技术选型与抽象
- **PitchTracker 抽象（必须）**：
  - `PitchyTracker`：基于 pitchy@4.x，输出 `{f0Hz, cents, clarity, voiced, rms}`；
  - `CrepeTracker`（实验，可选）：tfjs/onnx 版本二选一，behind flag；
  - `PyinTracker`（可选）：性能降级路径；
- **门控与稳定窗模块**（纯函数，便于单测）：
  - `gateByEnergy(rms, baseline, deltaDb)`；
  - `gateByStability(clarity, thetaV)`；
  - `accumulateStableWindow(cents, tolerance, dt)`；
  - `adaptiveParamsFromMAD(mad)`（返回 tolerance/stableWindow 的微调）。

## 2. 组件结构
- `ScalePracticeWizard.jsx`（页面根）
  - `HeadphoneCheckStep`
  - `DemonstrationStep`
  - `AscendPracticeStep`
  - `DescendPracticeStep`
  - `ResultStep`
- 共享：
  - `StartingNoteSelector`（含“基线校准”引导并存储 SFF/MAD）
  - `CentsMeter` + **StableRing**（稳定窗累计可视化）
  - `BeatIndicator`（8 拍 + 倒计时）
  - `TonePlayer`（参考音/目标音播放，10ms attack/release）
  - `notes`（音名映射/半音位移/cents 计算）

## 3. 关键流程
- **Step 0**：权限 + 基线校准（10–15s 舒适音 → SFF/MAD/噪声基线），起始音= SFF–2 半音（可 1–3）或手动
- **Step 1**：耳机检测（参考音泄漏 + RMS 升幅判断；兜底继续）
- **Step 2**：演示（可跳过），展示 StableRing
- **Step 3**：爬升（+1 半音/循环），每目标拍开启“延迟 ~100ms 的判定窗”，累计稳定 ≥250–400ms 即通过；连续失败≥3 触发保护
- **Step 4**：下降（-1 半音/循环），同判定
- **Step 5**：结果页（最高/最低、范围、命中率/平均偏差与建议）；可选保存事件

## 4. 判定参数（可配置）
- 声强阈值：`baseline + 12 dB`（相对阈值 + 绝对下限）
- 稳定度阈值：`clarity ≥ 0.6`（θ_v 可调）
- 容差三档：±75/±50/±30 cents（默认中级 ±50）
- 稳定窗：默认 300 ms（区间 250–400，自适应调参）
- 动态窗：拍开始 200ms 内宽松（如 ±100/200ms），其后收紧
- BPM：默认 84（72–100）
- 上/下限：A2–G5（可调）

## 5. 音频与调度
- AudioContext 调度：lookahead 25ms，scheduleAhead ~180ms；
- 检测对齐：拍起点 +100ms 开窗，收尾前 60–100ms 关窗；
- UI 节流 15–30fps；检测累计在 Worker/Worklet 侧。

## 6. 数据与契约
- 仅本地统计；如保存事件，沿用 `self_test`：`details.pitch = {maxHz, minHz}`；`notes` 标注起始音与模式；不上传原始音频。

## 7. 里程碑（D 表示天）
- **D0**：设计冻结与任务拆分；核对第三方手册（pitchy/WebAudio）
- **D1**：`notes` 工具、Cents 计算、TonePlayer
- **D2**：PitchTracker 抽象 + `PitchyTracker`；门控与稳定窗纯函数 + 单测
- **D3**：基线校准（SFF/MAD/噪声），StartingNoteSelector 整合
- **D4**：HeadphoneCheckStep；BeatIndicator；StableRing
- **D5**：AscendPracticeStep（判定窗 + 动态窗 + 失败保护）
- **D6**：DescendPracticeStep + ResultStep（建议/统计）
- **D7**：样式统一、入口按钮、跨浏览器与移动端测试；（可选）事件保存
- **缓冲**：D8–D9 修复与微调；预留实验 CrepeTracker 接入点（不作为本次验收）

## 8. 测试
- **单测**：音名映射/半音位移/cents；门控与稳定窗；自适应策略
- **集成/手测**：
  - 校准：不同噪声与波动度；
  - 耳机检测：通过/不通过与兜底继续；
  - 八拍与倒计时同步误差 < 40ms；
  - 爬升/下降：重试/保护路径；
  - 低性能设备：降级/刷新率降低；
  - `isProductionReady` 开关行为一致；
- **兼容**：Chrome、Safari(iOS)、Firefox；响应式 320–1280px

## 9. 风险与回滚
- 性能瓶颈 → 优先 pitchy；必要时关闭 StableRing 动画/降低刷新率；
- 设备/环境差异 → 相对阈值与稳定窗；结果以半音域展示；
- 兼容异常 → 可临时关闭“自动推荐”，强制手动起点；隐藏“实验 Crepe”入口。

## 10. 文档与发布
- 为向导新增内嵌帮助与阈值说明；
- 在 PR 中附带 README 片段：参数表、默认值与改动点；
- 常量集中在 `src/config/scalePractice.ts`（或同名 js）便于调参。

