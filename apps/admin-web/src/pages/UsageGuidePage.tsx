import { useState } from 'react';

type Section =
  | 'overview'
  | 'setup'
  | 'installation'
  | 'login'
  | 'dashboard'
  | 'rate-plans'
  | 'discount-rules'
  | 'memberships'
  | 'sessions'
  | 'payments'
  | 'kiosk'
  | 'device-api'
  | 'api-docs';

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'overview', title: '시스템 개요', icon: '🏠' },
  { id: 'setup', title: '초기 설정', icon: '⚙️' },
  { id: 'installation', title: '현장 설치 가이드', icon: '🔧' },
  { id: 'login', title: '로그인', icon: '🔐' },
  { id: 'dashboard', title: '대시보드', icon: '📊' },
  { id: 'rate-plans', title: '요금 정책', icon: '💰' },
  { id: 'discount-rules', title: '할인 규칙', icon: '🎫' },
  { id: 'memberships', title: '정기권 관리', icon: '📇' },
  { id: 'sessions', title: '주차 세션', icon: '🚗' },
  { id: 'payments', title: '결제 관리', icon: '💳' },
  { id: 'kiosk', title: '키오스크', icon: '🖥️' },
  { id: 'device-api', title: '디바이스 연동', icon: '📷' },
  { id: 'api-docs', title: 'API 문서', icon: '📚' },
];

