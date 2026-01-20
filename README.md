# ParkFlow - 주차 관제 시스템

LPR 기반 주차 관제 시스템 (STANDARD + DELUXE)

## 기능

### STANDARD
- LPR 이벤트 수신 및 세션 관리
- 요금 자동 계산 (무료시간, 기본요금, 추가요금, 일최대)
- 정산(Mock 결제) 및 차단기 오픈
- 운영 콘솔 (실시간 관제, 세션 관리, 정정, 통계)
- 정기권/화이트리스트

### DELUXE (확장)
- 웹/모바일 할인 적용
- 운전자 모바일 결제

## 기술 스택

- **API Server**: Node.js + Fastify + SQLite
- **Admin Web**: React + Vite + TailwindCSS
- **Device Agent**: Node.js (Mock LPR/Barrier)
- **Monorepo**: pnpm workspaces

## 설치 및 실행

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 데이터베이스 초기화

```bash
pnpm db:migrate
pnpm db:seed
```

### 3. 실행

터미널 3개를 열어 각각 실행:

```bash
# 터미널 1: API 서버
pnpm dev:api

# 터미널 2: Admin Web
pnpm dev:admin

# 터미널 3: Device Agent (시뮬레이터)
pnpm dev:agent
```

### 4. 접속

- **Admin Web**: http://localhost:5173
- **API Server**: http://localhost:3000

### 기본 계정
- ID: `admin`
- PW: `admin123`

## 프로젝트 구조

```
parkflow/
├── apps/
│   ├── api-server/       # Core API + WebSocket
│   ├── admin-web/        # 운영 콘솔
│   └── device-agent/     # Mock LPR/Barrier
├── packages/
│   ├── shared/           # 공통 타입/스키마
│   └── pricing-engine/   # 요금 계산 모듈
└── docs/
    └── PLAN.md
```

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인

### Device (LPR/Barrier)
- `POST /api/device/lpr/events` - LPR 이벤트 수신
- `POST /api/device/heartbeat` - 장비 상태
- `POST /api/device/barrier/command` - 차단기 명령

### 세션
- `GET /api/sessions` - 목록
- `GET /api/sessions/:id` - 상세
- `POST /api/sessions/:id/apply-discount` - 할인 적용
- `POST /api/sessions/:id/force-close` - 강제 종료

### 결제
- `POST /api/payments/mock/approve` - Mock 결제

### WebSocket
- `WS /api/ws` - 실시간 이벤트 스트림

## 시뮬레이션

Device Agent에서 명령어로 이벤트 발생:

```
e <차량번호>  - 입차 이벤트
x <차량번호>  - 출차 이벤트
r            - 랜덤 차량 입/출차
a            - 자동 시뮬레이션 (5초 간격)
q            - 종료
```

또는 시나리오 기반 시뮬레이션:

```bash
cd apps/device-agent
pnpm simulate
```

## 테스트 시나리오

1. **정상 흐름**: 입차 → 출차 → 요금계산 → 결제 → 출차허용
2. **무료 출차**: 무료시간 내 출차 (0원)
3. **할인 적용**: 할인 후 요금 감소 확인
4. **중복 입차**: 동일 차량 중복 이벤트 처리
5. **고아 출차**: 세션 없는 출차 이벤트 처리

## License

MIT
