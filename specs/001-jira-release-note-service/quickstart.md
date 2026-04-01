# Quickstart: JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스

## Prerequisites

- Node.js 20+
- pnpm (패키지 매니저)
- PostgreSQL 데이터베이스 (Neon 권장)
- JIRA API 토큰
- Anthropic API 키
- Resend API 키
- UploadThing API 키

## Setup

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 아래 값 설정:
#   DATABASE_URL=postgresql://...
#   NEXTAUTH_SECRET=...
#   NEXTAUTH_URL=http://localhost:3000
#   JIRA_BASE_URL=https://jira.company.com
#   JIRA_API_TOKEN=...
#   JIRA_USER_EMAIL=...
#   ANTHROPIC_API_KEY=...
#   RESEND_API_KEY=...
#   UPLOADTHING_TOKEN=...

# 3. DB 마이그레이션
pnpm prisma migrate dev

# 4. 초기 데이터 시드 (카테고리, 관리자 계정)
pnpm prisma db seed

# 5. 개발 서버 시작
pnpm dev
```

## Verify

1. `http://localhost:3000` 접속
2. 시드된 관리자 계정으로 로그인
3. 대시보드 확인
4. "새 공지 생성" 클릭 → URL 입력 페이지 확인
5. JIRA Release Note URL 입력 → 초안 생성 확인
6. 초안 편집 (항목 삭제, 순서 변경, 카테고리 지정) 확인
7. 이메일 발송 설정 → 미리보기 → 발송 확인
8. 대시보드에서 발송 이력 확인

## Commands

```bash
pnpm dev          # 개발 서버
pnpm build        # 프로덕션 빌드
pnpm start        # 프로덕션 서버
pnpm lint         # ESLint
pnpm typecheck    # TypeScript 타입 체크
pnpm test         # Vitest 단위 테스트
pnpm test:e2e     # Playwright E2E 테스트
pnpm prisma studio  # DB GUI
```
