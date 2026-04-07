# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스 (FASSTO Herald). JIRA Release Note URL을 입력하면 연결된 티켓을 분석하여 비개발자가 이해할 수 있는 업데이트 공지 초안을 자동 생성하고, 편집 후 이메일로 발송할 수 있는 웹 애플리케이션.

## Project Status

구현 완료 (2026-04-02 기준). 6개 화면 + 10개 API 엔드포인트 구현됨.

## Tech Stack

- **Language**: TypeScript 5.x
- **Framework**: Next.js 16 (App Router), React 19
- **Database**: PostgreSQL (Neon via Vercel Marketplace, Prisma 5)
- **Auth**: Auth.js v5 (next-auth@beta) + Google SSO (@fassto.com 도메인 제한)
- **AI**: Vercel AI SDK 6 + @ai-sdk/anthropic
- **Email**: Nodemailer + Gmail SMTP
- **UI**: Tailwind CSS 4 + lucide-react (아이콘) + @dnd-kit (드래그앤드롭)
- **File Upload**: Vercel Blob (스크린샷 업로드)
- **Hosting**: Vercel (서울 리전)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Package Manager**: pnpm

## Commands

```bash
pnpm dev          # 개발 서버 (포트 3100)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
pnpm typecheck    # TypeScript 타입 체크
pnpm test         # Vitest 단위 테스트
pnpm test:e2e     # Playwright E2E 테스트
```

## Figma Design Reference

- **Figma Make fileKey**: `hyat4Po1xsu1rZGUQWSSLq`
- **서비스명**: FASSTO Herald
- **브랜딩**: blue-purple 그라데이션 테마

## Design System (MANDATORY)

이 섹션은 모든 UI 구현에서 반드시 준수해야 합니다. 새로운 화면이나 컴포넌트를 만들 때 이 규칙을 따르세요.

### Figma 1:1 구현 원칙

- 새로운 화면 구현 시 반드시 Figma MCP `get_design_context`로 디자인을 가져와 1:1로 구현한다
- Figma 디자인의 레이아웃, 간격, 색상, 타이포그래피, 아이콘을 충실히 재현한다
- shadcn/ui 컴포넌트보다 Figma 디자인 코드의 스타일링을 우선한다
- Figma 디자인이 없는 화면은 아래 디자인 토큰과 패턴을 따른다

### Brand Identity

- **서비스명**: FASSTO Herald
- **서브타이틀**: Release Note Manager
- **로고**: blue-purple 그라데이션 배경(rounded-xl) + 커스텀 SVG 아이콘
- **슬로건**: "JIRA 릴리즈를 간편한 업데이트 공지로"

### Color Palette

```
Primary Gradient:  from-blue-600 to-purple-600 (버튼, CTA, 헤더 강조)
Background:        from-slate-50 via-blue-50/30 to-purple-50/30 (메인 페이지)
Auth Background:   from-blue-50 via-white to-purple-50 (로그인/회원가입)
Card:              bg-white/80 backdrop-blur-sm (Glassmorphism)
Input Background:  bg-gray-50/80 (입력 필드)
```

### Category Colors

| 카테고리 | Dot | Badge Gradient | Hover |
|---------|-----|----------------|-------|
| 기능 개선 | bg-blue-500 | from-blue-100 to-blue-200 text-blue-700 | hover:bg-blue-50/50 |
| 버그 수정 | bg-red-500 | from-red-100 to-red-200 text-red-700 | hover:bg-red-50/50 |
| 신규 기능 | bg-purple-500 | from-purple-100 to-purple-200 text-purple-700 | hover:bg-purple-50/50 |
| 기타 | bg-gray-400 | from-gray-100 to-gray-200 text-gray-700 | hover:bg-gray-50/50 |

### Status Colors

| 상태 | Badge |
|------|-------|
| 발송 성공 | bg-green-50 text-green-700 + CheckCircle icon |
| 발송 실패 | bg-red-50 text-red-700 + XCircle icon |

### Typography

- **페이지 제목**: text-3xl font-bold text-gray-900
- **섹션 제목**: text-2xl font-bold text-gray-900
- **카드 제목**: text-xl font-semibold text-gray-900
- **본문**: text-sm text-gray-600, leading-relaxed
- **라벨**: text-sm font-medium text-gray-700
- **보조 텍스트**: text-xs text-gray-500
- **폰트**: Pretendard (한글), system-ui fallback

### Layout Patterns

- **메인 컨테이너**: max-w-7xl mx-auto px-6 py-8
- **폼 컨테이너**: max-w-2xl 또는 max-w-3xl
- **헤더**: sticky top-0 z-50, bg-white/80 backdrop-blur-md, border-b border-gray-200/60
- **카드**: rounded-2xl 또는 rounded-3xl, border border-white/60, shadow-xl backdrop-blur-sm
- **CTA 카드**: rounded-3xl, gradient background, shadow-2xl, overflow-hidden + 장식 요소

### Component Patterns

- **버튼 (Primary)**: bg-gradient-to-r from-blue-600 to-purple-600, rounded-lg/2xl, shadow-lg, hover:scale-[1.02]
- **버튼 (Secondary)**: bg-white border-gray-200, rounded-xl/2xl, hover:bg-gray-50
- **입력 필드**: 좌측 아이콘(lucide-react) + pl-10, py-3, rounded-lg, border-gray-300, focus:ring-2 focus:ring-blue-500
- **오류 메시지**: bg-red-50 border-red-200 rounded-lg + AlertCircle icon
- **수신자 태그**: gradient pill (from-blue-500 to-purple-500 text-white rounded-full) + X 삭제
- **드래그 핸들**: GripVertical icon, cursor-grab
- **선택 카드**: border-2, selected: border-blue-500, default: border-gray-200

### Icons (lucide-react)

항상 lucide-react에서 아이콘을 가져옵니다:
- **인증**: Mail, Lock, User, CheckCircle, AlertCircle
- **네비게이션**: ArrowLeft, LogOut, Plus
- **편집**: Edit2, Trash2, GripVertical, Merge, Image as ImageIcon, ChevronDown
- **발송**: Send, Sparkles, X, Loader2
- **이력**: Calendar, Users, CheckCircle, XCircle, FileText

### Glassmorphism Pattern

```
bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60
```

### Gradient Header (미리보기/이력 상세)

```
bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6
```

## Specification Documents

- `feature-spec.md` - 전체 기능명세서 (5개 주요 기능, 수용 기준 포함)
- `user-flow.md` - Mermaid 기반 유저플로우 다이어그램
- `specs/001-jira-release-note-service/` - 상세 스펙, 플랜, 태스크

## Key Integration Points

- **JIRA API**: Atlassian Cloud REST API v3, `/rest/api/3/search/jql` + `/rest/api/3/version/{id}`
- **AI/LLM**: Vercel AI SDK + Anthropic Claude (기술 용어 → 비개발자 관점 변환)
- **Email**: Nodemailer + Gmail SMTP (HTML 이메일 발송)
- **Slack**: Slack Web API — 채널 메시지에서 요청자/작성자 추출 + 배포 완료 스레드 댓글 자동 작성
