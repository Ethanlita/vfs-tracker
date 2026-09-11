# 前端审查问题发布结果

2026-09-10，经用户明确授权，29 个新 issue、5 条此前待发布的补充，以及1条本地 Dashboard 403 排查说明已全部发布。逐项读取 GitHub 核对，35份正文与本地文件一致，29个新 issue 均为 OPEN；#37 仍为 CLOSED。

此前的 #97—#145 共49个问题加上本次29个新问题，以及后续发布链路复核新增的 #176/#177，累计发布80个前端审查 issue。发布完成不代表应用修复已经完成。

| 本地编号 | 问题或补充 | GitHub |
|---|---|---|
| D1 | 录音暂停仍计时、15/60 秒不一致 | [#146](https://github.com/Ethanlita/vfs-tracker/issues/146) |
| D2 | 音阶提前结束生成未测音域并继续采集 | [#147](https://github.com/Ethanlita/vfs-tracker/issues/147) |
| D3 | 事件管理承诺编辑却无入口 | [#148](https://github.com/Ethanlita/vfs-tracker/issues/148) |
| D4 | 事件详情与公开档案缺少弹层键盘交互 | [#149](https://github.com/Ethanlita/vfs-tracker/issues/149) |
| D5 | 医院报告说明与管理员预览不一致 | [#150](https://github.com/Ethanlita/vfs-tracker/issues/150) |
| D6 | 更换邮箱不能完成属性验证 | [#151](https://github.com/Ethanlita/vfs-tracker/issues/151) |
| D7 | 管理员 PIN 解锁网络故障删除保存信息 | [#152](https://github.com/Ethanlita/vfs-tracker/issues/152) |
| D8 | 音色慢加载重复请求并集中补播 | [#153](https://github.com/Ethanlita/vfs-tracker/issues/153) |
| D9 | 保存或资料刷新覆盖未提交编辑 | [#154](https://github.com/Ethanlita/vfs-tracker/issues/154) |
| D10 | 离开新增页后迟到成功响应仍强制跳转 | [#155](https://github.com/Ethanlita/vfs-tracker/issues/155) |
| D11 | 窄屏文档长标识符撑宽整页 | [#156](https://github.com/Ethanlita/vfs-tracker/issues/156) |
| D12 | 公开资料请求失败后整个区域隐藏 | [#157](https://github.com/Ethanlita/vfs-tracker/issues/157) |
| D13 | 头像及附件选择入口无法通过键盘到达 | [#158](https://github.com/Ethanlita/vfs-tracker/issues/158) |
| D14 | 上传中提交事件遗漏已选附件 | [#159](https://github.com/Ethanlita/vfs-tracker/issues/159) |
| D15 | 附件旧行按索引移除另一文件 | [#160](https://github.com/Ethanlita/vfs-tracker/issues/160) |
| D16 | 附件与报告链接失败后原始key变成错误链接 | [#161](https://github.com/Ethanlita/vfs-tracker/issues/161) |
| D17 | 首次资料设置丢失登录返回目标 | [#162](https://github.com/Ethanlita/vfs-tracker/issues/162) |
| D18 | 个人历史读取失败仍显示没有记录 | [#163](https://github.com/Ethanlita/vfs-tracker/issues/163) |
| D19 | 异步录音流程取消与重开后资源归属错误 | [#164](https://github.com/Ethanlita/vfs-tracker/issues/164) |
| D20 | 录音转WAV后临时上下文未关闭 | [#165](https://github.com/Ethanlita/vfs-tracker/issues/165) |
| D21 | 配置读取失败后可编辑却无法保存或重试 | [#166](https://github.com/Ethanlita/vfs-tracker/issues/166) |
| D22 | 快速基频成功后仍可重复保存 | [#167](https://github.com/Ethanlita/vfs-tracker/issues/167) |
| D23 | 离线队列读取失败被误报为空 | [#168](https://github.com/Ethanlita/vfs-tracker/issues/168) |
| D24 | 离线同步清理失败后重发已成功记录 | [#169](https://github.com/Ethanlita/vfs-tracker/issues/169) |
| D25 | 社交账号编辑行撑宽手机页面 | [#170](https://github.com/Ethanlita/vfs-tracker/issues/170) |
| D26 | 资料与头像保存的旧快照覆盖已确认修改 | [#171](https://github.com/Ethanlita/vfs-tracker/issues/171) |
| D27 | 嗓音转换失败后把WebM当作WAV上传 | [#172](https://github.com/Ethanlita/vfs-tracker/issues/172) |
| D28 | 管理用户保存旧响应污染当前详情 | [#173](https://github.com/Ethanlita/vfs-tracker/issues/173) |
| D29 | 管理用户最近事件混入其他用户记录 | [#174](https://github.com/Ethanlita/vfs-tracker/issues/174) |
| C1 | #102头像竞态与损坏图片 | [#102 补充](https://github.com/Ethanlita/vfs-tracker/issues/102#issuecomment-5620434694) |
| C2 | #105离线资料存储异常 | [#105 补充](https://github.com/Ethanlita/vfs-tracker/issues/105#issuecomment-5620435932) |
| C3 | #119配置保存跨页面交错 | [#119 补充](https://github.com/Ethanlita/vfs-tracker/issues/119#issuecomment-5620436699) |
| C4 | #127类型切换后旧重试绕过必填 | [#127 补充](https://github.com/Ethanlita/vfs-tracker/issues/127#issuecomment-5620437583) |
| C5 | #67算法音量与饱和测量 | [#67 补充](https://github.com/Ethanlita/vfs-tracker/issues/67#issuecomment-5620438394) |
| C6 | 本地旧 API 配置造成 Dashboard 403（已解决） | [#37 补充](https://github.com/Ethanlita/vfs-tracker/issues/37#issuecomment-5620439658) |
| D30 | 前后端并行发布造成新协议上线顺序窗口 | [#176](https://github.com/Ethanlita/vfs-tracker/issues/176) |
| D31 | Python 声学镜像依赖过期 artifact 且缺完整测试门禁 | [#177](https://github.com/Ethanlita/vfs-tracker/issues/177) |

D1—D29 保留原审阅清单编号，D30—D31 为修复阶段复核发布链路时新增。C1—C5 为既有五条补充；C6 为刚发现并已在本地解决的旧 API 地址问题，不单独创建未解决缺陷。

仅发布列出的标题和 Markdown 正文；原始浏览器日志、认证脚本、截图、环境文件和真实账户数据未上传。

继续人工试用见[分区试用清单](frontend-manual-trial-2026-09-10.md)，修复要求见[验收清单](frontend-repair-acceptance-2026-09-10.md)。
