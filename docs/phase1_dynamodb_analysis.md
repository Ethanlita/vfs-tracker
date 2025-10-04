# Phase 1 分析报告：DynamoDB数据结构与文档对比

**分析日期**: 2025-01-XX  
**数据来源**: IaC_Dynamo_Definition&Data/ (VoiceFemEvents.json, VoiceFemUsers.json, VoiceFemTests.json)  
**分析范围**: 数据结构、字段定义、Lambda函数实现

---

## 执行摘要

本报告对比了`data_structures.md`文档定义与DynamoDB实际数据，以及Lambda函数的实现。发现了多处不一致，包括：

- **关键不一致**：VoiceFemTests表的主键字段名（文档：userOrAnonId vs 实际：userId）
- **表名不匹配**：文档中VoiceTests vs 实际VoiceFemTests
- **数据质量问题**：VoiceFemUsers表中2条记录缺少必需字段
- **结构差异**：artifacts/charts字段结构与文档不符
- **未使用字段**：calibration、tests、forms字段在实际数据中不存在

---

## 1. VoiceFemEvents 表

### 1.1 文档定义 (data_structures.md)

**表名**: `VoiceFemEvents`

**主键**:
- Partition Key: `userId` (String)
- Sort Key: `eventId` (String)

**全局二级索引 (GSI)**:
- **StatusDateIndex**
  - Partition Key: `status` (String)
  - Sort Key: `date` (String)
  - Purpose: 高效查询已批准事件用于公共仪表板

**必需字段**: userId, eventId, type, date, details, status, createdAt

**可选字段**: attachments, updatedAt

### 1.2 实际数据统计

| 指标 | 值 |
|------|-----|
| 总记录数 | 75 |
| 有attachments的记录 | 55 (73%) |
| 事件类型分布 | self_test: 70, hospital_test: 2, surgery: 3 |

**字段存在率**:
```
userId:       100% ✅
eventId:      100% ✅
type:         100% ✅
date:         100% ✅
details:      100% ✅
status:       100% ✅
createdAt:    100% ✅
updatedAt:    100% ⚠️  (文档标记为可选)
attachments:   73% ✅  (可选字段)
```

### 1.3 差异与建议

#### ⚠️ 差异1: updatedAt字段的必需性

- **文档**: 标记为可选 (Optional)
- **实际**: 100%的记录都有此字段
- **原因**: `addVoiceEvent` Lambda在创建时就设置了createdAt和updatedAt为相同值
- **影响**: 低 - 实际上总是存在
- **建议**: 将updatedAt标记为必需字段以反映实际情况

#### ⚠️ 差异2: GSI的使用

- **文档**: 定义了StatusDateIndex GSI
- **IaC**: VoiceFemEvents-structure.json中未显示GSI定义
- **Lambda实现**: `getAllPublicEvents`使用`ScanCommand + FilterExpression`而非`Query StatusDateIndex`
- **性能影响**: Scan操作在数据量增长时性能会下降
- **建议**: 
  1. 确认GSI是否真实存在于AWS中
  2. 如果存在，更新Lambda使用Query GSI优化性能
  3. 如果不存在，在IaC中创建或从文档中移除

#### ✅ 正确实现: attachments隐私处理

- `getAllPublicEvents` Lambda正确地从公共响应中剥离了attachments字段
- `getVoiceEvents` Lambda正确地为已认证用户返回了attachments
- 符合文档中的隐私规范

---

## 2. VoiceFemUsers 表

### 2.1 文档定义

**表名**: `VoiceFemUsers`

**主键**:
- Partition Key: `userId` (String)

**必需字段**: userId, email, createdAt

**可选字段**: profile, updatedAt

**Profile对象结构**:
- name (String, optional)
- isNamePublic (Boolean, optional)
- socials (List, optional)
- areSocialsPublic (Boolean, optional)

### 2.2 实际数据统计

| 指标 | 值 |
|------|-----|
| 总记录数 | 13 |

**顶层字段存在率**:
```
userId:       100% ✅
email:         84% ❌ (11/13，文档要求必需)
profile:      100% ⚠️  (文档标记为可选)
createdAt:     84% ❌ (11/13，文档要求必需)
updatedAt:    100% ⚠️  (文档标记为可选)
```

**Profile子字段存在率**:
```
name:                100% (13/13)
isNamePublic:        100% (13/13)
socials:             100% (13/13)
areSocialsPublic:    100% (13/13)
nickname:             84% (11/13) ⚠️ (文档未提及)
bio:                  84% (11/13) ⚠️ (文档未提及)
```

