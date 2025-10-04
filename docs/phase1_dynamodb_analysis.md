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

#### ✅ 正确: updatedAt字段保持可选

- **文档**: 标记为可选 (Optional) ✅
- **实际**: 100%的记录都有此字段
- **原因**: `addVoiceEvent` Lambda在创建时就设置了createdAt和updatedAt为相同值
- **分析**: 虽然当前实现在创建时填充了此字段，但从语义上讲，如果事件从未被修改，updatedAt可以不存在。文档定义是正确的。
- **结论**: 保持updatedAt为可选字段，文档无需修改

#### ❌ 差异2: GSI不存在

- **文档**: 定义了StatusDateIndex GSI
- **IaC**: VoiceFemEvents-structure.json中未显示GSI定义（IaC是从AWS导出的，准确反映实际状态）
- **实际**: GSI不存在于AWS中
- **Lambda实现**: `getAllPublicEvents`使用`ScanCommand + FilterExpression`是正确的（因为GSI不存在）
- **性能影响**: Scan操作在数据量增长时性能会下降
- **建议**: 
  1. 从文档中移除StatusDateIndex GSI定义
  2. 创建新issue：添加StatusDateIndex GSI以优化getAllPublicEvents性能（超出本issue范围）

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

#### ❌ 差异1: 必需字段缺失（历史数据问题）

**问题**: 2条用户记录(15%)缺少`email`和`createdAt`字段

**受影响的记录**: 
- 2个userId（从13条记录中）

**根因分析**:
- email和createdAt都应该是必需字段：
  - email是Cognito的必填字段，应该始终从Cognito同步
  - createdAt记录用户首次注册时间，是必需的审计字段
- 检查了所有Lambda函数：
  - ✅ `vfsTrackerUserProfileSetup`: 正确设置email和createdAt（从Cognito获取）
  - ✅ `updateUserProfile`: 不创建新记录，只更新
  - ✅ `getUserProfile`: 返回基本profile但不写入数据库（正确行为）
- **可能原因**: 用户注册较早，当时的代码版本尚未实现这些字段的写入

**数据修复方案**:
- 创建新issue处理历史数据清理：从Cognito获取email并补充缺失的字段
- 修复脚本伪代码：
  ```javascript
  // 从Cognito获取用户信息并更新DynamoDB
  for (userId with missing email/createdAt) {
    cognitoUser = await cognito.getUser(userId);
    await dynamodb.update({
      userId: userId,
      email: cognitoUser.email,
      createdAt: updatedAt || cognitoUser.userCreateDate || now()
    });
  }
  ```

**结论**: 
- 文档定义正确（email和createdAt应为必需）
- Lambda实现正确
- 需要后续issue处理历史数据清理

#### ⚠️ 差异2: 未文档化的字段

**profile.nickname**:
- **文档**: 未提及
- **实际**: 84%的记录存在（与email/createdAt缺失是同一批历史数据）
- **用途**: 系统内的显示名称，在Auth.jsx和MyPage.jsx中展示
- **Lambda处理**: 
  - `getUserProfile`从ID Token注入nickname
  - `updateUserProfile`忽略请求中的nickname（由Cognito管理）
  - `vfsTrackerUserProfileSetup`将nickname从Cognito写入profile
- **数据源**: nickname是Cognito的必填字段，应始终与Cognito保持一致
- **建议**: 在文档中添加nickname字段说明，标注为从Cognito同步的系统字段

**profile.bio**:
- **文档**: 未提及
- **实际**: 84%的记录存在
- **问题**: ⚠️ **此字段不应该存在** - 需要调查是哪段代码创建了这个字段
- **Lambda处理**: `vfsTrackerUserProfileSetup`和`updateUserProfile`都支持bio字段
- **建议**: 调查bio字段的来源，考虑是否应该从代码和文档中移除

#### ✅ 正确: 字段的可选性定义合理

- **profile字段**: 文档标记为可选，实际100%存在
  - 分析：profile在当前实现中总是存在，但从数据模型角度，用户可以选择不填写个人资料
  - 结论：保持为可选是合理的设计
