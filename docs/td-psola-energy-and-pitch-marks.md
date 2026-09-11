# TD-PSOLA 能量与基频标记修复

## 问题范围

本轮处理 issue #67 中可以稳定复现和客观测量的两项缺陷：

1. 合成能量把所有分析帧的采样平方和除以“帧数”，再与按“采样点数”计算的输出能量比较。两个数的量纲不同，弱信号会被错误放大约 31 dB。
2. 浊音标记的精确候选一旦落在允许区间外，检测循环只移动分析窗口而不生成下一个标记。稳定正弦输入可能在约 3 秒中只留下 2–3 个标记点，造成大段合成空白；旧的高增益又掩盖了这个缺陷。

## 实现

- `matchTdPsolaEnergy` 使用完整原始音频和完整合成音频的每采样点均方能量。只有输出确有损失时才向上补偿，目标 RMS 保留 10% 余量，峰值同时限制在 0.95 full scale。
- 自相关候选在置信度相同或接近时优先选择靠近外部预估基频的一倍周期，避免纯周期信号误选二倍周期。
- 精确标记落在连续周期范围外时，使用当前预期位置继续推进。该路径仍属于同一套 TD-PSOLA 检测逻辑，不会切换到另一种处理算法。
- 合成仍保留原有窗函数、重叠相加、淡入淡出和峰值保护。

## 自动验收

单元及组件聚焦测试共 60 项，覆盖能量量纲、弱/中/强输入、稀疏峰值保护、周期候选排序、标记持续推进、TD-PSOLA 既有算法约束和页面交互。完整单元测试 112 个文件/1375 项、完整集成测试 32 个文件/631 项均通过。

真实 Chrome 验收在开发服务器和生产预览中分别运行，使用真实 `MediaRecorder` 录制 180 Hz 合成输入，再解析页面产生的 16-bit PCM WAV：

| 输入振幅 | 开发输出增益 | 生产输出增益 | 输出峰值（约） | 输出频率（约） |
| --- | ---: | ---: | ---: | ---: |
| 0.02 | -0.10 dB | -0.11 dB | 0.02 | 180 Hz（低于浊音阈值，保持原频率） |
| 0.08 | -0.96 dB | -0.96 dB | 0.12 | 223 Hz |
| 0.20 | -0.97 dB | -0.98 dB | 0.31 | 222 Hz |

页面默认目标为约 230 Hz。验收要求原始频率误差小于 5 Hz、有效浊音输出误差小于 25 Hz、RMS 增益绝对值小于 5 dB、没有接近满幅或满幅采样、时长比例在 0.8–1.3 内，并且没有页面异常或对话框。六组结果全部通过。开发模式的 0.08/0.20 输入分别生成约 496/484 个浊音标记，不再出现只有少量分析帧的空洞输出。

原始录音是 48 kHz，浏览器处理上下文输出 44.1 kHz；两者均为有效单声道 16-bit PCM，时长保持一致。采样率统一不属于本轮 #67 的修复范围。

## 验证命令

```bash
npx vitest run tests/unit/utils/tdPsolaEnergy.test.js tests/unit/utils/tdPsolaPitchMarks.test.js tests/unit/audio/td-psola.test.js tests/integration/components/VFSEffectPreview.test.jsx --maxWorkers=4
npx eslint src/components/VFSEffectPreview.jsx src/utils/tdPsolaEnergy.js src/utils/tdPsolaPitchMarks.js tests/unit/utils/tdPsolaEnergy.test.js tests/unit/utils/tdPsolaPitchMarks.test.js output/playwright/frontend-audit/td-psola-energy.mjs
npm run build
node output/playwright/frontend-audit/td-psola-energy.mjs
```

浏览器结果保存在 `output/playwright/frontend-audit/td-psola-energy-summary.json`，移动端生产截图保存在同目录。

## 剩余验证

本轮自动验收覆盖稳定合成音的响度、峰值、时长和频率。真人语音的自然度、噪声段和清浊音边界仍需要发布前后进行人工听感测试；如果继续改进 #67，应以固定真人语料和盲听对比为依据，避免只凭单一频率波形调整参数。
