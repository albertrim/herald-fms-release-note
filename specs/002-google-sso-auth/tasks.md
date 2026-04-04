# Tasks: Google SSO 인증 및 Gmail API 메일 발송

**Input**: Design documents from `/specs/002-google-sso-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 User Story 레이블 (US1, US2, US3)

---

## Phase 1: Setup (패키지 및 환경 설정)

**Purpose**: 필요한 패키지 설치 및 환경변수 설정

- [x] T001 패키지 설치: `pnpm add @auth/prisma-adapter googleapis`
- [x] T002 `.env.local`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 추가 및 `SMTP_USER`, `SMTP_PASS` 제거
- [x] T003 [P] `.env.example`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 항목 추가 및 `SMTP_USER`, `SMTP_PASS` 항목 제거

---

## Phase 2: Foundational (DB Schema 변경)

**Purpose**: 모든 User Story가 의존하는 Prisma 스키마 변경 및 마이그레이션

**⚠️ CRITICAL**: 이 Phase가 완료되기 전까지 User Story 구현을 시작하지 마세요

- [x] T004 `prisma/schema.prisma`의 `User` 모델 수정: `verified`, `verificationCode` 필드 제거 / `emailVerified DateTime?`, `image String?` 추가 / `accounts Account[]`, `sessions Session[]` 관계 추가 / `name String`을 `name String?`으로 변경
- [x] T005 `prisma/schema.prisma`에 `Account`, `Session`, `VerificationToken` 모델 추가 (data-model.md의 최종 스키마 참조)
- [x] T006 `prisma migrate dev --name add-google-sso` 실행
- [x] T007 `prisma generate` 실행

**Checkpoint**: DB 스키마 준비 완료 — User Story 구현 시작 가능

---

## Phase 3: User Story 1 - Google 계정으로 로그인 (Priority: P1) 🎯 MVP

**Goal**: 기존 이메일+코드 방식 로그인을 Google SSO로 완전 교체. @fassto.com 계정만 허용.

**Independent Test**: 로컬에서 Google 계정으로 로그인 버튼 클릭 → Google 동의화면 → 서비스 메인으로 이동 확인. @fassto.com 외 계정으로 시도 시 오류 메시지 표시 확인.

### Implementation for User Story 1

- [x] T008 [US1] `src/lib/auth.ts` 교체: `Credentials` provider 제거, `Google` provider 추가 (scope: `openid email profile https://www.googleapis.com/auth/gmail.send`, `access_type: "offline"`, `prompt: "consent"`), `PrismaAdapter(prisma)` 추가, `session: { strategy: "database" }` 변경, `signIn` 콜백에서 `account.provider === "google"` 및 `profile.email.endsWith("@fassto.com")` 검사(실패 시 `false` 반환 → Auth.js가 `?error=AccessDenied`로 자동 리다이렉트), gmail.send scope를 거부한 경우도 `AccessDenied`로 처리하여 로그인 화면에서 오류 배너 표시, `session` 콜백에서 `session.user.id = user.id` 설정. **참고**: `session: { strategy: "database" }` 전환으로 `signOut()` 호출 시 Auth.js가 DB에서 세션 레코드를 자동 삭제하여 FR-009(로그아웃 시 서버 세션 무효화)가 별도 코드 없이 충족됨
- [x] T009 [P] [US1] `src/types/next-auth.d.ts` 업데이트: database 세션 전략 기준으로 `session.user.id` 타입 선언 유지 확인 및 필요 시 수정
- [x] T010 [US1] `src/app/(auth)/login/page.tsx` 교체: 이메일 입력/코드 인증 폼 전체 제거, `signIn("google")` 호출하는 "Google 계정으로 로그인" 버튼 추가, `useSearchParams`로 `?error=AccessDenied` 감지 시 `"@fassto.com 계정만 사용할 수 있습니다."` 오류 배너 표시, 기존 로고 섹션·카드 레이아웃·배경 그라데이션 유지. **필수**: `useSearchParams()`는 Next.js App Router에서 Suspense 바운더리 필요 — `useSearchParams`를 사용하는 부분을 별도 클라이언트 컴포넌트(`LoginContent`)로 분리하고 page.tsx에서 `<Suspense fallback={null}><LoginContent /></Suspense>`로 감쌀 것

**Checkpoint**: Google SSO 로그인/로그아웃 동작 확인, 도메인 제한 동작 확인

---

## Phase 4: User Story 2 - 로그인한 사용자 계정으로 메일 발송 (Priority: P2)

**Goal**: 공지 메일 발송 시 공용 SMTP 대신 로그인한 사용자의 Gmail API 사용. 발신자 주소 = 로그인 계정.

**Independent Test**: 로그인 후 공지 발송 → 내 @fassto.com 주소가 발신자로 표시된 메일 수신 확인.

### Implementation for User Story 2

