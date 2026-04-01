# API Endpoints Contract

**Date**: 2026-04-01

## Authentication

### POST /api/auth/[...nextauth]

Auth.js가 관리하는 인증 엔드포인트. 로그인, 회원가입, 세션 관리.

---

## JIRA Integration

### POST /api/jira/analyze

JIRA Release Note URL 목록을 받아 티켓을 분석하고 비개발자용 공지 항목으로 변환.

**Request**:
```json
{
  "urls": ["https://jira.company.com/projects/PROJ/versions/12345"]
}
```

**Response (200)**:
```json
{
  "items": [
    {
      "id": "generated-uuid",
      "title": "주문 조회 화면 검색 필터 추가",
      "description": "이제 주문 상태, 날짜 범위별로 필터링하여 원하는 주문을 빠르게 찾을 수 있습니다.",
      "jiraTicketId": "PROJ-1234",
      "jiraTicketUrl": "https://jira.company.com/browse/PROJ-1234",
      "slackLink": "https://company.slack.com/archives/C123/p456",
      "isOriginalText": false
    }
  ]
}
```

**Response (400)**: URL 형식 오류
```json
{
  "error": "INVALID_URL",
  "message": "유효한 JIRA Release Note URL을 입력해주세요.",
  "details": ["urls[0]: 잘못된 형식"]
}
```

**Response (502)**: JIRA 연동 실패
```json
{
  "error": "JIRA_CONNECTION_FAILED",
  "message": "JIRA 시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
}
```

**Response (404)**: Release를 찾을 수 없음
```json
{
  "error": "RELEASE_NOT_FOUND",
  "message": "해당 Release를 찾을 수 없습니다."
}
```

**Notes**:
- AI 변환 실패 시 해당 항목의 `isOriginalText: true`, `description`에 원본 JIRA 텍스트
- 자동 재시도 1회 포함 (서버 측)
- 인증 필수

---

## Email

### POST /api/email/send

공지를 이메일로 발송.

**Request**:
```json
{
  "title": "2026년 3월 시스템 업데이트 안내",
  "senderName": "IT기획팀",
  "recipients": ["logistics@company.com", "sales@company.com"],
  "items": [
    {
      "title": "주문 조회 화면 검색 필터 추가",
      "description": "<p>이제 주문 상태...</p>",
      "categoryName": "기능 개선",
      "screenshots": ["https://uploadthing.com/xxx.png"],
      "slackLink": "https://company.slack.com/..."
    }
  ],
  "sourceUrls": ["https://jira.company.com/projects/PROJ/versions/12345"]
}
```

**Response (200)**:
```json
{
  "historyId": "uuid",
  "status": "SUCCESS",
  "message": "이메일이 성공적으로 발송되었습니다."
}
```

**Response (500)**: 발송 실패
```json
{
  "historyId": "uuid",
  "status": "FAILED",
  "error": "EMAIL_SEND_FAILED",
  "message": "이메일 발송에 실패했습니다. 수신자 주소를 확인해주세요."
}
```

**Notes**:
- HTML 이메일 생성 (React Email 템플릿)
- 이미지 인라인 포함
- 발송 결과를 SendHistory에 저장
- 수신자를 RecipientHistory에 upsert
- 인증 필수

---

## Recipients

### GET /api/recipients/autocomplete?q={query}

수신자 자동완성.

**Response (200)**:
```json
{
  "recipients": [
    { "email": "logistics@company.com", "usedCount": 5 },
    { "email": "sales@company.com", "usedCount": 3 }
  ]
}
```

**Notes**:
- 쿼리 문자열로 필터링
- usedCount 내림차순 정렬
- 인증 필수

---

## Send History

### GET /api/history

발송 이력 목록 조회.

**Response (200)**:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "2026년 3월 시스템 업데이트 안내",
      "senderName": "IT기획팀",
      "recipientCount": 3,
      "status": "SUCCESS",
      "sentAt": "2026-03-28T09:00:00Z"
    }
  ]
}
```

**Notes**:
- 모든 인증된 사용자 조회 가능
- sentAt 내림차순 정렬

### GET /api/history/{id}

발송 이력 상세 조회.

**Response (200)**:
```json
{
  "id": "uuid",
  "title": "2026년 3월 시스템 업데이트 안내",
  "senderName": "IT기획팀",
  "recipients": ["logistics@company.com", "sales@company.com"],
  "status": "SUCCESS",
  "sentAt": "2026-03-28T09:00:00Z",
  "sourceUrls": ["https://jira.company.com/projects/PROJ/versions/12345"],
  "contentSnapshot": { ... }
}
```

---

## Categories

### GET /api/categories

카테고리 목록 조회.

**Response (200)**:
```json
{
  "categories": [
    { "id": "uuid", "name": "기능 개선", "sortOrder": 0 },
    { "id": "uuid", "name": "버그 수정", "sortOrder": 1 },
    { "id": "uuid", "name": "신규 기능", "sortOrder": 2 },
    { "id": "uuid", "name": "UI/UX 변경", "sortOrder": 3 }
  ]
}
```

---

## File Upload

### POST /api/uploadthing

UploadThing 파일 업로드 엔드포인트.

**Constraints**:
- 허용 형식: PNG, JPG, JPEG, GIF, WEBP
- 최대 파일 크기: 4MB
- 항목당 최대 5개