- **updatedAt字段**: 文档标记为可选，实际100%存在
  - 分析：从语义上讲，未修改的记录可以不设置updatedAt
  - 结论：保持为可选是正确的

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

#### ❌ 严重差异1: 表名不匹配（需修改文档）

- **文档**: `VoiceTests`
- **实际**: `VoiceFemTests`
- **影响**: 高 - 文档与实际表名不符
- **行动**: 更新data_structures.md等所有文档，将`VoiceTests`改为`VoiceFemTests`

#### ❌ 严重差异2: 主键字段名不匹配（需修改文档）

- **文档定义**: Partition Key是`userOrAnonId`
- **实际数据**: 字段名是`userId`，`userOrAnonId`字段不存在（0/449条记录）
- **IaC定义**: VoiceFemTests-structure.json显示`sessionId`为HASH key（IaC从AWS导出，准确）
- **Lambda实现**: `online-praat-analysis/handler.py`使用`userId`字段

**影响**: 高 - 文档定义的主键字段实际不存在

**实际Key Schema**（基于IaC）:
- Partition Key: `sessionId` (String) - 单主键
- `userId`是普通属性字段，不是主键的一部分

**Lambda分析**:
```python
# handler.py 第398行 - 创建session
table.put_item(
    Item={
        'sessionId': session_id,  # 主键
        'userId': user_id,        # 普通字段
        'status': 'created',
        'createdAt': int(datetime.now(timezone.utc).timestamp())
    }
)
```

**行动**:
1. 更新文档：主键从`userOrAnonId + sessionId`改为`sessionId`（单主键）
2. 更新文档：将`userOrAnonId`字段定义改为`userId`
3. 匿名用户功能：如需要，可在后续issue中实现（超出本issue范围）

#### ❌ 严重差异3: artifacts vs charts 结构完全不同（需修改文档）

**文档定义的artifacts**:
```javascript
{
  timeSeries: String,
  vrp: String,
  formants: String,      // 复数
  reportPdf: String      // 嵌套在artifacts内
}
```

**实际数据结构**（Lambda实现）:
```javascript
{
  charts: {                        // 字段名是charts，非artifacts
    timeSeries: String,
    vrp: String,
    formant: String,               // 单数形式
    formant_spl_spectrum: String   // 新增字段
  },
  reportPdf: String                // 顶层字段，非嵌套
}
```

**Lambda实现** (analysis.py第189行):
```python
result_data = {
    'metrics': _to_dynamo(metrics),
    'charts': _to_dynamo(artifact_urls),    # 使用charts
    'reportPdf': report_pdf_url,            # 顶层字段
    ...
}
```

**行动**: 以Lambda实现为准，更新data_structures.md:
1. 将`artifacts`改为`charts`
2. `reportPdf`移到顶层
3. `formants`改为`formant`（单数）
4. 添加`formant_spl_spectrum`字段

#### ⚠️ 差异4: 文档定义但从未使用的字段（标记为未实现）

以下字段在文档中有详细定义，但实际数据中完全不存在（0/449条记录）：

- **calibration** (0%): 
  ```javascript
  { hasExternal: Boolean, offsetDb: Number, noiseFloorDbA: Number }
  ```
  - 用途：校准信息
  - 状态：未实现功能
  
- **tests** (0%): 
  ```javascript
  [{ step: String, s3Key: String, durationMs: Number }]
  ```
  - 用途：原始录音文件信息
  - 状态：原始数据存储在S3，不保存到DynamoDB
  
- **forms** (0%): 
  ```javascript
  { RBH: Object, VHI9i: Number, TVQ: Object }
  ```
  - 用途：问卷数据
  - 状态：实际数据在`metrics.questionnaires`中

**行动**: 在文档中将这些字段标记为"预留/未实现"，保留定义以供后续开发参考

#### ⚠️ 差异5: 未文档化的字段（需添加到文档）

