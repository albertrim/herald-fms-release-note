# Figma Make Prompt

## 프로젝트 컨텍스트

- 프로젝트: FASSTO Herald (Release Note Manager)
- 기존 화면:
  - `/login` — 이메일+인증코드 로그인 (이번 화면으로 교체)
  - `/dashboard` — 메인 대시보드
  - `/notice/new` — 새 공지 작성
  - `/notice/draft/edit` — 공지 편집
  - `/notice/draft/send` — 공지 발송
  - `/history/[id]` — 발송 이력 상세
- 기술 스택: Next.js 16 App Router, React 19, Tailwind CSS 4, Auth.js v5

## 디자인 시스템 (반드시 적용)

- **Primary Gradient**: `from-blue-600 to-purple-600` (버튼, 로고 배경)
- **Auth Background**: `from-blue-50 via-white to-purple-50` (페이지 배경 그라데이션)
- **Card**: 흰색 배경, `rounded-2xl border border-gray-200 shadow-lg p-8`
- **Border Radius**: `rounded-lg` (버튼), `rounded-2xl` (카드, 로고 박스)
- **Typography**:
  - 서비스명: `text-2xl font-bold text-gray-900`
  - 슬로건: `text-sm text-gray-500`
  - 카드 제목: `text-xl font-semibold text-gray-900 text-center`
  - 안내 텍스트: `text-sm text-gray-500 text-center`
- **버튼 (Primary)**: `bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg py-3 w-full font-semibold shadow-lg`
- **버튼 (Google SSO)**: 흰색 배경, `border border-gray-300 rounded-lg py-3 w-full text-sm font-medium text-gray-700 hover:bg-gray-50`
- **오류 배너**: `bg-red-50 border border-red-200 rounded-lg px-4 py-3` + AlertCircle 아이콘(빨간색) + `text-sm text-red-700`
- **아이콘 라이브러리**: lucide-react (AlertCircle, Loader2)
- **로딩 상태**: Loader2 아이콘 스핀 + 텍스트 변경

## 로고 섹션 (기존 화면과 동일)

```
64×64 rounded-2xl 박스 (bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg)
내부 SVG: 화살표+문서 조합 아이콘 (stroke white, strokeWidth 2)
아래: "FASSTO Herald" (text-2xl font-bold text-gray-900, mt-4)
아래: "JIRA 릴리즈를 간편한 업데이트 공지로" (text-sm text-gray-500, mt-1)
```

## 생성할 화면

### 화면 1: Google SSO 로그인 화면

- **목적**: 기존 이메일+인증코드 2단계 로그인을 단일 "Google 계정으로 로그인" 버튼으로 교체
- **URL**: `/login`

#### 주요 구성요소 (위에서 아래 순서)

1. **페이지 배경**: `min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4`
2. **중앙 컨테이너**: `w-full max-w-md`
3. **로고 섹션**: 그라데이션 아이콘 박스 + 서비스명 + 슬로건 (중앙 정렬, `mb-8`)
4. **카드**:
   - 카드 제목: "로그인" (중앙 정렬, `mb-6`)
   - **Google 로그인 버튼**: 흰색 배경 버튼, 좌측에 Google 컬러 G 로고, "Google 계정으로 로그인" 텍스트 (전체 너비)
   - (오류 발생 시) 빨간 배너: AlertCircle 아이콘 + "@fassto.com 계정만 사용할 수 있습니다." 텍스트
5. **카드 하단 안내**: "@fassto.com 계정으로만 로그인할 수 있습니다." (`text-sm text-gray-500 text-center mt-6`)

#### 레이아웃

- 화면 전체 세로 중앙 정렬
- 로고 섹션 → 카드 단일 컬럼, 입력 필드 없음

#### 상태별 화면

| 상태 | 설명 |
|------|------|
| 기본 | Google 로그인 버튼만 표시 |
| 로딩 | 버튼 내 Loader2 스핀 + "로그인 중..." 텍스트, 버튼 비활성화 |
| 도메인 오류 | 빨간 오류 배너 표시 ("@fassto.com 계정만 사용할 수 있습니다.") |

#### Google 버튼 스펙

- 배경: 흰색
- 테두리: `border border-gray-300`
- 좌측: Google G 로고 (공식 멀티컬러: 파랑/빨강/노랑/초록)
- 텍스트: "Google 계정으로 로그인" (`text-gray-700 text-sm font-medium`)
- 호버: `hover:bg-gray-50`

## 기존 화면과의 연관

- 기존 `/login`의 이메일 입력, 코드 인증 2단계 플로우를 완전히 제거하고 이 화면으로 교체
- 카드 스타일, 로고, 배경 그라데이션은 기존 로그인 화면과 100% 동일하게 유지
- 로그인 성공 시 `/dashboard`로 이동 (기존과 동일)

## 참고

- 기존 화면들의 스타일과 완벽히 일관되게 만들어주세요
- 카드 안에 불필요한 입력 필드 없이 버튼 1개만 있는 단순한 구조
- Google 로고는 공식 SVG 또는 인라인 컬러 G 로고 사용
- `/spec-implement` 실행 시 Figma 디자인을 1:1로 구현합니다
