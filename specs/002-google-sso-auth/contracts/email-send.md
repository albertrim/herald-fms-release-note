# API Contract: POST /api/email/send

**변경 유형**: 내부 동작 변경 (인터페이스 동일, 인증 방식 변경)

## 변경 전 (현재)

- 서버가 `SMTP_USER` / `SMTP_PASS` 환경변수로 공용 Gmail 계정을 통해 발송
- 발신자 주소: `SMTP_USER` (고정)

## 변경 후 (이 기능)

- 서버가 로그인한 사용자의 `Account.access_token`을 DB에서 조회하여 Gmail API로 발송
- `access_token` 만료 시 `refresh_token`으로 자동 갱신
- 갱신 실패 시 `401 REAUTH_REQUIRED` 응답

## Request (변경 없음)

```
POST /api/email/send
Authorization: Session cookie (변경 없음)
Content-Type: application/json

{
  "title": string,
  "senderName": string,
  "recipients": string[],
  "items": NoticeItem[],
  "sourceUrls": string[],
  "isResend": boolean?,
  "skipSlack": boolean?
}
```

## Response

### 성공 (변경 없음)
```json
{ "historyId": "string", "status": "SUCCESS", "message": "이메일이 성공적으로 발송되었습니다." }
```

### 실패 — Gmail API 오류 (변경 없음, 폴백 없음)
```json
// HTTP 500
{ "historyId": "string", "status": "FAILED", "error": "EMAIL_SEND_FAILED", "message": "이메일 발송에 실패했습니다." }
```

### 실패 — 재인증 필요 (신규)
```json
// HTTP 401
{ "error": "REAUTH_REQUIRED", "message": "Google 계정 재로그인이 필요합니다." }
```
