# Research: Google SSO 인증 및 Gmail API 메일 발송

**Phase**: 0 — Research  
**Feature**: 002-google-sso-auth  
**Date**: 2026-04-04

---

## Decision 1: Auth.js v5 세션 전략 — Database vs JWT

**Decision**: Database 세션 전략 + Prisma Adapter 사용

**Rationale**:
- Google OAuth에서 발급된 `refresh_token`은 최초 1회만 제공됨. JWT 전략은 토큰을 쿠키에 저장하므로 크기 제한(4KB)에 걸리고, 서버 측 무효화가 불가능함.
- `@auth/prisma-adapter`를 사용하면 Auth.js가 `Account` 테이블에 `access_token`과 `refresh_token`을 자동 저장하고, 이를 서버에서 조회하여 Gmail API에 전달할 수 있음.
- Database 전략은 로그아웃 시 서버에서 세션을 즉시 무효화할 수 있어 보안 요구사항(FR-009)에 부합.

**Alternatives considered**:
- JWT + 별도 UserToken 테이블: 표준이 아니며 token 갱신 로직을 직접 구현해야 함.
- JWT + DB 조회: 요청마다 DB 조회가 발생하여 database 전략과 차이 없으면서 복잡도만 증가.

---

## Decision 2: Gmail API 클라이언트 — googleapis vs nodemailer OAuth2

**Decision**: `googleapis` 패키지의 `gmail.users.messages.send` 사용

**Rationale**:
- `googleapis`는 Google 공식 Node.js 클라이언트로 타입 지원이 완전함.
- `google.auth.OAuth2` 클라이언트가 `access_token` + `refresh_token` 조합으로 자동 갱신을 지원.
- MIME 메시지를 base64url로 인코딩하여 `raw` 필드로 전달하는 방식이 표준.

**Alternatives considered**:
- Nodemailer OAuth2 transport: 내부적으로 동일하지만 googleapis 직접 사용 대비 추상화 계층이 추가됨.

---

## Decision 3: Access Token 만료 처리 전략

**Decision**: 이메일 발송 직전 `Account.expires_at` 확인 → 만료 시 `refresh_token`으로 갱신 → DB 업데이트

**Rationale**:
- Google access token은 1시간 유효. 리프레시 토큰은 명시적 취소 전까지 유효.
- `googleapis`의 `OAuth2Client.refreshAccessToken()`으로 새 access_token 획득 가능.
- 갱신 성공 시 `Account` 테이블의 `access_token`과 `expires_at`을 업데이트.
- 갱신 실패(리프레시 토큰 무효화) 시 `401 REAUTH_REQUIRED` 응답으로 클라이언트가 재로그인 안내.

---

## Decision 4: @fassto.com 도메인 제한 적용 위치

**Decision**: Auth.js `signIn` 콜백에서 이메일 도메인 검사

**Rationale**:
- Google OAuth는 모든 Google 계정 로그인을 허용하므로 Auth.js 콜백에서 도메인을 필터링해야 함.
- `signIn` 콜백에서 `false`를 반환하면 Auth.js가 자동으로 오류 페이지로 리다이렉트.
- 오류 URL에 `?error=AccessDenied`가 포함되므로 로그인 페이지에서 감지하여 안내 메시지 표시 가능.

---

## Decision 5: Prisma Schema 변경 범위

**Decision**: `User` 모델에서 `verified`, `verificationCode` 필드 제거 + Auth.js 표준 필드 추가 + `Account`/`Session`/`VerificationToken` 모델 추가

**Rationale**:
- `@auth/prisma-adapter`는 Auth.js 표준 스키마를 요구함 (User에 `emailVerified`, `image` 필드 필요).
- 기존 `verified`/`verificationCode`는 Credentials 인증 전용 필드로 Google SSO 전환 후 불필요.
- SQLite는 `ALTER TABLE DROP COLUMN`을 지원하므로 Prisma migration으로 처리 가능.

---

## Decision 6: 환경변수 추가/제거

**추가**:
- `GOOGLE_CLIENT_ID` — Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth 클라이언트 시크릿
- `AUTH_SECRET` — Auth.js v5 필수 시크릿 (기존 `NEXTAUTH_SECRET` 대체 또는 병행)

**제거**:
- `SMTP_USER`, `SMTP_PASS` — 공용 SMTP 계정 → Gmail API로 교체됨
