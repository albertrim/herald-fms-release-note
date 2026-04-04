# Data Model: Google SSO 인증 및 Gmail API 메일 발송

**Phase**: 1 — Design  
**Feature**: 002-google-sso-auth  
**Date**: 2026-04-04

---

## 변경 요약

| 모델 | 변경 유형 | 내용 |
|------|----------|------|
| `User` | 수정 | `verified`, `verificationCode` 제거 / `emailVerified`, `image` 추가 / `accounts`, `sessions` 관계 추가 |
| `Account` | 신규 | Auth.js 표준 — Google OAuth 토큰 저장 |
| `Session` | 신규 | Auth.js 표준 — 데이터베이스 세션 |
| `VerificationToken` | 신규 | Auth.js 표준 — (현재 미사용, 어댑터 요구사항) |
| `SendHistory` | 유지 | 변경 없음 |
| `RecipientHistory` | 유지 | 변경 없음 |
| `Category` | 유지 | 변경 없음 |

---

## 최종 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./data.db"
}

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  sendHistory   SendHistory[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model SendHistory {
  id              String   @id @default(uuid())
  userId          String
  title           String
  senderName      String
  recipients      String   // JSON array
  status          String   // "SUCCESS" | "FAILED"
  contentSnapshot String   // JSON
  sourceUrls      String   // JSON array
  sentAt          DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
}

model RecipientHistory {
  id         String   @id @default(uuid())
  email      String   @unique
  lastUsedAt DateTime @default(now())
  usedCount  Int      @default(1)
}

model Category {
  id        String   @id @default(uuid())
  name      String   @unique
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}
```

---

## Account 모델 핵심 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `provider` | String | 항상 `"google"` |
| `providerAccountId` | String | Google 사용자 고유 ID |
| `access_token` | String? | Gmail API 호출에 사용, 1시간 유효 |
| `refresh_token` | String? | access_token 만료 시 갱신용, 장기 유효 |
| `expires_at` | Int? | access_token 만료 시각 (Unix timestamp, 초) |

---

## 마이그레이션 전략

1. `prisma migrate dev --name add-google-sso` 실행
2. SQLite는 컬럼 드롭을 위해 테이블 재생성 방식 사용 (Prisma가 자동 처리)
3. 기존 `User` 레코드는 `verified`/`verificationCode` 제거 후 `email` 유지 — 단, 이 사용자들은 Google SSO로 재로그인 시 새 Account 레코드가 생성됨
4. 기존 `SendHistory` 레코드의 `userId`는 UUID 형식 유지이므로 호환 문제 없음