- [x] T011 [US2] `src/services/email.service.ts` 교체:
  - 생성자에서 Nodemailer transporter 제거
  - `sendNotice(request, userId)` 내부에서 `prisma.account.findFirst({ where: { userId, provider: "google" } })`로 토큰 조회
  - `account.expires_at * 1000 < Date.now()` 조건으로 만료 확인 → `google.auth.OAuth2` 클라이언트의 `refreshAccessToken()`으로 갱신 → `prisma.account.update`로 `access_token`, `expires_at` 업데이트
  - 갱신 실패 시 `throw new Error("REAUTH_REQUIRED")`
  - `googleapis` `google.auth.OAuth2` 클라이언트에 `access_token` 설정 후 `gmail.users.messages.send` 호출
  - MIME 메시지(From, To, Bcc, Subject, Content-Type, body) 빌드 후 `Buffer.from(mime).toString("base64url")`로 인코딩하여 `raw` 필드에 전달
  - 기존 BCC(`albert.rim@fassto.com`) 정책 유지
- [x] T012 [US2] `src/app/api/email/send/route.ts` 업데이트: `emailService.sendNotice` 호출부를 try/catch로 감싸고, `error.message === "REAUTH_REQUIRED"` 시 `{ error: "REAUTH_REQUIRED", message: "Google 계정 재로그인이 필요합니다." }` 와 HTTP 401 반환

**Checkpoint**: 로그인 사용자 Gmail 계정에서 공지 메일 발송 확인, 토큰 만료 갱신 동작 확인

---

## Phase 5: User Story 3 - 로컬 환경 테스트 지원 (Priority: P3)

**Goal**: Google Cloud Console 설정 없이도 README 참고만으로 로컬 테스트 환경을 구성할 수 있도록 한다.

**Independent Test**: `.env.local`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정 후 `pnpm dev` 실행 → 로컬에서 Google 로그인 및 메일 발송 동작 확인.

### Implementation for User Story 3

- [x] T013 [US3] `.env.example` 주석에 Google Cloud Console 설정 가이드 추가: OAuth 클라이언트 생성 방법, 승인된 리디렉션 URI (`http://localhost:3100/api/auth/callback/google`, 운영 URL), External 동의 화면 + 테스트 사용자 등록 방법 안내

**Checkpoint**: `.env.example` 가이드만으로 신규 개발자가 로컬 환경 구성 가능

---

## Phase 6: Cleanup & Lint

**Purpose**: 기존 인증 코드 완전 제거 및 코드 품질 검증

- [x] T014 [P] `src/app/api/auth/send-code/route.ts` 파일 삭제
- [x] T015 [P] `src/app/api/auth/verify-code/route.ts` 파일 삭제
- [x] T016 `pnpm typecheck` 실행 후 TypeScript 오류 전체 수정
- [x] T017 `pnpm lint` 실행 후 ESLint 오류 전체 수정

---

## Dependencies & Execution Order

### Phase 의존성

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 — **모든 US 구현을 블로킹**
- **Phase 3 (US1)**: Phase 2 완료 후
- **Phase 4 (US2)**: Phase 2 완료 후 (US1과 병렬 가능, DB 의존성만 공유)
- **Phase 5 (US3)**: Phase 1 완료 후 (독립적 — 코드 변경 없음)
- **Phase 6 (Cleanup)**: Phase 3, 4 완료 후

### User Story 내 실행 순서

- T008 (auth.ts) → T010 (login page) — auth.ts 완료 후 login page 구현
- T009 (types) — T008과 병렬 가능
- T011 (email service) → T012 (route) — service 완료 후 route 수정

### 병렬 실행 기회

- T003 (env.example) — Phase 1의 다른 태스크와 병렬
- T009 (types) — T008과 병렬
- T014, T015 (파일 삭제) — Phase 6에서 서로 병렬
- US1(Phase 3)과 US3(Phase 5) — Phase 2 완료 후 병렬 진행 가능

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (DB 마이그레이션)
3. Phase 3: US1 완료 (Google 로그인)
4. **STOP & VALIDATE**: 로컬에서 Google 로그인 동작 확인
5. 검증 후 Phase 4, 5, 6 순차 진행

### Incremental Delivery

1. Phase 1 + 2 → 기반 준비
2. Phase 3 (US1) → Google 로그인 동작 ✅
3. Phase 4 (US2) → Gmail API 발송 동작 ✅
4. Phase 5 (US3) → 로컬 테스트 가이드 완성 ✅
5. Phase 6 → 코드 정리 및 품질 검증 ✅

---

## Notes

- `@auth/prisma-adapter`는 Auth.js v5와 함께 사용 시 `@auth/prisma-adapter` (not `next-auth/prisma-adapter`) 패키지 사용
- Gmail API MIME 인코딩 시 `base64url` (표준 base64 아님) 형식 필수
- Google OAuth `prompt: "consent"` 옵션은 매 로그인마다 refresh_token을 새로 발급받기 위해 필수
- `access_type: "offline"` 없으면 refresh_token이 발급되지 않음
- Phase 2 마이그레이션은 기존 User 레코드를 유지하되, 해당 사용자들은 Google SSO 재로그인 시 새 Account 레코드가 자동 생성됨