### 2.3 差异与建议

#### ❌ 严重差异1: 必需字段缺失

**问题**: 2条用户记录(15%)缺少`email`和`createdAt`字段

**受影响的记录**: 
- 2个userId（从13条记录中）

**根因分析**:
- 检查了所有Lambda函数：
  - ✅ `vfsTrackerUserProfileSetup`: 正确设置email和createdAt
  - ✅ `updateUserProfile`: 不创建新记录，只更新
  - ⚠️ `getUserProfile`: 返回基本profile但不写入数据库

**可能原因**: 早期测试数据或手动创建的记录

**数据修复方案**:
```sql
-- 方案1: 如果能从Cognito获取email
UPDATE VoiceFemUsers
SET email = <从Cognito获取>,
    createdAt = updatedAt OR <当前时间>
WHERE email IS NULL

-- 方案2: 标记为测试数据并删除
```

**预防措施**:
1. 确保所有创建用户记录的代码路径都设置email和createdAt
2. 考虑在DynamoDB表上添加Required validation（通过应用层或Lambda触发器）

#### ⚠️ 差异2: 未文档化的字段

**profile.nickname**:
- **文档**: 未提及
- **实际**: 84%的记录存在
- **Lambda处理**: 
  - `getUserProfile`从ID Token注入nickname
  - `updateUserProfile`忽略请求中的nickname
  - `vfsTrackerUserProfileSetup`将nickname写入profile
- **建议**: 在文档中说明nickname是从Cognito ID Token获取并写入profile的字段

**profile.bio**:
- **文档**: 未提及
- **实际**: 84%的记录存在
- **Lambda处理**: `vfsTrackerUserProfileSetup`和`updateUserProfile`都支持bio字段
- **建议**: 在文档中添加bio字段定义

#### ⚠️ 差异3: 字段的实际必需性

- **profile字段**: 文档标记为可选，实际100%存在
- **updatedAt字段**: 文档标记为可选，实际100%存在
- **建议**: 考虑将这些字段标记为"实际上总是存在"或"必需"

---

## 3. VoiceFemTests 表

### 3.1 文档定义

**表名**: ❌ `VoiceTests` (文档中)

**主键**:
- Partition Key: ❌ `userOrAnonId` (String)
- Sort Key: `sessionId` (String)

**GSI**:
- **SessionIdIndex**
  - Partition Key: `sessionId`
  - Sort Key: `createdAt`

**必需字段**: userOrAnonId, sessionId, status, createdAt

**可选字段**: calibration, tests, metrics, forms, artifacts

**artifacts对象结构** (文档):
```javascript
{
  timeSeries: String,    // S3 URL
  vrp: String,           // S3 URL
  formants: String,      // S3 URL
  reportPdf: String      // S3 URL
}
```

### 3.2 实际数据统计

**实际表名**: ✅ `VoiceFemTests`

| 指标 | 值 |
|------|-----|
| 总记录数 | 449 |
| 状态分布 | created: 390 (87%), done: 52 (12%), failed: 7 (2%) |

**字段存在率**:
```
sessionId:       100% ✅
status:          100% ✅
createdAt:       100% ✅
userId:          100% ⚠️  (文档中为userOrAnonId)
userOrAnonId:      0% ❌ (文档定义的字段不存在)
updatedAt:        13% (59/449)
metrics:          12% (54/449)
charts:           12% (54/449) ⚠️ (文档中为artifacts)
reportPdf:        12% (54/449) ⚠️ (顶层字段，非嵌套)
errorMessage:      2% (10/449) ⚠️ (文档未提及)

calibration:       0% ❌ (文档定义但不存在)
tests:             0% ❌ (文档定义但不存在)
forms:             0% ❌ (文档定义但不存在)
```

**实际charts对象结构**:
```javascript
{
  timeSeries: String,              // S3 URL
  vrp: String,                     // S3 URL
  formant: String,                 // S3 URL (注意：单数形式)
  formant_spl_spectrum: String     // S3 URL (新增字段)
}
```

### 3.3 差异与建议

#### ❌ 严重差异1: 表名不匹配

- **文档**: `VoiceTests`
- **实际**: `VoiceFemTests`
- **影响**: 中等 - 文档阅读者会困惑
- **建议**: 更新所有文档使用正确的表名`VoiceFemTests`

#### ❌ 严重差异2: 主键字段名完全不匹配

