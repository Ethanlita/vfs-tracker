# S3存储桶权限配置指南

## 方案：完全私有存储 + 预签名URL（最安全）

### 存储结构设计
```
vfs-tracker-objstor/
├── avatars/           # 头像存储（私有，通过预签名URL访问）
│   └── {userId}/
│       └── avatar_*.jpg
├── attachments/       # 用户附件（私有）
│   └── {userId}/
│       └── *.pdf, *.doc, etc.
└── uploads/          # 其他上传文件（私有）
    └── {userId}/
        └── *.file
```

### 1. 存储桶策略 (Bucket Policy) - 完全私有
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vfs-tracker-objstor/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalType": "AssumedRole"
        }
      }
    }
  ]
}
```

### 2. CORS配置
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 3. Cognito身份池IAM角色权限
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUserFileOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:DeleteObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::vfs-tracker-objstor/avatars/${cognito-identity.amazonaws.com:sub}/*",
        "arn:aws:s3:::vfs-tracker-objstor/attachments/${cognito-identity.amazonaws.com:sub}/*",
        "arn:aws:s3:::vfs-tracker-objstor/uploads/${cognito-identity.amazonaws.com:sub}/*"
      ]
    }
  ]
}
```

### 4. Lambda函数权限（用于生成其他用户头像的预签名URL）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAvatarAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::vfs-tracker-objstor/avatars/*"
    }
  ]
}
```

## 优势：
- ✅ 完全私有存储，最高安全性
- ✅ 所有文件访问都需要身份验证
- ✅ 预签名URL有时间限制，自动过期
- ✅ 可以为不同用户生成不同权限的URL

## 需要实现的API端点：
1. `/api/avatar/{userId}` - 获取头像预签名URL
2. `/api/file/{fileKey}` - 获取文件预签名URL
3. `/api/upload-url` - 获取上传预签名URL
