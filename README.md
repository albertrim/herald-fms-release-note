# FASSTO Herald

JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스.

JIRA 릴리즈 URL을 입력하면 AI가 티켓을 분석하여 비개발자가 이해할 수 있는 업데이트 공지를 자동 생성하고, 편집 후 이메일로 발송합니다.

## 주요 기능

- **JIRA 연동** — Release Note URL 입력 → 티켓 자동 조회 및 분석
- **AI 변환** — 기술 용어를 비개발자 관점의 개선/변화 사항으로 자동 변환, 핵심 효과 **볼드** 강조
- **유사 티켓 자동 병합** — 제목 유사도 90% 이상인 티켓만 하나의 공지 항목으로 통합
- **초안 편집** — 삭제, 병합, 수정, 드래그앤드롭 순서 변경, 카테고리 지정, 스크린샷 첨부
- **이메일 발송** — HTML 이메일 발송, 수신자 자동완성, 최근 수신자 자동 채움, 발송 이력 관리/삭제, 재발송
- **Slack 연동** — JIRA 커스텀 필드("Slack 링크")에서 URL 추출, 메시지에서 요청자/작성자 이름 자동 추출, 배포 완료 스레드 댓글 자동 작성
- **사용자 인증** — @fassto.com 이메일 인증 (최초 1회 인증 코드, 이후 이메일만으로 로그인)

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | SQLite (Prisma 5) |
| Auth | Auth.js v5 (Credentials, @fassto.com 이메일 인증) |
| AI | Vercel AI SDK + Anthropic Claude |
| Email | Nodemailer (Gmail SMTP) |
| UI | Tailwind CSS 4, lucide-react, @dnd-kit |
| Slack | Slack Web API (conversations.history, users.info, chat.postMessage) |

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm

### 설치

```bash
pnpm install
```

### 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`에 아래 값을 설정합니다:

| 변수 | 설명 |
|------|------|
| `NEXTAUTH_SECRET` | Auth.js 시크릿 키 (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `JIRA_BASE_URL` | Atlassian Cloud URL (예: `https://company.atlassian.net`) |
| `JIRA_API_TOKEN` | JIRA API 토큰 |
| `JIRA_USER_EMAIL` | JIRA 서비스 계정 이메일 |
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `SLACK_BOT_TOKEN` | Slack Bot Token (`xoxb-...`) |
| `SMTP_USER` | Gmail 계정 |
| `SMTP_PASS` | Gmail 앱 비밀번호 |

### DB 초기화

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

시드 데이터: 카테고리 4개 (신규 기능, 기능 개선, UI/UX 변경, 버그 수정)

### 개발 서버

```bash
pnpm dev
```

http://localhost:3100 에서 접속합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 (포트 3100) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 타입 체크 |
| `pnpm test` | Vitest 단위 테스트 |
| `pnpm test:e2e` | Playwright E2E 테스트 |

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 로그인 (이메일 인증)
│   ├── (main)/          # 인증 필수 영역
│   │   ├── dashboard/   # 대시보드 (발송 이력)
│   │   ├── notice/      # URL 입력, 초안 편집, 이메일 발송
│   │   └── history/     # 발송 이력 상세, 재발송, 삭제
│   └── api/             # REST API 엔드포인트
├── components/          # UI 컴포넌트
├── services/            # 비즈니스 로직 (JIRA, AI, Email, Slack)
├── email-templates/     # 이메일 HTML 템플릿
├── lib/                 # 인프라 (auth, prisma, utils, 디자인 토큰)
└── types/               # TypeScript 타입 정의

prisma/
├── schema.prisma        # DB 스키마
├── seed.ts              # 초기 데이터
└── data.db              # SQLite 데이터베이스 (자동 생성)
```

## 사용 흐름

1. **로그인** → @fassto.com 이메일 입력 (최초 1회 인증 코드 검증)
2. **새 공지 생성** → JIRA Release Note URL 입력 (FMS, OMS)
3. **초안 자동 생성** → AI가 티켓 분석, 비개발자 관점으로 변환 (핵심 효과 볼드 강조), Slack 요청자 자동 연결
4. **초안 편집** → 항목 삭제/병합/수정, 순서 변경, 카테고리 지정, 스크린샷 첨부
5. **이메일 발송** → 수신자 설정 (최근 수신자 자동 채움), HTML 미리보기, Slack 댓글 옵션 선택 후 발송
6. **이력 관리** → 발송 이력 조회/삭제, 수신자 편집 후 재발송

## Slack Bot 설정

Slack 메시지에서 요청자 이름을 추출하려면 Bot에 아래 OAuth scope가 필요합니다:

- `channels:read` — 채널 정보 읽기
- `channels:history` — 채널 메시지 읽기
- `channels:join` — 채널 자동 참여 (새로운 채널 링크 발견 시)
- `chat:write` — 배포 완료 스레드 댓글 작성
- `im:write` — DM 발송 (테스트용)
- `users:read` — 사용자 프로필 조회 (멘션 ID → 이름 변환)

### 지원하는 메시지 형식

| 채널 | 패턴 | 예시 |
|------|------|------|
| #ask_system | `*작성자*\n<@USERID>` | 워크플로우 폼 (작성자 필드) |
| #collabo_product | `*[요청자]*\n<@USERID>` | 워크플로우 폼 (요청자 필드) |
| 기타 채널 | 글 작성자 | 일반 메시지 → 작성자 프로필 이름 |

### 주의사항

- `SLACK_BOT_TOKEN`이 시스템 환경변수에 설정되어 있으면 `.env.local` 값보다 우선합니다. 의도치 않은 토큰 사용을 방지하려면 시스템 환경변수에 `SLACK_BOT_TOKEN`이 없는지 확인하세요.
- Bot이 메시지가 있는 채널에 참여되어 있어야 합니다. `channels:join` 스코프가 있으면 자동으로 참여합니다.

## 대상 사용자

물류운영팀, 영업팀, 고객만족팀 등 IT 시스템 변경사항을 이해하고 전달해야 하는 비개발 직군.
