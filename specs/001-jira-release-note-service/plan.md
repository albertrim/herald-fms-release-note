# Implementation Plan: JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스

**Branch**: `001-jira-release-note-service` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-jira-release-note-service/spec.md`

## Summary

JIRA Release Note URL을 입력하면 연결된 JIRA 티켓을 자동으로 분석하여 비개발자용 업데이트 공지 초안을 생성하고, 사용자가 편집(삭제/병합/수정/순서변경/카테고리/스크린샷) 후 HTML 이메일로 발송할 수 있는 웹 애플리케이션. Next.js App Router 기반 풀스택 구조로, AI/LLM을 통한 기술 용어 변환, JIRA API 연동, 이메일 발송, 사용자 인증을 포함한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 15 (App Router), React 19, Prisma 7, Auth.js v5, Vercel AI SDK 6, Resend, React Email, shadcn/ui, Tailwind CSS 4, dnd-kit, Tiptap, UploadThing
**Storage**: PostgreSQL (Neon 또는 Supabase managed)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: 데스크톱 웹 브라우저 (Vercel 배포)
**Project Type**: Web application (full-stack)
**Performance Goals**: URL 입력 → 초안 확인 3분 이내, 이메일 발송 설정 → 완료 2분 이내
**Constraints**: 단일 세션 완료 방식 (초안 임시 저장 없음), 서버리스 환경 호환
**Scale/Scope**: 내부 도구, 소규모 사용자 (<100명), 7개 화면
**Figma Design**: fileKey `hyat4Po1xsu1rZGUQWSSLq` — 프론트엔드 구현 시 Figma MCP `get_design_context`로 디자인을 가져와 1:1 구현

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. User-Centric Communication | PASS | AI/LLM 변환으로 기술 용어 제거, UI 텍스트 한국어 비개발자 맞춤 |
| II. Data Integrity & Traceability | PASS | 공지 항목 → JIRA 티켓 ID/URL 참조 유지, Slack 링크 출처 표시 |
| III. Security-First | PASS | JIRA API 키 환경변수 관리, 서버 측 입력 검증, Auth.js 기반 인증 |
| IV. Simplicity & SOLID | PASS | Next.js 단일 프로젝트, 서비스 레이어 단일 책임, YAGNI 준수 |
| V. Testable Integrations | PASS | 외부 의존성(JIRA, AI, Email) 인터페이스 추상화, Vitest mock 가능 |

## Project Structure

### Documentation (this feature)

```text
specs/001-jira-release-note-service/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-endpoints.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                  # Root layout (헤더, 인증 provider)
│   ├── page.tsx                    # 리다이렉트 → /dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx          # 로그인 페이지
│   │   └── signup/page.tsx         # 회원가입 페이지
│   ├── (main)/
│   │   ├── layout.tsx              # 인증 필수 레이아웃
│   │   ├── dashboard/page.tsx      # 대시보드 (발송 이력 + 공지 생성 CTA)
│   │   ├── notice/
│   │   │   ├── new/page.tsx        # URL 입력 페이지
│   │   │   └── [id]/
│   │   │       ├── edit/page.tsx   # 초안 편집 페이지
│   │   │       └── send/page.tsx   # 이메일 설정/미리보기 페이지
│   │   └── history/
│   │       └── [id]/page.tsx       # 발송 이력 상세 페이지
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── jira/analyze/route.ts   # JIRA 연동 + AI 변환
│       ├── email/send/route.ts     # 이메일 발송
│       └── uploadthing/route.ts    # 이미지 업로드
├── components/
│   ├── ui/                         # shadcn/ui 컴포넌트
│   ├── notice/                     # 공지 관련 컴포넌트
│   │   ├── notice-item-card.tsx    # 공지 항목 카드
│   │   ├── notice-list.tsx         # 드래그앤드롭 목록
│   │   ├── merge-dialog.tsx        # 항목 병합 다이얼로그
│   │   └── screenshot-uploader.tsx # 스크린샷 첨부
│   ├── email/                      # 이메일 관련 컴포넌트
│   │   ├── recipient-input.tsx     # 수신자 자동완성 입력
│   │   └── email-preview.tsx       # HTML 미리보기
│   └── layout/
│       └── header.tsx              # 공통 헤더
├── lib/
│   ├── auth.ts                     # Auth.js 설정
│   ├── prisma.ts                   # Prisma client
│   └── utils.ts                    # 유틸리티
├── services/
│   ├── jira.service.ts             # JIRA API 클라이언트 (인터페이스 + 구현)
│   ├── ai-transform.service.ts     # AI/LLM 텍스트 변환 (인터페이스 + 구현)
│   ├── email.service.ts            # 이메일 발송 (인터페이스 + 구현)
│   └── slack-extractor.service.ts  # Slack 링크 추출
├── email-templates/
│   └── notice-email.tsx            # React Email 템플릿
└── types/
    └── index.ts                    # 공유 타입 정의

prisma/
├── schema.prisma                   # DB 스키마
└── seed.ts                         # 초기 데이터 (카테고리, 관리자 계정)

tests/
├── unit/
│   ├── services/
│   │   ├── jira.service.test.ts
│   │   ├── ai-transform.service.test.ts
│   │   └── slack-extractor.service.test.ts
│   └── components/
├── integration/
│   └── api/
└── e2e/
    └── flows/
```

**Structure Decision**: Next.js App Router 단일 프로젝트 구조. 프론트엔드와 백엔드가 동일 프로젝트 내 `app/` (페이지 + API Routes)와 `services/` (비즈니스 로직)로 분리. Constitution의 Simplicity & SOLID 원칙에 따라 불필요한 모노레포 구조를 피하고 단일 프로젝트로 유지.

## Complexity Tracking

> Constitution Check 위반 없음 — 이 섹션은 비어 있음.
