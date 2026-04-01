# Data Model: JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스

**Date**: 2026-04-01

## Entities

### User (사용자)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated |
| email | String | Unique, Not Null |
| passwordHash | String | Not Null |
| name | String | Not Null |
| role | Enum(ADMIN, USER) | Not Null, Default: USER |
| createdAt | DateTime | Not Null, auto |
| updatedAt | DateTime | Not Null, auto |

**Validation**:
- email: 유효한 이메일 형식
- password: 최소 8자 (해시 저장)

### SendHistory (발송 이력)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated |
| userId | UUID | FK → User.id, Not Null |
| title | String | Not Null |
| senderName | String | Not Null |
| recipients | String[] | Not Null, 최소 1개 |
| status | Enum(SUCCESS, FAILED) | Not Null |
| contentSnapshot | JSON | Not Null (발송 시점의 공지 내용 전체) |
| sourceUrls | String[] | Not Null (원본 JIRA Release Note URL 목록) |
| sentAt | DateTime | Not Null, auto |

**Relationships**:
- User 1 → N SendHistory (생성자)
- 모든 인증된 사용자가 조회 가능 (생성자 제한 없음)

**Notes**:
- contentSnapshot은 발송 시점의 공지 항목 전체를 JSON으로 저장 (재발송용)
- 공지 항목의 스크린샷 URL도 contentSnapshot에 포함

### RecipientHistory (수신자 이력)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated |
| email | String | Not Null |
| lastUsedAt | DateTime | Not Null |
| usedCount | Int | Not Null, Default: 1 |

**Notes**:
- 수신자 자동 완성에 사용
- 동일 이메일은 lastUsedAt/usedCount만 업데이트 (Upsert)
- 전체 사용자 공유 (조직 공통 수신자 목록)

### Category (카테고리)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated |
| name | String | Unique, Not Null |
| sortOrder | Int | Not Null, Default: 0 |
| createdAt | DateTime | Not Null, auto |

**Notes**:
- 관리자가 사전 정의
- 초기 시드 데이터: 기능 개선, 버그 수정, 신규 기능, UI/UX 변경

## Session-Only Entities (DB 미저장)

아래 엔티티는 단일 세션 내에서만 존재하며, React 상태로 관리된다.

### DraftNotice (공지 초안 — 세션 전용)

| Field | Type | Description |
|-------|------|-------------|
| sourceUrls | String[] | 원본 JIRA Release Note URL 목록 |
| items | NoticeItem[] | 공지 항목 목록 |
| createdAt | DateTime | 생성 시각 |

### NoticeItem (공지 항목 — 세션 전용)

| Field | Type | Description |
|-------|------|-------------|
| id | String | 클라이언트 생성 고유 ID |
| title | String | 항목 제목 |
| description | String | 항목 설명 (리치 텍스트) |
| categoryId | String \| null | 카테고리 참조 |
| sortOrder | Int | 표시 순서 |
| jiraTicketId | String | 원본 JIRA 티켓 ID |
| jiraTicketUrl | String | 원본 JIRA 티켓 URL |
| slackLink | String \| null | 추출된 Slack 링크 |
| screenshots | String[] | 업로드된 스크린샷 URL (최대 5개) |
| isOriginalText | Boolean | AI 변환 실패 시 true (원본 텍스트) |

## Entity Relationships

```text
User ──1:N──> SendHistory
Category (독립, 공지 항목에서 참조)
RecipientHistory (독립, 자동완성용)

DraftNotice ──1:N──> NoticeItem (세션 내 React 상태)
```

## State Transitions

### 공지 플로우 (세션 기반)

```
[URL 입력] → [JIRA 분석 + AI 변환] → [초안 생성됨]
                                          ↓
                                    [편집 중] ←→ (삭제/병합/수정/순서변경/카테고리/스크린샷)
                                          ↓
                                    [이메일 설정]
                                          ↓
                                    [발송 완료] → SendHistory 저장
```

### SendHistory 상태

```
[발송 시도] → SUCCESS | FAILED
```