- **文档定义**: Partition Key是`userOrAnonId`
- **实际数据**: 字段名是`userId`，`userOrAnonId`字段不存在
- **IaC定义**: VoiceFemTests-structure.json只显示`sessionId`为HASH key
- **Lambda实现**: `online-praat-analysis/handler.py`使用`userId`字段

**影响**: 高 - 这是关键的主键不一致

**需要确认**:
1. AWS控制台中表的实际Key Schema是什么？
2. 是只有sessionId作为HASH key（单主键）？
3. 还是userId+sessionId复合主键？

**Lambda分析**:
```python
# handler.py 第398行 - 创建session
table.put_item(
    Item={
        'sessionId': session_id,
        'userId': user_id,
        'status': 'created',
        'createdAt': int(datetime.now(timezone.utc).timestamp())
    }
)
```

**建议**:
1. 运行`aws dynamodb describe-table --table-name VoiceFemTests`确认实际Key Schema
2. 更新文档以反映实际结构
3. 如果确实需要userOrAnonId功能（匿名用户），考虑数据迁移

#### ❌ 严重差异3: artifacts vs charts 结构完全不同

**文档定义的artifacts**:
```javascript
{
  timeSeries: String,
  vrp: String,
  formants: String,      // 复数
  reportPdf: String      // 嵌套在artifacts内
}
```

**实际数据结构**:
```javascript
{
  charts: {                        // 字段名不同
    timeSeries: String,
    vrp: String,
    formant: String,               // 单数
    formant_spl_spectrum: String   // 新字段
  },
  reportPdf: String                // 顶层字段，非嵌套
}
```

**Lambda实现** (analysis.py):
```python
# 第189行 - 保存metrics
result_data = {
    'metrics': _to_dynamo(metrics),
    'charts': _to_dynamo(artifact_urls),
    'reportPdf': report_pdf_url,
    ...
}
```

**建议**: 更新文档以匹配实际实现

#### ⚠️ 差异4: 文档定义但从未使用的字段

以下字段在文档中有详细定义，但实际数据中完全不存在：

- **calibration** (0%): 
  ```javascript
  { hasExternal: Boolean, offsetDb: Number, noiseFloorDbA: Number }
  ```
  
- **tests** (0%): 
  ```javascript
  [{ step: String, s3Key: String, durationMs: Number }]
  ```
  
- **forms** (0%): 
  ```javascript
  { RBH: Object, VHI9i: Number, TVQ: Object }
  ```

**实际情况**: 
- 这些数据可能存储在S3中的原始文件
- metrics字段包含了questionnaires信息，对应forms
- 分析结果直接保存，不保存原始tests数组

**建议**:
1. 如果这些字段是未来计划的功能，标记为"预留"或"未实现"
2. 如果不再需要，从文档中移除
3. 考虑添加说明：原始数据存储在S3，DynamoDB只保存分析结果

#### ⚠️ 差异5: 未文档化的字段

**errorMessage** (2%存在):
- 用于记录failed状态的错误信息
- 例子: `"unterminated triple-quoted string literal (detected at line 549)"`
- **建议**: 在文档中添加此字段定义

#### ⚠️ 差异6: GSI定义和使用

- **文档**: 定义了SessionIdIndex GSI
- **IaC**: VoiceFemTests-structure.json未显示GSI
- **Lambda**: 代码中查询使用sessionId，但未确认是否使用GSI
- **建议**: 确认GSI存在并更新IaC文档

---

## 4. Lambda函数数据访问模式详细分析

### 4.1 VoiceFemEvents相关函数

#### ✅ addVoiceEvent (index.mjs)
**行为**:
- 正确设置所有必需字段：userId, eventId, type, date, details, status, createdAt
- 同时设置updatedAt = createdAt（创建时）
- 正确处理可选的attachments字段（清理和验证）
- 使用PutCommand插入
- 从ID Token提取userId

**与文档一致性**: 完全一致 ✅

#### ⚠️ getAllPublicEvents (index.mjs)
**行为**:
- 使用`ScanCommand + FilterExpression`查询status=approved的记录
- 从响应中剥离attachments字段（隐私保护）
- 使用BatchGetCommand批量获取用户显示名称
- 手动按date降序排序

**性能问题**:
```javascript
// 当前实现
const command = new ScanCommand({
    TableName: eventsTableName,
    FilterExpression: "#st = :status_approved",
    ...
});

// 建议实现（如果GSI存在）
const command = new QueryCommand({
    TableName: eventsTableName,
    IndexName: "StatusDateIndex",
    KeyConditionExpression: "#st = :status_approved",
    ScanIndexForward: false,  // 降序
    ...
});
```

