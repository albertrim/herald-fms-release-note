# Implementation Plan: Google SSO 인증 및 Gmail API 메일 발송

**Branch**: `002-google-sso-auth` | **Date**: 2026-04-04 | **Spec**: [spec.md](./spec.md)

## Summary

기존 이메일+인증코드 방식 로그인을 Google OAuth 2.0 SSO로 완전 교체하고, 공지 메일 발송 시 공용 SMTP 계정 대신 로그인한 사용자의 Gmail API를 사용한다. Auth.js v5 Prisma Adapter로 OAuth 토큰을 DB에 저장하며, `googleapis` 클라이언트로 Gmail API를 호출한다. 로컬 환경에서 환경변수 설정만으로 동일하게 동작한다.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Next.js 16, Auth.js v5 (next-auth@beta), `@auth/prisma-adapter`, `googleapis`  
**Storage**: SQLite (Prisma 5) — schema 변경 + migration 필요  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Node.js (로컬 개발 + AWS 운영)  
**Project Type**: Web application (Next.js App Router)  
**Constraints**: Google OAuth consent screen — 로컬은 External(테스트 모드), 운영은 Internal  
**Scale/Scope**: 소규모 내부 도구, fassto.com 도메인 사용자

## Constitution Check

| 원칙 | 상태 | 비고 |
|------|------|------|
| I. User-Centric | ✅ | 로그인 UI 단순화, 오류 메시지 한국어 |
| II. Data Integrity | ✅ | SendHistory 변경 없음 |
| III. Security-First | ✅ | OAuth 토큰 서버 DB 저장, 클라이언트 미노출 |
| IV. Simplicity & SOLID | ✅ | YAGNI 준수, 기존 라이브러리(Auth.js) 활용 |
| V. Testable Integrations | ✅ | EmailService 인터페이스 유지, Gmail API 추상화 |
| VI. Design Fidelity | ✅ | 기존 로그인 화면 레이아웃 재사용 (Figma 없음) |

## Project Structure

```text
src/
├── lib/
│   └── auth.ts                          # 변경: Google Provider + Prisma Adapter
├── services/
│   └── email.service.ts                 # 변경: Gmail API로 교체
├── app/
│   ├── (auth)/login/page.tsx            # 변경: Google SSO 버튼으로 교체
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts   # 유지 (핸들러만)
│   │   │   ├── send-code/route.ts       # 삭제
│   │   │   └── verify-code/route.ts     # 삭제
│   │   └── email/send/route.ts          # 변경: REAUTH_REQUIRED 응답 추가
├── types/
│   └── next-auth.d.ts                   # 변경: session 타입 업데이트

prisma/
└── schema.prisma                        # 변경: User 수정, Account/Session 추가

.env.local                               # 변경: GOOGLE_* 추가, SMTP_* 제거
```

## Implementation Phases

### Phase A: 의존성 및 환경 설정

1. 패키지 설치: `@auth/prisma-adapter`, `googleapis`
2. `.env.local` 업데이트:
   - 추가: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - 유지: `NEXTAUTH_SECRET` (또는 `AUTH_SECRET`)
   - 제거: `SMTP_USER`, `SMTP_PASS`
3. Google Cloud Console 설정 지침 문서화

### Phase B: DB Schema 변경

1. `prisma/schema.prisma` 수정:
   - `User`: `verified`/`verificationCode` 제거, `emailVerified`/`image` 추가, `accounts`/`sessions` 관계 추가
   - `Account` 모델 추가 (Auth.js 표준)
   - `Session` 모델 추가 (Auth.js 표준)
   - `VerificationToken` 모델 추가 (어댑터 요구사항)
2. `prisma migrate dev --name add-google-sso` 실행
3. `prisma generate` 실행

### Phase C: Auth.js 설정 교체

1. `src/lib/auth.ts`:
   - `Credentials` provider 제거
   - `Google` provider 추가 (scope: `openid email profile https://www.googleapis.com/auth/gmail.send`, `access_type: offline`, `prompt: consent`)
   - `PrismaAdapter` 추가
   - `session strategy: "database"`로 변경
   - `signIn` 콜백에서 `@fassto.com` 도메인 필터링
   - `session` 콜백에서 `user.id` 포함

2. `src/types/next-auth.d.ts` 업데이트:
   - `session.user.id` 타입 선언 유지

### Phase D: 로그인 UI 교체

1. `src/app/(auth)/login/page.tsx`:
   - 기존 이메일 입력/코드 인증 폼 제거
   - `"Google 계정으로 로그인"` 버튼 1개로 교체
   - `?error=AccessDenied` 파라미터 감지 시 오류 배너 표시
   - 기존 레이아웃(배경, 로고 섹션, 카드) 그대로 유지

### Phase E: 이메일 서비스 교체

1. `src/services/email.service.ts`:
   - 생성자에서 Nodemailer transporter 제거
   - `sendNotice` 파라미터에 `userId` 추가 (기존 유지)
   - DB에서 해당 user의 `Account.access_token` 조회
   - `expires_at` 확인 → 만료 시 `refresh_token`으로 갱신 후 DB 업데이트
   - `googleapis` OAuth2 클라이언트로 Gmail API 호출
   - MIME 메시지 빌드 후 base64url 인코딩하여 전송
   - 갱신 실패 시 `REAUTH_REQUIRED` 에러 throw

2. `src/app/api/email/send/route.ts`:
   - `REAUTH_REQUIRED` 에러 캐치 → `401` 응답 추가

### Phase F: 기존 인증 코드 제거

1. `src/app/api/auth/send-code/route.ts` 삭제
2. `src/app/api/auth/verify-code/route.ts` 삭제

### Phase G: 타입 체크 및 린트

1. `pnpm typecheck` 실행 및 오류 수정
2. `pnpm lint` 실행 및 오류 수정

## Complexity Tracking

해당 없음 — Constitution 위반 없음. `@auth/prisma-adapter`와 `googleapis`는 각각 Auth.js/Google 공식 클라이언트로 직접 구현 대비 명확한 이점이 있음.
