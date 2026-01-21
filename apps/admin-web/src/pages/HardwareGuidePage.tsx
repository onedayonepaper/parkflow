import { useState } from 'react';

type Section = 'architecture' | 'shopping' | 'relay' | 'lpr' | 'network' | 'config';

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'architecture', title: '시스템 구성도', icon: '🏗️' },
  { id: 'shopping', title: '구매 품목', icon: '🛒' },
  { id: 'relay', title: '릴레이 컨트롤러', icon: '🔌' },
  { id: 'lpr', title: 'LPR 카메라', icon: '📷' },
  { id: 'network', title: '네트워크 설정', icon: '🌐' },
  { id: 'config', title: '장비 등록', icon: '⚙️' },
];

export default function HardwareGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('architecture');

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <nav className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🔧 하드웨어 가이드
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
          {activeSection === 'architecture' && <ArchitectureSection />}
          {activeSection === 'shopping' && <ShoppingSection />}
          {activeSection === 'relay' && <RelaySection />}
          {activeSection === 'lpr' && <LprSection />}
          {activeSection === 'network' && <NetworkSection />}
          {activeSection === 'config' && <ConfigSection />}
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

function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success' | 'error'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
  };
  const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };

  return (
    <div className={`border rounded-lg p-4 my-4 ${styles[type]}`}>
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

function ArchitectureSection() {
  return (
    <div>
      <SectionTitle>🏗️ 시스템 구성도</SectionTitle>

      <Paragraph>
        ParkFlow 주차 관제 시스템의 전체 하드웨어 구성입니다.
      </Paragraph>

      <SubTitle>전체 시스템 구성</SubTitle>
      <div className="bg-gray-900 text-gray-100 p-6 rounded-lg mb-6 font-mono text-xs overflow-x-auto">
        <pre>{`
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ParkFlow 주차장 시스템 구성도                            │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│    ┌─────────────────────────────────────────────────────────────────────┐    │
│    │                         🌐 네트워크 계층                              │    │
│    │                                                                     │    │
│    │     [인터넷] ──── [공유기] ──── [PoE 스위치] ──── 각 장비            │    │
│    │                  192.168.1.1       └── PoE 전원 공급                │    │
│    └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                         │
│    ┌─────────────────────────────────┼─────────────────────────────────┐     │
│    │                         💻 서버 계층                                │     │
│    │                                 │                                  │     │
│    │                    ┌────────────┴────────────┐                     │     │
│    │                    │     ParkFlow 서버        │                     │     │
│    │                    │     192.168.1.10        │                     │     │
│    │                    │                         │                     │     │
│    │                    │  ┌─────────────────┐   │                     │     │
│    │                    │  │ API Server:3000 │   │                     │     │
│    │                    │  │ Admin Web:5173  │   │                     │     │
│    │                    │  │ SQLite DB       │   │                     │     │
│    │                    │  └─────────────────┘   │                     │     │
│    │                    └────────────────────────┘                     │     │
│    └───────────────────────────────────────────────────────────────────┘     │
│                                      │                                         │
│    ┌─────────────────────────────────┼─────────────────────────────────┐     │
│    │                         📷 입차 구역                                │     │
│    │                                 │                                  │     │
│    │     ┌───────────┐    ┌─────────┴─────────┐    ┌───────────┐      │     │
│    │     │ LPR 카메라 │    │  릴레이 컨트롤러   │    │   차단기   │      │     │
│    │     │ .20       │    │  .30 (USR-R16-T)  │    │  (접점)    │      │     │
│    │     │           │    │                   │    │           │      │     │
│    │     │  HTTP ────┼────│── HTTP ───────────┼────│── 릴레이  │      │     │
│    │     │  POST     │    │  /relay/1/on      │    │  접점     │      │     │
│    │     └───────────┘    └───────────────────┘    └───────────┘      │     │
│    │           │                    │                    │             │     │
│    │           └────────── 입차 감지 ─────────── 차단기 열림 ──────────┘     │     │
│    └───────────────────────────────────────────────────────────────────┘     │
│                                      │                                         │
│    ┌─────────────────────────────────┼─────────────────────────────────┐     │
│    │                         🚗 출차 구역                                │     │
│    │                                 │                                  │     │
│    │     ┌───────────┐    ┌─────────┴─────────┐    ┌───────────┐      │     │
│    │     │ LPR 카메라 │    │  릴레이 컨트롤러   │    │   차단기   │      │     │
│    │     │ .21       │    │  .31 (USR-R16-T)  │    │  (접점)    │      │     │
│    │     │           │    │                   │    │           │      │     │
│    │     │  HTTP ────┼────│── HTTP ───────────┼────│── 릴레이  │      │     │
│    │     │  POST     │    │  /relay/1/on      │    │  접점     │      │     │
│    │     └───────────┘    └───────────────────┘    └───────────┘      │     │
│    │           │                    │                    │             │     │
│    │           └────── 출차 감지 + 결제 확인 ─── 차단기 열림 ─────────┘     │     │
│    └───────────────────────────────────────────────────────────────────┘     │
│                                      │                                         │
│    ┌─────────────────────────────────┼─────────────────────────────────┐     │
│    │                         🖥️ 운영 구역                                │     │
│    │                                 │                                  │     │
│    │     ┌───────────┐         ┌────┴────┐         ┌───────────┐      │     │
│    │     │  키오스크  │         │ 관제 PC │         │  모바일    │      │     │
│    │     │  .40      │         │  .50    │         │  PWA      │      │     │
│    │     │           │         │         │         │           │      │     │
│    │     │ /kiosk    │         │ 대시보드  │         │ 원격 관제  │      │     │
│    │     └───────────┘         └─────────┘         └───────────┘      │     │
│    └───────────────────────────────────────────────────────────────────┘     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
`}</pre>
      </div>

      <SubTitle>데이터 흐름</SubTitle>
      <div className="bg-gray-900 text-gray-100 p-6 rounded-lg mb-6 font-mono text-xs overflow-x-auto">
        <pre>{`
┌─────────────────────────────────────────────────────────────────────────┐
│                            입차 프로세스                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. 차량 진입                                                           │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────┐   HTTP POST    ┌─────────────┐                       │
│   │ LPR 카메라   │ ────────────▶  │ ParkFlow    │                       │
│   │             │   번호판 인식    │ API Server  │                       │
│   └─────────────┘                └──────┬──────┘                       │
│                                         │                               │
│                                         ▼                               │
│                                  ┌──────────────┐                       │
│                                  │ 세션 생성     │                       │
│                                  │ 블랙리스트 확인│                       │
│                                  │ 정기권 확인   │                       │
│                                  └──────┬───────┘                       │
│                                         │                               │
│                           ┌─────────────┼─────────────┐                 │
│                           ▼             ▼             ▼                 │
│                    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│                    │ 정상 입차 │  │ 정기권   │  │ 블랙리스트 │            │
│                    │          │  │ 자동 열림 │  │ 입차 거부  │            │
│                    └────┬─────┘  └────┬─────┘  └──────────┘            │
│                         │             │                                 │
│                         ▼             ▼                                 │
│                  ┌──────────────────────────┐                          │
│   2. 차단기      │    릴레이 컨트롤러        │                          │
│      열림        │    HTTP /relay/1/on      │                          │
│                  └──────────┬───────────────┘                          │
│                             │                                           │
│                             ▼                                           │
│                       ┌──────────┐                                     │
│                       │  차단기   │                                     │
│                       │  열림    │                                     │
│                       └──────────┘                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            출차 프로세스                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. 차량 출차 감지                                                      │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────┐   HTTP POST    ┌─────────────┐                       │
│   │ LPR 카메라   │ ────────────▶  │ ParkFlow    │                       │
│   │ (출구)      │   번호판 인식    │ API Server  │                       │
│   └─────────────┘                └──────┬──────┘                       │
│                                         │                               │
│                                         ▼                               │
│                                  ┌──────────────┐                       │
│                                  │ 세션 조회     │                       │
│                                  │ 요금 계산     │                       │
│                                  └──────┬───────┘                       │
│                                         │                               │
│                    ┌────────────────────┼────────────────────┐          │
│                    ▼                    ▼                    ▼          │
│             ┌──────────┐         ┌──────────┐         ┌──────────┐     │
│             │ 무료 출차 │         │ 정기권   │         │ 결제 필요 │     │
│             │ (30분내)  │         │ 무료 출차 │         │          │     │
│             └────┬─────┘         └────┬─────┘         └────┬─────┘     │
│                  │                    │                    │           │
│                  │                    │                    ▼           │
│                  │                    │            ┌──────────────┐    │
│                  │                    │            │  키오스크     │    │
│                  │                    │            │  결제 대기    │    │
│                  │                    │            └──────┬───────┘    │
│                  │                    │                   │            │
│                  │                    │                   ▼            │
│                  │                    │            ┌──────────────┐    │
│                  │                    │            │ 토스페이먼츠  │    │
│                  │                    │            │ 결제 처리     │    │
│                  │                    │            └──────┬───────┘    │
│                  │                    │                   │            │
│                  ▼                    ▼                   ▼            │
│   2. 차단기 열림  ◀──────────────────────────────────────┘            │
│                  │                                                     │
│                  ▼                                                     │
│           ┌──────────────────────────┐                                │
│           │    릴레이 컨트롤러        │                                │
│           │    HTTP /relay/1/on      │                                │
│           └──────────┬───────────────┘                                │
│                      │                                                 │
│                      ▼                                                 │
│                ┌──────────┐                                           │
│                │  차단기   │                                           │
│                │  열림    │                                           │
│                └──────────┘                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
`}</pre>
      </div>

      <InfoBox type="info">
        릴레이 컨트롤러를 사용하면 대부분의 일반 차단기와 연동이 가능합니다.
        HTTP API를 직접 지원하는 고가의 차단기를 구매할 필요가 없습니다.
      </InfoBox>
    </div>
  );
}

function ShoppingSection() {
  const items = [
    {
      category: '서버 (필수)',
      products: [
        { name: '미니 PC (서버용)', spec: 'Intel i5+, RAM 8GB+, SSD 256GB+', price: '30~50만원', link: '쿠팡/다나와', required: true },
      ],
    },
    {
      category: '네트워크 (필수)',
      products: [
        { name: 'PoE 스위치', spec: '8포트 이상, 기가비트', price: '5~10만원', link: '쿠팡/다나와', required: true },
        { name: '공유기', spec: '기가비트, 듀얼밴드', price: '3~10만원', link: '쿠팡/다나와', required: true },
        { name: 'Cat6 LAN 케이블', spec: '외부용, 필요 길이', price: '1~3만원', link: '쿠팡/다나와', required: true },
      ],
    },
    {
      category: 'LPR 카메라 (필수)',
      products: [
        { name: 'LPR 전용 카메라', spec: 'HTTP API 지원, IR 조명 내장', price: '80~150만원', link: '카모시스템/파킹클라우드', required: true },
        { name: '카메라 브라켓', spec: '벽면/폴 설치용', price: '2~5만원', link: '전문업체', required: true },
      ],
    },
    {
      category: '차단기 시스템 (필수)',
      products: [
        { name: '차단기', spec: '바 길이 3~6m', price: '100~200만원', link: '에버다임/세이코', required: true },
        { name: '릴레이 컨트롤러', spec: 'USR-R16-T 또는 Shelly Pro', price: '5~10만원', link: '알리익스프레스/쿠팡', required: true },
        { name: '루프 센서', spec: '차량 감지용', price: '5~10만원', link: '전문업체', required: true },
      ],
    },
    {
      category: '키오스크 (선택)',
      products: [
        { name: '터치 모니터', spec: '15~21인치, 정전식', price: '20~50만원', link: '쿠팡/다나와', required: false },
        { name: '미니 PC', spec: 'Intel i3+, RAM 4GB+', price: '20~30만원', link: '쿠팡/다나와', required: false },
        { name: '키오스크 함체', spec: '야외용, 방수', price: '30~100만원', link: '전문업체', required: false },
      ],
    },
    {
      category: '기타 (선택)',
      products: [
        { name: 'UPS (무정전 전원)', spec: '1000VA 이상', price: '10~30만원', link: '쿠팡/다나와', required: false },
        { name: 'CCTV', spec: '일반 감시용', price: '5~20만원', link: '쿠팡/다나와', required: false },
      ],
    },
  ];

  const calculateTotal = (onlyRequired: boolean) => {
    let min = 0;
    let max = 0;
    items.forEach((cat) => {
      cat.products.forEach((p) => {
        if (!onlyRequired || p.required) {
          const prices = p.price.match(/\d+/g);
          if (prices && prices.length > 0) {
            min += parseInt(prices[0], 10) * 10000;
            max += parseInt(prices[prices.length - 1] || prices[0], 10) * 10000;
          }
        }
      });
    });
    return { min, max };
  };

  const requiredTotal = calculateTotal(true);
  const allTotal = calculateTotal(false);

  return (
    <div>
      <SectionTitle>🛒 구매 품목</SectionTitle>

      <Paragraph>
        ParkFlow 시스템 구축에 필요한 하드웨어 구매 목록입니다.
        1개 입출구 기준이며, 추가 차로는 LPR 카메라와 차단기만 추가하면 됩니다.
      </Paragraph>

      {/* 예상 비용 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">💰 필수 품목 예상 비용</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
            {(requiredTotal.min / 10000).toFixed(0)} ~ {(requiredTotal.max / 10000).toFixed(0)}만원
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">설치비 별도</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">📦 전체 품목 예상 비용</h3>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
            {(allTotal.min / 10000).toFixed(0)} ~ {(allTotal.max / 10000).toFixed(0)}만원
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">키오스크, UPS 포함</p>
        </div>
      </div>

      {/* 품목별 목록 */}
      {items.map((category, idx) => (
        <div key={idx} className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            {category.category}
          </h3>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="py-2 px-4 text-left text-gray-900 dark:text-white">품목</th>
                  <th className="py-2 px-4 text-left text-gray-900 dark:text-white">사양</th>
                  <th className="py-2 px-4 text-left text-gray-900 dark:text-white">예상 가격</th>
                  <th className="py-2 px-4 text-left text-gray-900 dark:text-white">구매처</th>
                </tr>
              </thead>
              <tbody>
                {category.products.map((product, pIdx) => (
                  <tr key={pIdx} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                      {product.required && <span className="text-red-500 mr-1">*</span>}
                      {product.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{product.spec}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{product.price}</td>
                    <td className="py-3 px-4 text-blue-600 dark:text-blue-400">{product.link}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <InfoBox type="warning">
        <strong>릴레이 컨트롤러 추천:</strong> USR-R16-T (알리익스프레스 ~8만원) 또는
        Shelly Pro 4PM (국내 ~15만원). HTTP API를 지원하여 ParkFlow와 바로 연동 가능합니다.
      </InfoBox>

      <InfoBox type="info">
        <strong>LPR 카메라 문의처:</strong> 카모시스템 (1588-xxxx), 파킹클라우드 (02-xxxx-xxxx).
        HTTP POST로 이벤트 전송 가능한 제품인지 반드시 확인하세요.
      </InfoBox>
    </div>
  );
}

function RelaySection() {
  return (
    <div>
      <SectionTitle>🔌 릴레이 컨트롤러 설정</SectionTitle>

      <Paragraph>
        릴레이 컨트롤러는 ParkFlow 서버와 차단기를 연결하는 핵심 장비입니다.
        HTTP 요청으로 릴레이를 ON/OFF하여 차단기를 제어합니다.
      </Paragraph>

      <SubTitle>지원 릴레이 컨트롤러</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <h4 className="font-bold text-green-800 dark:text-green-200 mb-2">✅ USR-R16-T (추천)</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 16채널 릴레이</li>
            <li>• HTTP API 지원</li>
            <li>• PoE 전원 지원</li>
            <li>• 약 8만원 (알리)</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Shelly Pro 4PM</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 4채널 릴레이</li>
            <li>• HTTP/MQTT 지원</li>
            <li>• 전력 모니터링</li>
            <li>• 약 15만원 (국내)</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">ESP32 DIY</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 직접 제작</li>
            <li>• 저렴 (3만원 이하)</li>
            <li>• 커스터마이징 가능</li>
            <li>• 기술력 필요</li>
          </ul>
        </div>
      </div>

      <SubTitle>USR-R16-T 설정 방법</SubTitle>
      <div className="space-y-4">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">1. 네트워크 설정</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>PC와 USR-R16-T를 이더넷으로 직접 연결</li>
            <li>PC IP를 192.168.0.x로 변경 (예: 192.168.0.100)</li>
            <li>브라우저에서 <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">192.168.0.7</code> 접속 (기본 IP)</li>
            <li>설정 페이지에서 IP 주소를 <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">192.168.1.30</code>으로 변경</li>
            <li>게이트웨이: 192.168.1.1</li>
            <li>서브넷 마스크: 255.255.255.0</li>
          </ol>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">2. HTTP API 테스트</h4>
          <CodeBlock title="브라우저 또는 curl">{`# 릴레이 1번 ON (차단기 열림)
http://192.168.1.30/relay/1/on

# 릴레이 1번 OFF (차단기 닫힘)
http://192.168.1.30/relay/1/off

# 상태 확인
http://192.168.1.30/relay/1/status`}</CodeBlock>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">3. 차단기 연결</h4>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs mb-4">
            <pre>{`
┌─────────────────────────────────────────────────────────┐
│                    USR-R16-T 릴레이                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   릴레이 1번 단자                                         │
│   ┌─────────────────┐                                   │
│   │  COM  │  NO   │  NC  │                              │
│   └───┬───┴───┬───┴──────┘                              │
│       │       │                                         │
│       │       └───────────────┐                         │
│       │                       │                         │
│   ┌───┴───────────────────┐   │                         │
│   │     차단기 컨트롤러     │   │                         │
│   │                       │   │                         │
│   │   OPEN 단자  ─────────┼───┘                         │
│   │   GND 단자  ──────────┘ (COM)                       │
│   │                       │                             │
│   └───────────────────────┘                             │
│                                                         │
│   * NO (Normally Open): 평소 열림, 신호 시 닫힘           │
│   * COM: 공통 단자                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
`}</pre>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            대부분의 차단기는 "OPEN" 또는 "EXT" 단자에 순간 접점 신호를 주면 열립니다.
            차단기 매뉴얼에서 외부 개방 신호 단자를 확인하세요.
          </p>
        </div>
      </div>

      <SubTitle>ParkFlow 장비 등록</SubTitle>
      <CodeBlock title="devices 테이블 config_json 예시">{`{
  "protocol": "RELAY",
  "relayType": "USR",
  "host": "192.168.1.30",
  "port": 80,
  "channel": 1,
  "openDuration": 5000,
  "timeout": 5000,
  "retryCount": 3
}`}</CodeBlock>

      <InfoBox type="success">
        설정 완료 후 관리자 페이지 → 장치 관리에서 "테스트" 버튼으로 차단기 동작을 확인하세요.
      </InfoBox>
    </div>
  );
}

function LprSection() {
  return (
    <div>
      <SectionTitle>📷 LPR 카메라 설정</SectionTitle>

      <Paragraph>
        LPR 카메라가 번호판을 인식하면 HTTP POST로 ParkFlow API에 이벤트를 전송합니다.
      </Paragraph>

      <SubTitle>카메라 설정 요구사항</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white w-1/3">이벤트 전송 방식</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">HTTP POST (JSON)</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">API 엔드포인트</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  http://192.168.1.10:3000/api/device/lpr/events
                </code>
              </td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">Content-Type</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">application/json</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">인코딩</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">UTF-8</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>JSON 전송 형식</SubTitle>
      <CodeBlock title="POST /api/device/lpr/events">{`{
  "deviceId": "dev_lpr_entry_1",    // 장치 ID (ParkFlow에 등록된 ID)
  "laneId": "lane_entry_1",         // 차로 ID
  "direction": "ENTRY",             // "ENTRY" 또는 "EXIT"
  "plateNo": "12가3456",            // 인식된 번호판
  "capturedAt": "2024-01-15T10:30:00+09:00",  // ISO 8601 형식
  "confidence": 0.95,               // 인식 신뢰도 (선택)
  "imageUrl": "http://192.168.1.20/capture/latest.jpg"  // 이미지 URL (선택)
}`}</CodeBlock>

      <SubTitle>카메라별 설정 가이드</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">한화비전/Wisenet</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
            <li>카메라 웹 설정 → 이벤트 → 알림</li>
            <li>HTTP POST 알림 활성화</li>
            <li>URL에 ParkFlow API 주소 입력</li>
            <li>JSON 템플릿에서 필드 매핑</li>
          </ol>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">다후아/Dahua</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
            <li>카메라 웹 설정 → 이벤트 → 스마트 이벤트 → LPR</li>
            <li>HTTP 알림 서버 추가</li>
            <li>서버 주소: 192.168.1.10, 포트: 3000</li>
            <li>경로: /api/device/lpr/events</li>
          </ol>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">국산 LPR 전용 카메라</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
            <li>제조사에 HTTP POST 지원 여부 확인</li>
            <li>JSON 형식 커스터마이징 가능 여부 확인</li>
            <li>필요시 미들웨어 개발 (포맷 변환)</li>
          </ol>
        </div>
      </div>

      <SubTitle>연동 테스트</SubTitle>

      <InfoBox type="info">
        <strong>시뮬레이션 페이지 활용:</strong> 관리자 페이지 → 시뮬레이션 메뉴에서 GUI로 입/출차 테스트를 수행할 수 있습니다.
        하드웨어 설치 전 소프트웨어 동작을 먼저 확인하세요.
      </InfoBox>

      <CodeBlock title="curl 테스트 (입차)">{`curl -X POST http://192.168.1.10:3000/api/device/lpr/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "dev_lpr_entry_1",
    "laneId": "lane_entry_1",
    "direction": "ENTRY",
    "plateNo": "12가3456",
    "capturedAt": "'$(date -Iseconds)'"
  }'`}</CodeBlock>

      <CodeBlock title="curl 테스트 (출차)">{`curl -X POST http://192.168.1.10:3000/api/device/lpr/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "dev_lpr_exit_1",
    "laneId": "lane_exit_1",
    "direction": "EXIT",
    "plateNo": "12가3456",
    "capturedAt": "'$(date -Iseconds)'"
  }'`}</CodeBlock>

      <SubTitle>시뮬레이션 API (하드웨어 없이 테스트)</SubTitle>
      <Paragraph>
        하드웨어 설치 전 ParkFlow의 모든 기능을 테스트할 수 있습니다.
      </Paragraph>
      <CodeBlock title="시뮬레이션 입차 API">{`curl -X POST http://localhost:3000/api/simulation/entry \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"plateNo": "12가3456"}'`}</CodeBlock>

      <CodeBlock title="시뮬레이션 출차 API">{`curl -X POST http://localhost:3000/api/simulation/exit \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"plateNo": "12가3456"}'`}</CodeBlock>

      <CodeBlock title="대량 입차 시뮬레이션">{`curl -X POST http://localhost:3000/api/simulation/bulk-entry \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"count": 10}'`}</CodeBlock>

      <InfoBox type="warning">
        카메라 구매 전 반드시 HTTP POST로 번호판 인식 결과를 전송할 수 있는지 확인하세요.
        일부 저가 카메라는 FTP만 지원합니다.
      </InfoBox>
    </div>
  );
}

function NetworkSection() {
  return (
    <div>
      <SectionTitle>🌐 네트워크 설정</SectionTitle>

      <Paragraph>
        모든 장비가 동일 네트워크에서 통신할 수 있도록 IP 주소를 할당합니다.
      </Paragraph>

      <SubTitle>권장 IP 주소 할당</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">장비</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">IP 주소</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">포트</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">용도</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">공유기</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">게이트웨이</td>
            </tr>
            <tr className="border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <td className="py-2 font-medium text-blue-800 dark:text-blue-200">ParkFlow 서버</td>
              <td className="py-2 font-mono text-blue-800 dark:text-blue-200">192.168.1.10</td>
              <td className="py-2 text-blue-600 dark:text-blue-400">3000, 5173</td>
              <td className="py-2 text-blue-600 dark:text-blue-400">API, 웹</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 LPR 카메라</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.20</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80</td>
              <td className="py-2 text-gray-500">입차 감지</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 LPR 카메라</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.21</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80</td>
              <td className="py-2 text-gray-500">출차 감지</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 릴레이</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.30</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80</td>
              <td className="py-2 text-gray-500">입구 차단기</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 릴레이</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.31</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80</td>
              <td className="py-2 text-gray-500">출구 차단기</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">키오스크</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.40</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">무인 정산</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600 dark:text-gray-400">관제 PC</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.50</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">모니터링</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>네트워크 다이어그램</SubTitle>
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-6 font-mono text-xs overflow-x-auto">
        <pre>{`
              ┌──────────────┐
              │   인터넷     │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │    공유기     │
              │ 192.168.1.1  │
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
   ┌─────┴─────┐     │     ┌─────┴─────┐
   │ PoE 스위치 │     │     │ PoE 스위치 │
   │  (입구)   │     │     │  (출구)   │
   └─────┬─────┘     │     └─────┬─────┘
         │           │           │
    ┌────┼────┐      │      ┌────┼────┐
    │    │    │      │      │    │    │
  LPR  릴레이 차단기  서버   LPR  릴레이 차단기
  .20   .30         .10    .21   .31
`}</pre>
      </div>

      <SubTitle>장비별 설정</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">ParkFlow 서버 (Ubuntu)</h4>
          <CodeBlock title="/etc/netplan/01-netcfg.yaml">{`network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]`}</CodeBlock>
          <CodeBlock title="적용">{`sudo netplan apply`}</CodeBlock>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">방화벽 설정</h4>
          <CodeBlock title="Ubuntu UFW">{`# 필요한 포트 열기
sudo ufw allow 3000/tcp  # API Server
sudo ufw allow 5173/tcp  # Admin Web (개발)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 방화벽 활성화
sudo ufw enable
sudo ufw status`}</CodeBlock>
        </div>
      </div>

      <InfoBox type="info">
        모든 장비는 <strong>고정 IP</strong>로 설정하세요. DHCP를 사용하면 IP가 변경되어 연동이 끊길 수 있습니다.
      </InfoBox>
    </div>
  );
}

function ConfigSection() {
  return (
    <div>
      <SectionTitle>⚙️ 장비 등록</SectionTitle>

      <Paragraph>
        ParkFlow 관리자 페이지에서 장비를 등록하는 방법입니다.
      </Paragraph>

      <SubTitle>1. 사이트 등록</SubTitle>
      <Paragraph>
        관리자 페이지 → 사이트 관리에서 주차장 정보를 등록합니다.
      </Paragraph>

      <SubTitle>2. 차로 등록</SubTitle>
      <Paragraph>
        관리자 페이지 → 장치 관리 → 차로에서 입/출차 차로를 등록합니다.
      </Paragraph>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">필드</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">예시 (입구)</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">예시 (출구)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-900 dark:text-white">차로 ID</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">lane_entry_1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">lane_exit_1</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-900 dark:text-white">차로명</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1번 입구</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1번 출구</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-900 dark:text-white">방향</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">ENTRY</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">EXIT</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>3. LPR 카메라 등록</SubTitle>
      <CodeBlock title="장치 설정">{`{
  "id": "dev_lpr_entry_1",
  "name": "1번 입구 LPR",
  "type": "LPR",
  "laneId": "lane_entry_1",
  "config": {
    "protocol": "HTTP",
    "host": "192.168.1.20",
    "port": 80
  }
}`}</CodeBlock>

      <SubTitle>4. 차단기 등록 (릴레이 컨트롤러)</SubTitle>
      <CodeBlock title="장치 설정">{`{
  "id": "dev_barrier_entry_1",
  "name": "1번 입구 차단기",
  "type": "BARRIER",
  "laneId": "lane_entry_1",
  "config": {
    "protocol": "RELAY",
    "relayType": "USR",
    "host": "192.168.1.30",
    "port": 80,
    "channel": 1,
    "openDuration": 5000
  }
}`}</CodeBlock>

      <SubTitle>5. 연동 테스트</SubTitle>
      <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2 mb-6">
        <li>장치 관리 페이지에서 각 장비의 "연결 상태" 확인 (녹색)</li>
        <li>차단기 "테스트" 버튼 클릭하여 열림/닫힘 동작 확인</li>
        <li>LPR 카메라 앞에서 번호판 인식 테스트</li>
        <li>대시보드에서 입차 이벤트 실시간 표시 확인</li>
      </ol>

      <SubTitle>체크리스트</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <div className="space-y-2">
          {[
            '서버 IP 고정 설정 완료',
            'LPR 카메라 이벤트 전송 URL 설정',
            '릴레이 컨트롤러 IP 설정 및 테스트',
            '차단기-릴레이 배선 연결',
            'ParkFlow 장치 등록',
            '입차/출차 테스트 완료',
            '정기권 차량 테스트',
            '결제 후 출차 테스트',
          ].map((item, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              {item}
            </label>
          ))}
        </div>
      </div>

      <InfoBox type="success">
        모든 체크리스트를 완료하면 주차장 운영을 시작할 수 있습니다!
      </InfoBox>
    </div>
  );
}
