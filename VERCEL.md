# FASSTO Herald — Vercel 배포 가이드

> **최종 업데이트**: 2026-04-07

## 아키텍처

```
herald.fassto.ai / herald.vercel.app
            │
    ┌───────▼────────┐
    │  Vercel (icn1)  │
    │  Next.js 16     │
    └──┬──────────┬───┘
       │          │
┌──────▼──┐  ┌───▼──────────────┐
│  Neon    │  │  Vercel Blob     │
│  Postgres│  │  (스크린샷 업로드) │
└─────────┘  └──────────────────┘
```

| 항목 | 선택 | 근거 |
|------|------|------|
| 호스팅 | **Vercel** (서울 리전) | Next.js 네이티브, zero-config |
| DB | **Neon PostgreSQL** (Vercel Marketplace) | Serverless, 자동 스케일링 |
| 파일 스토리지 | **Vercel Blob** | 스크린샷 업로드, public access |
| 도메인 | herald.vercel.app + herald.fassto.ai | Vercel Domains |

---

## 1. Vercel 프로젝트 설정

### 1-1. 프로젝트 연결

1. [vercel.com](https://vercel.com) 에서 GitHub 리포 Import
2. Framework Preset: **Next.js** (자동 감지)
3. Region: **Seoul (icn1)** 선택

### 1-2. Vercel Marketplace 연동

**Neon PostgreSQL** (Storage > Neon Postgres > Create):
- `DATABASE_URL` 환경변수 자동 주입

**Vercel Blob** (Storage > Blob > Create):
- `BLOB_READ_WRITE_TOKEN` 환경변수 자동 주입

### 1-3. 환경변수 설정

Vercel Dashboard > Settings > Environment Variables:

| 변수 | 설명 | 자동 주입 |
|------|------|----------|
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 | O (Marketplace) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 토큰 | O (Marketplace) |
| `NEXTAUTH_SECRET` | Auth.js 시크릿 키 (64자+) | |
| `NEXTAUTH_URL` | `https://herald.fassto.ai` | |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | |
| `JIRA_BASE_URL` | `https://fssuniverse.atlassian.net` | |
| `JIRA_API_TOKEN` | JIRA API 토큰 | |
| `JIRA_USER_EMAIL` | `albert.rim@fassto.com` | |
| `ANTHROPIC_API_KEY` | Anthropic API 키 | |
| `ANTHROPIC_BASE_URL` | `https://litellm.fassto.ai` (선택) | |
| `ANTHROPIC_MODEL` | `claude-opus-4-6` (선택, 기본: `claude-sonnet-4-20250514`) | |
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 | |

### 1-4. 도메인 설정

Vercel Dashboard > Settings > Domains:

1. `herald.vercel.app` — 자동 할당
2. `herald.fassto.ai` — 추가 후 DNS 설정:
   - Route 53에 **CNAME** 레코드: `herald.fassto.ai` → `cname.vercel-dns.com`
   - 또는 A 레코드: `76.76.21.21`

---

## 2. 배포

### 빌드 파이프라인

```
pnpm install → postinstall (prisma generate) → next build
```

`postinstall` 스크립트가 `prisma generate`를 자동 실행하므로 별도 설정 불필요.

### 2-1. 최초 배포

```bash
# 1. 로컬에서 Vercel 환경변수 동기화
vercel env pull .env.local

# 2. DB 스키마 적용 (Neon에 테이블 생성)
npx prisma db push

# 3. 시드 데이터 (카테고리 4개)
npx tsx prisma/seed.ts

# 4. 배포 (main 브랜치 push 시 자동 배포)
git push origin main
```

### 2-2. 이후 업데이트

`main` 브랜치에 push하면 자동 배포됩니다.
PR 생성 시 Preview 배포가 자동으로 생성됩니다.

### 2-3. DB 스키마 변경 시

```bash
# schema.prisma 수정 후
npx prisma db push
```

---

## 3. 외부 API 접근 (Outbound HTTPS)

| 서비스 | 도메인 | 용도 |
|--------|--------|------|
| Neon PostgreSQL | `*.neon.tech` | 데이터베이스 |
| JIRA | `fssuniverse.atlassian.net` | Release Note 티켓 조회 |
| Anthropic (LiteLLM) | `litellm.fassto.ai` | AI 텍스트 변환 |
| Slack | `slack.com` | 메시지 조회, 요청자 추출, 댓글 작성 |
| Gmail API | `googleapis.com` | 이메일 발송 (사용자 OAuth 토큰) |
| Vercel Blob | `*.public.blob.vercel-storage.com` | 스크린샷 업로드/조회 |

---

## 4. 체크리스트

### 배포 전

- [ ] Vercel 프로젝트 생성 (리전: icn1 서울)
- [ ] Neon PostgreSQL 연동 (Vercel Marketplace)
- [ ] Vercel Blob 연동 (Vercel Marketplace)
- [ ] 환경변수 설정 (위 표 참고)
- [ ] Google OAuth 리디렉션 URI 추가: `https://herald.fassto.ai/api/auth/callback/google`
- [ ] 도메인 설정: herald.fassto.ai (DNS CNAME → cname.vercel-dns.com)
- [ ] `npx prisma db push` — Neon에 테이블 생성
- [ ] `npx tsx prisma/seed.ts` — 시드 데이터

### 배포 후

- [ ] `https://herald.fassto.ai` 접속 확인
- [ ] Google SSO 로그인 동작
- [ ] JIRA 릴리즈 URL → 초안 생성 동작
- [ ] 이메일 발송 동작
- [ ] 스크린샷 업로드 → Vercel Blob 저장 확인
