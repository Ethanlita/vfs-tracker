# Lambda函数环境变量配置指南

## 必需的环境变量

### S3预签名URL相关的Lambda函数

所有S3预签名URL相关的Lambda函数都需要：

1. **BUCKET_NAME**
   - 描述：S3存储桶名称
   - 示例值：`vfs-tracker-files`
   - 用途：指定文件存储的S3桶

2. **AWS_REGION**
   - 描述：AWS区域
   - 示例值：`us-east-1`
   - 用途：S3客户端配置和预签名URL生成
   - 注意：通常Lambda运行时会自动提供此变量，但明确设置更安全

### DynamoDB相关的Lambda函数

所有访问DynamoDB的Lambda函数都需要：

1. **USERS_TABLE**
   - 描述：用户资料DynamoDB表名
   - 示例值：`VoiceFemUsers`
   - 用途：存储用户资料信息

2. **EVENTS_TABLE**
   - 描述：嗓音事件DynamoDB表名
   - 示例值：`VoiceFemEvents`
   - 用途：存储嗓音训练事件记录

## 各Lambda函数的环境变量需求

### S3文件管理函数

#### getUploadUrl
```
BUCKET_NAME = your-s3-bucket-name
AWS_REGION = us-east-1
```

#### getFileUrl
```
BUCKET_NAME = your-s3-bucket-name
AWS_REGION = us-east-1
```

#### getAvatarUrl
```
BUCKET_NAME = your-s3-bucket-name
AWS_REGION = us-east-1
```

### 嗓音事件管理函数

#### addVoiceEvent
```
EVENTS_TABLE = VoiceFemEvents
AWS_REGION = us-east-1
```

#### getAllPublicEvents
```
EVENTS_TABLE = VoiceFemEvents
AWS_REGION = us-east-1
```

#### getVoiceEvents
```
EVENTS_TABLE = VoiceFemEvents
AWS_REGION = us-east-1
```

### 用户资料管理函数

#### getUserProfile
```
USERS_TABLE = VoiceFemUsers
AWS_REGION = us-east-1
```

#### getUserPublicProfile
```
USERS_TABLE = VoiceFemUsers
AWS_REGION = us-east-1
```

#### updateUserProfile
```
USERS_TABLE = VoiceFemUsers
AWS_REGION = us-east-1
```

#### vfsTrackerUserProfileSetup
```
USERS_TABLE = VoiceFemUsers
AWS_REGION = us-east-1
```

## 现有代码问题修复

⚠️ **发现问题**：部分Lambda函数使用了硬编码的表名，需要修复为使用环境变量。

### 需要修复的函数：
1. **addVoiceEvent** - 硬编码了 `"VoiceFemEvents"`
2. **getAllPublicEvents** - 硬编码了 `"VoiceFemEvents"`  
3. **getVoiceEvents** - 硬编码了 `"VoiceFemEvents"`

### 修复方法：
将硬编码的表名替换为环境变量：
```javascript
// 修复前
const tableName = "VoiceFemEvents";

// 修复后
const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";
```

## AWS控制台配置步骤

### 1. 批量环境变量配置

对于所有Lambda函数，建议使用以下环境变量：

#### 通用环境变量（所有函数）
```
AWS_REGION = us-east-1
```

#### S3文件管理函数额外需要
```
BUCKET_NAME = your-s3-bucket-name
```

#### 嗓音事件管理函数额外需要
```
EVENTS_TABLE = VoiceFemEvents
```

#### 用户资料管理函数额外需要
```
USERS_TABLE = VoiceFemUsers
```

### 2. 通过AWS CLI批量配置

```bash
# S3文件管理函数
for func in getUploadUrl getFileUrl getAvatarUrl; do
  aws lambda update-function-configuration \
    --function-name $func \
    --environment Variables='{BUCKET_NAME=your-s3-bucket-name,AWS_REGION=us-east-1}'
done

# 嗓音事件管理函数
for func in addVoiceEvent getAllPublicEvents getVoiceEvents; do
  aws lambda update-function-configuration \
    --function-name $func \
    --environment Variables='{EVENTS_TABLE=VoiceFemEvents,AWS_REGION=us-east-1}'
done

# 用户资料管理函数
for func in getUserProfile getUserPublicProfile updateUserProfile vfsTrackerUserProfileSetup; do
  aws lambda update-function-configuration \
    --function-name $func \
    --environment Variables='{USERS_TABLE=VoiceFemUsers,AWS_REGION=us-east-1}'
done
```

### 3. 通过CloudFormation/SAM模板配置

```yaml
Parameters:
  S3BucketName:
    Type: String
    Default: vfs-tracker-files
  
  UsersTableName:
    Type: String
    Default: VoiceFemUsers
  
  EventsTableName:
    Type: String
    Default: VoiceFemEvents

Resources:
  # S3文件管理函数
  GetUploadUrlFunction:
    Type: AWS::Lambda::Function
    Properties:
      Environment:
        Variables:
          BUCKET_NAME: !Ref S3BucketName
          AWS_REGION: !Ref AWS::Region
  
  # 用户资料管理函数
  GetUserProfileFunction:
    Type: AWS::Lambda::Function
    Properties:
      Environment:
        Variables:
          USERS_TABLE: !Ref UsersTableName
          AWS_REGION: !Ref AWS::Region
  
  # 嗓音事件管理函数
  AddVoiceEventFunction:
    Type: AWS::Lambda::Function
    Properties:
      Environment:
        Variables:
          EVENTS_TABLE: !Ref EventsTableName
          AWS_REGION: !Ref AWS::Region
```

## 必需的AWS资源

确保以下AWS资源已创建：

### DynamoDB表
1. **VoiceFemUsers** - 用户资料表
2. **VoiceFemEvents** - 嗓音事件表

### S3存储桶
1. **your-s3-bucket-name** - 文件存储桶

### IAM权限
Lambda函数需要相应的IAM权限：
- DynamoDB: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Query`, `dynamodb:Scan`
- S3: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`

## 测试环境变量配置

可以创建一个简单的测试函数来验证环境变量是否正确设置：

```javascript
export const handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      bucketName: process.env.BUCKET_NAME,
      region: process.env.AWS_REGION,
      message: '环境变量配置检查'
    })
  };
};
```

## 故障排除

### 常见问题
1. **BUCKET_NAME未设置**：Lambda函数会抛出错误
2. **AWS_REGION未设置**：可能默认使用Lambda运行的区域
3. **存储桶不存在**：预签名URL生成会失败
4. **权限不足**：即使环境变量正确，如果IAM权限不足也会失败

### 调试方法
- 检查CloudWatch日志中的错误信息
- 使用AWS CLI测试S3访问权限
- 在Lambda函数中添加console.log来检查环境变量值