**建议**: 如果StatusDateIndex GSI存在，应使用Query优化性能

#### ✅ getVoiceEvents (index.mjs)
**行为**:
- 使用QueryCommand按userId查询（高效）
- 返回包括attachments的完整数据（已认证用户）
- 安全验证：路径中的userId必须匹配ID Token中的userId
- ScanIndexForward: false（按createdAt降序）

**与文档一致性**: 完全一致 ✅

#### ✅ autoApproveEvent (index.mjs)
**行为**:
- DynamoDB Stream触发
- 处理INSERT事件
- 更新status和updatedAt字段
- hospital_test类型调用Gemini API进行验证

**与文档一致性**: 完全一致 ✅

### 4.2 VoiceFemUsers相关函数

#### ⚠️ getUserProfile (index.mjs)
**行为**:
- 从ID Token提取userId
- 使用GetCommand查询
- 如果用户不存在，返回基本profile（不写入数据库）
- 将ID Token的nickname注入到返回的profile中

**潜在问题**:
```javascript
// 第172-186行：用户不存在时
const basicProfile = {
    userId: authenticatedUser.userId,
    email: authenticatedUser.email,
    profile: {
        nickname: authenticatedUser.nickname,
        name: '',
        bio: '',
        isNamePublic: false,
        socials: [],
        areSocialsPublic: false
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
return createResponse(200, basicProfile);
```

- 返回了createdAt但未写入数据库
- 用户体验：看起来有profile但实际不存在于数据库

**建议**: 考虑在此时写入基本profile到数据库

#### ✅ updateUserProfile (index.mjs)
**行为**:
- 验证路径中的userId匹配ID Token
- 使用UpdateCommand更新profile和updatedAt
- 过滤掉请求中的nickname（由Cognito管理）
- 在响应中注入ID Token的nickname

**正确性**: ✅ 但不创建新用户（依赖vfsTrackerUserProfileSetup）

#### ✅ vfsTrackerUserProfileSetup (index.mjs)
**行为**:
- 检查用户是否存在（GetCommand）
- 如果是新用户，设置createdAt
- 如果是现有用户，保留原createdAt
- 设置所有字段：userId, email, profile, updatedAt
- 将Cognito的nickname写入profile
- 使用PutCommand（覆盖式写入）

**正确性**: ✅ 完全正确，解决了email和createdAt的设置

**注意**: 这是创建用户记录的正确入口点

### 4.3 VoiceFemTests相关函数

#### ⚠️ online-praat-analysis (handler.py)

**POST /sessions** (第398行):
```python
table.put_item(
    Item={
        'sessionId': session_id,
        'userId': user_id,  # ← 使用userId而非userOrAnonId
        'status': 'created',
        'createdAt': int(datetime.now(timezone.utc).timestamp())
    }
)
```

**异步分析完成后** (第189行):
```python
result_data = {
    'metrics': _to_dynamo(metrics),
    'charts': _to_dynamo(artifact_urls),  # ← charts而非artifacts
    'reportPdf': report_pdf_url,          # ← 顶层字段
    'status': 'done',
    'updatedAt': int(datetime.now(timezone.utc).timestamp())
}
table.update_item(...)
```

**与文档不一致**:
- 使用userId代替userOrAnonId
- 使用charts代替artifacts
- reportPdf是顶层字段
- 不保存calibration、tests、forms字段

---

## 5. 总结与优先级建议

### 5.1 关键发现总结

| 类别 | 发现 | 严重程度 |
|------|------|----------|
| 字段命名 | VoiceFemTests: userId vs userOrAnonId | 🔴 高 |
| 表名 | VoiceTests vs VoiceFemTests | 🔴 高 |
| 数据质量 | VoiceFemUsers: 2条记录缺少email和createdAt | 🔴 高 |
| 结构差异 | VoiceFemTests: artifacts vs charts结构 | 🔴 高 |
| 未使用字段 | calibration, tests, forms (0%存在) | 🟡 中 |
| GSI使用 | StatusDateIndex未被getAllPublicEvents使用 | 🟡 中 |
| 未文档化字段 | bio, errorMessage, nickname处理 | 🟢 低 |
| 字段必需性 | updatedAt实际上总是存在 | 🟢 低 |

### 5.2 修复优先级

#### 🔴 P0 - 高优先级（影响功能正确性）

1. **确认VoiceFemTests主键结构**
   ```bash
   aws dynamodb describe-table --table-name VoiceFemTests --query 'Table.KeySchema'
   ```
   - 如果是单主键（sessionId），更新文档移除userOrAnonId
   - 如果是复合主键，确认实际字段名并更新文档

