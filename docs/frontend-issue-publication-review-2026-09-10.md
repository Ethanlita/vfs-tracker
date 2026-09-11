# 前端问题审阅与发布索引

基线：master `c29a6807ef02e0188344f8b63bc9065f1202436d`，2026-09-10。29份新issue正文和5份补充已获用户明确授权并全部发布；本地正文与逐项回读记录一致。另有#37本地配置排查补充，完整链接见[发布结果](frontend-issue-publication-results-2026-09-10.md)。发布完成不代表修复完成。

目标仓库：[Ethanlita/vfs-tracker](https://github.com/Ethanlita/vfs-tracker)。下表链接是审阅正文，摘要用于快速审阅；D编号仅是本地编号，不是GitHub issue号。建议优先处理会丢失数据、重复写入或结束后继续采集的问题。

正文中的源码链接固定到审查时的提交。测试使用隔离合成账户、模拟接口与合成音频；各正文另列环境与对照，不能由此声称真实云端事故、真实医疗报告访问或实体设备行为已经得到验证。

| 编号 | 建议顺序 | 审阅正文 | 已复现结果 | 关联与区别 |
|---|---|---|---|---|
| [D1 / #146](https://github.com/Ethanlita/vfs-tracker/issues/146) | 随后 | [录音暂停仍计时、15/60 秒不一致](../output/playwright/frontend-audit/issues/recorder-pause.md) | 生产页合成录音 0.5 秒后暂停，等约 16 秒自动完成 | 按正文独立复现验收 |
| [D2 / #147](https://github.com/Ethanlita/vfs-tracker/issues/147) | 优先 | [音阶提前结束生成未测音域并继续采集](../output/playwright/frontend-audit/issues/scale-end-result.md) | 首轮失败无通过，结果仍为 E3–F#3；结果页输入改变后 rms 0.070→0.142 | #106：无效测量；本项为音阶结果与采集生命周期 |
| [D3 / #148](https://github.com/Ethanlita/vfs-tracker/issues/148) | 随后 | [事件管理承诺编辑却无入口](../output/playwright/frontend-audit/issues/event-edit-missing.md) | 页面明确提示可编辑，列表/详情仅查看和删除；无更新 API | 按正文独立复现验收 |
| [D4 / #149](https://github.com/Ethanlita/vfs-tracker/issues/149) | 随后 | [事件详情与公开档案缺少弹层键盘交互](../output/playwright/frontend-audit/issues/event-dialog-a11y.md) | 事件详情无dialog语义/关闭名称；公开档案已有语义却仍能Tab/Enter操作背景用户，Escape不关闭且关闭不还原焦点；双构建、双宽度复现 | #98/#117：其他弹层与侧栏焦点问题 |
| [D5 / #150](https://github.com/Ethanlita/vfs-tracker/issues/150) | 随后 | [医院报告说明与管理员预览不一致](../output/playwright/frontend-audit/issues/hospital-privacy-copy.md) | 上传承诺无人看到，合成管理事件可生成附件链接；未读真实报告，也不声称已有泄露 | 上传承诺与授权管理员访问能力一致性；不推断泄露 |
| [D6 / #151](https://github.com/Ethanlita/vfs-tracker/issues/151) | 随后 | [更换邮箱不能完成属性验证](../output/playwright/frontend-audit/issues/profile-email-verification.md) | 返回待验证码确认后没有输入入口；重发调用注册 ResendConfirmationCode 并失败；区别于 #89 | #89：注册验证；本项为更换邮箱后的属性验证 |
| [D7 / #152](https://github.com/Ethanlita/vfs-tracker/issues/152) | 优先 | [管理员 PIN 解锁网络故障删除保存信息](../output/playwright/frontend-audit/issues/admin-pin-network-loss.md) | 错误 PIN 保留密文；正确 PIN 遇 STS 网络故障清除密文，联网后提示找不到保存的凭证 | 按正文独立复现验收 |
| [D8 / #153](https://github.com/Ethanlita/vfs-tracker/issues/153) | 随后 | [音色慢加载重复请求并集中补播](../output/playwright/frontend-audit/issues/note-soundfont-pending-playback.md) | 间隔两秒的3次按键产生3个请求；生产失败对照中三个振荡器在1ms内补播，首键已等待约6秒；开发成功对照同样积压 | 按正文独立复现验收 |
| [D9 / #154](https://github.com/Ethanlita/vfs-tracker/issues/154) | 优先 | [保存或资料刷新覆盖未提交编辑](../output/playwright/frontend-audit/issues/save-pending-edits-lost.md) | 事件保存清空后续备注、资料保存回填旧编辑；头像独立更新成功也覆盖未提交名称/公开选项/社交账号；双构建一致 | D26：已保存字段被覆盖；本项为未提交编辑丢失 |
| [D10 / #155](https://github.com/Ethanlita/vfs-tracker/issues/155) | 随后 | [离开新增页后迟到成功响应仍强制跳转](../output/playwright/frontend-audit/issues/event-save-late-navigation.md) | 请求等待时先回首页；生产等待3秒仍是首页，放行成功后跳/mypage；开发同样复现 | 按正文独立复现验收 |
| [D11 / #156](https://github.com/Ethanlita/vfs-tracker/issues/156) | 随后 | [窄屏文档长标识符撑宽整页](../output/playwright/frontend-audit/issues/docs-narrow-inline-overflow.md) | 13篇×2宽度×2构建：默认16px字号、320视口下数据查询指南宽365、更新记录宽370；文字右端在屏幕外 | 按正文独立复现验收 |
| [D12 / #157](https://github.com/Ethanlita/vfs-tracker/issues/157) | 随后 | [公开资料请求失败后整个区域隐藏](../output/playwright/frontend-audit/issues/public-profile-error-hidden.md) | 资料等待/400时无资料区、错误提示及重试；重新打开200恢复；生产390px和开发1440px一致 | 按正文独立复现验收 |
| [D13 / #158](https://github.com/Ethanlita/vfs-tracker/issues/158) | 随后 | [头像及附件选择入口无法通过键盘到达](../output/playwright/frontend-audit/issues/upload-keyboard-entry.md) | 头像从编辑账户Tab直达编辑资料；附件从备注Tab直达提交；input为display:none，label无焦点；鼠标可触发filechooser，双构建一致 | #101/#102：上传失败；本项为键盘入口 |
| [D14 / #159](https://github.com/Ethanlita/vfs-tracker/issues/159) | 优先 | [上传中提交事件遗漏已选附件](../output/playwright/frontend-audit/issues/event-submit-pending-attachment.md) | 文件仍上传时事件提交可用，POST无attachments且返回个人页；迟到上传完成不再提交事件；等待上传完成后对照正确包含附件，双构建一致 | #101：失败重试；本项为上传等待期间提交 |
| [D15 / #160](https://github.com/Ethanlita/vfs-tracker/issues/160) | 优先 | [附件旧行按索引移除另一文件](../output/playwright/frontend-audit/issues/attachment-remove-stale-index.md) | 移除A后计数1但仍显示A/B；慢链接期间再次点可见A，B也被移除，最终POST无附件；正常更新后对照保留B，双构建一致 | D14：均涉及附件；本项为旧行删除错误文件 |
| [D16 / #161](https://github.com/Ethanlita/vfs-tracker/issues/161) | 随后 | [附件与报告链接失败后原始key变成错误链接](../output/playwright/frontend-audit/issues/attachment-link-failure.md) | 新增附件与报告PDF点击均进入本站“页面不存在”，图表破图且无局部重试；报告返回上一步再进入可恢复且无需再分析；双构建已验证 | #135：管理音频；本项为用户附件与报告链接 |
| [D17 / #162](https://github.com/Ethanlita/vfs-tracker/issues/162) | 随后 | [首次资料设置丢失登录返回目标](../output/playwright/frontend-audit/issues/login-return-profile-setup.md) | 普通登录保留事件管理路径及查询参数；首次设置跳过/完成后均进入个人页，资料POST已成功；双构建6条路径已验证 | #105：首次资料设置；本项为登录返回地址 |
| [D18 / #163](https://github.com/Ethanlita/vfs-tracker/issues/163) | 随后 | [个人历史读取失败仍显示没有记录](../output/playwright/frontend-audit/issues/personal-history-failure-empty-state.md) | 顶部有错误和重试，下方仍提示暂无事件/添加第一个事件；两页重试恢复正常，事件管理失败时无矛盾空态；双构建对照 | #116：历史分页；本项为读取失败误示空态 |
| [D19 / #164](https://github.com/Ethanlita/vfs-tracker/issues/164) | 优先 | [异步录音流程取消与重开后资源归属错误](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md) | 快速测试迟到授权仍分析、旧失败关闭新测试；通用Recorder授权等待重复开始残留录音，转换等待重开中断新录音并残留旧音轨；双构建验证 | D20：临时转码上下文；本项含仍在采集的音轨 |
| [D20 / #165](https://github.com/Ethanlita/vfs-tracker/issues/165) | 随后 | [录音转WAV后临时上下文未关闭](../output/playwright/frontend-audit/issues/recorder-wav-context-cleanup.md) | 连续3次完成及GC后仍3个running；解码/重采样失败、转换中离开也残留上下文；正常放弃完整清理，双构建验证 | D19：授权与采集；本项为完成转码后资源清理 |
| [D21 / #166](https://github.com/Ethanlita/vfs-tracker/issues/166) | 随后 | [配置读取失败后可编辑却无法保存或重试](../output/playwright/frontend-audit/issues/admin-rate-read-recovery.md) | SSM读取400后显示24/10默认值，修改36但保存/重置禁用，无重试；侧栏离开再进入读回48/3/72/5并可保存，双构建验证 | #118/#119：参数校验与保存；本项为读取恢复 |
| [D22 / #167](https://github.com/Ethanlita/vfs-tracker/issues/167) | 优先 | [快速基频成功后仍可重复保存](../output/playwright/frontend-audit/issues/quick-f0-repeat-save.md) | 成功后跳转前再次点击，在线两次POST、离线队列两条；在途保存按钮禁用对照正常，双构建验证 | #106：结果有效性；本项为成功后重复保存 |
| [D23 / #168](https://github.com/Ethanlita/vfs-tracker/issues/168) | 优先 | [离线队列读取失败被误报为空](../output/playwright/frontend-audit/issues/offline-queue-read-error.md) | 有效队列读取SecurityError及损坏格式均提示没有记录，原始数据仍在；解除读取限制重入恢复数量，混合坏条目不阻塞有效同步，双构建验证 | #103/#104及D24：队列身份与同步；本项为读取错误 |
| [D24 / #169](https://github.com/Ethanlita/vfs-tracker/issues/169) | 优先 | [离线同步清理失败后重发已成功记录](../output/playwright/frontend-audit/issues/offline-sync-cleanup-error.md) | 全成功removeItem失败或部分成功setItem失败，无本地错误提示，队列保留成功项并在再次同步重发；正常清理对照不重复，双构建验证 | #104：同步中新增丢失；本项为成功条目被重发 |
| [D25 / #170](https://github.com/Ethanlita/vfs-tracker/issues/170) | 随后 | [社交账号编辑行撑宽手机页面](../output/playwright/frontend-audit/issues/profile-social-mobile-overflow.md) | 320/390px页面均扩到475px，添加按钮在视口外；1440px对照正常，取消/失败重试/保存删除及刷新均通过 | #144：大字号；本项为未调整字号的编辑布局 |
| [D26 / #171](https://github.com/Ethanlita/vfs-tracker/issues/171) | 优先 | [资料与头像保存的旧快照覆盖已确认修改](../output/playwright/frontend-audit/issues/profile-concurrent-save-overwrite.md) | 同页请求乱序及跨标签页严格顺序保存均可覆盖已保存名称/公开选项或清掉头像；刷新仍错误，第二页先刷新对照正常；双构建验证 | #102及D9：头像失败、未提交编辑；本项为成功写入互相覆盖 |
| [D27 / #172](https://github.com/Ethanlita/vfs-tracker/issues/172) | 优先 | [嗓音转换失败后把WebM当作WAV上传](../output/playwright/frontend-audit/issues/voice-conversion-failure-format.md) | 解码/重采样失败后首段字节为WebM，文件名和PUT类型仍为WAV；计入完成且可到下一步，无错误提示；双构建6路径12次上传 | #107：上传重试错步骤；D20：转换资源；本项为错误格式静默上传 |
| [D28 / #173](https://github.com/Ethanlita/vfs-tracker/issues/173) | 随后 | [管理用户保存旧响应污染当前详情](../output/playwright/frontend-audit/issues/admin-user-save-stale-selection.md) | A保存成功把B详情切回A；A失败把B开启状态误显示为关闭且无提示；原用户成功/失败重试正常，双构建8路径12次模拟写入 | #141/#119：其他异步保存问题；本项为管理用户详情选择与开关状态 |
| [D29 / #174](https://github.com/Ethanlita/vfs-tracker/issues/174) | 优先 | [管理用户最近事件混入其他用户记录](../output/playwright/frontend-audit/issues/admin-user-events-stale-data.md) | A迟到查询覆盖B；B读取失败保留A事件，首次失败误示空态且无重试；正常切换及恢复重开对照通过，双构建8路径18次查询 | D28：同组件保存流程；本项为最近事件查询结果归属与失败反馈 |

## 补充已有issue

| 目标 | 审阅正文 |
|---|---|
| [#102](https://github.com/Ethanlita/vfs-tracker/issues/102) | [#102头像竞态与损坏图片](../output/playwright/frontend-audit/avatar-race-issue-102-comment.md) |
| [#105](https://github.com/Ethanlita/vfs-tracker/issues/105) | [#105离线资料存储异常](../output/playwright/frontend-audit/profile-storage-issue-105-comment.md) |
| [#119](https://github.com/Ethanlita/vfs-tracker/issues/119) | [#119配置保存跨页面交错](../output/playwright/frontend-audit/admin-save-navigation-issue-119-comment.md) |
| [#127](https://github.com/Ethanlita/vfs-tracker/issues/127) | [#127类型切换后旧重试绕过必填](../output/playwright/frontend-audit/event-type-issue-127-comment.md) |
| [#67](https://github.com/Ethanlita/vfs-tracker/issues/67) | [#67算法音量与饱和测量](../output/playwright/frontend-audit/audio-level-issue-67-comment.md) |

## 发布范围与证据

本批实际发布内容为上述34份Markdown正文及其标题；不包含整个output目录、浏览器日志、认证测试脚本、截图自动上传或真实账户数据。正文末尾的本地证据文件名用于工作区内复核，GitHub读者应依靠正文复现步骤及固定源码链接；这些文件名不表示附件已经上传。

D5明确涉及医院报告上传承诺与授权管理员访问能力的差异。它只描述合成事件及源码能力，不声称任何真实报告曾被阅读或已经发生泄露。

此前自动审批拒绝了含报告访问发现的发布批次，以及D8的独立发布，原因是缺少针对具体内容和GitHub目的地的公开披露授权。后续草稿沿用该边界保留本地，没有反复尝试发布。此清单用于明确待审阅内容，不能自行视为发布授权。 用户随后明确授权全部发布，现已完成；此前阻碍已解除。

本轮结构检查确认正文文件、复现/环境/验收标记，以及源码链接所引用提交、提交内文件与行号范围；它不替代浏览器复现，也不证明所引用行的语义正确。详细证据和未覆盖场景见[审查报告](frontend-audit-2026-09-10.md)，修复后行为标准见[修复验收清单](frontend-repair-acceptance-2026-09-10.md)。
