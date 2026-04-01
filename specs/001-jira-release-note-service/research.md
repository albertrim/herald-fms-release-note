# Research: JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스

**Date**: 2026-04-01

## Framework

- **Decision**: Next.js 15 (App Router)
- **Rationale**: App Router의 Server Components로 JIRA API 호출을 서버 측에서 처리하여 보안 확보. Server Actions로 폼 처리 간소화. 단일 세션 방식의 초안은 React 상태로 관리 가능(DB 불필요).
- **Alternatives considered**: Remix (라우팅은 유사하나 생태계 규모가 작음), SvelteKit (팀 학습 비용)

## Database + ORM

- **Decision**: PostgreSQL (Neon managed) + Prisma 7
- **Rationale**: 사용자, 발송 이력, 수신자 히스토리 등 관계형 데이터에 적합. Prisma의 타입 안전성과 마이그레이션 관리. Neon은 서버리스 환경에서 커넥션 풀링 기본 지원.
- **Alternatives considered**: SQLite (서버리스 배포 불가), Supabase (유사하나 Neon이 Vercel과 더 밀접)

## Authentication

- **Decision**: Auth.js v5 + Prisma adapter
- **Rationale**: Next.js App Router 네이티브 지원. Credentials provider로 이메일/비밀번호 인증. JWT 콜백에서 역할(role) 정보 포함 가능. 자체 DB에 사용자/역할 데이터 저장으로 완전한 제어.
- **Alternatives considered**: Clerk (SaaS 의존성 추가, 내부 도구에 과함), Lucia Auth (v3 이후 유지보수 축소)

## AI/LLM

- **Decision**: Vercel AI SDK 6 + @ai-sdk/anthropic (Claude Sonnet)
- **Rationale**: Next.js Server Actions/Route Handlers에서 네이티브 동작. `generateText`로 일괄 변환(채팅 아닌 일회성 변환). Claude Sonnet은 톤 지시사항 준수에 우수. 재시도 1회 + 실패 시 원본 폴백 정책과 호환.
- **Alternatives considered**: OpenAI GPT-4 (유사 성능이나 비용 차이), 직접 API 호출 (SDK 대비 보일러플레이트 증가)

## Email

- **Decision**: Resend + React Email
- **Rationale**: React 컴포넌트로 HTML 이메일 템플릿 작성 가능(유지보수 용이). 인라인 이미지 지원(Content-ID 헤더). 트랜잭셔널 이메일에 최적화.
- **Alternatives considered**: Nodemailer (SMTP 설정 필요, 저수준), SendGrid (과도한 기능)

## UI Components

- **Decision**: shadcn/ui + Tailwind CSS 4 + dnd-kit + Tiptap
- **Rationale**: shadcn/ui는 복사-붙여넣기 방식으로 커스터마이징 자유도 높음. dnd-kit은 접근성 준수 드래그앤드롭. Tiptap은 리치 텍스트 편집(공지 항목 설명 수정)에 적합.
- **Alternatives considered**: Radix UI 직접 사용 (shadcn이 래핑), react-beautiful-dnd (deprecated), Slate.js (학습 비용)

## Image Upload

- **Decision**: UploadThing
- **Rationale**: Next.js 전용 파일 업로드 라이브러리. S3 기반 클라우드 저장. 타입 안전한 파일 라우트로 크기/형식 제약 설정 간편. 서버리스 환경 호환.
- **Alternatives considered**: Vercel Blob (더 많은 수동 구성 필요), 로컬 디스크 (서버리스 불가)

## Testing

- **Decision**: Vitest (unit/integration) + Playwright (E2E)
- **Rationale**: Vitest는 빠른 ESM 네이티브 테스트, TypeScript 설정과 호환. Playwright는 크로스 브라우저 E2E. 외부 의존성(JIRA, AI, Email)은 서비스 인터페이스를 통해 mock.
- **Alternatives considered**: Jest (ESM 지원 미흡), Cypress (Playwright 대비 느림)
