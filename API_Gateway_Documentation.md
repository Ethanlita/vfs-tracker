# VFS Tracker API Documentation

**API Base URL**: `https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev`

**Version**: 1.0  
**Last Updated**: August 15, 2025

---

## Overview

VFS Tracker API provides endpoints for managing voice feminization training events and user data. The API supports both public access for community dashboard and authenticated access for personal event management.

## Authentication

- **Public Endpoints**: No authentication required
- **Private Endpoints**: Require AWS Cognito JWT token in Authorization header
- **User Pool**: `us-east-1_Bz6JC9ko9`
- **Client ID**: `fb5fjoh3k5djvmbl9qq3pdl4q`

## CORS Configuration

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Amz-Date, X-Api-Key`

---

## Endpoints

### GET /all-events

**Description**: Retrieves all approved events for the public community dashboard.

**Authentication**: None required

**Parameters**: None

**Response Format**:
```json
[
  {
    "userId": "string",
    "eventId": "string (UUID)",
    "type": "voice_training | self_test | hospital_test | self_practice | surgery | feeling_log",
    "date": "string (ISO 8601)",
    "details": {
      // Event-specific details based on type
    },
    "createdAt": "string (ISO 8601)"
  }
]
```

**Example Response**:
```json
[
  {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "voice_training",
    "date": "2025-08-15T10:00:00.000Z",
    "details": {
      "trainingContent": "发音练习和气息控制",
      "voiceStatus": "良好",
      "instructor": "张老师",
      "feelings": "今天的训练效果很好"
    },
    "createdAt": "2025-08-15T10:30:00.000Z"
  }
]
```

**HTTP Status Codes**:
- `200 OK`: Success
- `500 Internal Server Error`: Server error

---

### GET /events/{userId}

**Description**: Retrieves all events for a specific authenticated user.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only access their own events. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Response Format**:
```json
[
  {
    "userId": "string",
    "eventId": "string (UUID)",
    "type": "voice_training | self_test | hospital_test | self_practice | surgery | feeling_log",
    "date": "string (ISO 8601)",
    "details": {
      // Event-specific details based on type
    },
    "status": "pending | approved | rejected",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601, optional)"
  }
]
```

**Note**: Returns ALL events for the user (pending, approved, rejected), sorted by date descending.

**HTTP Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to access another user's data
- `500 Internal Server Error`: Server error

---

### POST /events

**Description**: Creates a new event for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "type": "voice_training | self_test | hospital_test | self_practice | surgery | feeling_log",
  "date": "string (ISO 8601)",
  "details": {
    // Event-specific details based on type
  }
}
```

**Server-Generated Fields**: The following fields are automatically generated:
- `userId`: Extracted from JWT token
- `eventId`: Generated UUID v4
- `status`: Set to "pending"
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Response** (201 Created):
```json
{
  "message": "Event added successfully",
  "item": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "voice_training",
    "date": "2025-08-15T10:00:00.000Z",
    "details": {
      "trainingContent": "发音练习",
      "voiceStatus": "良好",
      "instructor": "张老师"
    },
    "status": "pending",
    "createdAt": "2025-08-15T10:30:00.000Z",
    "updatedAt": "2025-08-15T10:30:00.000Z"
  }
}
```

**HTTP Status Codes**:
- `201 Created`: Event created successfully
- `400 Bad Request`: Missing required fields (type, date, details)
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Server error

---

### GET /user/{userId}

**Description**: Retrieves user profile information for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only access their own profile. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Response Format**:
```json
{
  "userId": "string",
  "email": "string",
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional, defaults to false)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional, defaults to false)"
  },
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601, optional)"
}
```

**HTTP Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to access another user's data
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Server error

---

### PUT /user/{userId}

**Description**: Updates user profile information for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only update their own profile. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Request Body**:
```json
{
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional)"
  }
}
```

**Server-Generated Fields**: The following fields are automatically updated:
- `updatedAt`: Current timestamp

**Response** (200 OK):
```json
{
  "message": "User profile updated successfully",
  "user": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "email": "user@example.com",
    "profile": {
      "name": "张三",
      "isNamePublic": true,
      "socials": [
        {
          "platform": "Twitter",
          "handle": "@username"
        }
      ],
      "areSocialsPublic": false
    },
    "createdAt": "2025-08-15T10:00:00.000Z",
    "updatedAt": "2025-08-16T10:30:00.000Z"
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Profile updated successfully
- `400 Bad Request`: Invalid request format or data
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to update another user's profile
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Server error

---

### POST /user/profile-setup

**Description**: Creates or completes user profile setup for new users. This endpoint is designed for the onboarding flow where new users need to complete their profile information.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional, defaults to false)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional, defaults to false)"
  }
}
```

**Server-Generated Fields**: The following fields are automatically generated/updated:
- `userId`: Extracted from JWT token
- `email`: Extracted from JWT token (if not already exists)
- `createdAt`: Current timestamp (for new users)
- `updatedAt`: Current timestamp

**Response** (201 Created for new users, 200 OK for existing users):
```json
{
  "message": "User profile setup completed successfully",
  "user": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "email": "newuser@example.com",
    "profile": {
      "name": "新用户",
      "isNamePublic": false,
      "socials": [],
      "areSocialsPublic": false
    },
    "createdAt": "2025-08-16T10:30:00.000Z",
    "updatedAt": "2025-08-16T10:30:00.000Z"
  },
  "isNewUser": true
}
```

**HTTP Status Codes**:
- `201 Created`: New user profile created successfully
- `200 OK`: Existing user profile updated successfully
- `400 Bad Request`: Invalid request format or data
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Server error

---

### GET /user/{userId}/public

**Description**: Retrieves public profile information for any user. Only returns information that the user has marked as public.

**Authentication**: None required

**Parameters**:
- `userId` (path): User ID to retrieve public information for

**Response Format**:
```json
{
  "userId": "string",
  "profile": {
    "name": "string (only if isNamePublic is true, otherwise returns '（非公开）')",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ]
  }
}
```

**Note**: 
- If `isNamePublic` is false, the `name` field will return "（非公开）"
- If `areSocialsPublic` is false, the `socials` array will be empty
- Non-public users may return minimal information

**HTTP Status Codes**:
- `200 OK`: Success
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

## Data Storage

**Database**: Amazon DynamoDB  
**Table Name**: `VoiceFemEvents`

**Key Structure**:
- Partition Key: `userId` (String)
- Sort Key: `eventId` (String)

**Event Status Values**:
- `pending`: Newly created events awaiting approval
- `approved`: Events approved for public dashboard display
- `rejected`: Events that won't appear on public dashboard

**Indexes**:
- `StatusDateIndex`: Enables efficient querying of approved events by date

---

## Rate Limiting

- **Public endpoints**: No rate limiting currently applied
- **Authenticated endpoints**: Subject to AWS API Gateway default limits

## Support

For technical support or API questions, please refer to the project documentation or contact the development team.