export default function UsageGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <nav className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            📖 사용 가이드
          </h2>
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {section.icon} {section.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'setup' && <SetupSection />}
          {activeSection === 'installation' && <InstallationSection />}
          {activeSection === 'login' && <LoginSection />}
          {activeSection === 'dashboard' && <DashboardSection />}
          {activeSection === 'rate-plans' && <RatePlansSection />}
          {activeSection === 'discount-rules' && <DiscountRulesSection />}
          {activeSection === 'memberships' && <MembershipsSection />}
          {activeSection === 'sessions' && <SessionsSection />}
          {activeSection === 'payments' && <PaymentsSection />}
          {activeSection === 'kiosk' && <KioskSection />}
          {activeSection === 'device-api' && <DeviceApiSection />}
          {activeSection === 'api-docs' && <ApiDocsSection />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
      {children}
    </h1>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4">
      {children}
    </h2>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
      {children}
    </p>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-4">
      {title && (
        <div className="bg-gray-700 text-gray-300 px-4 py-2 rounded-t-lg text-sm font-mono">
          {title}
        </div>
      )}
      <pre className={`bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm font-mono ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {children}
      </pre>
    </div>
  );
}

function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
  };
  const icons = { info: 'ℹ️', warning: '⚠️', success: '✅' };

  return (
    <div className={`border rounded-lg p-4 my-4 ${styles[type]}`}>
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

function OverviewSection() {
  return (
    <div>
      <SectionTitle>🏠 ParkFlow 시스템 개요</SectionTitle>

      <Paragraph>
        ParkFlow는 LPR(License Plate Recognition, 번호판 인식) 기반의 주차장 관리 시스템입니다.
        차량의 입출차를 자동으로 인식하고, 요금을 계산하며, 결제를 처리하는 통합 솔루션을 제공합니다.
      </Paragraph>

      <SubTitle>주요 기능</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { icon: '🚗', title: '실시간 입출차 관리', desc: 'LPR 카메라를 통한 자동 차량 인식 및 세션 관리' },
          { icon: '💰', title: '요금 자동 계산', desc: '유연한 요금 정책 설정 및 자동 요금 계산' },
          { icon: '🎫', title: '할인 및 정기권', desc: '다양한 할인 규칙과 정기권 회원 관리' },
          { icon: '💳', title: '결제 처리', desc: '관리자 결제, 키오스크 결제 지원' },
          { icon: '📊', title: '통계 및 분석', desc: '매출, 이용 현황 등 다양한 통계 제공' },
          { icon: '📱', title: '반응형 UI', desc: '데스크톱, 태블릿, 모바일 지원' },
        ].map((item, i) => (
          <div key={i} className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl mb-2">{item.icon}</div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

      <SubTitle>시스템 구성</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">Admin Web</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">React + Vite + TailwindCSS 기반 관리자 웹</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">API Server</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">Fastify + SQLite 기반 REST API 서버</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">Device Agent</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">LPR 카메라 시뮬레이터 (개발/테스트용)</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">Shared</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">공통 타입, 유틸리티, 스키마</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>서비스 흐름</SubTitle>
      <div className="flex flex-wrap items-center gap-2 text-sm mb-6">
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
          1. 차량 입차
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
          2. LPR 인식
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
          3. 세션 생성
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full">
          4. 주차
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full">
          5. 출차 요청
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full">
          6. 요금 계산
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 px-3 py-1 rounded-full">
          7. 결제
        </span>
        <span className="text-gray-400">→</span>
        <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full">
          8. 출차
        </span>
      </div>
    </div>
  );
}

function SetupSection() {
  return (
    <div>
      <SectionTitle>⚙️ 초기 설정</SectionTitle>

      <SubTitle>1. 필수 요구사항</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4 space-y-1">
        <li>Node.js 18.0 이상</li>
        <li>pnpm 8.0 이상</li>
        <li>Git</li>
      </ul>

      <SubTitle>2. 프로젝트 클론 및 의존성 설치</SubTitle>
      <CodeBlock title="Terminal">{`# 프로젝트 클론
git clone https://github.com/your-repo/parkflow.git
cd parkflow

# 의존성 설치
pnpm install`}</CodeBlock>

      <SubTitle>3. 환경 변수 설정</SubTitle>
      <Paragraph>
        API 서버의 환경 변수를 설정합니다. <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.example</code>을 참고하여
        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> 파일을 생성합니다.
      </Paragraph>
      <CodeBlock title="apps/api-server/.env">{`# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000`}</CodeBlock>

      <SubTitle>4. 데이터베이스 초기화</SubTitle>
      <Paragraph>
        시드 데이터를 생성하여 기본 요금제, 할인 규칙, 관리자 계정 등을 초기화합니다.
      </Paragraph>
      <CodeBlock title="Terminal">{`# 데이터베이스 시딩
cd apps/api-server
pnpm seed`}</CodeBlock>

      <InfoBox type="info">
        시드 실행 시 생성되는 기본 계정: <strong>admin / admin123</strong>
      </InfoBox>

      <SubTitle>5. 서버 실행</SubTitle>
      <CodeBlock title="Terminal">{`# 프로젝트 루트에서 모든 앱 동시 실행
pnpm dev

# 또는 개별 실행
pnpm --filter api-server dev    # API 서버 (포트 3000)
pnpm --filter admin-web dev     # 관리자 웹 (포트 5173)`}</CodeBlock>

      <SubTitle>6. 접속 URL</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">관리자 웹</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://localhost:5173</code></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">키오스크</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://localhost:5173/kiosk</code></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">API 서버</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://localhost:3000</code></td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">API 문서 (Swagger)</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://localhost:3000/docs</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InstallationSection() {
  return (
    <div>
      <SectionTitle>🔧 현장 설치 가이드</SectionTitle>

      <Paragraph>
        ParkFlow 시스템을 주차장 현장에 설치하기 위한 가이드입니다.
        LPR 카메라, 차단기, 키오스크, 네트워크 등 하드웨어 설치 및 연동 방법을 설명합니다.
      </Paragraph>

      <SubTitle>1. 설치 전 준비사항</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { icon: '📋', title: '현장 조사', items: ['입출구 위치 확인', '차선 수 파악', '전원 위치 확인', '네트워크 환경 파악'] },
          { icon: '🛠️', title: '장비 준비', items: ['LPR 카메라', '차단기', '키오스크 단말기', '네트워크 장비 (스위치, 라우터)'] },
          { icon: '🔌', title: '인프라 확인', items: ['전원 공급 (220V)', '인터넷 회선', 'IP 주소 할당', '방화벽 설정'] },
          { icon: '📝', title: '문서 준비', items: ['설치 도면', '네트워크 구성도', 'IP 주소 목록', '비상 연락처'] },
        ].map((item, i) => (
          <div key={i} className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{item.icon}</span>
              <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {item.items.map((li, j) => (
                <li key={j} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                  {li}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <SubTitle>2. 네트워크 구성</SubTitle>
      <Paragraph>
        ParkFlow 시스템은 모든 장비가 동일 네트워크에 연결되어야 합니다.
        권장 네트워크 구성은 다음과 같습니다.
      </Paragraph>
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-6 font-mono text-sm overflow-x-auto">
        <pre>{`┌─────────────────────────────────────────────────────────────┐
│                      주차장 네트워크                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [인터넷] ─── [공유기/라우터] ─── [스위치]                   │
│                     │                 │                     │
│                     │        ┌────────┼────────┐            │
│                     │        │        │        │            │
│                [서버 PC]  [LPR-1] [LPR-2] [차단기]           │
│               192.168.1.10   .20     .21     .30            │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │             │                                │
│         [키오스크]    [관제 PC]                              │
│          .40           .50                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">권장 IP 할당</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">장비</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">IP 주소</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">포트</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">API 서버</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.10</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">3000</td>
              <td className="py-2 text-gray-500">고정 IP 필수</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 LPR</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.20</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">80, 554</td>
              <td className="py-2 text-gray-500">HTTP, RTSP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 LPR</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.21</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">80, 554</td>
              <td className="py-2 text-gray-500">HTTP, RTSP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">차단기 컨트롤러</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.30</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">502</td>
              <td className="py-2 text-gray-500">Modbus TCP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">키오스크</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.40</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">웹 브라우저</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600 dark:text-gray-400">관제 PC</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.50</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">웹 브라우저</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>3. LPR 카메라 설치</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📍 설치 위치</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 차량 진입 방향 기준 <strong>정면 또는 15° 이내</strong> 각도</li>
            <li>• 번호판 높이에서 <strong>3~5m 거리</strong></li>
            <li>• 지면에서 <strong>1.2~1.5m 높이</strong> (번호판 높이에 맞춤)</li>
            <li>• 직사광선을 피하고, 야간 조명 확보</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⚙️ 카메라 설정</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 해상도: <strong>1920x1080 (Full HD)</strong> 이상 권장</li>
            <li>• 셔터 속도: <strong>1/1000초</strong> 이상 (움직이는 차량 촬영)</li>
            <li>• IR 조명: 야간 촬영을 위해 <strong>850nm IR LED</strong> 권장</li>
            <li>• 트리거: 루프 센서 또는 영상 모션 감지</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🔗 API 연동 설정</h4>
          <CodeBlock title="LPR 카메라 이벤트 전송 설정">{`# 카메라 웹 설정에서 HTTP POST 이벤트 설정
URL: http://192.168.1.10:3000/api/device/lpr/events
Method: POST
Content-Type: application/json

# 전송 데이터 형식
{
  "plateNo": "{PLATE_NUMBER}",
  "direction": "ENTRY",  // 또는 "EXIT"
  "deviceId": "dev_lpr_entry_1",
  "laneId": "lane_entry_1",
  "capturedAt": "{ISO_TIMESTAMP}"
}`}</CodeBlock>
        </div>
      </div>

      <SubTitle>4. 차단기 설치</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🚧 하드웨어 설치</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 차단기 본체를 차로 옆에 고정 설치</li>
            <li>• 전원 케이블 연결 (AC 220V)</li>
            <li>• 네트워크 케이블 연결 (RJ45)</li>
            <li>• 루프 센서 매설 (차량 감지용)</li>
            <li>• 안전 센서 설치 (충돌 방지)</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🔌 컨트롤러 설정</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• IP 주소 설정: 192.168.1.30</li>
            <li>• Modbus TCP 포트: 502</li>
            <li>• 자동 닫힘 시간: 5초</li>
            <li>• 안전 센서 연동 설정</li>
            <li>• 수동 개방 버튼 연결</li>
          </ul>
        </div>
      </div>

      <InfoBox type="warning">
        차단기 설치 시 반드시 안전 센서를 설치하여 차량이나 사람이 있을 때 차단기가 내려오지 않도록 해야 합니다.
      </InfoBox>

      <SubTitle>5. 키오스크 설치</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🖥️ 하드웨어 구성</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">필수 사양</p>
              <ul className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <li>• 터치스크린: 15인치 이상</li>
                <li>• CPU: Intel i3 이상</li>
                <li>• RAM: 4GB 이상</li>
                <li>• SSD: 128GB 이상</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">선택 사양</p>
              <ul className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <li>• 카드 리더기 (결제용)</li>
                <li>• 영수증 프린터</li>
                <li>• 바코드 스캐너</li>
                <li>• 스피커 (음성 안내)</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">💻 소프트웨어 설정</h4>
          <CodeBlock title="키오스크 브라우저 설정 (Chrome Kiosk Mode)">{`# Windows 시작 프로그램에 등록
"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^
  --kiosk ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-translate ^
  http://192.168.1.10:5173/kiosk

# 또는 Linux (Chromium)
chromium-browser --kiosk --disable-pinch \\
  --overscroll-history-navigation=0 \\
  http://192.168.1.10:5173/kiosk`}</CodeBlock>
        </div>
      </div>

      <SubTitle>6. 서버 설치</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🖥️ 서버 권장 사양</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">최소 사양</p>
              <ul className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <li>• CPU: Intel i5 / Ryzen 5</li>
                <li>• RAM: 8GB</li>
                <li>• SSD: 256GB</li>
                <li>• OS: Ubuntu 22.04 / Windows 10</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">권장 사양</p>
              <ul className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <li>• CPU: Intel i7 / Ryzen 7</li>
                <li>• RAM: 16GB</li>
                <li>• SSD: 512GB</li>
                <li>• UPS: 무정전 전원장치</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🚀 서버 자동 시작 설정</h4>
          <CodeBlock title="systemd 서비스 등록 (Linux)">{`# /etc/systemd/system/parkflow.service
[Unit]
Description=ParkFlow API Server
After=network.target

[Service]
Type=simple
User=parkflow
WorkingDirectory=/opt/parkflow
ExecStart=/usr/bin/node apps/api-server/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target

# 서비스 활성화
sudo systemctl enable parkflow
sudo systemctl start parkflow`}</CodeBlock>
        </div>
      </div>

      <SubTitle>7. 설치 후 점검 체크리스트</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          {[
            { category: '네트워크', items: ['모든 장비 ping 테스트 성공', 'API 서버 접속 확인', '외부 인터넷 연결 확인'] },
            { category: 'LPR 카메라', items: ['번호판 인식률 테스트 (주간/야간)', 'API 이벤트 전송 확인', '이미지 품질 확인'] },
            { category: '차단기', items: ['개방/닫힘 동작 확인', '안전 센서 동작 확인', 'API 제어 테스트'] },
            { category: '키오스크', items: ['터치 동작 확인', '결제 테스트', '영수증 출력 테스트'] },
            { category: '시스템', items: ['입차 → 주차 → 결제 → 출차 전체 플로우 테스트', '비상 상황 대응 테스트', '백업 및 복구 테스트'] },
          ].map((group, i) => (
            <div key={i} className="border-b dark:border-gray-700 pb-3 last:border-0 last:pb-0">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{group.category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {group.items.map((item, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SubTitle>8. 유지보수 및 문제해결</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📅 정기 점검 항목</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• <strong>일일:</strong> 시스템 로그 확인, 이상 동작 점검</li>
            <li>• <strong>주간:</strong> LPR 렌즈 청소, 차단기 윤활</li>
            <li>• <strong>월간:</strong> 데이터베이스 백업, 디스크 용량 확인</li>
            <li>• <strong>분기:</strong> 전체 시스템 점검, 펌웨어 업데이트</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🔧 자주 발생하는 문제</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• <strong>인식률 저하:</strong> 렌즈 청소, 조명 점검</li>
            <li>• <strong>차단기 미작동:</strong> 네트워크 연결, 전원 확인</li>
            <li>• <strong>키오스크 먹통:</strong> 브라우저 재시작, 네트워크 확인</li>
            <li>• <strong>서버 응답 없음:</strong> 서비스 재시작, 로그 확인</li>
          </ul>
        </div>
      </div>

      <InfoBox type="info">
        비상 상황 시 수동으로 차단기를 제어할 수 있도록 관리자에게 비상 개방 방법을 반드시 교육하세요.
      </InfoBox>
    </div>
  );
}

function LoginSection() {
  return (
    <div>
      <SectionTitle>🔐 로그인</SectionTitle>

      <Paragraph>
        ParkFlow 관리자 시스템에 접속하려면 로그인이 필요합니다.
      </Paragraph>

      <SubTitle>기본 계정</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">역할</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">아이디</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">비밀번호</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">권한</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">관리자</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">admin</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">admin123</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">SUPER_ADMIN</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600 dark:text-gray-400">운영자</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">operator</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">operator123</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">OPERATOR</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>로그인 방법</SubTitle>
      <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2">
        <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">http://localhost:5173</code> 접속</li>
        <li>아이디와 비밀번호 입력</li>
        <li>"로그인" 버튼 클릭</li>
        <li>대시보드로 자동 이동</li>
      </ol>

      <InfoBox type="warning">
        운영 환경에서는 반드시 기본 비밀번호를 변경하세요!
      </InfoBox>

      <SubTitle>세션 관리</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
        <li>JWT 토큰 기반 인증 사용</li>
        <li>토큰 유효 기간: 24시간</li>
        <li>브라우저 새로고침 시 자동 로그인 유지</li>
        <li>로그아웃: 우측 상단 메뉴에서 "로그아웃" 클릭</li>
      </ul>
    </div>
  );
}

function DashboardSection() {
  return (
    <div>
      <SectionTitle>📊 대시보드</SectionTitle>

      <Paragraph>
        대시보드는 주차장의 전반적인 운영 현황을 한눈에 파악할 수 있는 메인 화면입니다.
      </Paragraph>

      <SubTitle>통계 카드</SubTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '현재 주차', desc: '현재 주차 중인 차량 수' },
          { label: '오늘 입차', desc: '오늘 입차한 총 차량 수' },
          { label: '오늘 출차', desc: '오늘 출차한 총 차량 수' },
          { label: '오늘 매출', desc: '오늘 발생한 총 매출액' },
        ].map((item, i) => (
          <div key={i} className="border dark:border-gray-700 rounded-lg p-3 text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">{item.label}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.desc}</div>
          </div>
        ))}
      </div>

      <SubTitle>차트</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 mb-6">
        <li><strong>시간대별 입출차 현황</strong>: 오늘 하루의 시간대별 입출차 추이를 막대 차트로 표시</li>
        <li><strong>주간 매출 추이</strong>: 최근 7일간의 일별 매출을 라인 차트로 표시</li>
      </ul>

      <SubTitle>실시간 업데이트</SubTitle>
      <Paragraph>
        대시보드는 WebSocket을 통해 실시간으로 업데이트됩니다.
        새로운 입출차 이벤트가 발생하면 자동으로 통계가 갱신됩니다.
      </Paragraph>

      <InfoBox type="info">
        대시보드 데이터는 30초마다 자동 새로고침됩니다.
      </InfoBox>
    </div>
  );
}

function RatePlansSection() {
  return (
    <div>
      <SectionTitle>💰 요금 정책</SectionTitle>

      <Paragraph>
        주차 요금을 계산하기 위한 요금 정책을 관리합니다.
        하나의 활성 요금제만 적용되며, 새 요금제를 활성화하면 기존 요금제는 자동 비활성화됩니다.
      </Paragraph>

      <SubTitle>요금 계산 방식</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">항목</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">예시</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">무료 시간</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">무료로 주차할 수 있는 시간</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">10분</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">기본 요금</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">무료 시간 이후 기본 요금</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1,000원 / 30분</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">추가 요금</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">기본 시간 초과 후 추가 요금</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">500원 / 10분</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">일 최대</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">하루 최대 요금 상한</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">20,000원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>요금 계산 예시</SubTitle>
      <CodeBlock>{`주차 시간: 2시간 30분 (150분)
무료 시간: 10분
기본 요금: 1,000원 / 30분
추가 요금: 500원 / 10분

계산:
- 과금 시간: 150분 - 10분(무료) = 140분
- 기본 요금: 1,000원 (30분)
- 추가 시간: 140분 - 30분 = 110분
- 추가 요금: ceil(110/10) × 500원 = 11 × 500원 = 5,500원
- 총 요금: 1,000원 + 5,500원 = 6,500원`}</CodeBlock>

      <SubTitle>요금제 관리</SubTitle>
      <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2">
        <li><strong>요금제 추가</strong>: "요금제 추가" 버튼 클릭 → 정보 입력 → 저장</li>
        <li><strong>요금제 수정</strong>: 목록에서 "수정" 클릭 → 정보 변경 → 저장</li>
        <li><strong>요금제 활성화</strong>: 비활성 요금제에서 "활성화" 클릭</li>
        <li><strong>내보내기</strong>: CSV 형식으로 요금제 목록 다운로드</li>
      </ol>

      <InfoBox type="warning">
        요금제를 변경해도 이미 진행 중인 주차 세션에는 영향을 주지 않습니다.
        변경된 요금제는 새로 시작되는 세션부터 적용됩니다.
      </InfoBox>
    </div>
  );
}

function DiscountRulesSection() {
  return (
    <div>
      <SectionTitle>🎫 할인 규칙</SectionTitle>

      <Paragraph>
        주차 요금에 적용할 수 있는 다양한 할인 규칙을 관리합니다.
      </Paragraph>

      <SubTitle>할인 유형</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { type: 'AMOUNT', name: '금액 할인', desc: '고정 금액을 할인합니다.', example: '1,000원 할인' },
          { type: 'PERCENT', name: '비율 할인', desc: '요금의 일정 비율을 할인합니다.', example: '50% 할인' },
          { type: 'FREE_MINUTES', name: '시간 무료', desc: '일정 시간을 무료로 처리합니다.', example: '1시간 무료' },
          { type: 'FREE_ALL', name: '전액 무료', desc: '요금 전액을 면제합니다.', example: '전액 무료' },
        ].map((item, i) => (
          <div key={i} className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-2 py-1 rounded text-xs font-mono">
                {item.type}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">{item.name}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">예: {item.example}</p>
          </div>
        ))}
      </div>

      <SubTitle>중복 적용 (Stackable)</SubTitle>
      <Paragraph>
        할인 규칙 생성 시 "중복 적용 가능" 옵션을 설정할 수 있습니다.
      </Paragraph>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 mb-6">
        <li><strong>중복 적용 가능</strong>: 다른 할인과 함께 적용 가능 (예: 금액 할인 + 시간 무료)</li>
        <li><strong>중복 적용 불가</strong>: 해당 할인만 단독 적용 (예: 50% 할인)</li>
      </ul>

      <SubTitle>할인 적용 방법</SubTitle>
      <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2">
        <li>주차 세션 상세 페이지로 이동</li>
        <li>"할인 적용" 버튼 클릭</li>
        <li>적용할 할인 규칙 선택</li>
        <li>적용 사유 입력 (선택)</li>
        <li>"적용" 버튼 클릭</li>
      </ol>

      <InfoBox type="info">
        적용된 할인은 감사 로그에 기록되며, 추후 확인할 수 있습니다.
      </InfoBox>
    </div>
  );
}

function MembershipsSection() {
  return (
    <div>
      <SectionTitle>📇 정기권 관리</SectionTitle>

      <Paragraph>
        정기권 회원을 등록하고 관리합니다. 정기권 차량은 유효 기간 내 무료로 주차할 수 있습니다.
      </Paragraph>

      <SubTitle>정기권 정보</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">필드</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">필수</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">차량번호</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">정기권 차량의 번호판</td>
              <td className="py-2 text-green-600">필수</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">회원명</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">회원 이름</td>
              <td className="py-2 text-green-600">필수</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">연락처</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">회원 연락처</td>
              <td className="py-2 text-gray-400">선택</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">시작일</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">정기권 유효 시작일</td>
              <td className="py-2 text-green-600">필수</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">종료일</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">정기권 유효 종료일</td>
              <td className="py-2 text-green-600">필수</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>정기권 상태</SubTitle>
      <div className="flex gap-4 mb-6">
        <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
          활성 - 현재 유효한 정기권
        </span>
        <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full text-sm">
          만료 - 유효 기간이 지난 정기권
        </span>
      </div>

      <SubTitle>정기권 차량 입출차</SubTitle>
      <Paragraph>
        정기권으로 등록된 차량이 입차하면 시스템이 자동으로 인식하여
        "FREE_ALL" 할인이 자동 적용됩니다. 출차 시 요금이 0원으로 계산됩니다.
      </Paragraph>

      <InfoBox type="success">
        정기권 차량은 출차 시 별도의 결제 절차 없이 바로 출차할 수 있습니다.
      </InfoBox>
    </div>
  );
}

function SessionsSection() {
  return (
    <div>
      <SectionTitle>🚗 주차 세션</SectionTitle>

      <Paragraph>
        현재 및 과거의 주차 세션을 조회하고 관리합니다.
      </Paragraph>

      <SubTitle>세션 상태</SubTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { status: 'PARKING', label: '주차중', color: 'blue', desc: '차량이 주차장 내에 있음' },
          { status: 'EXIT_PENDING', label: '출차대기', color: 'yellow', desc: '출차 요청됨, 결제 필요' },
          { status: 'PAID', label: '결제완료', color: 'green', desc: '결제 완료, 출차 가능' },
          { status: 'CLOSED', label: '종료', color: 'gray', desc: '출차 완료' },
          { status: 'ERROR', label: '오류', color: 'red', desc: '처리 중 오류 발생' },
        ].map((item, i) => (
          <div key={i} className={`border rounded-lg p-3 bg-${item.color}-50 dark:bg-${item.color}-900/30 border-${item.color}-200 dark:border-${item.color}-800`}>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium bg-${item.color}-100 text-${item.color}-800 dark:bg-${item.color}-900 dark:text-${item.color}-200 mb-2`}>
              {item.status}
            </span>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{item.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
          </div>
        ))}
      </div>

      <SubTitle>세션 검색 및 필터</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 mb-6">
        <li><strong>차량번호 검색</strong>: 특정 차량번호로 검색</li>
        <li><strong>상태 필터</strong>: 주차중, 출차대기, 결제완료, 종료 등</li>
        <li><strong>날짜 범위</strong>: 특정 기간의 세션 조회</li>
      </ul>

      <SubTitle>세션 상세 페이지</SubTitle>
      <Paragraph>
        세션을 클릭하면 상세 페이지로 이동하여 다음 작업을 수행할 수 있습니다:
      </Paragraph>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 mb-6">
        <li><strong>요금 재계산</strong>: 현재 시점 기준으로 요금 재계산</li>
        <li><strong>할인 적용</strong>: 할인 규칙 적용</li>
        <li><strong>관리자 결제</strong>: 관리자 권한으로 결제 처리</li>
        <li><strong>강제 종료</strong>: 세션 강제 종료 (비정상 상황 시)</li>
        <li><strong>이벤트 이력</strong>: 입출차 이벤트 로그 확인</li>
      </ul>

      <InfoBox type="warning">
        강제 종료는 비정상 상황에서만 사용하세요. 모든 강제 종료는 감사 로그에 기록됩니다.
      </InfoBox>
    </div>
  );
}

function PaymentsSection() {
  return (
    <div>
      <SectionTitle>💳 결제 관리</SectionTitle>

      <Paragraph>
        주차 요금 결제 내역을 조회하고 관리합니다.
      </Paragraph>

      <SubTitle>결제 방법</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { method: 'ADMIN', label: '관리자 결제', desc: '관리자가 직접 결제 처리', icon: '👤' },
          { method: 'KIOSK', label: '키오스크', desc: '무인 키오스크에서 결제', icon: '🖥️' },
          { method: 'CARD', label: '카드 결제', desc: 'PG 연동 카드 결제', icon: '💳' },
        ].map((item, i) => (
          <div key={i} className="border dark:border-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="font-semibold text-gray-900 dark:text-white">{item.label}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</div>
            <div className="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {item.method}
            </div>
          </div>
        ))}
      </div>

      <SubTitle>결제 상태</SubTitle>
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
          PAID - 결제 완료
        </span>
        <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full text-sm">
          CANCELLED - 결제 취소
        </span>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full text-sm">
          PENDING - 결제 대기
        </span>
      </div>

      <SubTitle>결제 취소</SubTitle>
      <Paragraph>
        결제 완료된 건에 대해 취소를 요청할 수 있습니다.
        취소 시 취소 사유를 입력해야 하며, 모든 취소 내역은 감사 로그에 기록됩니다.
      </Paragraph>

      <InfoBox type="info">
        결제 취소 시 해당 세션은 "출차대기" 상태로 변경되며, 다시 결제가 필요합니다.
      </InfoBox>
    </div>
  );
}

function KioskSection() {
  return (
    <div>
      <SectionTitle>🖥️ 키오스크</SectionTitle>

      <Paragraph>
        키오스크는 주차장 이용자가 직접 주차 요금을 조회하고 결제할 수 있는 무인 정산 시스템입니다.
      </Paragraph>

      <SubTitle>키오스크 접속</SubTitle>
      <CodeBlock>{`http://localhost:5173/kiosk`}</CodeBlock>

      <InfoBox type="info">
        키오스크 페이지는 로그인 없이 접근 가능합니다.
        실제 운영 시에는 별도의 키오스크 전용 기기에서 전체 화면 모드로 사용하세요.
      </InfoBox>

      <SubTitle>사용 방법</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-4 p-4 border dark:border-gray-700 rounded-lg">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">차량번호 입력</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">주차한 차량의 번호판을 입력합니다. (예: 12가3456)</p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-4 border dark:border-gray-700 rounded-lg">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">요금 확인</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">입차 시간, 주차 시간, 결제 금액을 확인합니다.</p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-4 border dark:border-gray-700 rounded-lg">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">결제하기</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">"결제하기" 버튼을 눌러 결제를 완료합니다.</p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-4 border dark:border-gray-700 rounded-lg">
          <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">출차</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">결제 완료 후 15분 이내에 출차합니다.</p>
          </div>
        </div>
      </div>

      <SubTitle>특수 케이스</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2">
        <li><strong>무료 출차</strong>: 무료 시간 내 출차 시 결제 없이 바로 출차 가능</li>
        <li><strong>이미 결제 완료</strong>: 이미 결제된 경우 안내 메시지 표시</li>
        <li><strong>정기권 차량</strong>: 정기권 회원은 0원으로 표시되어 무료 출차</li>
      </ul>
    </div>
  );
}

function DeviceApiSection() {
  return (
    <div>
      <SectionTitle>📷 디바이스 연동</SectionTitle>

      <Paragraph>
        LPR 카메라, 차단기 등 주차장 장비와의 연동 방법을 설명합니다.
      </Paragraph>

      <SubTitle>LPR 이벤트 전송</SubTitle>
      <Paragraph>
        LPR 카메라가 차량 번호판을 인식하면 다음 API로 이벤트를 전송합니다.
      </Paragraph>
      <CodeBlock title="POST /api/device/lpr/events">{`{
  "plateNo": "12가3456",
  "direction": "ENTRY",  // ENTRY: 입차, EXIT: 출차
  "deviceId": "dev_lpr_entry_1",
  "laneId": "lane_entry_1",
  "capturedAt": "2024-01-15T10:30:00Z"
}`}</CodeBlock>

      <SubTitle>응답 예시</SubTitle>
      <CodeBlock title="Response 200 OK">{`{
  "ok": true,
  "data": {
    "eventId": "pevt_abc123",
    "sessionId": "psess_xyz789"
  },
  "error": null
}`}</CodeBlock>

      <SubTitle>기본 디바이스 ID</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">Device ID</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">Lane ID</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">dev_lpr_entry_1</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">lane_entry_1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 LPR</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">dev_lpr_exit_1</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">lane_exit_1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 LPR</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">dev_barrier_entry_1</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">lane_entry_1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 차단기</td>
            </tr>
            <tr>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">dev_barrier_exit_1</td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400">lane_exit_1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 차단기</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>시뮬레이터 사용</SubTitle>
      <Paragraph>
        개발 및 테스트를 위해 Device Agent 시뮬레이터를 사용할 수 있습니다.
      </Paragraph>
      <CodeBlock title="Terminal">{`# Device Agent 실행
cd apps/device-agent
pnpm dev

# 시뮬레이터 옵션
# - 자동으로 랜덤 차량 입출차 이벤트 생성
# - 설정 가능한 이벤트 간격`}</CodeBlock>

      <SubTitle>차단기 제어</SubTitle>
      <Paragraph>
        결제 완료 시 시스템이 자동으로 차단기 개방 명령을 전송합니다.
        차단기 상태는 WebSocket을 통해 실시간으로 모니터링할 수 있습니다.
      </Paragraph>
    </div>
  );
}

function ApiDocsSection() {
  return (
    <div>
      <SectionTitle>📚 API 문서</SectionTitle>

      <Paragraph>
        ParkFlow API는 RESTful 설계를 따르며, Swagger UI를 통해 상세 문서를 제공합니다.
      </Paragraph>

      <SubTitle>Swagger UI 접속</SubTitle>
      <CodeBlock>{`http://localhost:3000/docs`}</CodeBlock>

      <SubTitle>API 엔드포인트 요약</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">경로</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">인증</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/auth/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">인증 (로그인, 토큰 갱신)</td>
              <td className="py-2 text-gray-400">-</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/sessions/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">주차 세션 관리</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/payments/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">결제 관리</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/rate-plans/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">요금 정책</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/discount-rules/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">할인 규칙</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/memberships/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">정기권 관리</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/stats/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">통계</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/device/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">디바이스 연동</td>
              <td className="py-2 text-gray-400">-</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/kiosk/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">키오스크</td>
              <td className="py-2 text-gray-400">-</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600 dark:text-gray-400">/api/audit/*</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">감사 로그</td>
              <td className="py-2 text-green-600">필요</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>응답 형식</SubTitle>
      <Paragraph>
        모든 API 응답은 다음과 같은 표준 형식을 따릅니다.
      </Paragraph>
      <CodeBlock title="성공 응답">{`{
  "ok": true,
  "data": { ... },
  "error": null
}`}</CodeBlock>
      <CodeBlock title="에러 응답">{`{
  "ok": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}`}</CodeBlock>

      <SubTitle>인증 방법</SubTitle>
      <Paragraph>
        인증이 필요한 API는 JWT 토큰을 Authorization 헤더에 포함해야 합니다.
      </Paragraph>
      <CodeBlock>{`Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`}</CodeBlock>

      <InfoBox type="info">
        Swagger UI에서 "Authorize" 버튼을 클릭하여 토큰을 설정하면
        모든 인증 API를 테스트할 수 있습니다.
      </InfoBox>
    </div>
  );
}
