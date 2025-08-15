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

## Event Types and Details Structure

### voice_training
```json
{
  "trainingContent": "string (required)",
  "selfPracticeContent": "string (optional)",
  "voiceStatus": "string (required)",
  "references": "string (optional)",
  "voicing": "string (required)",
  "feelings": "string (optional)",
  "instructor": "string (optional)"
}
```

### self_test
```json
{
  "appUsed": "string (optional)",
  "sound": ["array of strings (required)"],
  "customSoundDetail": "string (optional)",
  "voicing": ["array of strings (required)"],
  "customVoicingDetail": "string (optional)",
  "fundamentalFrequency": "number (optional)",
  "formants": {"f1": "number", "f2": "number"},
  "pitch": {"max": "number", "min": "number"},
  "jitter": "number (optional)",
  "shimmer": "number (optional)",
  "hnr": "number (optional)",
  "attachmentUrl": "string (optional)",
  "notes": "string (optional)"
}
```

### hospital_test
Same as `self_test` with additional fields:
```json
{
  "location": "string (required)",
  "equipmentUsed": "string (optional)"
}
```

### self_practice
```json
{
  "practiceContent": "string (required)",
  "hasInstructor": "boolean (required)",
  "instructor": "string (optional)",
  "references": "string (optional)",
  "voiceStatus": "string (required)",
  "voicing": "string (required)",
  "feelings": "string (optional)"
}
```

### surgery
```json
{
  "doctor": "string (required) - enum or '自定义'",
  "customDoctor": "string (optional)",
  "location": "string (required) - enum or '自定义'",
  "customLocation": "string (optional)",
  "notes": "string (optional)"
}
```

### feeling_log
```json
{
  "content": "string (required)"
}
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "message": "Error description",
  "error": "Detailed error information"
}
```

**Common Error Codes**:
- `400 Bad Request`: Invalid request format
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
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
