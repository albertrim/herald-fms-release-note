# Feature Specification: Google SSO 인증 및 Gmail API 메일 발송

**Feature Branch**: `002-google-sso-auth`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "이제 회원가입, 로그인 및 메일 발송은 구글 SSO로 진행하는 것을 구현, 로컬 환경에서 테스트도 가능토록. 별도 브랜치 생성."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Google 계정으로 로그인 (Priority: P1)

fassto.com 구성원은 별도 회원가입 없이 "Google로 로그인" 버튼 클릭 한 번으로 서비스에 접근할 수 있다. 기존 이메일 인증 코드 방식은 제거된다.

**Why this priority**: 인증이 없으면 서비스 전체가 동작하지 않는다. Google SSO는 기존 이메일+코드 방식을 완전히 대체한다.

**Independent Test**: 로컬 환경에서 Google 계정으로 로그인 후 메인 화면 진입이 가능하면 테스트 완료.

**Acceptance Scenarios**:

1. **Given** 로그인 화면, **When** @fassto.com 계정으로 Google SSO 로그인, **Then** 서비스 메인 화면으로 이동
2. **Given** 로그인 화면, **When** @fassto.com 이외 Google 계정으로 로그인 시도, **Then** 접근 거부 메시지 표시 후 로그인 화면 유지
3. **Given** 로그인된 상태, **When** 로그아웃 버튼 클릭, **Then** 로그인 화면으로 이동하고 세션 종료
4. **Given** 미인증 상태, **When** 보호된 페이지 직접 접근, **Then** 로그인 화면으로 자동 리다이렉트

---

### User Story 2 - 로그인한 사용자 계정으로 메일 발송 (Priority: P2)

공지 메일을 발송할 때 공용 SMTP 계정 대신 현재 로그인한 사용자의 Google 계정을 발신자로 사용한다. 수신자는 실제 발송자의 이메일 주소를 발신자로 확인할 수 있다.

**Why this priority**: 로그인이 완료된 후 구현 가능하며, 메일 발신자 신뢰도를 높이는 핵심 기능이다.

**Independent Test**: 로그인 후 공지 발송 시 내 Google 계정 주소가 발신자로 표시된 메일이 도착하면 테스트 완료.

**Acceptance Scenarios**:

1. **Given** Google SSO로 로그인된 상태, **When** 공지 메일 발송, **Then** 발신자 주소가 로그인한 사용자의 @fassto.com 이메일
2. **Given** OAuth 토큰 만료 상태, **When** 메일 발송 시도, **Then** 자동으로 토큰 갱신 후 발송
3. **Given** 토큰 갱신 실패 상태, **When** 메일 발송 시도, **Then** 재로그인 안내 메시지 표시

---

### User Story 3 - 로컬 환경 테스트 지원 (Priority: P3)

개발자가 로컬 환경(localhost:3100)에서도 Google SSO 로그인과 Gmail 발송을 실제로 테스트할 수 있다.

**Why this priority**: P1, P2 구현이 완료된 이후에도 지속적인 개발·검증을 위해 필요하다.

**Independent Test**: Google Cloud Console에 localhost:3100을 등록하고, 테스트 계정으로 로컬에서 전체 플로우(로그인 → 발송)가 동작하면 테스트 완료.

**Acceptance Scenarios**:

1. **Given** Google Cloud Console에 localhost:3100 리다이렉트 URI 등록, **When** 로컬 서버에서 Google 로그인, **Then** 정상 인증 완료
2. **Given** 로컬 환경 `.env.local`에 Google OAuth 클라이언트 정보 설정, **When** 로컬에서 메일 발송, **Then** Gmail API를 통해 실제 메일 발송

---

### Edge Cases

