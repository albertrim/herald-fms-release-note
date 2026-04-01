<!--
Sync Impact Report
===================
- Version change: 1.0.0 -> 1.1.0 (MINOR: new principle added)
- Added principles:
  - VI. Design Fidelity (NEW)
- Modified principles: None
- Added sections: None
- Removed sections: None
- Templates requiring updates: None
- Follow-up TODOs: None
===================
-->

# FMS Release Note Constitution

## Core Principles

### I. User-Centric Communication

모든 사용자 대면 콘텐츠는 비개발자가 즉시 이해할 수 있어야 한다.

- 시스템이 생성하는 업데이트 공지 초안은 기술 용어를 배제하고
  사용자 관점의 변화/개선 사항으로 표현해야 한다 (MUST).
- UI 텍스트, 오류 메시지, 이메일 본문 모두 대상 사용자(물류운영팀,
  영업팀, 고객만족팀)의 업무 맥락에 맞춰 작성해야 한다 (MUST).
- AI/LLM 변환 결과에 기술 용어가 잔존하는지 검증하는
  품질 게이트를 두어야 한다 (SHOULD).

### II. Data Integrity & Traceability

JIRA 원본 데이터와 생성된 공지 사이의 추적성을 보장해야 한다.

- 각 공지 항목은 원본 JIRA 티켓 ID/URL과 연결을 유지해야 한다 (MUST).
- 사용자의 편집(삭제, 병합, 수정)이력을 기록하여
  원본 대비 변경 사항을 추적할 수 있어야 한다 (SHOULD).
- Slack 링크 등 외부 참조는 원본 티켓에서 추출된 것임을
  명확히 표시해야 한다 (MUST).

### III. Security-First

외부 시스템 연동과 사용자 데이터 처리 시 보안을 최우선으로 한다.

- JIRA API 인증 정보는 서버 측에서만 관리하며
  클라이언트에 노출되어서는 안 된다 (MUST).
- 이메일 발송 기능은 인증된 사용자만 사용할 수 있어야 한다 (MUST).
- 사용자 입력(URL, 이메일 주소, 편집 내용)은 반드시
  서버 측에서 검증해야 한다 (MUST).
- API 키, 토큰, 비밀번호 등 민감 정보는 환경 변수로 관리하고
  코드베이스에 포함하지 않는다 (MUST).

### IV. Simplicity & SOLID

SOLID 원칙을 준수하되 불필요한 복잡성을 배제한다.

- YAGNI: 현재 요구사항에 명시된 기능만 구현한다.
  가상의 미래 요구사항을 위한 추상화를 만들지 않는다 (MUST).
- 단일 책임: 각 모듈/서비스는 하나의 명확한 역할을 가진다 (MUST).
- 코드보다 설정: 반복되는 값은 설정으로 분리하되,
  한 곳에서만 사용되는 값의 과도한 설정화를 피한다 (SHOULD).
- 외부 라이브러리 도입 시 해당 기능이 직접 구현 대비
  명확한 이점이 있는 경우에만 추가한다 (SHOULD).

### V. Testable Integrations

외부 시스템 연동 경계에서 테스트 가능성을 확보한다.

- JIRA API, 이메일 서비스, AI/LLM 호출 등 외부 의존성은
  인터페이스로 추상화하여 테스트 시 대체 가능해야 한다 (MUST).
- 핵심 비즈니스 로직(티켓 분석, 공지 생성, 항목 병합)은
  외부 의존성 없이 단위 테스트 가능해야 한다 (MUST).
- API 연동 실패 시나리오(타임아웃, 인증 오류, 잘못된 응답)에
  대한 테스트를 포함해야 한다 (SHOULD).

### VI. Design Fidelity

UI 구현은 Figma 디자인과 1:1로 일치해야 한다.

- 새로운 화면 구현 시 Figma MCP `get_design_context`를 호출하여
  디자인 코드를 가져온 후 1:1로 구현해야 한다 (MUST).
- Figma 디자인의 레이아웃, 간격, 색상, 타이포그래피, 아이콘을
  충실히 재현해야 한다 (MUST).
- CLAUDE.md의 Design System 섹션에 정의된 디자인 토큰과
  패턴을 준수해야 한다 (MUST).
- Figma 디자인이 없는 화면은 기존 화면의 패턴과
  Design System 토큰을 따라야 한다 (MUST).
- shadcn/ui 기본 스타일보다 프로젝트 Design System을
  우선 적용해야 한다 (SHOULD).

## Integration & API Constraints

외부 시스템 연동 시 준수해야 할 제약사항을 정의한다.

- **JIRA API**: Rate limit을 준수하고, API 호출 실패 시
  사용자에게 명확한 오류 메시지를 제공해야 한다.
  JIRA 버전 변경에 대비하여 API 클라이언트를 격리한다.
- **AI/LLM**: 프롬프트와 응답 형식을 버전 관리한다.
  LLM 응답의 품질이 기대에 미치지 못할 경우를 대비하여
  사용자가 수동 편집할 수 있는 UI를 항상 제공한다.
- **이메일 서비스**: 발송 실패 시 재시도 로직을 포함하고,
  발송 상태(성공/실패)를 기록한다.
- **Slack**: 링크 추출은 최선 노력(best-effort) 방식으로
  처리하며, 추출 실패가 전체 공지 생성을 차단해서는 안 된다.

## Development Workflow

개발 과정에서 준수해야 할 워크플로우를 정의한다.

- 모든 코드 변경은 lint와 타입 체크를 통과해야 한다 (MUST).
- 커밋 전 관련 테스트가 통과하는지 확인한다 (MUST).
- PR은 명확한 변경 사유와 테스트 계획을 포함해야 한다 (SHOULD).
- 외부 API 연동 코드 변경 시 해당 API의 최신 문서를
  확인한 후 작업한다 (SHOULD).
- 명시적으로 요청된 항목만 작업하며, 범위 밖의 리팩토링이나
  개선을 임의로 수행하지 않는다 (MUST).

## Governance

이 Constitution은 프로젝트의 모든 설계 및 구현 결정에 우선한다.

- Constitution 수정 시 변경 사유, 영향 범위, 마이그레이션 계획을
  문서화해야 한다 (MUST).
- 버전 관리는 Semantic Versioning을 따른다:
  - MAJOR: 원칙의 삭제 또는 의미 변경
  - MINOR: 새 원칙/섹션 추가 또는 기존 항목의 실질적 확장
  - PATCH: 문구 수정, 오탈자 교정, 비의미적 정리
- 모든 PR/리뷰에서 Constitution 준수 여부를 확인한다 (SHOULD).
- 복잡성이 증가하는 결정은 Constitution의 원칙에 근거하여
  정당화되어야 한다 (MUST).

**Version**: 1.1.0 | **Ratified**: 2026-04-01 | **Last Amended**: 2026-04-01
