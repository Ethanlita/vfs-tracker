# Phase 1 快速总结：发现的问题一览表（修订版）

**完整报告**: 请查看 `phase1_dynamodb_analysis.md`  
**状态**: 已根据用户反馈修订 ✅

---

## 问题清单（修订后）

### 🔴 需要修改文档（本issue范围内）

| # | 问题 | 位置 | 行动 |
|---|------|------|------|
| 1 | **表名错误** | 文档 | `VoiceTests` → `VoiceFemTests` |
| 2 | **主键字段不匹配** | VoiceFemTests | 主键：`sessionId`（单主键）<br>普通字段：`userOrAnonId` → `userId` |
| 3 | **结构不匹配** | VoiceFemTests | `artifacts` → `charts`<br>`reportPdf`移到顶层 |
| 4 | **GSI不存在** | 两个表 | 移除StatusDateIndex和SessionIdIndex定义 |
| 5 | **未实现字段** | VoiceFemTests | 标记calibration/tests/forms为"未实现" |
| 6 | **缺少字段文档** | 多处 | 添加errorMessage, nickname说明 |

### 🟡 需要创建后续issue（超出范围）

| # | 问题 | 位置 | 行动 |
|---|------|------|------|
| 7 | **数据质量** | VoiceFemUsers | 创建issue：修复2条记录的缺失字段 |
| 8 | **性能优化** | getAllPublicEvents | 创建issue：添加GSI，使用Query代替Scan |
| 9 | **bio字段来源** | VoiceFemUsers | 创建issue：找到添加bio的代码并修改，使其不再添加bio |

### ✅ 文档定义正确（无需修改）

| # | 项目 | 说明 |
|---|------|------|
| 10 | **updatedAt可选性** | 从语义上应保持可选，文档正确 |
| 11 | **profile可选性** | 保持可选是合理设计 |
| 12 | **Lambda实现** | 大部分正确，以代码为准更新文档 |

---

## 数据统计

### VoiceFemEvents (75条记录)
- ✅ 字段完整性: 优秀
- ⚠️ GSI未被充分利用
- ✅ attachments隐私处理正确

### VoiceFemUsers (13条记录)
- ❌ 2条记录(15%)缺少必需字段
- ⚠️ 2个字段(`bio`, `nickname`)未文档化

### VoiceFemTests (449条记录)
- ❌ 表名、主键、结构均与文档不符
- ⚠️ 文档定义的3个字段(calibration, tests, forms)实际0%存在
- ⚠️ 1个实际字段(errorMessage)未文档化

---

## 用户反馈已确认 ✅

基于用户comments，所有问题已明确：

1. ✅ **主键结构**: IaC准确，`sessionId`是单主键，`userId`是普通字段
2. ✅ **GSI不存在**: IaC从AWS导出是准确的，文档中的GSI定义应移除
3. ✅ **updatedAt**: 从语义上应保持可选，文档定义正确
4. ✅ **未实现字段**: 标记为"未实现"而非移除，保留供后续开发
5. ✅ **数据质量**: 创建issue后续处理历史数据问题
6. ✅ **bio字段**: 不应该存在，需要调查来源

---

## Lambda函数评分卡

### VoiceFemEvents相关
- ✅ `addVoiceEvent`: 完全符合规范
- ⚠️ `getAllPublicEvents`: 应使用Query GSI而非Scan
- ✅ `getVoiceEvents`: 完全符合规范
- ✅ `autoApproveEvent`: 完全符合规范

### VoiceFemUsers相关
- ⚠️ `getUserProfile`: 返回但不写入基本profile
- ✅ `updateUserProfile`: 正确处理
- ✅ `vfsTrackerUserProfileSetup`: 完全正确，是创建用户的正确入口

### VoiceFemTests相关
- ⚠️ `online-praat-analysis`: 使用与文档不同的字段名和结构

---

## 修复优先级建议

### P0 (本周)
1. 确认VoiceFemTests主键结构
2. 修复VoiceFemUsers数据质量
3. 更新所有文档中的表名
4. 更新VoiceFemTests结构定义

### P1 (下周)
5. 确认GSI并优化getAllPublicEvents
6. 决定updatedAt的必需性
7. 处理未使用字段（移除或标记）

### P2 (两周内)
8. 添加缺失字段文档
9. 说明nickname处理逻辑
10. 更新IaC模板

---

## 文件清单

- **完整分析**: `docs/phase1_dynamodb_analysis.md` (691行)
- **本摘要**: `docs/phase1_summary.md` (本文件)
- **数据来源**: `IaC_Dynamo_Definition&Data/*.json`

---

## 下一步行动

**立即**: 修改data_structures.md等文档（P0任务）  
**然后**: 创建3个后续issue（P1任务）  
**最后**: 进入Phase 2 (API文档审查)