2. **修复VoiceFemUsers数据质量**
   - 识别缺少email和createdAt的2条记录
   - 从Cognito获取email并补充
   - 设置createdAt（使用updatedAt或当前时间）

3. **更新表名**
   - 全局替换：VoiceTests → VoiceFemTests
   - 文件：data_structures.md, online_praat_plan.md, online_praat_detailed_plan.md

4. **更新VoiceFemTests的artifacts结构定义**
   - 将artifacts重命名为charts
   - 移除reportPdf从charts内部，标记为顶层字段
   - 更新formants为formant（单数）
   - 添加formant_spl_spectrum字段
   - 添加errorMessage字段说明

#### 🟡 P1 - 中优先级（影响性能和一致性）

5. **确认并优化GSI使用**
   ```bash
   aws dynamodb describe-table --table-name VoiceFemEvents --query 'Table.GlobalSecondaryIndexes'
   aws dynamodb describe-table --table-name VoiceFemTests --query 'Table.GlobalSecondaryIndexes'
   ```
   - 如果StatusDateIndex存在，更新getAllPublicEvents使用Query
   - 如果不存在，创建GSI或从文档移除

6. **标准化updatedAt字段**
   - 决定是否标记为必需
   - 确保所有创建操作都设置此字段

7. **移除或标记未使用的字段**
   - calibration, tests, forms在VoiceFemTests中不存在
   - 选项A：标记为"未实现/预留"
   - 选项B：完全移除并说明数据存储在S3

#### 🟢 P2 - 低优先级（文档完善）

8. **添加缺失字段文档**
   - VoiceFemUsers.profile.bio
   - VoiceFemUsers.profile.nickname（说明来源）
   - VoiceFemTests.errorMessage

9. **说明nickname的特殊处理**
   - 来自Cognito ID Token
   - 由Lambda注入，不可通过API修改
   - 存储在profile中但每次从Token读取

10. **更新IaC模板**
    - 如果GSI存在，添加到IaC定义
    - 确保Key Schema定义完整

### 5.3 数据迁移需求

#### 立即需要的迁移

```javascript
// 修复VoiceFemUsers缺失字段
// 伪代码
const usersWithoutEmail = await scanTable({
  FilterExpression: 'attribute_not_exists(email)'
});

for (const user of usersWithoutEmail) {
  const cognitoEmail = await getCognitoUserEmail(user.userId);
  await updateItem({
    userId: user.userId,
    email: cognitoEmail,
    createdAt: user.updatedAt || new Date().toISOString()
  });
}
```

#### 可能需要的迁移

如果决定实现userOrAnonId功能（支持匿名用户）：
```javascript
// 为VoiceFemTests添加userOrAnonId字段
// 对于现有记录，userOrAnonId = userId
```

### 5.4 测试覆盖建议

为每个Lambda函数创建测试，验证：

1. **字段完整性测试**
   - 所有必需字段都被设置
   - 字段类型正确
   - 枚举值有效

2. **数据结构测试**
   - 嵌套对象结构符合规范
   - 数组字段包含正确类型的元素

3. **边界情况测试**
   - 缺少可选字段
   - 空数组和空对象
   - 新用户 vs 现有用户

---

## 6. 下一步行动

### Phase 1 完成项 ✅

- [x] 导出并分析所有DynamoDB表数据（75+13+449=537条记录）
- [x] 对比文档与实际数据结构
- [x] 分析17个Lambda函数的数据访问模式
- [x] 生成详细差异报告（本文档）

### 等待用户确认

**需要用户回答的问题**:

1. VoiceFemTests的主键结构是什么？（单主键还是复合主键？）
2. 是否需要支持匿名用户（userOrAnonId功能）？
3. StatusDateIndex GSI是否存在？是否应该使用？
4. calibration、tests、forms字段是未来功能还是应该移除？
5. 是否同意修复VoiceFemUsers中的2条不完整记录？

### Phase 2 准备 📋

用户确认后，将进行：
- [ ] API Gateway文档审查（API_Gateway_Documentation.md）
- [ ] Lambda实现与API文档对比
- [ ] 记录API定义与实现的差异
- [ ] 更新API文档

---

**报告生成时间**: 2025-01-XX  
**分析工具**: Python数据分析脚本 + 手动代码审查  
**数据时间戳**: 见IaC_Dynamo_Definition&Data/目录中的JSON文件