- @fassto.com이 아닌 Google 계정(개인 gmail.com 등)으로 로그인 시도하면 어떻게 되는가?
- Gmail API 권한(gmail.send 스코프)을 사용자가 동의 화면에서 거부하면 어떻게 되는가?
- OAuth 액세스 토큰은 1시간 후 만료되는데, 장시간 작업 중 만료되면 어떻게 되는가?
- 기존 이메일+코드 방식으로 생성된 사용자 데이터는 어떻게 처리되는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 Google OAuth 2.0을 통한 로그인을 제공해야 한다
- **FR-002**: 로그인은 @fassto.com 도메인 Google 계정으로만 허용해야 한다
- **FR-003**: 기존 이메일 인증 코드 방식 로그인은 완전 제거되어야 한다 — 관련 라우트(`/api/auth/send-code`, `/api/auth/verify-code`), 코드, DB 테이블 포함
- **FR-004**: 로그인 시 Gmail 발송 권한(gmail.send 스코프)에 대한 사용자 동의를 요청해야 한다
- **FR-005**: 시스템은 로그인 후 발급된 OAuth 액세스 토큰과 리프레시 토큰을 안전하게 저장해야 한다
- **FR-006**: 공지 메일 발송 시 공용 SMTP 계정 대신 로그인한 사용자의 Gmail API를 사용해야 한다
- **FR-007**: 액세스 토큰 만료 시 리프레시 토큰으로 자동 갱신해야 한다
- **FR-008**: 리프레시 토큰으로도 갱신 실패 시 사용자에게 재로그인을 안내해야 한다
- **FR-009**: 로그아웃 시 서버의 세션 및 저장된 토큰을 무효화해야 한다
- **FR-010**: 로컬 환경(localhost)에서도 동일한 인증 및 발송 플로우가 동작해야 한다
- **FR-011**: Gmail API 호출 실패 시(할당량 초과, 서비스 장애 등) 별도 폴백 없이 에러 메시지를 표시하고 발송 실패로 이력에 기록해야 한다

### Key Entities

- **사용자(User)**: Google 계정 식별자, 이름, 이메일, OAuth 토큰 정보를 포함. @fassto.com 도메인 계정만 허용
- **OAuth 토큰(Account)**: 액세스 토큰, 리프레시 토큰, 만료 시각. 사용자 1:N 관계 (이 기능에서는 google provider 1개만 사용)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자는 Google 로그인 버튼 클릭 후 3회 이하의 화면 전환으로 서비스 메인 화면에 도달할 수 있다
- **SC-002**: @fassto.com 외 계정의 로그인 시도는 100% 차단된다
- **SC-003**: 메일 발신자 주소가 로그인한 사용자의 실제 이메일로 표시된다
- **SC-004**: 로컬 환경에서 추가 코드 변경 없이 환경변수 설정만으로 Google SSO 및 메일 발송이 동작한다
- **SC-005**: 토큰 만료 시 사용자 개입 없이 자동 갱신되어 발송이 중단 없이 완료된다

## Clarifications

### Session 2026-04-04

- Q: Gmail API 발송 실패 시(할당량 초과, Google 서비스 장애 등) 처리 방식은? → A: 에러 메시지 표시 후 발송 실패로 기록 (폴백 없음)
- Q: 기존 이메일 인증 코드 인프라 제거 범위는? → A: 코드, 라우트, DB 테이블 모두 완전 제거
- Q: 새 로그인 화면 UI를 어떻게 구현할 것인가? → A: Figma 없이 기존 로그인 화면(`src/app/(auth)/login/page.tsx`)의 레이아웃과 스타일을 그대로 활용하여 Google SSO 버튼으로 교체

## Assumptions

- Google Workspace 또는 Google Cloud Console 프로젝트 생성 권한이 있는 Google 계정을 보유하고 있다
- 로컬 테스트는 External OAuth 동의 화면(테스트 모드, 최대 100명)으로 구성한다
- 운영 배포 시 Internal로 전환은 별도 작업으로 처리한다 (Google Workspace 관리자 필요)
- 기존 데이터베이스의 사용자 레코드 마이그레이션은 이 기능 범위에 포함되지 않는다 (신규 로그인 시 자동 생성)
- Gmail API 발송은 기존 Nodemailer SMTP를 대체하며, BCC 정책 등 발송 옵션은 그대로 유지된다
- 인증 라이브러리(Auth.js v5)는 유지하고 Provider만 Credentials → Google로 교체한다
