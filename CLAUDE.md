# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스. JIRA Release Note URL을 입력하면 연결된 티켓을 분석하여 비개발자가 이해할 수 있는 업데이트 공지 초안을 자동 생성하고, 편집 후 이메일로 발송할 수 있는 웹 애플리케이션.

## Project Status

기획 단계 (2026-04-01 기준). 기능명세서와 유저플로우 문서만 존재하며 코드베이스는 아직 생성되지 않음.

## Specification Documents

- `JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스_기능명세서_2026-04-01.md` - 전체 기능명세서 (5개 주요 기능, 수용 기준 포함)
- `JIRA Release Note 기반 비개발자용 업데이트 공지 자동 생성 서비스_유저플로우_2026-04-01.md.md` - Mermaid 기반 유저플로우 다이어그램

## Core Features (Priority Order)

1. **JIRA 연동 및 자동 생성** (높음) - JIRA Release Note URL → 티켓 분석 → 비개발자 친화적 초안 생성, Slack 링크 자동 포함
2. **초안 편집** (높음) - 항목 삭제/병합/수정, 드래그앤드롭 순서 변경, 스크린샷 첨부(항목당 최대 5개)
3. **이메일 발송 및 관리** (높음) - 이메일 발송, 발송 이력 관리, 재발송
4. **사용자 인증** (중간) - 회원가입/로그인, 역할 기반 접근 제어 (관리자/일반 사용자)
5. **JIRA URL 입력 관리** (중간) - 기본 2개 필드, 동적 추가/삭제, URL 유효성 검증

## User Flow

인증 → 대시보드(발송이력/공지생성) → URL 입력 → 초안 자동 생성 → 초안 편집(삭제/병합/수정/순서변경/스크린샷) → 이메일 발송(수신자 설정/미리보기) → 발송 완료

## Target Users

물류운영팀, 영업팀, 고객만족팀 등 비개발 직군. IT 시스템 변경사항을 이해하고 전달해야 하는 사용자.

## Key Integration Points

- **JIRA API**: Release Note 및 연결 티켓 조회
- **AI/LLM**: 기술 용어를 비개발자 관점으로 변환
- **이메일 서비스**: 공지 발송
- **Slack**: 티켓 내 Slack 링크 자동 추출
