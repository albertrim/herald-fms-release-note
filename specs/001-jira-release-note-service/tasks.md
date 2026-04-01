# Tasks: JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스

**Input**: Design documents from `/specs/001-jira-release-note-service/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-endpoints.md

**Figma Design**: fileKey `hyat4Po1xsu1rZGUQWSSLq` — 프론트엔드 화면 구현 시 Figma MCP `get_design_context` 호출 → 스크린샷 참조 → 1:1 구현

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Next.js 15 프로젝트 생성 및 기본 도구 설정

- [x] T001 Create Next.js 15 project with TypeScript, App Router, Tailwind CSS 4, pnpm in project root
- [x] T002 Initialize shadcn/ui and install required components (button, input, card, dialog, dropdown-menu, table, badge, toast, checkbox, label, separator) in src/components/ui/
- [x] T003 [P] Configure ESLint and Prettier with TypeScript rules
- [x] T004 [P] Configure Vitest with TypeScript support in vitest.config.ts
- [x] T005 [P] Create .env.example with all required environment variables (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_USER_EMAIL, ANTHROPIC_API_KEY, RESEND_API_KEY, UPLOADTHING_TOKEN)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story 시작 전 완료해야 하는 인프라. DB, 인증, 공통 레이아웃.

**CRITICAL**: 이 Phase가 완료되어야 User Story 구현이 가능합니다.

- [x] T006 Create Prisma schema with User, SendHistory, RecipientHistory, Category models per data-model.md in prisma/schema.prisma
- [x] T007 Create database seed script with default categories (기능 개선, 버그 수정, 신규 기능, UI/UX 변경) and admin account in prisma/seed.ts
- [x] T008 [P] Define shared TypeScript types (DraftNotice, NoticeItem, API request/response types) per data-model.md and contracts in src/types/index.ts
- [x] T009 [P] Create Prisma client singleton in src/lib/prisma.ts
- [x] T010 [P] Create utility functions (cn helper, URL validation) in src/lib/utils.ts
- [x] T011 Configure Auth.js v5 with Credentials provider, Prisma adapter, JWT callback with role, and session callback in src/lib/auth.ts
- [x] T012 Create Auth.js API route handler in src/app/api/auth/[...nextauth]/route.ts
- [x] T013 Create signup API route with password hashing (bcrypt) and email validation in src/app/api/auth/signup/route.ts
- [x] T014 Build login page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq) with email/password form, error message, signup link in src/app/(auth)/login/page.tsx
- [x] T015 [P] Build signup page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq) with email/password/confirm form, login link in src/app/(auth)/signup/page.tsx
- [x] T016 Create root layout with auth session provider, global styles in src/app/layout.tsx
- [x] T017 Create authenticated layout with session check, redirect to login if unauthenticated in src/app/(main)/layout.tsx
- [x] T018 [P] Create common header component with service name, user info, logout button in src/components/layout/header.tsx
- [x] T019 [P] Configure UploadThing file router with image type constraints (PNG/JPG/GIF/WEBP, max 4MB) in src/app/api/uploadthing/route.ts
- [x] T020 Create redirect page (root / → /dashboard) in src/app/page.tsx

**Checkpoint**: 로그인/회원가입 가능, 인증된 사용자만 (main) 영역 접근 가능

---

## Phase 3: User Story 1 — JIRA 연동을 통한 초안 자동 생성 (Priority: P1) MVP

**Goal**: JIRA Release Note URL 입력 → 비개발자용 공지 초안 자동 생성

**Independent Test**: URL 입력 페이지에서 JIRA Release Note URL을 입력하고 '초안 생성' 버튼을 클릭하면, 비개발자 관점의 공지 항목 목록이 화면에 표시된다.

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement JIRA API service with interface (IJiraService) and implementation: fetchReleaseTickets(urls) → tickets array, with error handling per contracts/api-endpoints.md in src/services/jira.service.ts
- [x] T022 [P] [US1] Implement Slack link extractor: extractSlackLinks(ticketContent) → slackLink | null in src/services/slack-extractor.service.ts
- [x] T023 [P] [US1] Implement AI transform service with interface (IAiTransformService) and implementation: transformTickets(tickets) → NoticeItem[] with 1-retry + original-text fallback, using Vercel AI SDK + @ai-sdk/anthropic in src/services/ai-transform.service.ts
- [x] T024 [US1] Implement POST /api/jira/analyze route handler: validate URLs → call JiraService → call AiTransformService → extract Slack links → return NoticeItem[] per contracts/api-endpoints.md in src/app/api/jira/analyze/route.ts
- [x] T025 [US1] Build URL input page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq): default 2 URL fields, add/delete buttons, URL validation, '초안 생성' button, loading state, error display, navigate to edit page on success in src/app/(main)/notice/new/page.tsx

**Checkpoint**: URL 입력 → JIRA 분석 → AI 변환 → 초안 목록 생성 전체 흐름 동작

---

## Phase 4: User Story 2 — 공지 초안 편집 및 사용자 정의 (Priority: P2)

**Goal**: 자동 생성된 초안을 사용자가 편집 (삭제/병합/수정/순서변경/카테고리/스크린샷)

**Independent Test**: 생성된 공지 초안 목록에서 항목 삭제, 병합, 내용 수정, 드래그앤드롭 순서 변경, 카테고리 지정, 스크린샷 첨부를 각각 수행하고 변경 사항이 반영되는지 확인한다.

### Implementation for User Story 2

- [x] T026 [P] [US2] Implement GET /api/categories route returning sorted category list in src/app/api/categories/route.ts
- [x] T027 [P] [US2] Create notice item card component: title, description preview, category badge, Slack link, screenshot thumbnails, delete button, edit button, checkbox for merge selection, isOriginalText badge in src/components/notice/notice-item-card.tsx
- [x] T028 [P] [US2] Create draggable notice list with @dnd-kit/core: DndContext, SortableContext, drag handles, sortOrder update in src/components/notice/notice-list.tsx
- [x] T029 [P] [US2] Create merge dialog: selected items preview, merged content editor (Tiptap), confirm/cancel in src/components/notice/merge-dialog.tsx
- [x] T030 [P] [US2] Create screenshot uploader with UploadThing: upload button, thumbnail grid, max 5 limit, delete individual, file type/size validation in src/components/notice/screenshot-uploader.tsx
- [x] T031 [US2] Build draft edit page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq): integrate notice-list, notice-item-card, merge-dialog, screenshot-uploader, category dropdown, Tiptap editor for description, '이메일 발송' button (Primary), 'URL 재입력' button (Secondary) in src/app/(main)/notice/draft/edit/page.tsx

**Checkpoint**: 초안 편집 전 기능(삭제/병합/수정/순서변경/카테고리/스크린샷) 동작, 편집 → 발송 진행 가능

---

## Phase 5: User Story 3 — 이메일 발송 및 관리 (Priority: P3)

**Goal**: 완성된 공지를 HTML 이메일로 발송, 발송 이력 관리, 재발송

**Independent Test**: 편집 완료된 공지를 이메일로 발송하고, 대시보드에서 발송 이력을 확인하고, 재발송까지 수행한다.

### Implementation for User Story 3

- [x] T032 [P] [US3] Create React Email template: HTML layout with category sections, inline images, Slack links, responsive design in src/email-templates/notice-email.tsx
- [x] T033 [P] [US3] Implement email service with interface (IEmailService) and Resend implementation: sendNotice(config, items) → {historyId, status} in src/services/email.service.ts
- [x] T034 [P] [US3] Create recipient autocomplete input component: text input with debounced API call to /api/recipients/autocomplete, dropdown suggestions sorted by usedCount, tag-style display for selected recipients, add/remove in src/components/email/recipient-input.tsx
- [x] T035 [P] [US3] Create email preview component: render React Email template in iframe, reflect title/sender/recipients in src/components/email/email-preview.tsx
- [x] T036 [US3] Implement POST /api/email/send route: validate request → render React Email → send via Resend → save SendHistory → upsert RecipientHistory per contracts/api-endpoints.md in src/app/api/email/send/route.ts
- [x] T037 [US3] Implement GET /api/recipients/autocomplete route: query filter, usedCount desc sort per contracts in src/app/api/recipients/autocomplete/route.ts
- [x] T038 [US3] Build email send page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq): left panel (title, sender name, recipient input with autocomplete), right panel (HTML preview), send button, success/failure toast in src/app/(main)/notice/draft/send/page.tsx
- [x] T039 [US3] Implement GET /api/history (list, sentAt desc) and GET /api/history/[id] (detail with contentSnapshot) routes in src/app/api/history/route.ts and src/app/api/history/[id]/route.ts
- [x] T040 [US3] Build dashboard page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq): '새 공지 생성' CTA button, send history table (date, title, recipients count, status badge), row click → detail page in src/app/(main)/dashboard/page.tsx
- [x] T041 [US3] Build send history detail page (Figma MCP: fileKey=hyat4Po1xsu1rZGUQWSSLq): send info card (date, title, sender, recipients, status), rendered content snapshot, '재발송' button → navigate to send page with prefilled data, '목록으로' button in src/app/(main)/history/[id]/page.tsx

**Checkpoint**: 이메일 발송, 발송 이력 조회, 재발송 전체 흐름 동작. 대시보드에서 서비스 진입 가능.

---

## Phase 6: User Story 4 — 사용자 인증 및 권한 관리 보강 (Priority: P4)

**Goal**: 역할 기반 접근 제어 (관리자/일반 사용자) 및 인증 흐름 보강

**Independent Test**: 관리자 계정으로 로그인 시 관리자 전용 기능 접근 가능, 일반 사용자 계정으로는 접근 거부 확인.

### Implementation for User Story 4

- [x] T042 [US4] Add role-based access control: middleware check for admin-only routes, role display in header, admin menu items in src/middleware.ts and src/components/layout/header.tsx
- [x] T043 [US4] Implement login/signup form validation: email format, password minimum length (8 chars), confirm password match, error messages in src/app/(auth)/login/page.tsx and src/app/(auth)/signup/page.tsx

**Checkpoint**: 관리자/일반 사용자 역할 구분 동작, 미인증 사용자 접근 차단, 폼 유효성 검증 완료

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 품질 향상 및 횡단 관심사

- [x] T044 [P] Run lint and typecheck across entire codebase, fix all errors
- [x] T045 [P] Input validation hardening: server-side URL validation, email format validation, XSS prevention for rich text content
- [x] T046 [P] Error handling consistency: standardize error response format across all API routes, add user-friendly Korean error messages
- [ ] T047 Run quickstart.md validation: follow all steps and verify end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on US1 (needs generated draft to edit)
- **User Story 3 (Phase 5)**: Depends on US2 (needs edited draft to send)
- **User Story 4 (Phase 6)**: Depends on Foundational (auth infra already exists, adds RBAC)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Foundational → US1. No dependency on other stories.
- **US2 (P2)**: Foundational → US1 → US2. Needs draft data from US1.
- **US3 (P3)**: Foundational → US2 → US3. Needs edited items from US2.
- **US4 (P4)**: Foundational → US4. Independent of US1-3. Can run in parallel with US1.

### Within Each User Story

- Services before API routes
- API routes before pages
- Components (marked [P]) can be built in parallel
- Pages integrate all components and API routes

### Parallel Opportunities

```bash
# Phase 1: All setup tasks after T001
T003, T004, T005 in parallel

# Phase 2: After T006-T007
T008, T009, T010 in parallel
T015, T018, T019 in parallel

# Phase 3 (US1): Service layer
T021, T022, T023 in parallel (then T024, then T025)

# Phase 4 (US2): Components
T026, T027, T028, T029, T030 in parallel (then T031)

# Phase 5 (US3): Services + Components
T032, T033, T034, T035 in parallel (then T036, T037, then T038, T039, then T040, T041)

# Phase 6 (US4): Can run in parallel with US1-US3
T042, T043 in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: URL 입력 → 초안 생성 동작 확인
5. Demo/deploy if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → URL → 초안 생성 (MVP!)
3. US2 → 초안 편집 (삭제/병합/수정/순서/카테고리/스크린샷)
4. US3 → 이메일 발송 + 대시보드 + 이력 관리
5. US4 → 역할 기반 접근 제어 보강
6. Polish → 품질/보안 강화

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Figma MCP: 모든 프론트엔드 페이지 구현 시 `get_design_context(fileKey="hyat4Po1xsu1rZGUQWSSLq")` 호출하여 디자인 1:1 구현
- 공지 초안(DraftNotice, NoticeItem)은 React 상태로만 관리 (DB 미저장, 단일 세션 방식)
- Commit after each task or logical group