**errorMessage** (2%存在):
- 用于记录failed状态的错误信息
- 示例: `"unterminated triple-quoted string literal (detected at line 549)"`
- 存在条件：仅在`status='failed'`时存在
- **行动**: 在文档中添加errorMessage字段说明（可选字段）

#### ❌ 差异6: GSI不存在（需修改文档）

- **文档**: 定义了SessionIdIndex GSI
- **IaC**: VoiceFemTests-structure.json中无GSI定义（IaC从AWS导出，准确反映实际）
- **实际**: SessionIdIndex GSI不存在于AWS中
- **行动**: 
  1. 从文档中移除SessionIdIndex GSI定义
  2. 创建新issue：如需通过sessionId查询，后续添加GSI（超出本issue范围）

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

#### ✅ getAllPublicEvents (index.mjs)
**行为**:
- 使用`ScanCommand + FilterExpression`查询status=approved的记录（因为GSI不存在，这是正确实现）
- 从响应中剥离attachments字段（隐私保护）✅
- 使用BatchGetCommand批量获取用户显示名称 ✅
- 手动按date降序排序

**性能考虑**:
- 当前使用Scan是因为StatusDateIndex GSI不存在
- 在数据量增长时性能会下降
- 建议：创建新issue，添加StatusDateIndex GSI以优化性能（超出本issue范围）

**与文档一致性**: ✅ Lambda实现正确

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

#### ✅ getUserProfile (index.mjs)
**行为**:
- 从ID Token提取userId
- 使用GetCommand查询
- 如果用户不存在，返回基本profile（不写入数据库）
- 将ID Token的nickname注入到返回的profile中

**设计考虑**:
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

**分析**:
- 返回基本profile但不写入是合理的设计
- 用户应通过`vfsTrackerUserProfileSetup`或`updateUserProfile`显式创建/更新profile
- 这种设计避免了隐式创建可能导致的数据不一致

**与文档一致性**: ✅ 实现合理

**改进建议**: 可创建新issue考虑是否在此时写入基本profile（超出本issue范围）

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

#### ✅ online-praat-analysis (handler.py) - 以函数为准，修改文档

**POST /sessions** (第398行):
```python
table.put_item(
    Item={
        'sessionId': session_id,  # 主键
        'userId': user_id,        # 普通字段（非userOrAnonId）
        'status': 'created',
        'createdAt': int(datetime.now(timezone.utc).timestamp())
    }
)
```

**异步分析完成后** (第189行):
```python
result_data = {
    'metrics': _to_dynamo(metrics),
    'charts': _to_dynamo(artifact_urls),  # 字段名是charts
    'reportPdf': report_pdf_url,          # 顶层字段
    'status': 'done',
    'updatedAt': int(datetime.now(timezone.utc).timestamp())
}
table.update_item(...)
```

**结论**:
- Lambda实现是事实标准，文档需要更新以匹配实现
- 使用`userId`字段（文档应改）
- 使用`charts`对象（文档应改）
- `reportPdf`是顶层字段（文档应改）
- 不保存calibration、tests、forms字段（文档应标记为"未实现"）

**行动**: 更新data_structures.md以匹配Lambda实现

---

## 5. 总结与优先级建议

### 5.1 关键发现总结（修订版）

| 类别 | 发现 | 需要的行动 | 严重程度 |
|------|------|-----------|----------|
| 表名 | VoiceTests vs VoiceFemTests | 修改文档 | 🔴 高 |
| 主键字段 | userOrAnonId不存在，实际为userId | 修改文档 | 🔴 高 |
| 结构差异 | artifacts vs charts，reportPdf位置 | 修改文档 | 🔴 高 |
| GSI定义 | 文档定义的GSI不存在 | 修改文档+创建issue | 🟡 中 |
| 数据质量 | 2条记录缺字段 | 创建issue后续处理 | 🟡 中 |
| 未实现字段 | calibration, tests, forms | 标记为"未实现" | 🟡 中 |
| 未文档化字段 | errorMessage, nickname, bio | 添加到文档 | 🟢 低 |
| 字段可选性 | updatedAt定义正确 | 无需修改 ✅ | N/A |

