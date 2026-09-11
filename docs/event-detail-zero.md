# 事件详情零值

问题追踪：[GitHub #175](https://github.com/Ethanlita/vfs-tracker/issues/175)。

SelfTestDetails与HospitalTestDetails现在通过共享 `formatMetricNumber` 格式化核心指标。数值0及完整数字字符串保留；null、undefined、空白、非数字及非有限数值不生成卡片。单位和精度不变：HNR一位小数/dB，Jitter与Shimmer两位小数/%。

2026-09-11：63项详情/格式化测试通过，生产构建通过；开发/生产×390/1440px四组浏览器分别检查自测与医院详情，共8个弹窗均显示0.0 dB、0.00%、0.00%。样本含医院必填地点并通过Schema验证。已检查生产手机医院截图。使用合成账号及模拟事件，无真实数据写入。

证据为 `output/playwright/frontend-audit/detail-zero-*`。本地修复尚未提交或部署，issue保持打开。
