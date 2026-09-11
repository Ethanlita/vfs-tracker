# 前端体验审查（进行中）

> 发布链路补充（2026-09-12）：复核上线前置条件时新增 [#176](https://github.com/Ethanlita/vfs-tracker/issues/176)、[#177](https://github.com/Ethanlita/vfs-tracker/issues/177)、[#179](https://github.com/Ethanlita/vfs-tracker/issues/179) 与 [#180](https://github.com/Ethanlita/vfs-tracker/issues/180)。其中 #176/#177 分别复现前后端并行发布窗口，以及 Python 镜像 artifact 过期、稳定 Parselmouth 缺少默认算法命令且没有完整 pytest 门禁；#179 由首个 PR 门禁复现 ESA Routine 隐式复制跨运行域 `Request` 后在 Node 24 拒绝 `AbortSignal`；#180 记录 Step 4 后端按音量锚点分析而界面写成最低音/最高音的用户误导。当前修复统一发布顺序、从固定提交构建 Parselmouth、显式重建 ESA 回源请求，并统一 Step 4 的音量语义。首轮 ARM CI 的能力探针通过，完整测试又发现成功结果空错误字段和过时测试对象键，均已在源头或当前契约测试中修复。累计已发布 83 个审查 issue，下一轮 PR #178 门禁将完成验证，真实发布尚未执行。

> 回归基础设施更新（2026-09-11）：旧 Playwright 套件仍访问 `/events`、`/public-dashboard`、`/quick-pitch`、`/note-frequency-converter` 及已删除的结果子页面，并含 40 个条件跳过，无法证明现有用户路径。现已收敛为 26 项当前开发模式流程，不使用条件跳过或真实用户写入；路由契约测试会拒绝再次引用不存在的页面。Chromium、Firefox 和 iPhone 12 WebKit 各 26/26 通过；桌面 WebKit 暴露并修复了原生 dialog 关闭后不回到菜单入口的差异，失败专项修复后 6/6 通过。另新增生产 PWA 桌面与 Pixel 5 共 4 项测试，真实等待 Service Worker 接管后断网直达并刷新 7 个公开/本地页面，Markdown 正文、Hz 双向转换及整页横向溢出检查通过。开发服务器不再作为 PWA 离线证据。

> 当前发布状态（2026-09-10）：用户已明确授权全部发布，29份独立草稿已建立为 #146—#174，5条补充均已发布；另向 #37 补充本地旧API配置导致403的已解决说明。35份远端正文已逐项核对一致，完整链接见[发布结果](frontend-issue-publication-results-2026-09-10.md)。下文“尚未发布/等待授权”及此前拒绝记录保留为历史，当前发布授权障碍已解除。累计已发布78个审查issue；应用修复、真机验证和性能验收仍未完成。

基线：master `c29a680`（2026-09-10），生产站点 `.app`，与现有 40 个 issue 对照。目标是将整个前端的易用性、性能和用户可感知异常转化为可复现、可验收的 issue；不把页面能打开等同于功能合格。

## 检查范围与证据规则

- 公共路由：首页、公共仪表板、文档列表/阅读、登录/注册/邮箱补充验证/密码重置、Hz-音符工具、VFS 预览、404。
- 登录路由：个人页、资料/头像、资料向导、事件新增/管理、快速基频、音阶练习、完整嗓音测试、API 测试页。
- 独立管理前端：入口、登录、列表、详情、配置及移动布局（不使用生产管理权限做写操作）。
- 横切检查：桌面快速导航、手机横竖屏/小屏、键盘与焦点、PWA 安装/更新/离线重启、断网与恢复、长请求/重试、初始加载与资源成本。
- 实际生产浏览器观察与代码定位交叉确认；需要登录或写操作时用隔离的本地生产构建和模拟 HTTP，不修改真实用户资料或提交真实事件。模拟复现会在 issue 中明确注明。
- 已修复的 #89、#46、#60、#58 等仅作历史关联，不因主题相同直接认定回归。已有 #34/#35/#38/#39/#67/#86 等应关联，避免重复泛化 issue。

## 当前已复现

| 编号 | 问题 | 证据 | 状态 |
|---|---|---|---|
| NAV-1 | 桌面没有常驻功能入口，工具菜单仅支持鼠标悬停，Enter 不展开 | 1440×900，Enter 后 aria-expanded=false；入口配置分散 | [#97](https://github.com/Ethanlita/vfs-tracker/issues/97) |
| NAV-2 | 手机侧栏底部无法滚动，关闭后仍截获焦点 | 390×667，aside 667 / scrollHeight 696；隐藏链接仍被 Tab 聚焦 | [#98](https://github.com/Ethanlita/vfs-tracker/issues/98) |
| NAV-3 | 访客头像点击不进入登录 | 实际点击前后 URL 不变 | [#99](https://github.com/Ethanlita/vfs-tracker/issues/99) |
| PWA-1 | 文档未缓存，离线冷启动失败 | controller=true，保留 CacheStorage，仅清 HTTP cache 后复现 | [#100](https://github.com/Ethanlita/vfs-tracker/issues/100) |
| UPLOAD-1 | 附件重试抛异常，同文件无法重选重试 | PUT 失败后点击重试，异常 reading '0'，无新请求 | [#101](https://github.com/Ethanlita/vfs-tracker/issues/101) |
| UPLOAD-2 | 头像资料保存失败仍显示新预览 | PUT /user 失败，img 仍为 data:image，刷新恢复旧头像 | [#102](https://github.com/Ethanlita/vfs-tracker/issues/102) |
| PWA-2 | 离线队列无账户归属，跨账户同步 | A 保存并退出后队列保留；B 用相同格式 fixture 同步，POST 身份为 B | [#103](https://github.com/Ethanlita/vfs-tracker/issues/103) |
| PWA-3 | 同步期间新增记录被删除 | 响应前队列 2 条，提交仅 1 条，成功后队列 null | [#104](https://github.com/Ethanlita/vfs-tracker/issues/104) |
| PWA-4 | 离线资料没有同步消费者 | 成功提示后联网刷新，无资料写请求，草稿仍残留 | [#105](https://github.com/Ethanlita/vfs-tracker/issues/105) |
| AUDIO-1 | 静音得到“完成 0 Hz”并可保存；手机标题与返回重叠 | 合成静音，实际离线条目 fundamentalFrequency=0；390px 截图 | [#106](https://github.com/Ethanlita/vfs-tracker/issues/106) |
| AUDIO-2 | 失败录音重试加入当前错误步骤 | MPT 失败→返回校准→重试，校准 3/2，含 2_1.wav | [#107](https://github.com/Ethanlita/vfs-tracker/issues/107) |
| AUDIO-3 | 报告查询重叠，查询重试再次分析 | GET 延迟 5.5 秒，最多 2 在途；重试后分析 POST 从 1 到 2 | [#108](https://github.com/Ethanlita/vfs-tracker/issues/108) |
| AUDIO-4 | 长流程刷新/导航后不能恢复，重复新建会话 | 完成录音到报告页，离开返回重置到说明；再次请求 sessions | [#109](https://github.com/Ethanlita/vfs-tracker/issues/109) |
| PWA-5 | 离线工具在会话过期后进入无法登录的登录页 | 合成有效会话 API 不可达可打开；令牌过期且断网刷新跳登录 | [#110](https://github.com/Ethanlita/vfs-tracker/issues/110) |
| PERF-1 | 首页加载无关音频引擎、大主包和大 favicon | 主 JS 1,956,940 B，World JS+WASM 681,836 B，icon 1,286,963 B；预缓存 8,415,725 B | [#111](https://github.com/Ethanlita/vfs-tracker/issues/111) |
| AUTH-1 | 登录输入框无持久标签，显隐按钮无名称 | 生产 DOM labels=0、无 aria-label；显隐按钮仅图标 | [#112](https://github.com/Ethanlita/vfs-tracker/issues/112) |
| PROFILE-1 | 资料确认页展示调试 JSON，管理页混入实现术语 | 数组长度=0、socials=[] 直接显示 | [#113](https://github.com/Ethanlita/vfs-tracker/issues/113) |
| ADMIN-1 | 列表重试成功仍错误；概览重试丢登录态 | 模拟首次失败后成功仍旧错误；概览重试跳 /admin/login | [#114](https://github.com/Ethanlita/vfs-tracker/issues/114) |
| ADMIN-2 | 搜索只查已加载用户且隐藏分页 | 第二页 target-user 搜索无请求/无结果；清搜索加载后才查到 | [#115](https://github.com/Ethanlita/vfs-tracker/issues/115) |
| DATA-1 | 个人历史超过 DynamoDB 一页后截断 | 两页模拟，handler 仅查 1 次、返回 page-one 且无游标 | [#116](https://github.com/Ethanlita/vfs-tracker/issues/116) |
| ADMIN-3 | 管理侧栏隐藏焦点、Escape/语义缺失 | 收起时 focus x=-240，Escape 后 aside 仍 x=0 | [#117](https://github.com/Ethanlita/vfs-tracker/issues/117) |
| ADMIN-4 | 配置非法数字仍成功保存 | 最大次数输入 -5、checkValidity=false 仍写入；实际限速函数空历史也受限 | [#118](https://github.com/Ethanlita/vfs-tracker/issues/118) |
| ADMIN-5 | 部分配置已生效但重置显示旧快照 | 服务端 48/10，重置 UI 24/10 且不能保存；重开才读回 48/10 | [#119](https://github.com/Ethanlita/vfs-tracker/issues/119) |
| AUTH-2 | 必须重置密码的登录响应被静默忽略 | 模拟 PasswordResetRequiredException，真实 SDK 转成 RESET_PASSWORD，页面无提示/跳转 | [#120](https://github.com/Ethanlita/vfs-tracker/issues/120) |
| AUTH-3 | 重置码过期后无重发入口 | 提示重新获取，但仅有再次确认重置/返回登录，旧发送成功提示仍在 | [#121](https://github.com/Ethanlita/vfs-tracker/issues/121) |
| AUTH-4 | 漏填当前密码时静默忽略改密并成功退出 | 请求只有 GetUser，新密码被清空；完整填写对照含 ChangePassword | [#122](https://github.com/Ethanlita/vfs-tracker/issues/122) |
| AUTH-5 | 临时密码挑战缺少必填属性输入 | requiredAttributes 含 nickname；页面只有密码框，提交缺 userAttributes.nickname | [#123](https://github.com/Ethanlita/vfs-tracker/issues/123) |
| PERF-2 | 中国大陆站主资源未压缩传输 | 同 JS .app encoded 583,330 B、.cn 1,956,940 B；独立 GET 无 Content-Encoding | [#124](https://github.com/Ethanlita/vfs-tracker/issues/124) |
| PROFILE-2 | 账户部分更新失败后显示过时状态 | 昵称写成功、改密失败；取消显示旧昵称，刷新才显示新值 | [#125](https://github.com/Ethanlita/vfs-tracker/issues/125) |
| EVENT-1 | 感受记录无法正常通过校验 | 页面 checkbox=0，却要求 sound/voicing，正常提交无请求 | [#126](https://github.com/Ethanlita/vfs-tracker/issues/126) |
| EVENT-2 | 提交失败无反馈，重试成功不收尾 | 有效自测 POST400 无错误UI；校验错误重试 POST200 无提示/清空/返回 | [#127](https://github.com/Ethanlita/vfs-tracker/issues/127) |
| EVENT-3 | 数字 0 被清空并作为字符串提交 | Jitter/Shimmer/HNR 输入 0 后 UI 为空、请求值为字符串；契约校验拒绝而数字 0 对照通过 | [#128](https://github.com/Ethanlita/vfs-tracker/issues/128) |
| EVENT-4 | 默认事件日期使用 UTC 日历日 | 东八区 9 月 10 日 01:30，日期框和请求都为 9 月 9 日 | [#129](https://github.com/Ethanlita/vfs-tracker/issues/129) |
| CHART-1 | 非基频指标错误依赖基频字段 | 合法 Jitter/Shimmer/HNR 记录无 F0 时均 N/A，只补 F0 后全部出现 | [#130](https://github.com/Ethanlita/vfs-tracker/issues/130) |
| CHART-2 | Shimmer 百分比被标成 dB | 表单/契约为 %，图表原始 3.2 显示为 3.2dB，未转换 | [#131](https://github.com/Ethanlita/vfs-tracker/issues/131) |
| ADMIN-6 | 旧分页响应混入新筛选并覆盖分页状态 | approved/done 各先得到1条，旧页返回后混入2条 pending/processing | [#132](https://github.com/Ethanlita/vfs-tracker/issues/132) |
| ADMIN-7 | 返回导航仅更新地址，未恢复筛选 | 全部50→筛选1→返回无status地址，仍1条且没有新请求 | [#133](https://github.com/Ethanlita/vfs-tracker/issues/133) |
| ADMIN-8 | 管理事件详情读取旧字段位置 | details.notes及fundamentalFrequency在JSON中，列表备注“-”，详情正文均无 | [#134](https://github.com/Ethanlita/vfs-tracker/issues/134) |
| ADMIN-9 | 音频读取失败被显示成无文件 | 模拟400与成功空列表显示相同“暂无音频文件”，无重试按钮 | [#135](https://github.com/Ethanlita/vfs-tracker/issues/135) |
| DOC-1 | 公开文档目录没有有效锚点 | 四个目录目标均不存在，点参考文献hash变更但scrollY仍0 | [#136](https://github.com/Ethanlita/vfs-tracker/issues/136) |
| TOOL-1 | 开发构建转换表单无响应 | 输入880/C5结果仍440/A4，Enter同样失效，琴键对照可更新 | [#137](https://github.com/Ethanlita/vfs-tracker/issues/137) |
| TOOL-2 | 越界音名与夹取频率拼成错误等式 | C0输入变A0但结果C0=27.50；C9输入变C8但结果C9=4186.01 | [#138](https://github.com/Ethanlita/vfs-tracker/issues/138) |
| PERF-3 | 手机分页仍挂载全量隐藏桌面时间轴 | 1000 条时可见10条、隐藏1000张卡片；生产4倍CPU降速翻页1339–1496ms | [#139](https://github.com/Ethanlita/vfs-tracker/issues/139) |
| EVENT-5 | 摘要未正确解释可选字段和契约数据 | 合法训练/练习缺内容显示undefined；旧感受与自定义姓名在详情正常、摘要错误 | [#140](https://github.com/Ethanlita/vfs-tracker/issues/140) |
| EVENT-6 | 删除在途可重复提交并关闭其他详情 | A删除未返回时打开B，A成功后B详情消失；相同ID可同时发2次DELETE | [#141](https://github.com/Ethanlita/vfs-tracker/issues/141) |
| PERF-4 | 搜索输入反复更新完整事件列表 | 1000行/13000元素；生产4倍CPU降速输入688–1118ms，期间0次新请求 | [#142](https://github.com/Ethanlita/vfs-tracker/issues/142) |
| DATE-1 | 有限历史范围包含未来记录 | 最近一周包含明天及一年后；图表最新240/均值230而过去记录为220 | [#143](https://github.com/Ethanlita/vfs-tracker/issues/143) |
| FONT-1 | 窄视口大字号表单越界、图表内容裁切 | 浏览器默认字号16→32px：390视口表单页宽601，图表范围按钮被隐藏 | [#144](https://github.com/Ethanlita/vfs-tracker/issues/144) |
| PWA-6 | 另一标签页接受更新会清空已延后更新的表单 | 两个真实构建、390/1440独立上下文，新增备注被动重载后为空、无提交/确认 | [#145](https://github.com/Ethanlita/vfs-tracker/issues/145) |

本地截图位于 `output/playwright/frontend-audit/`。不能将本地文件路径当作 GitHub 可公开访问的附件；issue 正文将包含完整文字复现和代码永久链接。

## 待核实线索

- 用户事件详情/删除、合法自测新增及五条其他事件最小提交路径已实际验证；个人时间轴和事件管理25/250/1000条规模实验已完成。可选字段组合、保存中编辑、日期精确边界与真机滚动性能仍需补充。
- 音阶练习已完成离线权限、耳机检测、180Hz 校准、首轮失败与结果；VFS 已完成离线录音和 RubberBand 处理。真人音质、多算法长音频、设备切换仍需补充。
- PWA 安装/升级/真实手机系统回收，以及 Safari 音频权限、后台恢复：不能用桌面 Chromium 模拟视口冒充真机验证。
- 性能已得到资源体积和固定慢网/CPU 的首页冷启动证据（见下方实验记录）；其他路由、桌面和真实用户 p75 仍需补充，不能把实验室数据当作全站验收。
- 管理用户/事件/报告详情与编辑需更多有数据 fixture；已验证各路由空态、用户两页搜索和失败恢复。

## 已排除的误判与可用路径

- `authenticatedGet` 会解包 `events`，MyPage 与事件 API 的数组包装匹配，未为此创建错误 issue。
- 当前所有 posts.json 文档路径符合现有校验；未发现由当前文件名触发的路径拒绝。
- PWA 预缓存包含 WorldJS 与 WASM，不能归因于 WASM 文件完全未缓存。
- 文档联网读取、公开工具/404/管理登录页初始布局在 390px 无横向溢出。
- Hz-音符转换器实际离线将 880 Hz 转为 A5；不代表其他音频或录音流程全部通过。
- VFS 预览实际离线录制 180Hz 合成音并完成 RubberBand 处理，不能笼统归因于 WASM 无法离线工作。
- 本地生产构建的 SW 新版本等待、更新提示、立即刷新激活均通过；“稍后提醒”后站内导航不重显，但完整重载会再次提示，不能断言更新入口完全失效。
- 删除测试最初误把模拟端点写成复数 `/events/`，校正为 `/event/{eventId}` 后成功验证列表 2→1 条；未为 harness 错误建立产品 issue。
- 嗓音向导使用合成音轨实际走完录音步骤到问卷和报告页；上传成功计数正常路径可用，失败与恢复缺陷见对应 issue。
- #89 邮箱验证在此前修复已做真实一次性邮箱验证；本轮不重复发真实注册邮件，认证其他失败分支仍需补充。
- 手动密码重置的密码不一致校验、验证码错误提示、模拟成功后返回登录均可用；过期码恢复与服务端强制重置入口的问题单独建立 #120/#121。
- 资料改密完整填写时会发出 ChangePassword，不能把 #122 描述成所有改密都不工作；该缺陷是未完整填写时误报成功。

## 日志问题与证据保管

向现有 [#39](https://github.com/Ethanlita/vfs-tracker/issues/39#issuecomment-5611003063) 补充了生产构建输出完整 ID token 的定位与合成账户复现。没有另建同主题 issue，也没有上传真实凭据。

截图、模拟脚本、issue 原文和创建结果位于 `output/playwright/frontend-audit/`；历史 `.review-pr-93/`、`.playwright-cli/` 不应整体提交或公开。公开 issue 使用文字复现和固定提交代码链接。资源大小均注明 decoded bytes，不声称是网络传输量。

## 修复与验收次序（仍在审查）

1. 数据归属与丢失：#103、#104、#105、#116；同时优先处理 #39 的凭据日志。
2. 上传与长流程恢复：#101、#102、#106、#107、#108、#109。
3. 导航、登录可访问性与后台恢复：#97–#99、#112–#115、#117。
4. PWA 完整可用性与性能：#100、#110、#111，配套真机安装/更新/离线重启矩阵。

任何分组完成都不能只凭单元测试放行：需在生产构建、桌面/手机、在线/离线/恢复网络、真实与模拟数据边界中验证用户操作结果。当前完成的是 49 项公开 issue、现有问题单的复现补充和 29 份待发布草稿，整个前端审查仍未结束。已另整理 [修复顺序与用户路径验收清单](frontend-repair-acceptance-2026-09-10.md)。

## 最终验收方式

每条 issue 至少给出：受影响场景、基线/环境、最短复现步骤、实际与期望结果、根因代码证据、修复验收清单与关联历史 issue。完成时补齐逐路由检查矩阵、已建 issue 链接和明确未能模拟的真实设备差异；不能仅凭现有测试通过声明整个前端无问题。

## 已确认但尚未发布的草稿

已将以下29份正文和5份已有issue补充整理为[待发布问题审阅清单](frontend-issue-publication-review-2026-09-10.md)，逐项列出建议顺序、关联问题、复现摘要和明确发布范围。清单整理与结构检查不代表已获准发布或问题已修复。

以下 29 项均已有具体复现、代码定位和验收要求。发布前五项的工具调用被自动审批整体拒绝，理由为这批包含医疗报告访问权限相关发现，缺少对具体内容公开披露的授权；没有绕过拒绝再次发布。第八项音色加载问题独立发布时再次被自动审批拒绝，理由是未明确获准向该GitHub目的地公开本项代码线索、复现细节和审查结果。其余项在验证后沿用该公开披露审批边界保留本地，尚未尝试发布，不将它们写成新的工具拒绝结果。

| 草稿 | 实际证据 |
|---|---|
| [录音暂停仍计时、15/60 秒不一致](../output/playwright/frontend-audit/issues/recorder-pause.md) | 生产页合成录音 0.5 秒后暂停，等约 16 秒自动完成 |
| [音阶提前结束生成未测音域并继续采集](../output/playwright/frontend-audit/issues/scale-end-result.md) | 首轮失败无通过，结果仍为 E3–F#3；结果页输入改变后 rms 0.070→0.142 |
| [事件管理承诺编辑却无入口](../output/playwright/frontend-audit/issues/event-edit-missing.md) | 页面明确提示可编辑，列表/详情仅查看和删除；无更新 API |
| [事件详情与公开档案缺少弹层键盘交互](../output/playwright/frontend-audit/issues/event-dialog-a11y.md) | 事件详情无dialog语义/关闭名称；公开档案已有语义却仍能Tab/Enter操作背景用户，Escape不关闭且关闭不还原焦点；双构建、双宽度复现 |
| [医院报告说明与管理员预览不一致](../output/playwright/frontend-audit/issues/hospital-privacy-copy.md) | 上传承诺无人看到，合成管理事件可生成附件链接；未读真实报告，也不声称已有泄露 |
| [更换邮箱不能完成属性验证](../output/playwright/frontend-audit/issues/profile-email-verification.md) | 返回待验证码确认后没有输入入口；重发调用注册 ResendConfirmationCode 并失败；区别于 #89 |
| [管理员 PIN 解锁网络故障删除保存信息](../output/playwright/frontend-audit/issues/admin-pin-network-loss.md) | 错误 PIN 保留密文；正确 PIN 遇 STS 网络故障清除密文，联网后提示找不到保存的凭证 |
| [音色慢加载重复请求并集中补播](../output/playwright/frontend-audit/issues/note-soundfont-pending-playback.md) | 间隔两秒的3次按键产生3个请求；生产失败对照中三个振荡器在1ms内补播，首键已等待约6秒；开发成功对照同样积压 |
| [保存或资料刷新覆盖未提交编辑](../output/playwright/frontend-audit/issues/save-pending-edits-lost.md) | 事件保存清空后续备注、资料保存回填旧编辑；头像独立更新成功也覆盖未提交名称/公开选项/社交账号；双构建一致 |
| [离开新增页后迟到成功响应仍强制跳转](../output/playwright/frontend-audit/issues/event-save-late-navigation.md) | 请求等待时先回首页；生产等待3秒仍是首页，放行成功后跳/mypage；开发同样复现 |
| [窄屏文档长标识符撑宽整页](../output/playwright/frontend-audit/issues/docs-narrow-inline-overflow.md) | 13篇×2宽度×2构建：默认16px字号、320视口下数据查询指南宽365、更新记录宽370；文字右端在屏幕外 |
| [公开资料请求失败后整个区域隐藏](../output/playwright/frontend-audit/issues/public-profile-error-hidden.md) | 资料等待/400时无资料区、错误提示及重试；重新打开200恢复；生产390px和开发1440px一致 |
| [头像及附件选择入口无法通过键盘到达](../output/playwright/frontend-audit/issues/upload-keyboard-entry.md) | 头像从编辑账户Tab直达编辑资料；附件从备注Tab直达提交；input为display:none，label无焦点；鼠标可触发filechooser，双构建一致 |
| [上传中提交事件遗漏已选附件](../output/playwright/frontend-audit/issues/event-submit-pending-attachment.md) | 文件仍上传时事件提交可用，POST无attachments且返回个人页；迟到上传完成不再提交事件；等待上传完成后对照正确包含附件，双构建一致 |
| [附件旧行按索引移除另一文件](../output/playwright/frontend-audit/issues/attachment-remove-stale-index.md) | 移除A后计数1但仍显示A/B；慢链接期间再次点可见A，B也被移除，最终POST无附件；正常更新后对照保留B，双构建一致 |
| [附件与报告链接失败后原始key变成错误链接](../output/playwright/frontend-audit/issues/attachment-link-failure.md) | 新增附件与报告PDF点击均进入本站“页面不存在”，图表破图且无局部重试；报告返回上一步再进入可恢复且无需再分析；双构建已验证 |
| [首次资料设置丢失登录返回目标](../output/playwright/frontend-audit/issues/login-return-profile-setup.md) | 普通登录保留事件管理路径及查询参数；首次设置跳过/完成后均进入个人页，资料POST已成功；双构建6条路径已验证 |
| [个人历史读取失败仍显示没有记录](../output/playwright/frontend-audit/issues/personal-history-failure-empty-state.md) | 顶部有错误和重试，下方仍提示暂无事件/添加第一个事件；两页重试恢复正常，事件管理失败时无矛盾空态；双构建对照 |
| [异步录音流程取消与重开后资源归属错误](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md) | 快速测试迟到授权仍分析、旧失败关闭新测试；通用Recorder授权等待重复开始残留录音，转换等待重开中断新录音并残留旧音轨；双构建验证 |
| [录音转WAV后临时上下文未关闭](../output/playwright/frontend-audit/issues/recorder-wav-context-cleanup.md) | 连续3次完成及GC后仍3个running；解码/重采样失败、转换中离开也残留上下文；正常放弃完整清理，双构建验证 |
| [配置读取失败后可编辑却无法保存或重试](../output/playwright/frontend-audit/issues/admin-rate-read-recovery.md) | SSM读取400后显示24/10默认值，修改36但保存/重置禁用，无重试；侧栏离开再进入读回48/3/72/5并可保存，双构建验证 |
| [快速基频成功后仍可重复保存](../output/playwright/frontend-audit/issues/quick-f0-repeat-save.md) | 成功后跳转前再次点击，在线两次POST、离线队列两条；在途保存按钮禁用对照正常，双构建验证 |
| [离线队列读取失败被误报为空](../output/playwright/frontend-audit/issues/offline-queue-read-error.md) | 有效队列读取SecurityError及损坏格式均提示没有记录，原始数据仍在；解除读取限制重入恢复数量，混合坏条目不阻塞有效同步，双构建验证 |
| [离线同步清理失败后重发已成功记录](../output/playwright/frontend-audit/issues/offline-sync-cleanup-error.md) | 全成功removeItem失败或部分成功setItem失败，无本地错误提示，队列保留成功项并在再次同步重发；正常清理对照不重复，双构建验证 |
| [社交账号编辑行撑宽手机页面](../output/playwright/frontend-audit/issues/profile-social-mobile-overflow.md) | 320/390px页面均扩到475px，添加按钮在视口外；1440px对照正常，取消/失败重试/保存删除及刷新均通过 |
| [资料与头像保存的旧快照覆盖已确认修改](../output/playwright/frontend-audit/issues/profile-concurrent-save-overwrite.md) | 同页请求乱序及跨标签页严格顺序保存均可覆盖已保存名称/公开选项或清掉头像；刷新仍错误，第二页先刷新对照正常；双构建验证 |
| [嗓音转换失败后把WebM当作WAV上传](../output/playwright/frontend-audit/issues/voice-conversion-failure-format.md) | 解码/重采样失败后首段字节为WebM，文件名和PUT类型仍为WAV；计入完成且可到下一步，无错误提示；双构建6路径12次上传 |
| [管理用户保存旧响应污染当前详情](../output/playwright/frontend-audit/issues/admin-user-save-stale-selection.md) | A保存成功把B详情切回A；A失败把B开启状态误显示为关闭且无提示；原用户成功/失败重试正常，双构建8路径12次模拟写入 |
| [管理用户最近事件混入其他用户记录](../output/playwright/frontend-audit/issues/admin-user-events-stale-data.md) | A迟到查询覆盖B；B读取失败保留A事件，首次失败误示空态且无重试；正常切换及恢复重开对照通过，双构建8路径18次查询 |

另有5份已有issue的待发布补充，不计入29份独立草稿：[#102头像竞态与损坏图片](../output/playwright/frontend-audit/avatar-race-issue-102-comment.md)、[#105离线资料存储异常](../output/playwright/frontend-audit/profile-storage-issue-105-comment.md)、[#119配置保存跨页面交错](../output/playwright/frontend-audit/admin-save-navigation-issue-119-comment.md)、[#127类型切换后旧重试绕过必填](../output/playwright/frontend-audit/event-type-issue-127-comment.md)、[#67算法音量与饱和测量](../output/playwright/frontend-audit/audio-level-issue-67-comment.md)。

## 当前路由覆盖矩阵

“检查”只涵盖下列行为，不代表全部字段组合、设备与异常场景已合格。

| 路由/功能 | 已检查 | 未完成/后续 |
|---|---|---|
| 首页、Header/Sidebar | 生产桌面1440×900、手机390×667，点击/Tab/Escape、资源清单；首页主内容默认字号16/32px对照 | #97–#99、#111；真机、系统字号、大字号菜单操作 |
| /dashboard | 沿用 #96 已合并的分页顺序验证（前轮 26 组件+8 E2E）；资料等待/失败隐藏及档案键盘操作背景已复现；明细失败重试和切换用户迟到响应保护通过开发/生产对照 | 全站真机和固定性能基线；资料错误反馈及弹层焦点修复后验收 |
| /posts、/docs | 双构建真实正文迟到响应/历史导航、正文与目录500重试、非法/缺失参数；13篇320/390宽度共52组；冷HTTP缓存离线、长文锚点 | #100/#136、窄屏正文草稿；目录缓存迁移、读屏、真机阅读 |
| /login、注册/验证/重置 | 生产初始/注册、字段标签；#89之前真实邮箱验证；模拟重置/临时改密；独立访客16/32px字号、键盘空密码校验与显隐 | #112、#120/#121/#123；MFA是否启用、临时挑战过期恢复 |
| /mypage | 模拟账户、同步并发/身份切换；队列读取异常及清理失败重发、恢复和正常对照；独立指标/单位；25/250/1000条时间轴；未来日期；历史400/慢重试/200数据与空态 | #103–#105、#116、#130/#131/#139/#143；历史失败空态、队列读取与同步清理草稿；复杂指标组合、后台刷新失败 |
| /profile-manager | 头像保存/竞态/损坏图片/键盘与类型大小校验；邮箱及改密恢复；未提交资料覆盖、同页并发及跨标签页顺序保存覆盖已确认字段，先刷新对照正常；社交流程正常及手机溢出 | #102、#113、#122、#125、邮箱/未提交编辑/上传键盘/社交布局/旧快照保存草稿；跨设备与部分失败、原生文件选择器取消及更多图片格式 |
| /profile-setup-wizard | 三步确认、离线完成、联网刷新；双构建登录后跳过/完成丢失原目标，普通登录回跳对照正常；离线QuotaExceededError/SecurityError与成功写入分别覆盖完成/跳过，共12条路径 | #105、#113、登录返回目标草稿；真实设备存储限制、向导刷新后目标恢复 |
| /add-event | 各类型入口、附件失败/键盘入口；上传在途提交遗漏附件、慢链接期间旧行误移除、链接失败导航本站错误路径及正常对照；双构建六条表单、API400、感受记录校验/重试、数字0、当地日期；保存中修改备注/离开页面后的迟到成功；类型切换清空详情而保留日期/附件、在途附件完成、旧错误重试绕过新类型原生必填 | #101、#126–#129、报告说明/保存生命周期/附件提交与移除及链接草稿；#127本地补充；更多可选字段、多附件同时上传与增删 |
| /event-manager | 8条合法边界记录；组合筛选/排序/宽度切换；摘要/详情；延迟删除与恢复；25/250/1000条搜索性能；1000条首尾滚动/详情；过去/未来日期；开发与生产 | #116/#140–#143、编辑/弹窗草稿；日期精确边界/真机滚动帧率 |
| /quick-f0-test | 静音/离线保存、过期会话离线重启；双构建写入异常恢复、成功后重复在线提交/离线入队及在途禁用对照；拒绝恢复、正常停止清理、旧授权干扰 | #106、#110、迟到授权与重复保存草稿；长录制/设备切换、原生授权弹窗及实体设备 |
| /scale-practice | 离线权限→耳机检测→180Hz 校准→首轮失败→结果及继续采集 | 音阶草稿；真人上下行/推荐失败 |
| /voice-test | 合成音轨完成录音步骤到问卷/报告；上传跨步骤、慢轮询、导航恢复；双构建12段录音后的报告链接失败及免重新分析恢复；解码/重采样失败后WebM冒充WAV上传且计入完成，正常PCM WAV字节对照 | #107–#109、报告链接与D27格式失败草稿；真设备、实际后端格式兼容、转换失败恢复、真实报告多图与文件过期 |
| /note-frequency-tool | 生产手机布局/离线转换；正常/非法/越界输入；开发Enter失效；默认字号16/32px双构建；键盘与88键遍历；音色慢成功/失败、在途导航关闭与返回、断网和重连 | #137/#138/#144、音色积压草稿；物理播放、读屏、多音色/真实设备 |
| /vfs-effect-preview | 生产SW离线导航、180Hz录音及三算法输出WAV、重连请求恢复；暂停计时；双构建迟到授权及重复开始残留；转换期间重开中断新录音且旧音轨残留；连续3次转换、失败及离开后上下文未关闭；正常放弃、单次转换中离开清理音轨及弱引用/GC对照 | 暂停、异步录音生命周期及转码上下文草稿；三算法真实音质与长音频、物理播放、完整向导相同资源路径 |
| /api-test | 模拟登录后路由与按钮可达，手机无横向溢出 | 内部诊断入口边界，不执行真实批量写 |
| 404 | 生产未知路由返回 404 内容与返回入口 | PWA/真机直接导航 |
| /admin/login | 生产布局、模拟 STS 登录、不记住会话与重试退出；PIN 保存/错误 PIN/正确 PIN 断网及联网恢复 | #114、PIN 草稿；明确凭证拒绝/损坏存储 |
| /admin | 模拟统计空态/失败重试 | #114；大表统计开销 |
| /admin/users | 两页用户、搜索、失败恢复、手机布局；权限旧成功/失败污染选择及开关，原用户保存重试对照；事件旧响应及新读取失败混入其他用户记录、首次失败空态，正常与恢复重开对照 | #115、D28保存、D29读取归属；保存关闭重开/离开页面、头像异步归属与真实服务对照 |
| /admin/events | 空态、合成医院事件/附件详情；52条分页竞态、筛选/返回；合法自测备注/基频与JSON对照、详情关闭 | #132–#134；报告说明草稿；其他类型详情、审核错误恢复、搜索 |
| /admin/tests | 空态、手机布局；52条分页竞态、筛选/返回；详情音频失败/空响应、合成音频播放/暂停/结束与下载失败、关闭和Escape | #132/#133/#135；多指标详情、UUID搜索分页、物理播放与移动端音频 |
| /admin/settings/rate-limit | 空参数响应、手机布局、负数保存、部分失败、重置及重新进入读回；双构建首次读取400及恢复对照；同页首轮成功/失败保留新编辑；离开再返回后新旧保存交错导致旧值覆盖，完成后返回读回正确 | #118/#119、读取失败恢复草稿、#119本地补充；跨标签页/管理员并发及更多网络异常 |
| 管理 Sidebar | 隐藏焦点、Escape、语义 | #117；长内容/横屏 |
| PWA 生命周期 | 真SW控制、断网/恢复、过期会话、草稿；受控更新及两个真实提交的80项预缓存、离线激活、20/5分页版本核对；双标签页未提交表单；清空HTTP缓存后SW离线进入效果预览、三算法完成及联网恢复 | #145；跨数据结构版本迁移、安装/系统回收及iOS/Android真机；功能音质不由离线可运行替代 |

## 本轮补充：固定条件冷启动与 PWA 安装诊断

2026-09-10，公开生产 `.app` 首页，HeadlessChrome 152，Windows；390×667 视口，CDP CPU 降速 4 倍，下行 200,000 B/s、上行 93,750 B/s、延迟 150ms。每次使用全新浏览器/上下文，禁用 HTTP 缓存并绕过 Service Worker 响应；真实页面仍可注册自己的 SW。页面导航 workerStart=0，主 JS 等同源资源 transferSize 非零，排除了此前缓存命中的问题。

三次 FCP 为 5,984 / 5,840 / 5,844 ms，观察窗口内最后一次 LCP 候选为 6,884 / 6,552 / 6,564 ms。主包压缩正文 583,330 B、解码 1,956,940 B，下载完成约 5.0–5.1 秒；最长主线程任务 643 / 612 / 615 ms。favicon 实际传输 1,287,263 B，约 13 秒才下载完成。没有交互样本，不能报告 INP；LCP 是页面观察窗口内的实验室候选，不是真实用户 p75，也不能把 Windows 视口模拟当作实体手机。

复测脚本：[cold-home-measurement.js](../output/playwright/frontend-audit/cold-home-measurement.js)。原始结果：[第二次](../output/playwright/frontend-audit/cold-home-run2.txt)、[第三次](../output/playwright/frontend-audit/cold-home-run3.txt)。截图：[home-cold-mobile.png](../output/playwright/frontend-audit/home-cold-mobile.png)。这补强现有 #111，不另建重复性能 issue。

生产 manifest 读取成功，浏览器解析 errors=[]，实际包含 start_url=/、scope=/、display=standalone 和 192/512 图标。安装诊断仅返回 `in-incognito`，这是隔离测试上下文限制，不能认定为产品安装缺陷；SW registration 的 active 状态为 activated。本阶段未验证实体设备安装与跨版本更新；后续两个真实构建的更新证据见“真实构建更新与跨标签页草稿”，实体设备仍未验证。

三次公开首页测量已补充到 [#111 评论](https://github.com/Ethanlita/vfs-tracker/issues/111#issuecomment-5611283270)。该评论仅包含公开首页性能实验，与等待具体披露授权的 7 份草稿分开处理，未重新提交被拒绝的发布操作。

## 本轮补充：配置保存与受控 SW 更新

- #118：正常填写输入框 `-5`，浏览器原生 validity 为 false，页面仍发送写请求并提示成功；直接调用仓库限速函数验证了负上限使空历史也被限速。未写入真实 SSM。
- #119：模拟部分保存失败后，实际配置 48/10，但点击重置显示 24/10 并禁用保存；重新进入后恢复显示 48/10。四项参数全部有请求，即使其中两项未修改。
- `admin-rate-partial-save.png` 在切换视口的侧栏动画中截取，不能用它证明稳定的手机布局或配置完整可见；配置结论来自控件值、模拟写入状态和重新读回数据。

SW 测试使用 [pwa-update-server.mjs](../output/playwright/frontend-audit/pwa-update-server.mjs) 在 127.0.0.1:3103 提供现有 dist，给 SW 附加一个只返回版本号的消息探针；未改源码或 dist。通过本地测试接口改变 SW 字节，显式调用 registration.update()。

1. v1 激活后刷新获得 controller；v2 安装后处于 waiting=installed，应用显示更新提示。
2. 点击“稍后提醒”，站内进入 /posts 并再次 update() 时提示仍隐藏；完整 reload 后提示再次出现。
3. 点击“立即刷新”，active 的探针版本变为 2，waiting 消失。
4. v3 已安装等待后，在网络阻断状态点击立即刷新，探针版本变为 3，首页可渲染。额外对照确认 setOffline(true) 时未缓存 fetch 失败，SW 导航刷新后未缓存 fetch 仍失败；但 Chromium 152 此时 navigator.onLine 从 false 变成 true。此处网络不可用由请求失败证明，不用 onLine 值宣称真实系统网络状态。

上述证明的是现有构建的更新通知/激活流程；没有替换真实业务资产、改变缓存 schema，不能代替跨发布版本兼容或实体 PWA 安装测试。对依赖 navigator.onLine 的分支，后续实验必须同时核对网络请求与属性值，避免把浏览器模拟差异归因于应用。

## 本轮补充：认证异常恢复

新增 #120–#123 使用的是现有生产构建、真实前端 SDK 与浏览器拦截的合成服务响应。密码、邮箱、会话标识均为虚构；没有发送真实邮件、验证真实 SRP 签名或改变真实账号。记录请求名及字段名即可重现缺陷，不需要公开认证响应原文或浏览器完整日志。

临时密码缺失属性契约已对照 [AWS RespondToAuthChallenge 文档](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_RespondToAuthChallenge.html)，且实际请求仅包含 NEW_PASSWORD、USERNAME；缺少服务要求的 nickname。手机视口截图 [auth-force-missing-attribute.png](../output/playwright/frontend-audit/auth-force-missing-attribute.png) 已检查，错误可见但没有对应补填控件。该条件性复现不能用于声称所有现存账户都缺少属性。

## 本轮补充：尺寸覆盖、桌面对照与中国大陆站

使用 [small-screen-routes.js](../output/playwright/frontend-audit/small-screen-routes.js) 检查首页、dashboard、posts、音符工具、VFS 预览、登录和 404 的初始布局；320×568、667×375 共 14 个组合 document.scrollWidth 均未超过视口。结果在 [small-screen-routes.txt](../output/playwright/frontend-audit/small-screen-routes.txt)。这只证明这些初始状态没有整页横向溢出，不代表每条完整数据路径都通过。

音符工具的键盘是预期的独立横向滚动区域：320px 下容器 clientWidth=238、scrollWidth=2392，scrollLeft 可到 2154，overflowX=auto，不为此建立误报。320px 登录页截图已检查，内容可正常纵向滚动。

横屏菜单另验证：dialog 高 375px、scrollHeight=704，nav clientHeight/scrollHeight 同为 489；登录按钮 top=640、bottom=688，body overflow=hidden。已补充 [#98 评论](https://github.com/Ethanlita/vfs-tracker/issues/98#issuecomment-5611472107)，截图 [sidebar-landscape-667.png](../output/playwright/frontend-audit/sidebar-landscape-667.png)。

桌面对照：1440×900、CPU 不降速、下行 10 Mbps、CDP 延迟 40ms、全新上下文；FCP=1720ms、最后 LCP 候选=1896ms、最长任务109ms。已补充 [#111 评论](https://github.com/Ethanlita/vfs-tracker/issues/111#issuecomment-5611472944)，原始结果 [cold-home-desktop.txt](../output/playwright/frontend-audit/cold-home-desktop.txt)。桌面单样本较快，不能用慢网手机样本概括所有设备。

`.cn` 在相同慢条件脚本下得到 FCP=58736ms、最后 LCP 候选=59696ms；主 JS encoded/decoded 均为1,956,940 B，CSS 均为445,211 B。浏览器 GET、携带 Accept-Encoding 的 HEAD 与独立 curl GET 交叉核对：`.cn` 无 Content-Encoding，独立 GET 完整收到1,956,940 B；`.app` 同 JS 有 gzip，正文583,330 B。已建立 #124。原始浏览器结果 [cold-home-cn.txt](../output/playwright/frontend-audit/cold-home-cn.txt)；未将含临时站点 Cookie 的完整响应头写入问题单。当前位置不是真实大陆用户网络，压缩缺失确定，但不能把约一分钟样本直接归因于某一级 CDN 或推广到所有用户。

## 本轮补充：现有单元测试基线与提交失败路径

在当前未修改应用代码的 master 上运行现有单元测试：44 个文件、883 项测试全部通过，用时约 90 秒。启动时曾因沙箱禁止 esbuild 子进程而失败；允许正常创建测试子进程后执行完成，该启动错误不是应用缺陷。结果保存在 [unit-baseline.log](../output/playwright/frontend-audit/unit-baseline.log)。日志含测试调试输出，不作为公开附件整体上传。

本轮新增 #125–#127 均由本地生产构建、合成账户与模拟服务复现。昵称/改密的独立请求出现部分成功后未重新读回；感受记录正文已填却因不存在的 checkbox 被拦；useAsync 捕获 API 异常并 resolve undefined，而 EventForm 只渲染另一份 errorState，导致有效自测被400拒绝时无可见错误。重试直接 execute()，又跳过校验及成功回调。这些结论依赖请求和页面实际结果，不因单元测试绿色而忽略。

EventForm 现有测试中的感受记录覆盖只检查切换后字段出现；“错误处理”分组中存在仅模拟成功响应并断言 API 被调用的测试。应补足用户操作链，不能用现有测试名称宣称已覆盖失败恢复。

## 本轮补充：事件提交与输入边界

使用 [event-form-paths.js](../output/playwright/frontend-audit/event-form-paths.js) 在本地生产构建、390×667 视口完成六次模拟提交。医院检测、嗓音训练、自我练习（无指导）、预设手术、自定义手术五条路径各发送一次请求，随后返回 `/mypage`。请求补齐仓库 minimalSelfTest fixture 的元数据后，通过 `eventSchemaPrivate` 校验。它们证明前端输入和成功收尾路径可用，不代表真实服务已持久化数据，也没有测试这些路径的全部可选字段。

自测的零值用例则暴露 #128：三个数字输入填 0 后立即变为空字符串，实际请求也携带空字符串。使用 [validate-event-paths.mjs](../output/playwright/frontend-audit/validate-event-paths.mjs) 校验捕获请求，三个数字字段均失败；将这些字段改为数字 0 的对照通过。结果见 [提交记录](../output/playwright/frontend-audit/event-form-paths-result.txt) 和 [契约对照](../output/playwright/frontend-audit/event-form-schema-results.json)。本实验用模拟成功响应观察前端完成流程，不声称真实后端接受了不合契约的数据。

#129 使用隔离浏览器时区 Asia/Shanghai，固定时刻 2026-09-09T17:30Z；实际当地日期为 9 月 10 日 01:30，表单默认 9 月 9 日，提交也为 2026-09-09T00:00:00.000Z。见 [结果](../output/playwright/frontend-audit/event-date-timezone-result.txt) 和已查看的 [手机截图](../output/playwright/frontend-audit/event-date-timezone.png)。尝试用第二个 CDP session 切换负时区时被浏览器拒绝，未将该未完成实验当作产品缺陷或声称覆盖负时区；已恢复浏览器时钟。代码初始化和重置均使用 UTC 截日，后续修复应覆盖两个方向的时区边界。

## 本轮补充：个人图表与多页历史

使用 [build-chart-harness.mjs](../output/playwright/frontend-audit/build-chart-harness.mjs) 复用 minimalSelfTest，构造只有 jitter=1.25、shimmer=3.2、hnr=0 的事件，及仅增加 fundamentalFrequency=180 的对照。两者先通过私有事件契约。390×667 的既有浏览器和未安装时钟模拟的全新 1280×720 浏览器均复现 #130/#131。独立结果见 [chart-results-fresh.txt](../output/playwright/frontend-audit/chart-results-fresh.txt)，截图 [无基频时空态](../output/playwright/frontend-audit/chart-missing-f0.png) 和 [Shimmer 单位](../output/playwright/frontend-audit/chart-shimmer-unit.png) 已查看。

没有 F0 时三个其他指标均 N/A；只补 F0 后分别出现 1.25、3.2、0。HNR 的数值0在图表中可以正常显示，不能把输入表单 #128 的问题泛化成全站都丢0。Shimmer 的 % 契约与 dB 图表标签直接冲突，未进行单位换算。已有 #71 处理的是原始 JSON 详情展示，与这两个图表问题不同。

早先安装过时钟模拟的浏览器在 innerText 中保留了退出动画的空态文本，但截图并未显示空态覆盖数据；新浏览器稳定结果也没有该文本。不为此建立空态遮挡误报。元素截图顶部出现固定导航是截图滚动位置的影响，不用于证明图表容器自身重叠。

[build-history-harness.mjs](../output/playwright/frontend-audit/build-history-harness.mjs) 生成25条经契约校验的自测事件：8月16日至9月9日，基频176至200Hz。390×667下，“全部”最新200、平均188.00；9月10日测试时“1周”纳入9月4日至9日，最新200、平均197.50，符合当前按时刻截断的筛选规则。手机时间轴三页10/10/5条，序号025至001全部可达且不重复，末页下一页禁用，整页无横向溢出。结果见 [history-results.txt](../output/playwright/frontend-audit/history-results.txt)。这证明25条数据的功能行为，不是大数据性能验收或后端跨页完整性证明；#116仍独立存在。

## 本轮补充：管理筛选与响应顺序

在原有合成管理员会话（1440×900）中，用 [build-admin-event-race.mjs](../output/playwright/frontend-audit/build-admin-event-race.mjs) 构造52条通过事件契约的记录。前50条中49条pending、1条approved，后2条pending。全部查询返回前50条及游标；approved筛选同一页只返回1条，ScannedCount仍为50并保留同一游标。旧第二页请求被手动暂缓，先切approved并得到1条，再释放旧响应，当前表格即出现1条approved和2条pending。新筛选的分页状态也被旧响应覆盖。见 [事件结果](../output/playwright/frontend-audit/admin-filter-race-result.txt) 和已查看的 [截图](../output/playwright/frontend-audit/admin-filter-race.png)。

[build-admin-test-race.mjs](../output/playwright/frontend-audit/build-admin-test-race.mjs) 在嗓音测试列表用processing/done重复相同操作，结果相同。会话样本通过testSessionSchema；初次复用实验曾误将userId也放进测试表游标，随后对照IaC确认测试表仅sessionId为主键，校正并重新执行，保存的 [测试结果](../output/playwright/frontend-audit/admin-test-filter-race-result.txt) 为校正后输出。未把模拟器错误当作产品缺陷。

在没有在途请求的条件下，两页分别操作“全部50条→已通过/已完成1条→浏览器返回”。URL回到无status参数，表格仍1条，且没有新查询。见 [事件返回结果](../output/playwright/frontend-audit/admin-filter-back-result.txt)、[测试返回结果](../output/playwright/frontend-audit/admin-test-filter-back-result.txt)。因此分别创建#132（响应竞态）与#133（URL/状态不同步），不与#114失败恢复混为一谈。本轮直接验证status；type/q虽有类似实现，仍须补操作覆盖。

额外线索“合成事件details.notes含备注，表格却显示-”已在下一轮完成详情对照并建立#134，见下文。上述测试只拦截DynamoDB响应，没有真实云端读写，也未尝试审核真实记录。

## 本轮补充：管理详情的数据字段与音频错误

[build-admin-detail-harness.mjs](../output/playwright/frontend-audit/build-admin-detail-harness.mjs) 复用minimalSelfTest，将details设为notes=“这是隔离测试备注”、fundamentalFrequency=180、jitter=1.25，先通过事件契约。1440×900本地生产构建中，管理表格备注为“-”，详情正文没有备注和测试结果；展开原始JSON后两项均存在，证明是展示字段不匹配而非数据丢失。正文读取event.note及event.testResult，与当前details契约不一致。见 [结果](../output/playwright/frontend-audit/admin-event-details-result.txt)、已查看的 [截图](../output/playwright/frontend-audit/admin-event-details.png)，对应#134。合成用户查询返回空是实验设置，不能据此报告用户数据缺失；详情关闭按钮可用。

测试详情用经testSessionSchema验证的已完成合成会话，拦截S3 ListObjectsV2：HTTP400/InvalidRequest失败后显示“音频文件(0)”“暂无音频文件”，无重试按钮；关闭后改为HTTP200有效空ListBucketResult再打开，界面文字完全相同。结果见 [失败记录](../output/playwright/frontend-audit/admin-audio-failure-result.txt)、[空响应对照](../output/playwright/frontend-audit/admin-audio-empty-control.txt) 与已查看的 [截图](../output/playwright/frontend-audit/admin-audio-failure.png)，对应#135。getTestSessionFiles在catch中返回[]，详情无法区分两种结果。关闭重开确实再次发出请求，Escape也可关闭；不能说完全没有绕行恢复方式，但缺少明确错误和重试。未读取真实音频，也不把模拟400当成真实账户权限问题。成功音频播放仍未在这轮验证。

## 本轮补充：播放器正常路径与开发构建对照

[build-audio-playback-harness.mjs](../output/playwright/frontend-audit/build-audio-playback-harness.mjs) 创建完全合成的2秒180Hz单声道PCM WAV，并复用已通过契约的会话。模拟文件列表成功且音频下载成功后，浏览器duration=2；播放paused=false且时间前进，暂停paused=true，恢复后ended=true/currentTime=2。随后令文件列表成功但音频GET失败，详情显示“音频文件(1)”和“音频加载失败”，audio元素被移除，重试按钮0。此路径有错误提示，与#135正文中列表读取失败显示为空不同，已补充 [#135评论](https://github.com/Ethanlita/vfs-tracker/issues/135#issuecomment-5611898291)。原始结果 [admin-audio-playback-result.txt](../output/playwright/frontend-audit/admin-audio-playback-result.txt)，[失败截图](../output/playwright/frontend-audit/admin-audio-download-failure.png) 已查看。不能用浏览器合成音播放证明实体设备音质或移动系统后台播放。

开发运行入口另行核实：当前main.jsx缺必需配置会直接显示配置错误并停止，env.js无isProductionReady，README也明确已移除运行时模拟模式。因此旧AGENTS说明中的自动开发模式不是当前代码行为；这不是本轮发现的终端用户回归，不为已明确移除的模式重新建立缺陷单。

使用 [start-dev-audit.mjs](../output/playwright/frontend-audit/start-dev-audit.mjs) 启动127.0.0.1:3104开发服务器，隔离envDir且只注入五个虚构配置，防止加载真实账户环境文件。沿用生产构建的合成登录与API拦截，六条表单操作结果一致：数字0仍丢为字符串，五条其他类型正常提交均成功返回个人页，并通过同一契约。见 [开发提交记录](../output/playwright/frontend-audit/event-form-paths-dev-result.txt)、[开发契约校验](../output/playwright/frontend-audit/event-form-dev-schema-results.json)，已补充 [#128评论](https://github.com/Ethanlita/vfs-tracker/issues/128#issuecomment-5611904146)。本轮补强既有issue，没有增加编号，总数仍39；这六条对照不代表其余全部功能已完成开发/生产双模式验收。

## 本轮补充：文档锚点与音符输入边界

生产公开文章《基频和其他参数的意义》中，四个目录锚点目标均不存在，16个h2/h3的id均为空。1440×900下点击“参考文献”，hash变化但scrollY前后均0。390px下document.scrollWidth=390，没有为该文档制造横向溢出误报。见 [锚点结果](../output/playwright/frontend-audit/docs-anchor-result.txt)、已查看的 [截图](../output/playwright/frontend-audit/docs-anchor-desktop.png)，对应#136。

音符工具开发构建输入880后仍显示440Hz/A4，输入C5后仍显示A4=440；点击C5白键下部可更新为523.25Hz，随后输入220按Enter仍保留523.25Hz/C5。默认位置点击白键曾超时，下半部点击成功，不把单次自动定位超时当作产品缺陷。结果见 [开发转换](../output/playwright/frontend-audit/note-tool-dev-result.txt)、[琴键对照](../output/playwright/frontend-audit/note-tool-dev-keyboard-control.txt) 与已查看的 [截图](../output/playwright/frontend-audit/note-tool-dev-stale.png)，对应#137。根StrictMode与清理函数只设unmountedRef=true、未在建立时恢复false相结合，阻止了两个提交处理器；机制已对照 [React官方说明](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development)。

同一版本生产构建880→A5、C5→523.25、Bb3→A#3/233.08、B#3→C4/261.63正常；0、-1、abc及H4都有错误提示。但C0被对齐A0后仍显示C0=27.50Hz，C9被对齐C8后仍显示C9=4186.01Hz，形成原音名与夹取频率错配，建立#138。见 [生产输入结果](../output/playwright/frontend-audit/note-tool-production-result.txt)、[上下边界](../output/playwright/frontend-audit/note-tool-range-result.txt)、已查看的 [截图](../output/playwright/frontend-audit/note-tool-out-of-range.png)。范围限制本身由界面明确说明，问题在不一致的等式；这也区别于开发模式下整条表单提交被拦截。

## 本轮补充：个人历史规模与手机翻页性能

[build-history-performance.mjs](../output/playwright/frontend-audit/build-history-performance.mjs) 复用minimalSelfTest，生成25/250/1000条有效历史：唯一ID、过去逐日日期、正基频180+(index%40)，1000条全部先通过eventSchemaPrivate。实验只模拟本地GET响应，没有真实用户数据和云端写入。当前个人页手机分页与桌面时间轴同时挂载，桌面树的计算样式是display:none，但映射所有历史。

390×667生产构建、4倍CPU降速，按1000→250→25反序复测，每组交替上一页/下一页6次：

| 总记录 | 可见事件按钮 | 隐藏桌面卡片 | 时间轴元素数 | 点击到两帧后的范围 | 中位数 | 最长主线程任务 |
|---:|---:|---:|---:|---:|---:|---:|
| 25 | 10 | 25 | 501 | 95–171ms | 114ms | 144ms |
| 250 | 10 | 250 | 3878 | 477–912ms | 667ms | 875ms |
| 1000 | 10 | 1000 | 15128 | 1339–1496ms | 1428ms | 1466ms |

正序首轮同样呈现规模增长：1000条1292–1417ms；首轮页码采集选择器误选了导航元素，耗时仍有记录，随后修正为button[aria-current="page"]并重新执行。上述反序主结果和之后的对照均核实页码2/1交替，不能把首轮的空采集值当成分页失败。不降速生产对照：25条14–24ms，1000条166–221ms。开发构建4倍降速对照：25条287–317ms，1000条4373–6091ms，隐藏卡片数量相同；开发模式耗时不能当作生产指标。

这里记录的是浏览器click捕获到第二次requestAnimationFrame的实验耗时，另外用PerformanceObserver记录长任务；不是Event Timing INP，不包含完整输入等待时间，也不是真实用户p75或实体手机测量。数据量反向复测仍出现差异，说明不能只凭界面显示10条就认为渲染成本有界。排序与桌面全量map都是后续优化要检查的路径，未声称全部耗时只来自某一行代码。

原始结果：[正序首轮](../output/playwright/frontend-audit/history-performance-result.txt)、[反序复测](../output/playwright/frontend-audit/history-performance-reverse.txt)、[不降速](../output/playwright/frontend-audit/history-performance-unthrottled.txt)、[开发对照](../output/playwright/frontend-audit/history-performance-dev.txt)。[汇总](../output/playwright/frontend-audit/history-performance-summary.json)只包含校正后的三组结果；[截图](../output/playwright/frontend-audit/history-performance-mobile.png)已查看，当前为最后一次开发构建1000条、第一页。

已建立[#139](https://github.com/Ethanlita/vfs-tracker/issues/139)，关联已关闭且无关闭说明评论的#53。它聚焦当前InteractiveTimeline的有界渲染缺失；#116仍负责后端历史截断，#111仍负责首页资源成本，不互相替代。下一步仍需覆盖事件管理大列表、宽度切换与键盘操作，不能以此实验代替全站性能验收。

## 本轮补充：事件管理摘要与删除交错操作

[build-event-manager-audit.mjs](../output/playwright/frontend-audit/build-event-manager-audit.mjs) 基于minimalSelfTest生成8条通过eventSchemaPrivate的合成事件，覆盖有内容的训练/练习、可选内容省略、旧feeling字段、自定义医生。生产与开发列表均出现三条undefined...；旧感受和自定义姓名在详情分别正常显示“合成旧版感受内容”和“合成姓名”，而列表显示undefined.../自定义。参见[生产初始状态](../output/playwright/frontend-audit/event-manager-initial.txt)、[开发初始状态](../output/playwright/frontend-audit/event-manager-initial-dev.txt)、[详情对照](../output/playwright/frontend-audit/event-manager-summary-details.txt)和已查看的[摘要截图](../output/playwright/frontend-audit/event-manager-undefined.png)。截图为最终开发对照，已等待列表过渡动画结束；首轮过早截图的淡色不是新的样式缺陷。对应#140。

[event-manager-workflow.js](../output/playwright/frontend-audit/event-manager-workflow.js) 验证自我练习筛选得到2条，叠加“目标”得到1条，无匹配词得到明确空态；清空后选择最早在前顺序正确，390→1440→390保留类型与排序，两种宽度没有页面横向溢出。当前EventManager没有分页而是完整映射筛选结果；本轮8条功能实验不能据此宣称大列表性能合格。

生产延迟删除实验中，同一自测的删除按钮仍启用，第二次确认产生相同ID的第二条DELETE；随后打开训练B详情，释放删除A响应后B详情被关闭，但B仍在数组中。开发构建关闭重复点击，只发1条DELETE，同样关闭B；生产又独立执行“删除训练A→打开练习B→放行唯一请求”，也复现。分别见[生产完整结果](../output/playwright/frontend-audit/event-manager-workflow-completed.txt)、[开发单次对照](../output/playwright/frontend-audit/event-manager-workflow-dev-completed.txt)、[生产单次对照](../output/playwright/frontend-audit/event-manager-single-delete-completed.txt)。对应#141。模拟器两次都返回成功导致两个成功提示，不据此推断真实后端第二次删除也一定成功。

原生confirm使Playwright CLI首份输出在流程尚未结束时就显示Modal state；后续读取同一浏览器中的完成结果，确认流程已执行到末尾，没有把CLI输出边界当作产品卡死。上述completed文件是最终证据，start/result文件保留调用记录。全部DELETE都被本地/event/{id}路由拦截，没有真实事件写入。

[event-manager-delete-controls.js](../output/playwright/frontend-audit/event-manager-delete-controls.js)补测正常控制路径：[结果](../output/playwright/frontend-audit/event-manager-delete-controls-completed.txt)显示取消确认无请求、6条保留；自身详情删除收到模拟400后有明确失败提示，详情及6条保留；再试成功后详情关闭，列表变5条。因此#141只描述在途状态与异步关闭归属问题，不把常规失败恢复误报为异常。时间范围边界、事件管理长列表输入/滚动和更多字段组合仍需继续。

## 本轮补充：事件管理搜索规模与未来日期

[build-manager-performance.mjs](../output/playwright/frontend-audit/build-manager-performance.mjs) 生成25/250/1000条合法self_test记录；备注均以audit开头，逐字输入a/u/d再退格三次，保证匹配数量始终不变。390×667、生产构建、4倍CPU降速，六次输入耗时分别40–82/213–417/692–1022ms，最长任务77/387/981ms；反序1000→25得到688–1118/26–48ms。1000条在384px高容器里挂载1000行、13000后代元素。每组输入期间个人事件请求增量均为0。对应#142。

取消CPU降速的生产对照为25条5–10ms、1000条101–138ms；开发构建不降速对照为23–33/318–583ms，不能把开发额外开销当作生产数据。指标是input捕获到两次requestAnimationFrame，不是真实用户INP或p75。原始记录：[生产](../output/playwright/frontend-audit/manager-performance-production.txt)、[反序](../output/playwright/frontend-audit/manager-performance-reverse.txt)、[不降速](../output/playwright/frontend-audit/manager-performance-unthrottled.txt)、[开发](../output/playwright/frontend-audit/manager-performance-dev.txt)、[汇总](../output/playwright/frontend-audit/manager-performance-summary.json)。后续为滚动检查重载1000条时跳过输入循环，单独保存在manager-scroll-setup.txt，没有混入计时汇总。

[首尾滚动结果](../output/playwright/frontend-audit/manager-scroll-controls.txt)：390×900和1440×900实际滚轮滚至顶部/底部，均保留1000行，详情分别包含audit performance 0和999，页面无横向溢出。手机底部scrollTop83235、clientHeight384、scrollHeight83619；桌面80615+384=80999。证明记录可达，不证明60fps或实体手机滚动流畅。

[build-date-range-audit.mjs](../output/playwright/frontend-audit/build-date-range-audit.mjs) 使用距参考时刻-200/-100/-60/-14/-2/+1/+365天的7条合法事件，基频依次180至240Hz。生产与开发的最近一周/月/三月/半年分别显示3/4/5/6条，均多出两条未来事件；仅移除未来事件后为1/2/3/4条。图表1周在有未来记录时最新240Hz、均值230Hz，仅过去记录时均为220Hz。对应#143；“全部”保留全部记录是正常行为。

日期结果：[生产](../output/playwright/frontend-audit/date-range-production.txt)、[开发](../output/playwright/frontend-audit/date-range-dev.txt)。初次图表文字采集包含退出动画中的空态，不将该瞬时内容另报缺陷；[动画结束后的生产对照](../output/playwright/frontend-audit/date-range-stable-visual.txt)确认1周下仍有2026/9/11与2027/9/10，最新与均值不变。[列表截图](../output/playwright/frontend-audit/date-range-production-future.png)、[图表截图](../output/playwright/frontend-audit/date-range-production-chart.png)已单独在生产页面重拍并查看；最初两构建共用截图名的图片不用于区分构建。生成器已改为分构建命名，以便后续复现。

上述模拟GET没有真实用户记录或写操作。未来日期本身被契约接受，本单关注有限历史范围含义，不要求删除未来记录。日期恰好边界、跨月定义、放大字号/页面缩放与真机输入滚动仍需继续。

## 本轮补充：浏览器默认字号与访客键盘路径

依据[Chrome DevTools Protocol默认字号接口](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-setFontSizes)，用原生Page.setFontSizes设置standard=16/32、fixed=13/26。实测html计算字号16→32px，innerWidth和devicePixelRatio不变。没有向应用注入CSS；这是浏览器默认字号对照，不能冒充整页200%缩放或手机系统字号验收。

[font-size-audit.js](../output/playwright/frontend-audit/font-size-audit.js)在390/1440×900覆盖首页、公共dashboard、个人页、新增/管理事件、音符工具、文档列表；[生产结果](../output/playwright/frontend-audit/font-size-production.txt)记录实际URL，已登录状态下/login跳到/mypage，因此那两条不能算登录页覆盖。主要内容检查排除琴键等具有自身横向滚动的区域；没有溢出只是局部布局证据，不证明所有控件交互已合格。

390px、默认字号32px时，音符工具document.scrollWidth=601，输入与提交按钮x=81至552；个人页document宽仍390，但“全部”x=395至477，平均值文字也越界。单独[横向操作对照](../output/playwright/frontend-audit/font-chart-range-interaction.txt)把时间栏滚到屏幕中央后按钮仍x=363至445，横向滚轮不改变位置；祖先overflow:hidden，时间栏376px而父内容区仅164px。[开发对照](../output/playwright/frontend-audit/font-size-dev.txt)复现两项；开发有数据的平均值215.00Hz也被裁切，证明并非仅空态异常。对应#144。[图表裁切截图](../output/playwright/frontend-audit/font-chart-range-clipped.png)、[转换表单截图](../output/playwright/frontend-audit/font-note-form-overflow.png)已查看；后者[测量](../output/playwright/frontend-audit/font-note-form-visual.txt)确认横向scrollX为0。

新增事件页在大字号时document宽718，但[进一步检查](../output/playwright/frontend-audit/font-add-event-overflow-investigation.txt)找到的越界元素是装饰圆，未找到越界表单控件；不将其描述为控件不可用，也未把它纳入#144已证实的内容裁切。装饰层与滚动宽度的具体关系仍可继续核实。

[guest-font-keyboard-audit.js](../output/playwright/frontend-audit/guest-font-keyboard-audit.js)另建无登录态上下文，[结果](../output/playwright/frontend-audit/guest-font-keyboard-result.txt)确认实际URL为/login，390和1440px、16/32px字号下用户名/密码输入均在视口内。从用户名输入框作为已聚焦起点，Tab到密码，空密码Enter触发原生必填校验且焦点留在密码，认证请求0次；再Tab/Space可切换密码显隐。图标按钮仍无可访问名称，是已知#112，不另建重复问题。这里不是从浏览器地址栏开始的整站键盘导航验收。

同一访客上下文转到音符工具，纯键盘输入880→Tab→Space得到880Hz≈A5，再Tab到音名输入、输入C5并Enter得到523.25Hz。继续Tab实际遍历88个不同琴键，最后在A#7按Space后选中结果3729.31Hz；遍历全部琴键不等于逐个验证音质或触发每个键，本轮只实际触发末键。在线音色下载被拦截，使用已有合成器路径。结束后独立上下文关闭、额外调试会话释放，[恢复检查](../output/playwright/frontend-audit/font-cleanup-check.txt)确认主页面字号回到16px。

新增问题是#144，累计48个；既有导航、标签与开发StrictMode问题仍需修复。真实页面缩放、系统字号、读屏与实体设备仍没有最终验收证据。

## 本轮补充：真实构建更新与跨标签页草稿

[build-pwa-release.mjs](../output/playwright/frontend-audit/build-pwa-release.mjs) 分别构建真实提交1745fa4与c29a680，完整虚构AWS配置、隔离env目录；[服务器](../output/playwright/frontend-audit/pwa-real-release-server.mjs)在3105提供原样生成的SW和资源，仅切换当前构建。系统tar对中文文件名解压失败的release-a/b目录没有用于构建；[UTF-8解压脚本](../output/playwright/frontend-audit/extract-pwa-releases.py)创建的snapshot-a/b才是有效输入。两次生产构建均成功，各预缓存80项，主程序分别index-h-hn5wcP.js与index-nuEpziP2.js。

[阶段A](../output/playwright/frontend-audit/pwa-release-stage-a.txt)确认旧版SW控制页面，用户列表25行且在图表之前；切换服务端后旧主资源直接请求404，新版SW进入installed等待，旧页仍正常。fixture派生的一条pendingEvents:v1由测试直接写入localStorage，不将其冒充本轮通过UI创建的离线记录。[更新提示截图](../output/playwright/frontend-audit/pwa-real-update-prompt.png)已查看。

[阶段B](../output/playwright/frontend-audit/pwa-release-stage-b.txt)确认延后后提示隐藏且25行保留，重载再次提示。打开第二标签页后清空普通HTTP缓存，context.setOffline(true)令未缓存网络探针fetch抛TypeError；点击更新后两页均加载新版主程序。主页面HTML、JS、CSS响应均fromServiceWorker=true，pendingEvents:v1字节一致。继续断网直接导航音符工具，输入880、Enter得到A5/880Hz。刷新后Chromium的navigator.onLine又变成true，但探针仍失败；不据此声称网络已恢复，也不把模拟器这一行为单独报为应用缺陷。

[恢复联网结果](../output/playwright/frontend-audit/pwa-release-reconnect.txt)探针200，dashboard首页20人、末页5人，用户列表位于全部图表之后；预缓存已没有旧主程序，离线队列仍完整。此实验验证这两个提交的资源更新，不证明其他版本的数据结构迁移、系统回收或实体安装通过。

另用两次全新上下文复测正在编辑的表单：[手机结果](../output/playwright/frontend-audit/pwa-cross-tab-result.txt)、[桌面结果](../output/playwright/frontend-audit/pwa-cross-tab-desktop-result.txt)。[脚本](../output/playwright/frontend-audit/pwa-release-cross-tab.js)在标签页A新增自测备注，标签页B打开dashboard，真实A→B构建更新安装后，A点击稍后提醒，B点击立即刷新。两次A均发生一次/add-event主框架重载，备注从测试文字变为空，无离开确认、无事件POST。对应#145；[手机前](../output/playwright/frontend-audit/pwa-cross-tab-before.png)/[后](../output/playwright/frontend-audit/pwa-cross-tab-after.png)截图已查看。

跨标签页实验全程在线，虚构认证与API读取由原审查harness适配同源/__api；未提交事件。其模拟网络条件与前面无请求拦截的访客离线实验分开，不能混用证据。PWA注册只在PROD启用，因此普通开发服务器不具备该更新触发路径；本轮没有把开发页面当作SW更新测试。应用中main/App/EventForm和vite配置在两个提交间没有差异。已将跨标签页编辑保护加入修复验收，累计49个公开issue，应用尚未修复。

## 本轮补充：音色在途、播放积压与导航

[note-audio-setup.js](../output/playwright/frontend-audit/note-audio-setup.js)在独立访客上下文延迟gleitz音色请求，给原生AudioContext构造、close与音源start添加观察记录；不替换真实解码或播放。[fixture生成器](../output/playwright/frontend-audit/build-note-soundfont-fixture.mjs)复用已有两秒180Hz合成WAV生成MIDI.js三键响应，三个键音频相同，仅验证生命周期；失败对照直接abort，不提供合成音色响应。

[按键脚本](../output/playwright/frontend-audit/note-audio-delayed.js)按A4/B4/C5、每次间隔2秒，全部响应暂存。初次点击默认白键中心被正常重叠的黑键截获，点击尚未发生；原失败输出保留在note-audio-delayed-production.txt，不视为音频缺陷。修正为白键底部露出的区域并通过正常命中检查，未使用force点击。

[生产成功](../output/playwright/frontend-audit/note-audio-delayed-production-completed.txt)、[开发成功](../output/playwright/frontend-audit/note-audio-delayed-dev.txt)、[生产失败](../output/playwright/frontend-audit/note-audio-delayed-failure.txt)均出现3个相同音色请求，放行前音源start为0，当前选中C5且状态“在线（钢琴音色）”，无加载提示。[截图](../output/playwright/frontend-audit/note-audio-loading.png)已查看。按键间隔约2056–2102ms；成功后启动集中在4/13ms，失败后440/493.88/523.25Hz三个振荡器在1ms内启动；首键等待约6.2秒。时间来自人为延迟，不代表真实用户延迟分布。

注意成功路径每个音使用一个采样源和一个ADSR包络源，不能把6个BufferSource启动误称为6个琴音。后续探针加入bufferDuration/Length，开发结果明确3个2秒采样源与3个2采样点包络源。[汇总](../output/playwright/frontend-audit/note-audio-summary.json)保留生产首次未区分节点的事实；[汇总脚本](../output/playwright/frontend-audit/summarize-note-audio.mjs)不擅自将其计成6个音乐音源。

[导航对照](../output/playwright/frontend-audit/note-audio-navigation-production.txt)：旧播放context在离开时关闭；重新进入并点击、音色仍在途时再次离开，新context同样closed。放行迟到响应后仍对closed context调用start，但没有新建运行context；返回后第三个context running并播放。没有实体听音证据，不据此另报“离开后持续发声”或已证实资源泄漏。

[失败/断网/重连控制](../output/playwright/frontend-audit/note-audio-controls-result.txt)：失败后的新C5按键启动合成器，请求数仍3；离线navigator.onLine=false且探针fetch失败，B4按键可启动493.88Hz振荡器，请求数仍3；恢复网络后A4触发第4次音色请求，并启动2秒采样源。说明既有失败后可用路径及网络恢复重载音色都存在，问题集中在加载未完成期间的重复下载和过期按键补播。

已形成[完整issue草稿](../output/playwright/frontend-audit/issues/note-soundfont-pending-playback.md)，但独立发布被自动审批拒绝：缺少针对该GitHub目的地公开本项代码线索与复现结果的明确授权。保持49个公开issue，待发布草稿增至8份；没有修改应用源码。

## 本轮补充：保存中的输入与页面生命周期

[事件脚本](../output/playwright/frontend-audit/event-save-scenarios.js)通过正常表单填写有效自测，在POST等待时继续修改备注，随后放行响应。生产390×900与开发1440×900均表现为：请求notes=A，保存按钮disabled，但备注仍可编辑为B；成功后B被清空并返回个人页，没有第二次POST。

第一份生产脚本另试“成功提示后离开”，实际导航顺序却为自动/mypage先于点击首页，最后等待/mypage超时。该调用并非所有场景都未运行：[同会话状态](../output/playwright/frontend-audit/event-save-production-state.txt)保存前两项完整结果，但第三项不作为复现。之后收敛脚本，使用契约规定的eventId/message成功响应，重新执行两项确定场景：[生产标准响应](../output/playwright/frontend-audit/event-save-production-contract-result.txt)、[开发标准响应](../output/playwright/frontend-audit/event-save-dev-contract-result.txt)。旧脚本使用过兼容的item包装，不将其当作当前响应契约；[schema检查](../output/playwright/frontend-audit/save-schema-validation.txt)验证两构建合计4个请求与4个标准响应均合法。

第二项场景在POST仍等待时先点顶部VFS Tracker回首页。生产增加3秒未放行对照，URL始终为/；放行成功后自动变/mypage。开发同样从/add-event→/→/mypage。根因链为useAsync卸载仅阻止自身setState、Promise仍返回结果，EventForm成功then继续调用旧onEventAdded，AddEvent安排2秒navigate。不能把“hook已有卸载保护”当作整个调用链安全。

[生产迟到失败对照](../output/playwright/frontend-audit/event-save-leave-failure-result.txt)执行同样离开路径，但放行HTTP 400；等待3.5秒后仍在首页，没有成功导航。这强化了成功回调的触发关系，不代表#127所述错误反馈问题已经修复。

[资料保存脚本](../output/playwright/frontend-audit/profile-save-editing.js)在PUT等待时将显示名称A改B、选项false改true；按钮已禁用但字段可编辑。模拟服务只保存收到的A/false，随后GET回读。生产和开发都显示成功、关闭编辑并回填A/false，再次编辑仍A，B丢失：[生产](../output/playwright/frontend-audit/profile-save-editing-production.txt)、[开发](../output/playwright/frontend-audit/profile-save-editing-dev.txt)。[事件待保存截图](../output/playwright/frontend-audit/event-save-pending-production.png)、[资料待保存截图](../output/playwright/frontend-audit/profile-save-pending-production.png)已查看。

新增[保存中编辑丢失](../output/playwright/frontend-audit/issues/save-pending-edits-lost.md)与[迟到响应导航](../output/playwright/frontend-audit/issues/event-save-late-navigation.md)两份草稿，前者同时覆盖事件/资料，后者聚焦离开后的页面副作用。全部使用合成账户与模拟请求，未改应用源码；沿用此前公开披露审批边界先保存在本地，49个公开issue、10份待发布草稿。成功后立即离开的独立分支、更多字段在途变化与真机输入仍待进一步验证。

## 本轮补充：文档导航恢复与窄屏正文

[文档请求控制](../output/playwright/frontend-audit/docs-load-setup.js)只延迟或失败真实文档请求，成功时继续向本地实际构建获取原文，没有注入测试文章。[菜单切换实验](../output/playwright/frontend-audit/docs-switch-race.js)先挂起《VFS Tracker是什么》，通过文档菜单切到《联系和交流》，新正文显示后再放行旧请求。生产挂起1次、开发StrictMode挂起2次；新文章前后正文完全一致、无错误，后退/前进后的地址、标题、正文正确：[生产](../output/playwright/frontend-audit/docs-switch-race-production.txt)、[开发](../output/playwright/frontend-audit/docs-switch-race-dev.txt)。这项迟到成功响应保护有效，不能套用事件新增的生命周期缺陷来报文档竞态。

[恢复实验](../output/playwright/frontend-audit/docs-error-recovery.js)在两个构建均验证：正文500显示“无法加载文档”和重试，重试后正确正文且主内容alert为0；目录500后重试恢复10个根目录入口；非法../private.md请求参数在客户端拒绝，正文请求增量0；无doc参数显示选择文档提示。[生产结果](../output/playwright/frontend-audit/docs-error-recovery-production.txt)、[开发结果](../output/playwright/frontend-audit/docs-error-recovery-dev.txt)。文档菜单和正文独立取目录，主内容恢复结果不被扩展为整站所有网络错误场景都已通过。

[移动宽度脚本](../output/playwright/frontend-audit/docs-mobile-width.js)遍历当前13篇真实文档，在320/390×900下逐篇确认正文非空后再测量。生产、开发各26组，[生产汇总](../output/playwright/frontend-audit/docs-mobile-width-production-verified-summary.json)/[开发汇总](../output/playwright/frontend-audit/docs-mobile-width-dev-verified-summary.json)均missingContentEvidence=0。最初一轮没有显式等待非空正文，因此增加该条件后重跑并以verified结果为准。

两构建结果一致：只有320px下tutorial/数据查询使用指南.md整页365px、更新记录.md整页370px。390px全部文档整页宽均390。嗓音测试报告解读指南中的pre自身scrollWidth达950–1120px，但overflow-x:auto且页面宽仍320/390，不把内部滚动混作整页溢出。

[可见位置实验](../output/playwright/frontend-audit/docs-width-visual.js)使用文本Range定位实际长标识符。横向scrollX=0时details.fundamentalFrequency右边缘348.73px、CONTRACT_TEST_ENVIRONMENT.md右边缘365.44px，均超出320px；横向滚轮后页面分别移动45/50px，说明需要移动整页才能读全，并非完全无法访问。[生产](../output/playwright/frontend-audit/docs-width-visual-production.txt)/[开发](../output/playwright/frontend-audit/docs-width-visual-dev.txt)一致；[查询指南截图](../output/playwright/frontend-audit/docs-width-production-query.png)、[更新记录截图](../output/playwright/frontend-audit/docs-width-production-changelog.png)已查看。

新建[窄屏文档草稿](../output/playwright/frontend-audit/issues/docs-narrow-inline-overflow.md)，区别于#136锚点和#144大字号。草稿含具体路径、位置、两宽度对照与修复验收，尚未公开发布。当前49个公开issue、11份待发布草稿；应用代码未修改，真机、读屏及大字号下全部文档仍需后续验收。

## 公共档案读取反馈与切换用户复核

2026-09-10，基线仍为c29a680。复用[dashboard及公开用户fixture生成器](../output/playwright/frontend-audit/build-public-profile-audit.mjs)，两位合成用户共3条事件；仪表板和明细通过对应Joi schema，公开资料按Lambda实际过滤后的结构生成。使用独立访客上下文，生产构建390×900、开发构建1440×900，模拟HTTP而非真实用户请求。

[失败/恢复脚本](../output/playwright/frontend-audit/public-profile-failure.js)保持明细成功，暂缓用户甲公开资料，然后返回400。两构建中，资料等待及失败都无公开资料标题、status、alert或重试按钮；统计与明细正常显示。恢复资料200后关闭再打开，姓名/简介出现。对照将事件明细返回400，则有alert和重试，恢复200点击重试后错误消失、明细恢复。[生产结果](../output/playwright/frontend-audit/public-profile-failure-production.txt)、[开发结果](../output/playwright/frontend-audit/public-profile-failure-dev.txt)及两种宽度的失败截图均已检查。页面并未显示“用户未公开资料”的错误文案，实际问题是资料区整体隐藏且无恢复入口。

[切换用户脚本](../output/playwright/frontend-audit/public-profile-switch.js)暂缓甲的资料和明细，关闭甲、打开乙并等待乙资料/明细显示，然后释放甲两个200响应并确认完成。[生产](../output/playwright/frontend-audit/public-profile-switch-production.txt)与[开发](../output/playwright/frontend-audit/public-profile-switch-dev.txt)前后弹窗文本均相同，只有乙的资料和事件。未发现该场景的旧响应污染；源码两处effect的active保护与浏览器结果一致。

新增[公开资料错误反馈草稿](../output/playwright/frontend-audit/issues/public-profile-error-hidden.md)，含复现、代码定位及加载/重试/隐私空态/迟到响应的验收要求。沿用现有公开披露审批边界保留本地，未尝试发布。当前49个公开issue、12份待发布草稿，应用源码未修改。实体手机、读屏及本项其他错误码的浏览器验证仍待补充。

## 公共档案键盘路径与背景隔离

2026-09-10，基线c29a680。[键盘脚本](../output/playwright/frontend-audit/public-profile-keyboard.js)复用两用户合成公开数据，从已聚焦的甲用户查看档案按钮开始，后续均使用真实Enter/Tab/Shift+Tab/Escape，不强制点击遮罩后的元素。生产/开发各1440×900与390×900，共4组。

四组均发现：打开甲后焦点仍在背景甲按钮；Escape不关闭；一次Tab转到背景乙按钮，Enter可将抽屉内容切换成乙；最终通过关闭按钮Enter关闭后焦点为BODY，未回到仍存在的入口。故问题不仅是语义属性不足，用户能实际操作模态遮罩后的内容。公开档案已有dialog角色、aria-modal及关闭按钮名称，不能把事件详情缺少这些属性的旧结论套在它上面。

从关闭按钮继续Tab时，桌面两组离开抽屉，手机两组先进入可滚动的内容DIV；这一宽度差异已保留，不夸大为所有视口一步逃离。结果：[生产桌面](../output/playwright/frontend-audit/public-keyboard-production-desktop.txt)、[生产手机宽度](../output/playwright/frontend-audit/public-keyboard-production-mobile.txt)、[开发桌面](../output/playwright/frontend-audit/public-keyboard-dev-desktop.txt)、[开发手机宽度](../output/playwright/frontend-audit/public-keyboard-dev-mobile.txt)。[汇总](../output/playwright/frontend-audit/public-keyboard-summary.json)由脚本核对四组关键事实；生产桌面和手机宽度截图已查看。

已扩充[现有弹层键盘问题草稿](../output/playwright/frontend-audit/issues/event-dialog-a11y.md)，不另增重复issue；验收覆盖初始焦点、背景隔离、正反Tab、Escape和返回入口，并参考[WAI模态对话框模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。维持49个已发布issue、12份待披露草稿。没有修改应用源码；实体设备和读屏路径仍未验证。

## 连续选择头像的迟到回调覆盖

2026-09-10，基线c29a680。[头像脚本](../output/playwright/frontend-audit/avatar-selection-race.js)复用合成账户与模拟接口，取仓库192px/512px两张有效PNG。生产390×900、开发1440×900分别执行：A文件上传和URL获取成功，但图片GET暂缓；此时文件输入已重新启用，资料保存0次。选择B立即成功，随后放行A，资料PUT顺序变为B→A，当前预览仍是B字节的data URL，页面仍提示成功。刷新后profile.avatarKey和头像资源URL均指向A。

[生产结果](../output/playwright/frontend-audit/avatar-selection-race-production.txt)、[开发结果](../output/playwright/frontend-audit/avatar-selection-race-dev.txt)记录不同key及其先后关系；[汇总](../output/playwright/frontend-audit/avatar-selection-race-summary.json)核对两种构建的保存顺序、预览和重载结果。两张图标外观相似，识别依据是key、字节与URL而非肉眼猜图；生产截图已查看，用于确认页面仍显示成功提示。测试脚本最初缺少Buffer全局，尚无上传就退出；检查同一页面状态后改用响应字节对象的构造器，最终结果文件为成功完成的实验，不将该脚本错误归为产品问题。

类型text/plain与大小5MB+1字节均在上传前被拒绝，上传请求0次；清空文件选择同样没有新请求。这是文件输入校验对照，不等于测试了操作系统原生选择器的取消按钮或损坏图片解码。

只读核对GitHub #102仍为OPEN且无评论，其原文已指出头像完整保存流程缺失并要求并发验收，因此本轮不另建同主题问题。已准备[#102补充评论原文](../output/playwright/frontend-audit/avatar-race-issue-102-comment.md)，尚未发布，沿用现有具体披露授权边界。本轮没有新的发布尝试或审批拒绝。仍为49个已发布issue、12份独立issue草稿，另有此份待发布的已有issue补充记录。应用源码未修改。

## 上传入口键盘与图片解码边界

2026-09-10，基线c29a680，本地生产390×900、开发1440×900，新的隔离合成账户上下文。[键盘脚本](../output/playwright/frontend-audit/upload-keyboard.js)从已聚焦的编辑账户/最后备注字段开始，实际Tab/Shift+Tab均跳过上传入口；前者在编辑账户和编辑资料间移动，后者在备注和提交间移动。两处file input均display:none，父label的tabIndex=-1且无按钮角色。鼠标点击label能触发filechooser，返回空选择后上传请求0次。[生产](../output/playwright/frontend-audit/upload-keyboard-production.txt)、[开发](../output/playwright/frontend-audit/upload-keyboard-dev.txt)。新增[上传键盘入口草稿](../output/playwright/frontend-audit/issues/upload-keyboard-entry.md)，与#101重试错误、#112登录标签问题区分。

[损坏头像脚本](../output/playwright/frontend-audit/avatar-invalid-content.js)用image/png MIME和.png文件名包装纯合成文本，模拟上传成功及同字节的200图片GET。浏览器独立解码同资源触发error、naturalWidth=0，但两构建均写入avatarKey、显示头像更新成功且alert=0，刷新后仍保留该key。资料页src已转为ui-avatars默认资源URL；截图中灰色区域未呈现实际头像，不声称默认资源加载成功。[生产](../output/playwright/frontend-audit/avatar-invalid-production.txt)、[开发](../output/playwright/frontend-audit/avatar-invalid-dev.txt)、[四项汇总](../output/playwright/frontend-audit/upload-boundaries-summary.json)。生产截图已查看。

SecureFileUpload的Image.onerror与onload均调用保存回调，故将此复现加入[#102本地补充记录](../output/playwright/frontend-audit/avatar-race-issue-102-comment.md)，不另建头像重复问题。当前测试中的备用头像用例只验证显示回退，不能证明损坏的新文件不会被持久化。应用源码未改，真实S3、全部图像格式、实体设备与读屏尚未验收。当前49个已发布issue、13份独立待发布草稿，另有#102待发布补充；本轮没有公开写入或新的审批拒绝。

## 附件上传在途时提交事件

2026-09-10，基线c29a680。中断后先检查既有浏览器会话，确认合成账户已在/mypage且无事件写请求，再继续执行，未重复启动实验环境。[实验脚本](../output/playwright/frontend-audit/attachment-submit-pending.js)用仓库有效PNG，暂缓模拟上传PUT，在正常自测表单中勾选“好”“没夹”并填写备注后提交。文件输入已禁用且“上传中...”可见，但事件提交按钮仍启用；事件POST成功并返回/mypage时上传完成数为0，请求省略attachments。放行上传后文件URL获取继续发生，事件POST数量仍为1。

同一页面另建新事件，等待上传完成且附件链接显示后提交，第二个POST正确包含一项附件。生产390×900及开发1440×900一致：[生产](../output/playwright/frontend-audit/attachment-submit-production.txt)、[开发](../output/playwright/frontend-audit/attachment-submit-dev.txt)、[汇总](../output/playwright/frontend-audit/attachment-submit-summary.json)。[验证脚本](../output/playwright/frontend-audit/validate-attachment-submit.mjs)校验4个事件请求及4个响应均符合现有schema，并核对在途/完成状态和附件数量。生产截图已查看，清楚显示上传中和可用提交按钮。这里只验证模拟请求流程，没有实际云端持久化或S3对象检查。

新增[上传中提交遗漏附件草稿](../output/playwright/frontend-audit/issues/event-submit-pending-attachment.md)，包含慢上传复现、完成后正对照和多附件/三阶段延迟验收。源码显示上传状态局限于子组件，父表单只收集完成回调的附件，按钮只检查事件POST状态。与#101失败重试及保存中编辑草稿区分；附件链接解析effect已有cancelled保护，未仅凭异步代码猜测旧响应覆盖。当前49个已发布issue、14份独立待发布草稿及#102补充记录；没有修改应用源码，也未进行新的公开写入尝试。

## 多附件移除与显示列表错位

2026-09-10，基线c29a680。[移除脚本](../output/playwright/frontend-audit/attachment-remove-stale.js)通过界面上传A/B两张仓库PNG，全部完成后暂缓后续文件URL请求，再点击A移除。计数变成1，resolvedAttachments仍显示A/B两行；再次点击旧A行的移除使attachments变空，提交POST无附件。正常链接速度下另起事件，仅移除A并等列表更新，POST保留B。生产390×900、开发1440×900一致：[生产](../output/playwright/frontend-audit/attachment-remove-production.txt)、[开发](../output/playwright/frontend-audit/attachment-remove-dev.txt)。[验证及汇总](../output/playwright/frontend-audit/attachment-remove-summary.json)检查四个请求及四个响应schema、错位行数和最终附件差异。

生产截图显示计数1及仍可见的A行，B在该截图下缘之外，完整两行事实来自DOM结果；开发截图另已查看。这里的风险是旧行按索引操作当前数组，不是缺少cancelled保护；迟到链接响应并未让清空的列表恢复。记录的是本地表单移除和模拟事件请求，没有删除真实文件。

新增[附件移除错位草稿](../output/playwright/frontend-audit/issues/attachment-remove-stale-index.md)，补入稳定标识、即时列表更新、三附件及增删并行验收。与#141已保存事件删除以及上传在途提交分别记录。当前49个已发布issue、15份独立待发布草稿和#102补充，源码未修改，本轮无公开发布尝试。

## 下载链接失败后的错误导航

2026-09-10，基线c29a680。[链接脚本](../output/playwright/frontend-audit/attachment-link-failure.js)使用合成PNG，上传完成前第一次file-url成功，表单重新解析列表时第二次file-url返回400。生产390×900及开发1440×900均无alert/重试按钮，仍显示已添加附件1和可点击文件名。href原样变成attachments/audit-user-a/...对象key，浏览器解析为本站路径；实际点击的新标签页显示应用“404 / 页面不存在”，导航HTTP状态200，不与服务器HTTP404混淆。[生产](../output/playwright/frontend-audit/attachment-link-production.txt)、[开发](../output/playwright/frontend-audit/attachment-link-dev.txt)、[汇总](../output/playwright/frontend-audit/attachment-link-summary.json)。生产失败链接截图已查看。

恢复服务后300ms内无新file-url请求，原href未更新且没有重试入口；此短观察不证明永久不重试，源码effect依赖attachments且无独立重试状态补充定位。另起页面重新选择文件、所有请求成功后href正确，读取200/image/png。工具resolveAttachmentLinks仍用于EventForm；resolveAttachmentUrl也被当前/voice-test的TestResultsDisplay调用，报告图表/PDF实际错误行为留待独立验证。EventList仅找到定义/导出，未把其下载方法当作当前实际用户路径。

新增[附件链接失败草稿](../output/playwright/frontend-audit/issues/attachment-link-failure.md)，要求区分对象key与可访问URL、链接失败可单独重试并保留文件及表单。当前49个已发布issue、16份独立待发布草稿及#102补充；没有应用源码修改或新的公开发布尝试。

## 嗓音报告文件链接的完整向导复核

2026-09-10，基线c29a680。[准备脚本](../output/playwright/frontend-audit/report-links-setup.template.js)提供180Hz合成MediaStream，保留真实Recorder、浏览器编码及界面上传；[录音脚本](../output/playwright/frontend-audit/report-record-steps.js)按按钮走完2/2/4/2/1/1段录音，再跳过问卷生成报告。生产390×900和开发1440×900各上传12段非空WAV，合计24段；每段约0.5秒，只证明流程，不评价算法或真人音质。分析指标复用completeSelfTest fixture中的报告字段，图表和单页PDF均为无个人信息的测试资源。初版setup超过Windows命令行长度，缩减至展示所需指标后正常执行；没有修改应用。

[报告实验](../output/playwright/frontend-audit/report-link-behavior.js)在done结果已返回后暂缓file-url，页面只显示文件加载提示，平均基频标题0个。返回400后指标显示，但图表src变为原始key且naturalWidth=0，PDF也是原始key、aria-disabled=false，alert和局部重试均0。点击PDF实际进入本站错误路径并显示“页面不存在”。[生产](../output/playwright/frontend-audit/report-links-production.txt)、[开发](../output/playwright/frontend-audit/report-links-dev.txt)，生产破图与绿色PDF按钮截图已查看。

恢复服务后通过上一步→跳过返回报告，图表naturalWidth=192，合成PDF响应200/application/pdf且头部%PDF-1.4；analyze/results请求增量都0，未重复录音上传。生产重新获取文件URL2次，开发StrictMode环境4次；初版验证器错误假设两者都2次，检查实际重复键及main.jsx的StrictMode后改为分别核对并记录次数。[最终汇总](../output/playwright/frontend-audit/report-links-summary.json)验证24段录音、两种构建的失败和恢复。没有断言PDF阅读器排版通过，也未把指标暂时隐藏或链接错误说成分析结果丢失。

已将报告复现、可用间接恢复路径及文件级重试验收补进[已有链接失败草稿](../output/playwright/frontend-audit/issues/attachment-link-failure.md)，独立草稿数仍16；49个已发布issue和#102待发布补充不变。本轮无公开写入，真实设备、真实分析及报告多资源部分失败仍需后续验收。

## 补充：登录与首次资料设置的返回目标

2026-09-10，基线c29a680，生产390×900和开发1440×900。通过真实登录表单及SDK，使用隔离的合成认证/资料HTTP响应，访问`/event-manager?audit=return`。已有完整资料账户均正确回到原路径并保留查询参数，浏览器返回到先前首页。首次设置账户均进入向导，分别执行“跳过设置”和输入昵称、两次“下一步”、“完成设置”，四条路径最终均为`/mypage`。每条只有一次资料POST且保存内容正确，不把模拟响应错误或资料保存失败算作导航缺陷。

证据：[浏览器脚本](../output/playwright/frontend-audit/login-return-flow.js)、[6条路径汇总](../output/playwright/frontend-audit/login-return-summary.json)、[结果核对脚本](../output/playwright/frontend-audit/validate-login-return.mjs)；原始输出为`login-return-{production,dev,production-complete,dev-complete}.txt`。生产手机最终页面截图已查看。使用实际设置接口的成功响应包装；没有声称通过现有完整用户Joi契约，首次未设置/跳过状态与完整资料schema并不等价。未验证真实Cognito、向导刷新恢复或实体设备。

代码在全局自动进入向导时未传递目标，且向导两种出口共享的finishSetup固定导航个人页。新增[独立草稿](../output/playwright/frontend-audit/issues/login-return-profile-setup.md)，归入进入功能与账户恢复批次，要求目标贯穿认证和向导、失败重试保留、无目标默认行为明确。当前49个已发布issue、17份独立待发布草稿和#102待发布补充；本轮无公开发布尝试，应用源码未修改。

## 补充：个人历史读取失败与重试恢复

基线c29a680，生产390×900及开发1440×900，使用合成账户、仓库minimalSelfTest派生且通过私有事件契约的记录。两页各执行400失败、慢重试、200恢复一条记录、200空数组对照。个人页错误区可见且有重试，但下方仍出现“暂无事件”“开始记录您的第一个嗓音事件吧！”及无参数数据文案。事件管理页同条件下只展示错误，不混入正常空态。

两页每次重试均只产生一个历史请求，等待时显示加载，成功后清除错误并显示事件；空数组响应完成后正常显示空态。这是有效正对照，不应将新发现写成重试失效，也没有证据表明历史被删除。生产完整页面截图已查看。早期观察脚本因事件管理摘要不展示备注、桌面时间轴首个备注副本隐藏而等待错误元素；已根据实际DOM修正为可见记录，并在空响应完成和动画结束后记录，最终结果以重新执行输出为准。

证据：[浏览器脚本](../output/playwright/frontend-audit/history-read-recovery.js)、[fixture生成与校验](../output/playwright/frontend-audit/build-history-read-recovery.mjs)、[结果核对脚本](../output/playwright/frontend-audit/validate-history-read-recovery.mjs)、[双构建汇总](../output/playwright/frontend-audit/history-read-summary.json)，原始输出为`history-read-production.txt`及`history-read-dev.txt`。新增[失败与空态混用草稿](../output/playwright/frontend-audit/issues/personal-history-failure-empty-state.md)，归入页面体验批次。当前49个已发布issue、18份独立待发布草稿和#102补充，无公开发布尝试或应用源码修改。真实网络离线、已有内容刷新失败和全部错误码仍需后续验收。

## 补充：事件类型切换与旧校验错误

2026-09-10，生产390×900和开发1440×900。实际填写自我测试180Hz/备注/两组勾选并上传合成PNG，切换医院检测后字段为空，再切回仍为空；日期及已完成附件保留。第二份附件上传中切换嗓音训练，上传完成后两份附件均显示。当前代码明确清空formData，现有单元用例也描述这种策略，本轮未将清空本身或同一表单的附件保留另报为缺陷。

新的#127复现：空自我测试提交产生声音状态/发声方式错误，切为嗓音训练仍保留旧错误。三个原生required字段为空时，普通提交0次POST，form.checkValidity=false；点击旧错误“重试”却发送voice_training与空details。模拟成功后2.5秒仍停留新增页，无成功提示，必填仍空。双构建一致，2个请求及2个响应均通过当前API契约；此处表单required与契约允许范围不同，不能写成契约校验失败。生产完整页面截图已查看。

只读核对#127仍为OPEN且暂无评论，因此准备[#127补充原文](../output/playwright/frontend-audit/event-type-issue-127-comment.md)，不另建重复问题，也尚未发布。证据：[浏览器脚本](../output/playwright/frontend-audit/event-type-transition.js)、[双构建汇总](../output/playwright/frontend-audit/event-type-transition-summary.json)、[核对脚本](../output/playwright/frontend-audit/validate-event-type-transition.mjs)；原始输出`event-type-transition-production.txt`及`event-type-transition-dev.txt`。49个公开issue、18份独立草稿不变，待发布补充现为#102与#127两份。无应用源码修改，类型切换提示策略和更多类型组合仍需修复验收。

## 补充：快速基频测试授权等待中的取消

2026-09-10，生产390×900、开发1440×900。通过可控getUserMedia成功/拒绝/暂缓响应返回真实180Hz合成MediaStream；发生器与应用AudioContext分开记录，没有物理麦克风采集或音频上传。拒绝权限后有错误，再次允许并点击开始可恢复；已正常分析时停止，track变ended、应用context变closed，后续读取次数不增加。

授权暂缓时点击停止，迟到成功仍创建live音轨和running上下文，图表/音名受新信号更新，但页面显示“测试完成”、停止按钮禁用。授权暂缓时先返回个人页，迟到成功也在后台持续分析，个人页没有停止入口。生产停止路径两次观察的读取次数37→69、离开37→81；开发分别35→55、40→84，证明仍在活动，不作为性能测量。所有实验结束后明确由测试清理残留音轨及上下文，不能算作应用清理成功。

新增[独立问题草稿](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md)，与#106无效测量区分；源码在await后未校验操作有效性，停止/卸载只能清理当时存在的ref。证据：[授权模拟与原生资源观察](../output/playwright/frontend-audit/microphone-audit-setup.js)、[浏览器操作脚本](../output/playwright/frontend-audit/quick-f0-permission-lifecycle.js)、[结果汇总](../output/playwright/frontend-audit/quick-permission-summary.json)、[核对脚本](../output/playwright/frontend-audit/validate-quick-permission.mjs)，原始输出`quick-permission-production.txt`/`quick-permission-dev.txt`。生产停止后截图已查看。

当前49个已发布issue、19份独立待发布草稿及#102/#127补充。无公开写入或应用源码修改。仍未验证真实授权弹窗与系统采集指示、实体手机、旧授权与新测试交错及通用Recorder的相同边界；合成响应结果不能替代这些最终验收。

## 补充：通用Recorder的迟到授权与转码上下文

2026-09-10，生产390×900和开发1440×900，在公开VFS预览页使用真实MediaRecorder和180Hz合成音轨。授权等待中点击“返回首页”，迟到成功使录音器进入recording、音轨live、分析上下文running；首页无停止入口。生产两次观察电平读取45→86、开发36→77。复现已合并到[既有迟到授权草稿](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md)，同时定位QuickF0Test和Recorder，未重复建立同类问题。没有声称无限期录制，完整嗓音向导和原生权限弹窗仍需独立验证。

另确认独立转码资源问题：每次正常完成录制后，电平分析上下文与VFS基频检测临时上下文均关闭，但Recorder.encodeWav的局部上下文仍running且decodeAudioData调用1次。两种构建连续3段后均为1→2→3，轨道均ended、录音器inactive。返回首页并主动请求Chromium GC后，VFS检测的已关闭实例可回收，3个转码上下文仍running。最终实验对AudioContext使用WeakRef，排除了直接强持有上下文的观察方式；初次强引用结果仅保留为线索，文件后缀strong-reference，不作为最终证据。正常放弃录音仅有1个已关闭分析上下文，不进入转码。未测量内存/耗电或触发资源上限，不把资源残留夸大为必然崩溃或持续麦克风采集。

新增[转码清理草稿](../output/playwright/frontend-audit/issues/recorder-wav-context-cleanup.md)。证据：[资源观察脚本](../output/playwright/frontend-audit/recorder-resource-setup.js)、[实际录音流程](../output/playwright/frontend-audit/recorder-resource-lifecycle.js)、[双构建结果汇总](../output/playwright/frontend-audit/recorder-resource-summary.json)、[核对脚本](../output/playwright/frontend-audit/validate-recorder-resources.mjs)，原始输出recorder-resource-production.txt/dev.txt。6段完成录音及2段放弃录音均有非空原生WebM数据；没有真实录音、声音播放或上传，收尾由实验明确清理资源。

只读搜索现有issue的AudioContext关键词未命中相关条目。本轮无公开写入或应用源码修改，当前49个已发布issue、20份独立待发布草稿及#102/#127补充；转码成功/失败出口与完整向导多段录音的修复后验收归入第3批。

## 补充：离线资料草稿的存储异常

2026-09-10，生产390×900、开发1440×900。使用浏览器离线模式，逐路径确认navigator.onLine=false和未缓存探测请求失败；仅对pendingProfileSetup:v1写入模拟QuotaExceededError/SecurityError，不实际填满磁盘或更改权限。两类错误×完成/跳过×两构建共8条路径均尝试写1次但无草稿，资料API写入0，直接进入个人页，没有错误反馈；恢复网络再进入向导昵称为空。存储失败时原生成功弹窗也没有出现，故明确描述为静默退出，而非错误弹出保存成功。

另有4条正常写入对照：相应payload确实持久化，并显示已离线保存后退出；重新进入仍不恢复输入，与#105缺少消费者的现有问题一致。认证及只读资料接口仍为模拟响应，不作为离线真实云服务可访问的证据。生产失败后页面截图已查看；真实设备的额度/权限行为仍待补测。

只读核对#105仍OPEN且无评论，准备[#105补充原文](../output/playwright/frontend-audit/profile-storage-issue-105-comment.md)，未重复建单或公开发布。证据：[实际浏览器脚本](../output/playwright/frontend-audit/profile-offline-storage.js)、[12条路径汇总](../output/playwright/frontend-audit/profile-storage-summary.json)、[核对脚本](../output/playwright/frontend-audit/validate-profile-storage.mjs)，原始结果profile-storage-production.txt/dev.txt。应用源码未改，当前49个公开issue、20份独立草稿，另有#102/#105/#127三份待发布补充。

## 补充：后台配置首次读取失败后的恢复

2026-09-10，生产390×900、开发1440×900。真实管理员登录表单、虚构凭证且不记住，STS/DynamoDB/SSM全部拦截。GetParameters返回400 AccessDeniedException后，配置区有错误提示，但默认24/10/24/10仍可编辑，改第一项36后保存/重置仍禁用且无重试入口；失败期间PutParameter为0，没有默认值覆盖云端的证据。

恢复模拟SSM响应，留在原页无新读取；通过实际侧栏切到用户管理再返回，正确显示48/3/72/5，错误清除。此时改64并保存，四个模拟参数写入成功，证明恢复路径及正常保存可用。生产读取计数1→2，开发StrictMode下2→4；没有将开发重复挂载当作恢复失败。生产手机完整截图已查看。

新增[配置读取失败恢复草稿](../output/playwright/frontend-audit/issues/admin-rate-read-recovery.md)，与#114已有重试不清错误、#119部分保存失败的触发与修复分别明确。证据：[模拟服务与登录](../output/playwright/frontend-audit/admin-rate-read-setup.js)、[实际用户操作](../output/playwright/frontend-audit/admin-rate-read-recovery.js)、[双构建汇总](../output/playwright/frontend-audit/admin-rate-read-summary.json)、[结果核对](../output/playwright/frontend-audit/validate-admin-rate-read.mjs)，原始输出admin-rate-read-production.txt/dev.txt。无真实云端写入、公开发布或应用源码修改，当前49个公开issue、21份独立待发布草稿及3份补充。实际网络故障、其他错误码和保存中编辑仍待后续验收。

## 补充：配置保存期间的新编辑保留

2026-09-10，基线c29a680，生产390×900、开发1440×900。沿用隔离管理员登录和全部AWS请求拦截，先读取48/3/72/5，修改并提交64/3/72/5，暂缓四个参数写入响应，再把页面改为96/7/72/5。分别让首轮全部成功或全部失败，两种情况下页面均保留96/7/72/5，保存和重置重新可用；模拟服务端分别保留首轮提交值或初始值。

随后第二轮保存均发出96/7/72/5，成功后页面与模拟服务端一致，保存按钮禁用，旧错误清除。四条路径、32个模拟参数写入的结果核对通过，生产页面截图已查看。这一结论只覆盖配置页的后续输入保留和再次提交；不撤销#118/#119及读取失败恢复草稿，也不能推广为事件/资料表单均正常。首轮部分成功、保存中离开、真实AWS网络条件仍需独立验收。

证据：[实际浏览器操作](../output/playwright/frontend-audit/admin-rate-pending-edit.js)、[双构建结果汇总](../output/playwright/frontend-audit/admin-pending-edit-summary.json)、[结果核对脚本](../output/playwright/frontend-audit/validate-admin-pending-edit.mjs)，原始结果admin-pending-edit-production.txt/dev.txt。已将这项正常行为纳入修复回归要求；无新增问题、真实云端写入、公开发布或应用源码修改，仍为49个公开issue、21份独立草稿及3份补充。

## 补充：配置保存跨页面交错

2026-09-10，生产390×900、开发1440×900，继续使用隔离管理员与全部AWS请求拦截。初始48/3/72/5，提交64后暂缓四个写入，侧栏离开再返回读取初始值，此时能提交96。第二轮全部成功后，页面及模拟服务均96；随后第一轮较晚执行写入，模拟服务变为64，而页面仍96、显示已保存且保存按钮禁用。再次离开返回读回64。每个交错路径8次模拟请求全部成功，实验明确延迟的是写入执行，不是仅延迟已提交操作的响应；不声称真实云端已发生事故。

正常对照是先离开、让第一轮完成，再返回：读回64正确，用户管理页保持当前路由且无配置成功提示。结合上一节，同页保存期间编辑可保留，问题出现在跨实例丢失在途任务状态。两种构建共4条路径、24次模拟写入，结果核对通过，生产截图已查看。

只读核对#119仍OPEN，原验收已要求在途写入全部结束后才允许下一轮。本次作为[#119补充原文](../output/playwright/frontend-audit/admin-save-navigation-issue-119-comment.md)，扩展离开/返回边界，不另建重复issue。证据：[浏览器操作](../output/playwright/frontend-audit/admin-save-navigation.js)、[汇总](../output/playwright/frontend-audit/admin-save-navigation-summary.json)、[核对脚本](../output/playwright/frontend-audit/validate-admin-save-navigation.mjs)。没有公开写入或应用源码修改，当前49个公开issue、21份独立草稿、4份待发布补充；跨标签页、多管理员和真实服务端并发仍待验证。

## 补充：快速基频重开后的旧授权结果

2026-09-10，c29a680，生产390×900、开发1440×900。第一轮getUserMedia暂缓，正常点击停止，再允许第二轮成功并点击重新测试。新一轮已有一条live音轨、一个running上下文及分析读取，第一轮仍等待。分别释放旧成功或旧NotAllowedError：成功使两条音轨/两个上下文同时活动，再次停止后只清理迟到的旧资源，新一轮资源仍live/running，同时出现null.sampleRate异常；失败则无条件结束新一轮轨道/上下文并显示权限错误，停止按钮禁用。

资源数组按返回顺序记录，先返回的属于第二轮，因此明确区分了哪次请求的资源残留。四条双构建路径结果核对通过，生产错误截图已查看。使用180Hz合成MediaStream与真实Web Audio资源，未使用真实麦克风或上传音频，收尾由测试明确清理。最初在about:blank准备模拟登录因localStorage不可访问失败，已在正确本地域名修正并完整重跑，该准备失败不计入应用缺陷。

复现D/E及资源归属原因已加入[现有迟到授权草稿](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md)，独立草稿数未增加。证据：[旧请求控制](../output/playwright/frontend-audit/quick-restart-setup.js)、[正常界面操作](../output/playwright/frontend-audit/quick-restart-permission.js)、[汇总](../output/playwright/frontend-audit/quick-restart-summary.json)、[结果核对](../output/playwright/frontend-audit/validate-quick-restart.mjs)。49个公开issue、21份独立草稿、4份待发布补充不变；无应用源码或公开内容修改，原生权限行为、设备切换及通用Recorder重开交错仍需验证。

## 补充：通用录音授权等待中的重复开始

2026-09-10，生产390×900、开发1440×900，公开VFS预览页。开始录音等待授权时按钮仍可用，第二次正常点击发出第二个请求。先返回第二次授权，再返回第一次授权，真实MediaRecorder出现两份recording、两条live轨道、两个running分析上下文。分别点击继续与确认放弃，均只结束最后创建的资源；页面无停止入口，返回首页后较早创建的录音器仍recording、轨道live、分析上下文running。

四条路径结果核对通过，生产放弃后截图已查看。放弃未经过转码，明确区别于转码上下文草稿；继续存在额外解码上下文，但此处以录音器和轨道状态定位活动录音。电平读取循环停止不代表录音器停止。每条结束路径产出11864字节合成WebM；实验未采集物理麦克风或上传，观察后主动清理所有残留资源，不将测试清理算作应用行为。

已将复现F补入[已有录音生命周期草稿](../output/playwright/frontend-audit/issues/quick-f0-late-microphone-permission.md)，不另建重复问题。证据：[浏览器操作](../output/playwright/frontend-audit/recorder-pending-double-start.js)、[双构建汇总](../output/playwright/frontend-audit/recorder-double-start-summary.json)、[结果核对](../output/playwright/frontend-audit/validate-recorder-double-start.mjs)。保留先前单次录音正常放弃可清理的对照；没有声称无限期录音、实体设备或完整向导已验证。49个公开issue、21份独立草稿、4份待发布补充不变，无应用源码或公开内容修改。

## 补充：快速基频离线写入失败后的恢复对照

2026-09-10，生产390×900、开发1440×900。隔离登录、180Hz合成MediaStream，通过真实开始/停止取得约179.98–180.00Hz结果。页面加载后启用浏览器离线，逐路径确认navigator.onLine=false且未缓存探测请求失败；仅对pendingEvents:v1的setItem模拟QuotaExceededError或SecurityError，不实际填满磁盘或修改权限。

四条路径均显示离线保存失败和重试保存，等待超过正常成功后的两秒跳转时限仍停留快速测试页，原测量结果保留，写入尝试1次、队列为空。恢复写入后点击一次重试，错误清除，总尝试2次且队列只有1条，测量值与页面一致；自动返回个人页后队列仍在，期间API写入0。四个eventData均通过当前addEventRequestSchema，数值另行核对至页面两位小数；这不等于真实云端同步成功或完整私有事件响应契约已验证。

生产失败页面截图已查看。证据：[浏览器操作](../output/playwright/frontend-audit/quick-offline-storage-recovery.js)、[四条路径汇总](../output/playwright/frontend-audit/quick-storage-summary.json)、[结果及契约核对](../output/playwright/frontend-audit/validate-quick-storage.mjs)。该正常行为加入修复回归要求，不撤销#103/#104的队列归属/并发问题，也不替代#110离线冷启动或#105资料向导存储异常的验收。模拟认证和读取仍使用隔离响应；队列在恢复联网前由实验移除，未执行同步，无物理麦克风或云端写入。

本轮无新增问题、公开发布或应用源码修改；49个公开issue、21份独立草稿、4份待发布补充不变。实际存储耗尽、读取异常、损坏队列、真实设备和联网同步仍需各自验证。

## 补充：快速基频成功后重复保存

2026-09-10，生产390×900、开发1440×900。真实合成测量约180Hz，在线第一次请求等待时保存按钮禁用且只有1个POST；返回成功后按钮恢复可用，在两秒自动导航前再次点击，会发送第二个POST。两次type/details相同、date重新生成，模拟成功返回不同eventId。离线逐条核对navigator.onLine=false和未缓存探测失败，同样成功后再次点击使队列1→2，返回个人页仍保留两条，API写入0。

四条路径、8份payload及4份模拟响应通过核对与当前契约，生产截图已查看。实际验证了在线重复请求和离线重复入队；后端每次生成eventId并写入是代码证据，不声称真实DynamoDB已产生重复数据。与前一节单次失败后重试正常的对照并存，修复不能阻断失败重试或下一次新测量保存。

新增[独立草稿](../output/playwright/frontend-audit/issues/quick-f0-repeat-save.md)，归入第3批事件与录音流程；只读现有问题搜索未发现覆盖该触发点的条目。证据：[浏览器操作](../output/playwright/frontend-audit/quick-save-repeat.js)、[双构建汇总](../output/playwright/frontend-audit/quick-save-repeat-summary.json)、[结果及契约核对](../output/playwright/frontend-audit/validate-quick-save-repeat.mjs)。当前49个公开issue、22份独立草稿、4份待发布补充；无公开写入、真实麦克风采集或应用源码修改。响应丢失后的结果未知重试、键盘连续激活和真实云端幂等仍待验收。

## 补充：离线事件队列读取异常

2026-09-10，生产390×900、开发1440×900。仓库minimalSelfTest派生有效条目，通过当前事件请求契约。对pendingEvents:v1模拟getItem SecurityError时，个人页正常打开但不显示待同步数量，点击同步提示没有离线记录，API写入0；原始内容仍保存一条有效记录。解除读取限制，实际进入添加页再浏览器返回，计数恢复1且原始内容不变。

非法JSON和错误顶层对象也得到同样空反馈，原始文本未删除；这些是人为注入的损坏样本，不声称正常应用写入会产生它们。有效空数组对照的无记录提示正确。混合数组[null,有效条目]仍提交有效项，提示成功1/失败1，留下[null]，证明单条坏数据没有阻塞其余项。两种构建共10条路径及2次有效模拟POST核对通过，生产页面截图已查看；原生弹窗由dialog事件取证。

新增[队列读取错误草稿](../output/playwright/frontend-audit/issues/offline-queue-read-error.md)，归入第1批离线数据可见性与恢复，与#103/#104触发不同；只读现有issue搜索无相同条目。证据：[fixture及契约准备](../output/playwright/frontend-audit/build-queue-read-audit.mjs)、[浏览器操作](../output/playwright/frontend-audit/queue-read-audit.js)、[汇总](../output/playwright/frontend-audit/queue-read-summary.json)、[结果核对](../output/playwright/frontend-audit/validate-queue-read-audit.mjs)。当前49个公开issue、23份独立草稿、4份待发布补充，无公开写入或应用源码修改；实际存储策略、损坏内容恢复及同步后的本地清理失败仍需补测。

## 补充：同步后的本地队列清理失败

2026-09-10，生产390×900、开发1440×900，隔离登录及仓库fixture派生A/B事件。全成功分支在POST A成功后模拟removeItem SecurityError，页面仍报告成功1/失败0且队列留A；解除存储异常再次同步，A重复POST。部分成功分支A成功/B失败，模拟setItem QuotaExceededError，原A/B仍在；恢复存储和B接口后再次同步，A与B都发送，已成功A重发。

正常对照：无存储异常时，全成功清空且再次点击无请求；部分成功只保留失败B，再次仅请求B。8条双构建路径、20个模拟请求通过结果核对，请求及成功响应通过当前契约。生产页面截图已查看，弹窗文本通过dialog事件记录；没有真实云端写入，也没有通过实际耗尽空间或更改存储策略来制造异常。

新增[独立同步清理失败草稿](../output/playwright/frontend-audit/issues/offline-sync-cleanup-error.md)，归入第1批。只读核对#104仍OPEN，范围是同期新增被覆盖；本次没有并发新增，根因是本地持久化失败被忽略，分别记录并关联稳定条目身份与幂等验收。证据：[fixture准备](../output/playwright/frontend-audit/build-sync-cleanup-audit.mjs)、[浏览器操作](../output/playwright/frontend-audit/sync-cleanup-audit.js)、[汇总](../output/playwright/frontend-audit/sync-cleanup-summary.json)、[结果核对](../output/playwright/frontend-audit/validate-sync-cleanup.mjs)。当前49个公开issue、24份独立草稿、4份待发布补充，应用源码和公开内容未修改；清理失败后重载、响应丢失和真实服务端幂等仍待验收。

## 补充：社交账号编辑流程与手机布局

2026-09-10，生产390/320×900、开发1440/390/320×900，隔离账户及模拟资料API。两种构建手机编辑行均撑宽页面到475px；选择框146px、账号框241px、添加按钮48px，加间距超过可用342/272px。滚到输入框后添加按钮右边界446/376px，仍在视口外。1440px对照所有控件在行内。生产截图已查看，本轮未调整字体或应用CSS，位置记录包含自动横向滚动后的状态。

数据流程对照正常：新增行和公开选项后取消无请求且恢复；保存400保留两账号及选项，恢复后保存、刷新均一致；删除Discord后保存并刷新仅余Twitter。两构建共6份PUT请求通过更新资料契约，未验证公开dashboard的隐私过滤。脚本首次使用不受运行环境支持的structuredClone而中止，已改为JSON对象复制；随后契约检查发现旧通用夹具缺少必填nickname，已补齐模拟资料并完整重跑两种构建。最终结果及汇总以本次重跑为准，这两次测试准备问题均不计入应用缺陷。

新增[手机社交编辑行草稿](../output/playwright/frontend-audit/issues/profile-social-mobile-overflow.md)，归入第4批；只读核对#144仅覆盖大字号转换器/图表，触发条件及组件不同。证据：[浏览器操作](../output/playwright/frontend-audit/profile-social-flow.js)、[汇总](../output/playwright/frontend-audit/profile-social-summary.json)、[结果及契约核对](../output/playwright/frontend-audit/validate-profile-social-flow.mjs)。当前49个公开issue、25份独立草稿、4份待发布补充，无公开内容或应用源码修改；长账号、软键盘、真机与资料/头像交叉保存仍待验证。

## 补充：头像更新刷新覆盖未提交资料

2026-09-10，生产390×900、开发1440×900。进入资料编辑，改名称、勾名称公开并添加Discord，不保存资料直接上传本地PNG。头像PUT成功及资料GET刷新后，名称回旧值、公开取消、社交账号清空；编辑模式仍开着，仅显示头像更新成功。请求只保存原资料加新avatarKey，未提交的编辑没有被发出或恢复。头像PUT失败对照保留草稿；先保存资料再上传头像对照保留全部新值。

六条路径、8个资料请求通过更新契约与结果核对，合成资料已包含必填nickname。生产覆盖后截图已查看。此处与既有资料保存丢编辑共用userProfile变化后的无条件回填，已加入[现有草稿复现三](../output/playwright/frontend-audit/issues/save-pending-edits-lost.md)，不增加独立问题数。修复需隔离资料草稿与头像刷新，不能仅保护资料保存等待状态，也不能默默将草稿随头像一并提交。

证据：[浏览器操作](../output/playwright/frontend-audit/profile-avatar-draft.js)、[结果汇总](../output/playwright/frontend-audit/profile-avatar-draft-summary.json)、[结果及契约核对](../output/playwright/frontend-audit/validate-profile-avatar-draft.mjs)。当前49个公开issue、25份独立草稿、4份待发布补充不变，无真实上传/账户修改、公开写入或应用源码修改。两个保存请求同时在途、其他页面触发资料刷新仍需独立验证。

## 补充：头像与资料并发保存覆盖已确认字段

2026-09-10，生产390×900、开发1440×900。同页两个入口仍可在另一操作等待时发起写入。先头像后资料、让资料先成功，名称与公开选项先变新值，再执行迟到头像完整快照则恢复旧值；先资料后头像、让头像先成功，再执行带avatarKey=null的迟到资料快照则清掉新头像。两次均成功，刷新后模拟服务和页面仍呈现覆盖结果。

四条路径、8份PUT请求通过更新契约与结果核对，生产刷新后截图已查看。实验延迟写入执行，非只延迟已完成写入的响应；后端源码也使用SET profile整体替换，因此修复不能仅忽略UI回调。未进行真实云端写入。前一轮先完成资料再上传头像的顺序对照正常。

新增[并发保存覆盖草稿](../output/playwright/frontend-audit/issues/profile-concurrent-save-overwrite.md)，归入第1批，与未提交草稿覆盖和#102失败预览分别定位；只读issue检索未发现覆盖该触发点的条目。证据：[浏览器操作](../output/playwright/frontend-audit/profile-concurrent-save.js)、[汇总](../output/playwright/frontend-audit/profile-concurrent-summary.json)、[结果及契约核对](../output/playwright/frontend-audit/validate-profile-concurrent.mjs)。当前49个公开issue、26份独立草稿、4份待发布补充，无公开内容或应用源码修改。跨标签页、部分失败及真实服务并发仍待验证。

## 补充：录音转换等待、失败与离开

2026-09-10，同一master基线，生产390×900、开发1440×900，真实MediaRecorder与180Hz合成音轨。在效果预览停止录音后暂缓WAV首次解码：原录音器inactive但原音轨live，开始按钮可用。再次开始后两份音轨live；放行旧转换，旧完成回调中断第二次录音，第一份音轨仍live且原分析上下文running，返回首页仍未释放。生产完成页截图已查看。

单次录音停止、转换等待时直接离开可正常结束音轨；放行后留在首页，未跳转或显示完成页。单独注入解码EncodingError、重采样OperationError，及普通正常完成，音轨均ended、录音器inactive，但转换上下文都在返回首页后仍running。没有把临时上下文残留误写成这些对照路径仍在录音。

双构建共10条路径完成并通过[结果核对](../output/playwright/frontend-audit/validate-recorder-conversion.mjs)，见[汇总](../output/playwright/frontend-audit/recorder-conversion-summary.json)、[转换边界设置](../output/playwright/frontend-audit/recorder-conversion-setup.js)与[浏览器操作](../output/playwright/frontend-audit/recorder-conversion-lifecycle.js)。失败注入位于浏览器音频接口，不修改React状态；测试结束主动收尾，未采集物理麦克风或上传声音。

补入D19复现G及D20失败/离开出口，独立草稿仍26份，另4份待发布补充；没有发布新内容或修改应用源码。修复必须覆盖授权等待和转换等待两个阶段，不能只忽略迟到UI回调。完整嗓音向导、真实设备和真实资源消耗仍需后续验证。

## 补充：完整嗓音向导的转换格式错误

2026-09-10，同一master，生产390×900、开发1440×900。设备与环境校准的首段转换分别注入解码EncodingError、离线重采样OperationError，第二段正常；另有两段正常对照。实际请求体表明失败后首段仍为WebM（EBML头1a45dfa3），而`POST /uploads`与PUT声明audio/wav、文件名1_1.wav。进度仍到2/2，显示所有录音完成，无错误提示，下一步进入最长发声时。

双构建6条路径、12次模拟上传通过[字节与流程核对](../output/playwright/frontend-audit/validate-voice-format.mjs)，见[浏览器操作](../output/playwright/frontend-audit/voice-conversion-format.js)和[结果汇总](../output/playwright/frontend-audit/voice-format-summary.json)。正常上传及异常后的第二段均为单声道48kHz、16位PCM WAV。生产截图已查看。音频为180Hz合成输入，短片段只验证格式与流程，未采集真实声音、写S3或请求云端分析。

新增[D27格式失败草稿](../output/playwright/frontend-audit/issues/voice-conversion-failure-format.md)，归入第3批；和D20上下文清理、#107上传重试错步骤分别定位。只读搜索已有WebM/WAV问题没有找到直接覆盖此触发点的条目，但不把关键词检索当作绝对无重复证明。当前49个已发布issue、27份独立草稿、4份待发布补充；应用源码未修改，未尝试发布新草稿。真实后端对原始容器格式的兼容性与失败恢复仍需验证，不能据此次拦截测试推断每次云端分析必然失败。

## 补充：PWA离线三算法的可用性对照

2026-09-10，生产构建c29a680，Chromium390×900，独立访客上下文。在线首页安装真实Service Worker并取得控制后，清空并禁用普通HTTP缓存、阻断网络，再直接导航`/vfs-effect-preview`；响应200且fromServiceWorker=true，非此前已经打开的效果页DOM或HTTP历史缓存。

首次实验导航后网络请求确实失败，但navigator.onLine仍true，结果保留在pwa-offline-algorithms-network-only.txt，仅证明网络阻断下可运行。补测在离线导航完成后显式切换一次在线→离线，确认navigator.onLine=false、未缓存探测请求失败，再录制约1.2秒180Hz合成音轨并依次处理。此短暂切换用于修正测试浏览器报告状态，不把它写成从首次导航起始终onLine=false；新一轮录制及处理全程在已验证离线状态下执行。

RubberBand、TD-PSOLA、WORLD Vocoder均可选、显示已处理且有对应结果卡，无处理错误弹窗。观察真实Blob构造产物，原录音为48kHz单声道16位WAV，三种输出均含RIFF/WAVE头、非空PCM数据，输出采样率44.1kHz。没有播放到扬声器、调用物理麦克风或模拟算法结果。采集轨道最后ended；仍存在的Recorder转换上下文按D20跟踪，不能写成所有资源均已清理。

恢复联网后navigator.onLine=true，原未缓存探测路径的新请求成功。生产截图已查看，[结果核对](../output/playwright/frontend-audit/validate-pwa-offline-algorithms.mjs)通过，见[浏览器脚本](../output/playwright/frontend-audit/pwa-offline-algorithms.js)与[汇总](../output/playwright/frontend-audit/pwa-offline-algorithms-summary.json)。这是生产PWA特有路径；开发服务器不注册该SW，未用开发模式冒充相同离线缓存验收。

本组为通过对照，不新增issue。27份独立草稿和4份待发布补充不变，应用源码未改。输出容器可用不代表音质合格：TD-PSOLA合成输出峰值达到16位边界，需另测饱和比例及声音失真；本组不据单一峰值判定听感。真实语音、长音频、物理播放、安装后系统回收及真机仍未覆盖。

## 补充：TD-PSOLA音量与饱和的量化对照

2026-09-10，生产390×900、开发1440×900。此前离线实验的满幅峰值已进一步核对：在公开效果预览用180Hz合成音轨录制约3.2秒，幅度0.02/0.08/0.2，默认+50Hz，分别运行三种真实算法，共6段录制、18份算法输出。

0.02档TD-PSOLA输出RMS从0.01411增至0.51883，双构建均约+31.31dB，无满幅样本；0.08档增益约+0.82至+0.91dB、满幅约0.060%至0.061%；0.2档约-6.95dB、满幅约0.128%。因此不能把此前峰值写成持续大面积硬削波；确认的是音量匹配不稳定及部分波形达到PCM边界。RubberBand约-0.42至-0.41dB、WORLD约+1.99至+3.06dB，均无接近满幅样本。没有实际声音播放或真人音质评价。

源码将平均每帧总能量与每采样点平均能量直接比较，存在量纲不一致；但未隔离修改该分支，不将全部失真归为单一原因。只读确认已有#67明确包含能量匹配优化，故新增[已有issue补充](../output/playwright/frontend-audit/audio-level-issue-67-comment.md)，不另建重复独立草稿。证据见[浏览器操作](../output/playwright/frontend-audit/audio-level-audit.js)、[汇总](../output/playwright/frontend-audit/audio-level-summary.json)和[结果核对](../output/playwright/frontend-audit/validate-audio-level.mjs)。观察器只增加合成输入幅度参数，默认0.08保持此前资源实验行为；应用源码未改。

当前仍49个已发布issue、27份独立草稿，待发布补充增为5份。后续音质验收应覆盖能量包络、时长、真实语音与听感，不能由整体RMS或输出文件可解码替代；公开发布仍待具体授权。

## 补充：跨标签页顺序保存覆盖已确认资料

2026-09-10，生产390×900、开发1440×900；两个真实同源标签页与共享模拟服务。A、B先读取同一初始资料，A操作完成且收到成功反馈后，才切到B发起第二次操作。A先头像、B后名称/公开选项，B旧快照清掉新头像；A先名称/公开选项、B后头像，B旧快照改回旧资料。两个请求无重叠或延迟，重新加载两个页面均确认覆盖结果。

第二页在编辑/上传前先刷新，两种顺序均保留新名称、公开选项与头像。双构建8条路径、16份PUT通过请求契约和[结果核对](../output/playwright/frontend-audit/validate-profile-cross-tab.mjs)，见[脚本](../output/playwright/frontend-audit/profile-cross-tab.js)及[汇总](../output/playwright/frontend-audit/profile-cross-tab-summary.json)。生产刷新后截图已查看，未操作真实账户或S3。

已补入D26复现C：同页串行或禁用忙碌按钮不足以保护跨标签页旧快照。需明确字段更新/版本冲突策略，同时保留未提交草稿；刷新对照不作为要求用户手动刷新的最终方案。27份独立草稿、5份待发布补充保持不变，应用源码未修改；跨设备及真实服务竞争、部分失败仍待验证。

## 补充：管理用户详情保存的异步归属

2026-09-10，生产390×900、开发1440×900，合成管理登录与全拦截AWS服务。A的isAdmin=false、B=true；保存A等待时关闭抽屉并打开B。A成功会通过父组件setSelectedUser把详情切回A；A失败则保留B身份但把B开关误显示为关闭，实际模拟存储B仍true。再次点击B发送true，验证错误显示影响后续操作计算。失败无页面提示。

原用户正常成功、失败后重试均可正确保存。双构建8条路径、12次UpdateItem通过[结果核对](../output/playwright/frontend-audit/validate-admin-user-save.mjs)，见[夹具准备](../output/playwright/frontend-audit/build-admin-user-fixture.mjs)、[浏览器模板](../output/playwright/frontend-audit/admin-user-save.template.js)、[汇总](../output/playwright/frontend-audit/admin-user-save-summary.json)。开发失败返回瞬间截图已查看，未修改真实权限。首次夹具使用.test被Joi邮箱TLD检查拒绝，已改用保留示例域名example.com；Windows命令长度限制通过压缩测试参数解决，两者均为测试准备问题，不计入应用缺陷。

新增[D28草稿](../output/playwright/frontend-audit/issues/admin-user-save-stale-selection.md)，归第4批，与#141/#119分别定位。当前49个已发布issue、28份独立草稿、5份待发布补充；应用源码未修改，未尝试发布新内容。最近事件读取与其他离开/重入组合仍待检查。

## 补充：管理用户详情最近事件归属错误

2026-09-10，生产390×900、开发1440×900，合成用户与通过私有事件契约的自测/VFS手术夹具；所有AWS请求拦截。A只有自测、B只有手术事件。A查询等待→打开B并成功显示手术→放行A后，B详情出现A自测；A先加载→B查询失败，也保留A自测。首次Query失败则提示暂无事件，无错误或就地重试。

正常A到B切换显示正确B事件，失败恢复后关闭重开也能取回正确数据。双构建8条路径、18次Query通过[结果核对](../output/playwright/frontend-audit/validate-admin-user-events.mjs)，见[夹具准备](../output/playwright/frontend-audit/build-admin-user-events.mjs)、[浏览器模板](../output/playwright/frontend-audit/admin-user-events.template.js)和[汇总](../output/playwright/frontend-audit/admin-user-events-summary.json)。生产事件区域截图已查看；顶部身份由同一时点DOM核对，不从滚动截图猜测。无真实用户读取或云端写入。

新增[D29草稿](../output/playwright/frontend-audit/issues/admin-user-events-stale-data.md)，归第1批数据正确性。和D28保存状态分开验收，请求目标本身正确，问题发生在前端接收/保留结果。当前49个已发布issue、29份独立草稿、5份待发布补充，应用源码未修改。头像共享加载流程和A旧失败/B仍加载等组合仍待覆盖；没有将本次显示混淆写成服务端归属被修改或真实泄露。

## 阶段核对：审查基线、覆盖与发布门槛

2026-09-10重新只读核对GitHub：远端master与本地HEAD均为`c29a6807ef02e0188344f8b63bc9065f1202436d`；本轮已发布的#97–#145共49项仍全部OPEN。当前应用无已跟踪源码差异，不能据审查过程或浏览器结果声称这些缺陷已被修复。

对照App.jsx及AdminApp.jsx，16个主站入口、6个管理入口均在路由矩阵中有检查记录，另有主站404记录。这里核对的是路由覆盖记录完整性，不代表每条路由的所有操作组合、设备或实际服务条件均通过。矩阵中的未完成项继续有效。

| 目标要求 | 当前证据 | 仍缺少的完成证据 |
|---|---|---|
| 桌面功能入口与手机侧栏可用 | #97–#99、#117及桌面/手机浏览器复现 | 对应修复与键盘、横屏、真机回归 |
| PWA离线及更新可靠 | 真实SW离线导航、三算法处理、两版本更新与跨标签页草稿实验 | 已报离线身份/队列/更新缺陷修复；安装、系统回收、iOS/Android验证 |
| 账户、头像、资料、事件与管理流程可靠 | 已发布问题和29份具体草稿；失败、恢复、异步顺序与跨用户对照 | 每项修复后的同条件通过证据，真实服务边界验证 |
| 性能达到合格标准 | 首页及大数据列表的固定条件实验 | 优化后的同条件对比、真实用户手机/桌面p75数据 |
| 问题有可审阅复现并建立issue | 49项已发布；29份新issue正文与5份补充已整理 | 剩余34份内容尚待具体公开披露授权并实际发布 |
| 修复后无已知可感知异常 | 已有逐用户路径验收清单 | 当前修复尚未实施，无法证明此目标完成 |

发布清单检查已增强为读取Git对象：核对链接中引用的提交、该提交内文件及行号范围。34份正文共108处源码链接检查通过；这比只检查当前工作区文件更严格，但仍不替代代码语义复核和行为测试。首次运行遭到Node启动Git子进程的沙箱限制，已区分环境失败与链接失效，在获准的只读检查中完成，最终检查结果无链接问题。

已向用户提出针对当前34份正文及明确GitHub目的地的授权请求，尚未收到答复。此前自动审批拒绝公开发布的原因仍有效，不能把自动目标续跑视为披露授权；未重新尝试发布。审查目标保持未完成，后续修复和真机验证也不能由材料整理替代。

## 结论边界

这是一轮持续中的缺陷审查，应用代码未在此轮修复。现有 issue 含具体复现，分别标明生产观察与模拟实验。没有真实用户 p75 性能样本或真机全流程证明；不能据此宣称修完目前清单就必然没有其他问题。剩余工作按上述矩阵继续收敛，发布草稿的批准也不替代修复后的验证。
