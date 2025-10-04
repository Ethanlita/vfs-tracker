# Phase 1 快速总结：发现的问题一览表

**完整报告**: 请查看 `phase1_dynamodb_analysis.md`

---

## 问题清单

### 🔴 关键问题（必须修复）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **主键字段名不匹配** | VoiceFemTests | 文档：`userOrAnonId` + `sessionId`<br>实际：`userId` + `sessionId` (?) |
| 2 | **表名错误** | 文档 | 文档：`VoiceTests`<br>实际：`VoiceFemTests` |
| 3 | **必需字段缺失** | VoiceFemUsers | 2条记录缺少`email`和`createdAt` (15%) |
| 4 | **结构不匹配** | VoiceFemTests | `artifacts` → 实际是 `charts`<br>`reportPdf`是顶层字段而非嵌套 |

### 🟡 性能与一致性问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 5 | **GSI未使用** | getAllPublicEvents | 用Scan代替Query，性能差 |
| 6 | **未使用字段** | VoiceFemTests | `calibration`, `tests`, `forms` (0%存在) |
| 7 | **字段必需性不准确** | 多处 | `updatedAt`文档说可选，实际100%存在 |

### 🟢 文档完善问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 8 | **缺少字段文档** | VoiceFemUsers | `bio`, `nickname`未记录 |
| 9 | **缺少字段文档** | VoiceFemTests | `errorMessage`未记录 |
| 10 | **nickname处理未说明** | VoiceFemUsers | 来自Cognito，处理逻辑未文档化 |

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

## 待确认问题

请确认以下问题以便继续Phase 2:

1. ❓ **VoiceFemTests主键**: 运行 `aws dynamodb describe-table --table-name VoiceFemTests` 确认实际Key Schema
2. ❓ **匿名用户支持**: 是否需要userOrAnonId功能？还是所有用户都要求认证？
3. ❓ **GSI存在性**: StatusDateIndex是否存在？运行 `aws dynamodb describe-table --table-name VoiceFemEvents --query 'Table.GlobalSecondaryIndexes'`
4. ❓ **未使用字段**: calibration/tests/forms是未来功能还是应从文档移除？
5. ❓ **数据修复**: 是否同意修复VoiceFemUsers中的2条不完整记录？

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

**下一步**: 用户确认上述问题后，进入Phase 2 (API文档审查)