### 5.2 修复优先级（修订版）

#### 🔴 P0 - 立即修改文档（本issue范围内）

1. **更新VoiceFemTests表名**
   - 全局替换：`VoiceTests` → `VoiceFemTests`
   - 影响文件：data_structures.md, API_Gateway_Documentation.md, online_praat_plan.md

2. **更新VoiceFemTests主键定义**
   - 主键：从`userOrAnonId + sessionId`改为`sessionId`（单主键，IaC已确认）
   - 普通字段：将`userOrAnonId`改为`userId`

3. **更新VoiceFemTests结构定义**（以Lambda实现为准）
   - 将`artifacts`改为`charts`
   - 将`reportPdf`从charts内移到顶层
   - `formants` → `formant`（单数）
   - 添加`formant_spl_spectrum`字段

4. **移除不存在的GSI定义**
   - VoiceFemEvents: 移除StatusDateIndex GSI定义
   - VoiceFemTests: 移除SessionIdIndex GSI定义
   - （IaC从AWS导出，准确反映实际，GSI确实不存在）

5. **标记未实现字段**
   - 将calibration, tests, forms标记为"预留/未实现"
   - 保留定义供后续开发参考

6. **添加缺失字段文档**
   - 添加errorMessage字段（可选，status='failed'时存在）
   - 添加nickname字段说明（从Cognito同步，系统字段）
   - bio字段标记为"需要调查来源"

#### 🟡 P1 - 创建后续issue（超出本issue范围）

7. **数据清理issue**: "修复VoiceFemUsers历史数据缺失字段"
   - 从Cognito获取email和nickname
   - 补充createdAt时间戳（2条记录）

8. **性能优化issue**: "添加GSI提升DynamoDB查询性能"
   - VoiceFemEvents: 添加StatusDateIndex GSI
   - 更新getAllPublicEvents使用Query代替Scan
   - 评估VoiceFemTests是否需要SessionIdIndex GSI

9. **代码审查issue**: "调查bio字段来源并决定是否保留"
   - 确认bio字段是否为计划功能
   - 如不需要，从Lambda和文档中移除

#### ✅ 无需修改

10. **updatedAt字段** - 文档定义为可选是正确的，保持现状
11. **profile字段** - 文档定义为可选是合理的，保持现状
12. **Lambda函数** - 大部分实现正确，以代码为准更新文档

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
- [x] 根据用户反馈修订分析结论

### 用户反馈已确认 ✅

基于用户comment，以下问题已明确：

1. ✅ **VoiceFemTests主键**: IaC准确，单主键`sessionId`，`userId`是普通字段
2. ✅ **GSI不存在**: IaC从AWS导出是准确的，文档中的GSI定义需要移除
3. ✅ **updatedAt可选性**: 从语义上应保持可选，文档定义正确
4. ✅ **未实现字段**: calibration/tests/forms标记为"未实现"而非移除
5. ✅ **数据质量问题**: email/createdAt缺失是历史数据问题，创建issue后续处理
6. ✅ **bio字段**: 不应该存在，需要调查来源

### 立即行动项 📝

本issue范围内需要完成：
- [ ] 更新data_structures.md（表名、主键、结构定义）
- [ ] 移除不存在的GSI定义
- [ ] 添加缺失字段文档（errorMessage, nickname说明）
- [ ] 标记未实现字段

### 后续issue ⏭️

需要创建的新issue：
1. 数据清理：修复VoiceFemUsers历史数据
2. 性能优化：添加GSI提升查询性能  
3. 代码审查：调查bio字段来源

### Phase 2 准备 📋

完成文档修改后，将进行：
- [ ] API Gateway文档审查（API_Gateway_Documentation.md）
- [ ] Lambda实现与API文档对比
- [ ] 记录API定义与实现的差异
- [ ] 更新API文档

---

**报告生成时间**: 2025-01-XX  
**分析工具**: Python数据分析脚本 + 手动代码审查  
**数据时间戳**: 见IaC_Dynamo_Definition&Data/目录中的JSON文件
