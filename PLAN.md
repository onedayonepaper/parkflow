# ParkFlow 구현 계획

## 개요
PRD v1.0 기반 주차 관제 시스템 (STANDARD + DELUXE) 구현

## 기술 스택
- **Runtime**: Node.js + TypeScript
- **API Server**: Fastify (고성능, 스키마 검증 내장)
- **Database**: SQLite (better-sqlite3)
- **Admin Web**: React + Vite + TailwindCSS
- **Mobile Web**: React + Vite (DELUXE)
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest

---

## Phase 1: 프로젝트 기반 구축

### 1.1 모노레포 초기화
```
parkflow/
├── package.json (workspace root)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── api-server/
│   ├── admin-web/
│   ├── mobile-web/
│   └── device-agent/
├── packages/
│   ├── shared/          # 공통 타입/DTO
│   └── pricing-engine/  # 요금 계산 모듈
└── docs/
```

### 1.2 공통 패키지 설정
- `packages/shared`: Zod 스키마, 타입 정의, 상수
- `packages/pricing-engine`: 순수 함수 기반 요금 계산

---

## Phase 2: Database & Core API

### 2.1 SQLite 스키마 구현
PRD의 DDL 그대로 적용:
- sites, lanes, devices
- plate_events (원본 보존)
- parking_sessions
- rate_plans, discount_rules, discount_applications
- memberships
- payments
- users, audit_logs

### 2.2 API Server 핵심 엔드포인트

#### 인증
- `POST /api/auth/login` → JWT 발급

#### Device Ingress (LPR/Barrier)
- `POST /api/device/lpr/events` → 입출차 이벤트 수신
- `POST /api/device/heartbeat` → 장비 상태
- `POST /api/device/barrier/command` → 차단기 제어

#### Sessions
- `GET /api/sessions` → 목록 조회
- `GET /api/sessions/:id` → 상세 (breakdown 포함)
- `POST /api/sessions/:id/recalc` → 재계산
- `POST /api/sessions/:id/correct` → 정정
- `POST /api/sessions/:id/apply-discount` → 할인 적용
- `POST /api/sessions/:id/force-close` → 강제 종료

#### Payments
- `POST /api/payments/mock/approve` → Mock 결제

#### CRUD
- `/api/rate-plans` → 요금 정책
- `/api/discount-rules` → 할인 규칙
- `/api/memberships` → 정기권

#### WebSocket
- `WS /api/ws` → 실시간 이벤트 스트림

---

## Phase 3: Pricing Engine

### 3.1 요금 규칙 JSON 포맷
```typescript
interface RatePlan {
  freeMinutes: number;        // 무료 시간 (분)
  baseMinutes: number;        // 기본 시간 (분)
  baseFee: number;            // 기본 요금 (원)
  additionalMinutes: number;  // 추가 단위 (분)
  additionalFee: number;      // 추가 요금 (원)
  dailyMax: number;           // 일 최대 (원)
  graceMinutes: number;       // 결제 후 유예 (분)
}
```

### 3.2 계산 로직
1. 주차 시간 계산 (entry → exit)
2. 무료 시간 차감
3. 기본 요금 적용
4. 추가 시간 요금 계산
5. 일 최대 캡 적용
6. breakdown 생성

### 3.3 할인 적용
- AMOUNT: 정액 차감
- PERCENT: 정률 할인
- FREE_MINUTES: 시간 무료
- FREE_ALL: 전액 무료

---

## Phase 4: Admin Web

### 4.1 페이지 구성
1. **로그인** `/login`
2. **대시보드** `/` - 실시간 현황, 위젯
3. **세션 목록** `/sessions` - 필터, 검색
4. **세션 상세** `/sessions/:id` - 타임라인, 정정, 할인
5. **요금 정책** `/rate-plans` - CRUD
6. **할인 규칙** `/discount-rules` - CRUD
7. **정기권** `/memberships` - CRUD
8. **장비 관리** `/devices` - 상태, 로그
9. **통계** `/stats` - 기간별 매출, 입출차

### 4.2 실시간 기능
- WebSocket 연결로 이벤트 스트림
- 대시보드 자동 갱신

---

## Phase 5: Device Agent

### 5.1 Mock LPR 이벤트 생성기
- 랜덤 차량번호 생성
- ENTRY/EXIT 시나리오 시뮬레이션
- Configurable 간격

### 5.2 재전송 큐
- 네트워크 실패 시 로컬 파일 큐
- 연결 복구 시 재전송

### 5.3 Barrier Mock
- OPEN 명령 수신 로깅

---

## Phase 6: DELUXE 기능

### 6.1 Mobile Web (운영자 할인)
- 로그인 (운영자/제휴처)
- 차량번호 검색
- 할인 적용

### 6.2 Mobile Web (운전자 결제)
- 차량번호 입력
- 요금 조회
- Mock 결제
- 출차 가능 표시

---

## Phase 7: 테스트 시나리오

### 인수 테스트 5개
1. **정상 흐름**: 입차 → 출차 → 요금계산 → 결제 → 출차허용
2. **무료 출차**: 무료시간 내 출차 (0원)
3. **할인 적용**: 할인 후 요금 감소 확인
4. **중복 입차**: 동일 차량 중복 이벤트 처리
5. **고아 출차**: 세션 없는 출차 이벤트 처리

---

## 구현 순서 (권장)

| 순서 | 작업 | 예상 산출물 |
|------|------|------------|
| 1 | 모노레포 + 공통 패키지 | 프로젝트 구조, 타입 |
| 2 | DB 스키마 + 마이그레이션 | SQLite 테이블 |
| 3 | pricing-engine | 요금 계산 모듈 + 테스트 |
| 4 | api-server 핵심 | LPR 이벤트, 세션, 결제 |
| 5 | api-server WebSocket | 실시간 스트림 |
| 6 | device-agent Mock | 시뮬레이터 |
| 7 | admin-web 기본 | 로그인, 대시보드, 세션 |
| 8 | admin-web 운영 | 정정, 할인, 통계 |
| 9 | mobile-web (DELUXE) | 할인/결제 |
| 10 | 통합 테스트 | E2E 시나리오 |

---

## 승인 요청 사항

위 계획대로 진행해도 될까요?

- **Phase 1-4** (Core): API 서버 + Admin 기본 기능
- **Phase 5-6** (Extension): Device Agent + DELUXE
- **Phase 7**: 테스트

순차적으로 구현하며, 각 Phase 완료 시 동작 확인 후 다음으로 진행합니다.
