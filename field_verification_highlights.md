# 字段验证分析精华摘要

## 快速统计

📊 **文档定义**: 223 字段  
📊 **数据存在**: 286 字段  
📊 **两者都有**: 164 (73%文档, 57%数据)

**代码覆盖**:  
✅ 写入: 286/286 (100%)  
✅ 读取: 270+/286 (95%+)

## 三类字段分类

### ✅ 类型1: 两者都有 (164个)
核心业务字段，文档和数据完美匹配  
示例: userId, eventId, fundamentalFrequency, full_metrics.sustained.f0_mean

### 📝 类型2: 只在文档 (59个)  
预留功能字段，等待实现  
示例: instructor, practiceContent, content (feeling_log)

### 🔧 类型3: 只在数据 (122个)
实现细节字段，算法内部使用  
示例: error_details, best_segment_time, f0_stats.median

## 100%存在的核心字段

所有记录中都存在：
- events: userId, eventId, type, date, status, createdAt, updatedAt
- users: userId, createdAt  
- tests: sessionId, userId, status, createdAt

## 高使用率字段 (>70%)

- fundamentalFrequency: 72/75 (96%)
- full_metrics: 53/75 (71%)
- jitter: 55/75 (73%)
- shimmer: 55/75 (73%)
- hnr: 53/75 (71%)
- attachments: 55/75 (73%)

## Formants双位置说明

✅ **这是有意的设计，不是数据不一致**

代码同时写入两个位置：
- 顶层 (`full_metrics.formants_low/high`): 向后兼容
- sustained内: 逻辑归属

**建议**: 保持现状

## 数据质量评级

**总体**: A级 (93%字段有数据)  
**VoiceFemEvents**: A级  
**VoiceFemUsers**: A级  
**VoiceFemTests**: A级  

## 关键发现

✅ **优秀表现**:
- 核心字段100%完整
- 数据一致性零错误  
- 文档准确度73%+

⚠️ **需要关注**:
- 2条用户记录缺email (15%)
- profile.bio不应存在 (84%)

---

*详细分析见 field_verification_summary.md*
