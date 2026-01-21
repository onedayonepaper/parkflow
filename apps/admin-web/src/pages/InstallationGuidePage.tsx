import { useState } from 'react';

type Section =
  | 'requirements'
  | 'docker'
  | 'manual'
  | 'network'
  | 'lpr'
  | 'barrier'
  | 'kiosk'
  | 'production'
  | 'troubleshooting';

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'requirements', title: '시스템 요구사항', icon: '📋' },
  { id: 'docker', title: 'Docker 설치', icon: '🐳' },
  { id: 'manual', title: '수동 설치', icon: '⚙️' },
  { id: 'network', title: '네트워크 구성', icon: '🌐' },
  { id: 'lpr', title: 'LPR 카메라 설치', icon: '📷' },
  { id: 'barrier', title: '차단기 설치', icon: '🚧' },
  { id: 'kiosk', title: '키오스크 설치', icon: '🖥️' },
  { id: 'production', title: '운영 환경 배포', icon: '🚀' },
  { id: 'troubleshooting', title: '문제 해결', icon: '🔧' },
];

export default function InstallationGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('requirements');

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <nav className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🛠️ 설치 가이드
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
          {activeSection === 'requirements' && <RequirementsSection />}
          {activeSection === 'docker' && <DockerSection />}
          {activeSection === 'manual' && <ManualSection />}
          {activeSection === 'network' && <NetworkSection />}
          {activeSection === 'lpr' && <LprSection />}
          {activeSection === 'barrier' && <BarrierSection />}
          {activeSection === 'kiosk' && <KioskSection />}
          {activeSection === 'production' && <ProductionSection />}
          {activeSection === 'troubleshooting' && <TroubleshootingSection />}
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

function RequirementsSection() {
  return (
    <div>
      <SectionTitle>📋 시스템 요구사항</SectionTitle>

      <Paragraph>
        ParkFlow를 설치하기 전에 시스템 요구사항을 확인하세요.
      </Paragraph>

      <SubTitle>소프트웨어 요구사항</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">필수 소프트웨어</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <strong>Node.js</strong> v18.0 이상
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <strong>pnpm</strong> v8.0 이상
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <strong>Git</strong> v2.30 이상
            </li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">선택 소프트웨어</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-blue-500">○</span>
              <strong>Docker</strong> v24.0 이상 (컨테이너 배포 시)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">○</span>
              <strong>Docker Compose</strong> v2.20 이상
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">○</span>
              <strong>nginx</strong> (리버스 프록시 사용 시)
            </li>
          </ul>
        </div>
      </div>

      <SubTitle>하드웨어 요구사항</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">구분</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">최소 사양</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">권장 사양</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">CPU</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">Intel i3 / Ryzen 3</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">Intel i7 / Ryzen 7</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">RAM</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">4GB</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">16GB</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">저장 공간</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">128GB SSD</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">512GB SSD</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">네트워크</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">100Mbps</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1Gbps</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>지원 운영체제</SubTitle>
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-sm font-medium">
          🐧 Ubuntu 20.04 / 22.04 LTS
        </span>
        <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium">
          🪟 Windows 10 / 11
        </span>
        <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium">
          🍎 macOS 12+ (개발용)
        </span>
      </div>

      <InfoBox type="info">
        운영 환경에서는 Ubuntu Server LTS 버전을 권장합니다.
      </InfoBox>
    </div>
  );
}

function DockerSection() {
  return (
    <div>
      <SectionTitle>🐳 Docker 설치</SectionTitle>

      <Paragraph>
        Docker를 사용하면 가장 간편하게 ParkFlow를 설치할 수 있습니다.
      </Paragraph>

      <SubTitle>1. Docker 설치</SubTitle>
      <CodeBlock title="Ubuntu">{`# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치 (최신 버전)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Docker 권한 설정
sudo usermod -aG docker $USER
newgrp docker

# 설치 확인
docker --version
docker compose version`}</CodeBlock>

      <SubTitle>2. 프로젝트 클론</SubTitle>
      <CodeBlock title="Terminal">{`git clone https://github.com/your-repo/parkflow.git
cd parkflow`}</CodeBlock>

      <SubTitle>3. 환경 변수 설정</SubTitle>
      <CodeBlock title=".env">{`# API Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database
DATABASE_URL=file:./data/parkflow.db

# CORS (프론트엔드 URL)
CORS_ORIGIN=http://localhost:5173

# 토스페이먼츠 (선택)
TOSS_CLIENT_KEY=your-toss-client-key
TOSS_SECRET_KEY=your-toss-secret-key

# 알림 (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password`}</CodeBlock>

      <SubTitle>4. Docker Compose로 실행</SubTitle>
      <CodeBlock title="docker-compose.yml">{`version: '3.8'

services:
  api-server:
    build:
      context: .
      dockerfile: apps/api-server/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=\${JWT_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  admin-web:
    build:
      context: .
      dockerfile: apps/admin-web/Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - api-server
    restart: unless-stopped

volumes:
  data:`}</CodeBlock>

      <CodeBlock title="Terminal">{`# 빌드 및 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 서비스 상태 확인
docker compose ps

# 서비스 중지
docker compose down`}</CodeBlock>

      <SubTitle>5. 접속 확인</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">관리자 웹</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://서버IP:5173</code></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">키오스크</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://서버IP:5173/kiosk</code></td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">API 서버</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://서버IP:3000</code></td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">API 문서</td>
              <td className="py-2"><code className="text-blue-600 dark:text-blue-400">http://서버IP:3000/docs</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="success">
        기본 계정: <strong>admin / admin123</strong> (운영 환경에서는 반드시 변경하세요)
      </InfoBox>
    </div>
  );
}

function ManualSection() {
  return (
    <div>
      <SectionTitle>⚙️ 수동 설치</SectionTitle>

      <Paragraph>
        Docker 없이 직접 설치하는 방법입니다. 개발 환경이나 커스터마이징이 필요한 경우 사용하세요.
      </Paragraph>

      <SubTitle>1. Node.js 설치</SubTitle>
      <CodeBlock title="Ubuntu (nvm 사용)">{`# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Node.js 18 설치
nvm install 18
nvm use 18
nvm alias default 18

# 확인
node --version  # v18.x.x`}</CodeBlock>

      <SubTitle>2. pnpm 설치</SubTitle>
      <CodeBlock title="Terminal">{`# pnpm 설치
npm install -g pnpm

# 확인
pnpm --version  # 8.x.x`}</CodeBlock>

      <SubTitle>3. 프로젝트 설정</SubTitle>
      <CodeBlock title="Terminal">{`# 프로젝트 클론
git clone https://github.com/your-repo/parkflow.git
cd parkflow

# 의존성 설치
pnpm install

# 환경 변수 설정
cp apps/api-server/.env.example apps/api-server/.env
# .env 파일 편집하여 설정 변경

# 데이터베이스 시딩
cd apps/api-server
pnpm seed
cd ../..`}</CodeBlock>

      <SubTitle>4. 개발 모드 실행</SubTitle>
      <CodeBlock title="Terminal">{`# 모든 앱 동시 실행 (개발 모드)
pnpm dev

# 또는 개별 실행
pnpm --filter api-server dev    # API 서버 (포트 3000)
pnpm --filter admin-web dev     # 관리자 웹 (포트 5173)
pnpm --filter device-agent dev  # 디바이스 시뮬레이터`}</CodeBlock>

      <SubTitle>5. 프로덕션 빌드</SubTitle>
      <CodeBlock title="Terminal">{`# 전체 빌드
pnpm build

# API 서버 실행 (프로덕션)
cd apps/api-server
NODE_ENV=production node dist/index.js

# Admin Web은 nginx로 서빙 (아래 참조)`}</CodeBlock>

      <SubTitle>6. PM2로 프로세스 관리</SubTitle>
      <CodeBlock title="Terminal">{`# PM2 설치
npm install -g pm2

# API 서버 실행
cd apps/api-server
pm2 start dist/index.js --name parkflow-api

# PM2 상태 확인
pm2 status

# 부팅 시 자동 실행 설정
pm2 startup
pm2 save`}</CodeBlock>

      <InfoBox type="warning">
        운영 환경에서는 PM2 또는 systemd를 사용하여 프로세스를 관리하세요.
      </InfoBox>
    </div>
  );
}

function NetworkSection() {
  return (
    <div>
      <SectionTitle>🌐 네트워크 구성</SectionTitle>

      <Paragraph>
        ParkFlow 시스템의 네트워크 구성 방법입니다. 모든 장비가 동일 네트워크에서 통신할 수 있어야 합니다.
      </Paragraph>

      <SubTitle>네트워크 토폴로지</SubTitle>
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-6 font-mono text-sm overflow-x-auto">
        <pre>{`┌─────────────────────────────────────────────────────────────┐
│                      주차장 네트워크                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [인터넷] ─── [공유기/라우터] ─── [L2 스위치]                │
│                     │                   │                   │
│                192.168.1.1        ┌─────┼─────┐             │
│                     │             │     │     │             │
│                [서버 PC]       [LPR-1] [LPR-2] [차단기]       │
│               192.168.1.10     .20    .21     .30           │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │             │                                │
│         [키오스크]    [관제 PC]                               │
│          .40           .50                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <SubTitle>IP 주소 할당 계획</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
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
              <td className="py-2 text-gray-600 dark:text-gray-400">라우터/게이트웨이</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.1</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">DHCP 서버</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">ParkFlow 서버</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.10</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">3000, 5173</td>
              <td className="py-2 text-gray-500">고정 IP 필수</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">입구 LPR 카메라</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.20</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80, 554</td>
              <td className="py-2 text-gray-500">HTTP, RTSP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">출구 LPR 카메라</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.21</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">80, 554</td>
              <td className="py-2 text-gray-500">HTTP, RTSP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">차단기 컨트롤러</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.30</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">502</td>
              <td className="py-2 text-gray-500">Modbus TCP</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 text-gray-600 dark:text-gray-400">키오스크</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.40</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">웹 브라우저</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-600 dark:text-gray-400">관제 PC</td>
              <td className="py-2 font-mono text-gray-900 dark:text-white">192.168.1.50</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">-</td>
              <td className="py-2 text-gray-500">웹 브라우저</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>방화벽 설정</SubTitle>
      <CodeBlock title="Ubuntu UFW">{`# UFW 활성화
sudo ufw enable

# 필요한 포트 허용
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # API Server
sudo ufw allow 5173/tcp    # Admin Web (개발)

# 로컬 네트워크에서만 허용 (더 안전)
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw allow from 192.168.1.0/24 to any port 5173

# 상태 확인
sudo ufw status`}</CodeBlock>

      <SubTitle>nginx 리버스 프록시</SubTitle>
      <CodeBlock title="/etc/nginx/sites-available/parkflow">{`server {
    listen 80;
    server_name parkflow.example.com;

    # Admin Web
    location / {
        root /var/www/parkflow/admin-web;
        try_files $uri $uri/ /index.html;
    }

    # API Server
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /api/ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}`}</CodeBlock>

      <InfoBox type="info">
        HTTPS 설정은 Let's Encrypt (certbot)를 사용하여 무료 SSL 인증서를 발급받을 수 있습니다.
      </InfoBox>
    </div>
  );
}

function LprSection() {
  return (
    <div>
      <SectionTitle>📷 LPR 카메라 설치</SectionTitle>

      <Paragraph>
        LPR(License Plate Recognition) 카메라 설치 및 연동 방법입니다.
      </Paragraph>

      <SubTitle>설치 위치 가이드</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📐 설치 각도</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• 수평 각도: <strong>정면 또는 15° 이내</strong></li>
            <li>• 수직 각도: <strong>10~30°</strong> (약간 내려다보는 각도)</li>
            <li>• 촬영 거리: <strong>3~5m</strong></li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📏 설치 높이</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• 일반 차량: <strong>1.2~1.5m</strong></li>
            <li>• 트럭 포함: <strong>1.5~2.0m</strong></li>
            <li>• 번호판이 화면 중앙에 위치하도록</li>
          </ul>
        </div>
      </div>

      <SubTitle>카메라 설정</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 text-left text-gray-900 dark:text-white">항목</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">권장값</th>
              <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">해상도</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1920x1080</td>
              <td className="py-2 text-gray-500">Full HD 이상 권장</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">셔터 속도</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">1/1000초</td>
              <td className="py-2 text-gray-500">움직이는 차량 촬영</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">IR 조명</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">850nm</td>
              <td className="py-2 text-gray-500">야간 촬영용</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">트리거</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">루프센서/모션</td>
              <td className="py-2 text-gray-500">차량 감지 방식</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>API 연동 설정</SubTitle>
      <Paragraph>
        LPR 카메라가 번호판을 인식하면 ParkFlow API로 이벤트를 전송하도록 설정합니다.
      </Paragraph>
      <CodeBlock title="HTTP POST 이벤트 설정">{`# 카메라 웹 설정에서 HTTP POST 이벤트 설정

URL: http://192.168.1.10:3000/api/device/lpr/events
Method: POST
Content-Type: application/json

# 전송 데이터 형식
{
  "plateNo": "12가3456",
  "direction": "ENTRY",  // 또는 "EXIT"
  "deviceId": "dev_lpr_entry_1",
  "laneId": "lane_entry_1",
  "capturedAt": "2024-01-15T10:30:00Z",
  "imageUrl": "http://192.168.1.20/images/capture.jpg"  // 선택
}`}</CodeBlock>

      <SubTitle>연동 테스트</SubTitle>
      <CodeBlock title="curl 테스트">{`# 입차 이벤트 테스트
curl -X POST http://192.168.1.10:3000/api/device/lpr/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "plateNo": "12가3456",
    "direction": "ENTRY",
    "deviceId": "dev_lpr_entry_1",
    "laneId": "lane_entry_1"
  }'

# 출차 이벤트 테스트
curl -X POST http://192.168.1.10:3000/api/device/lpr/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "plateNo": "12가3456",
    "direction": "EXIT",
    "deviceId": "dev_lpr_exit_1",
    "laneId": "lane_exit_1"
  }'`}</CodeBlock>

      <InfoBox type="warning">
        카메라 렌즈는 주기적으로 청소해야 인식률을 유지할 수 있습니다. (주 1회 권장)
      </InfoBox>
    </div>
  );
}

function BarrierSection() {
  return (
    <div>
      <SectionTitle>🚧 차단기 설치</SectionTitle>

      <Paragraph>
        차단기 설치 및 ParkFlow 시스템과의 연동 방법입니다.
      </Paragraph>

      <SubTitle>하드웨어 설치</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">🔧 본체 설치</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• 차로 옆 콘크리트 기초 위에 고정</li>
            <li>• 앵커 볼트 4개 이상 사용</li>
            <li>• 수평 상태 확인</li>
            <li>• 방수 처리 확인</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">🔌 전기 연결</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• 전원: AC 220V (접지 필수)</li>
            <li>• 네트워크: RJ45 Cat5e 이상</li>
            <li>• 루프 센서: 2선식 케이블</li>
            <li>• 안전 센서: 광전 센서 연결</li>
          </ul>
        </div>
      </div>

      <SubTitle>안전 장치</SubTitle>
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">⚠️ 필수 안전 장치</h4>
        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
          <li>• <strong>루프 센서</strong>: 차량 감지 (차량이 있으면 내려오지 않음)</li>
          <li>• <strong>광전 센서</strong>: 장애물 감지 (작동 중 감지 시 즉시 상승)</li>
          <li>• <strong>수동 해제 레버</strong>: 정전/고장 시 수동 개방</li>
          <li>• <strong>비상 정지 버튼</strong>: 위급 상황 시 즉시 정지</li>
        </ul>
      </div>

      <SubTitle>컨트롤러 설정</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">IP 주소</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">192.168.1.30 (고정)</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">통신 프로토콜</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">Modbus TCP, 포트 502</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">자동 닫힘 시간</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">5초 (조절 가능)</td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-900 dark:text-white">동작 속도</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">상승 1.5초, 하강 3초</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubTitle>WebSocket 연동</SubTitle>
      <Paragraph>
        차단기는 WebSocket을 통해 ParkFlow 서버와 연결되어 실시간 명령을 수신합니다.
      </Paragraph>
      <CodeBlock title="WebSocket 연결">{`# 연결 URL
ws://192.168.1.10:3000/api/ws?apiKey=parkflow-device-key&deviceId=dev_barrier_entry_1

# 수신 명령 형식
{
  "type": "BARRIER_COMMAND",
  "data": {
    "action": "OPEN",       // OPEN 또는 CLOSE
    "reason": "PAID_EXIT",  // 개방 사유
    "commandId": "bcmd_xxx",
    "sessionId": "psess_xxx"
  }
}`}</CodeBlock>

      <SubTitle>동작 테스트</SubTitle>
      <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2">
        <li>수동 버튼으로 개폐 동작 확인</li>
        <li>루프 센서 위에 차량 정차 후 닫힘 방지 확인</li>
        <li>광전 센서 차단 시 상승 확인</li>
        <li>API를 통한 원격 개방 테스트</li>
        <li>비상 정지 버튼 동작 확인</li>
      </ol>
    </div>
  );
}

function KioskSection() {
  return (
    <div>
      <SectionTitle>🖥️ 키오스크 설치</SectionTitle>

      <Paragraph>
        무인 정산 키오스크 설치 방법입니다.
      </Paragraph>

      <SubTitle>하드웨어 권장 사양</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">필수 구성</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• <strong>터치 모니터</strong>: 15~21인치, 정전식</li>
            <li>• <strong>PC</strong>: Intel i3+, RAM 4GB+</li>
            <li>• <strong>SSD</strong>: 128GB 이상</li>
            <li>• <strong>OS</strong>: Windows 10/11 또는 Linux</li>
          </ul>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">선택 구성</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• <strong>카드 리더기</strong>: IC/MSR 복합</li>
            <li>• <strong>영수증 프린터</strong>: 80mm 열전사</li>
            <li>• <strong>바코드 스캐너</strong>: 1D/2D</li>
            <li>• <strong>스피커</strong>: 음성 안내용</li>
          </ul>
        </div>
      </div>

      <SubTitle>소프트웨어 설정</SubTitle>
      <CodeBlock title="Windows 키오스크 모드">{`:: Chrome 키오스크 모드로 실행하는 배치 파일
:: C:\\ParkFlow\\start-kiosk.bat

@echo off
taskkill /f /im chrome.exe 2>nul
timeout /t 2

start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^
  --kiosk ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-translate ^
  --no-first-run ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  "http://192.168.1.10:5173/kiosk"`}</CodeBlock>

      <CodeBlock title="Linux 키오스크 모드">{`#!/bin/bash
# /opt/parkflow/start-kiosk.sh

# X 서버 시작 (필요한 경우)
export DISPLAY=:0

# 화면 보호기 비활성화
xset s off
xset -dpms
xset s noblank

# 기존 Chrome 종료
pkill -f chromium

# Chromium 키오스크 모드 실행
chromium-browser \\
  --kiosk \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --disable-translate \\
  --noerrdialogs \\
  --disable-session-crashed-bubble \\
  "http://192.168.1.10:5173/kiosk"`}</CodeBlock>

      <SubTitle>자동 시작 설정</SubTitle>
      <CodeBlock title="Windows 작업 스케줄러">{`# 관리자 권한으로 실행
# 시작 → 작업 스케줄러 → 작업 만들기

이름: ParkFlow Kiosk
트리거: 시작 시
동작: C:\\ParkFlow\\start-kiosk.bat
조건:
  - "컴퓨터의 AC 전원 사용 중일 때만" 체크 해제
설정:
  - "요청 시 작업 실행" 체크`}</CodeBlock>

      <CodeBlock title="Linux systemd 서비스">{`# /etc/systemd/system/parkflow-kiosk.service
[Unit]
Description=ParkFlow Kiosk
After=graphical.target

[Service]
Type=simple
User=kiosk
Environment=DISPLAY=:0
ExecStart=/opt/parkflow/start-kiosk.sh
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target

# 서비스 활성화
sudo systemctl enable parkflow-kiosk
sudo systemctl start parkflow-kiosk`}</CodeBlock>

      <SubTitle>보안 설정</SubTitle>
      <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 mb-6">
        <li>Windows: 할당된 액세스 (Assigned Access) 모드 사용</li>
        <li>Linux: 별도 키오스크 전용 사용자 계정 생성</li>
        <li>BIOS/UEFI 암호 설정</li>
        <li>USB 포트 비활성화 (물리적 보안)</li>
        <li>원격 관리 도구 설치 (TeamViewer, AnyDesk 등)</li>
      </ul>

      <InfoBox type="info">
        키오스크 PC는 전원 복구 시 자동으로 켜지도록 BIOS에서 "Restore on AC Power Loss" 옵션을 활성화하세요.
      </InfoBox>
    </div>
  );
}

function ProductionSection() {
  return (
    <div>
      <SectionTitle>🚀 운영 환경 배포</SectionTitle>

      <Paragraph>
        ParkFlow를 실제 운영 환경에 배포하기 위한 체크리스트와 설정입니다.
      </Paragraph>

      <SubTitle>배포 전 체크리스트</SubTitle>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          {[
            { category: '보안', items: ['JWT_SECRET 변경', '기본 비밀번호 변경', 'HTTPS 설정', '방화벽 설정'] },
            { category: '백업', items: ['데이터베이스 백업 스케줄', '설정 파일 백업', '이미지 백업 저장소'] },
            { category: '모니터링', items: ['로그 수집 설정', 'APM 도구 설치', '알림 설정 (Slack, Email)'] },
            { category: '네트워크', items: ['고정 IP 설정 완료', '도메인 연결', 'SSL 인증서 발급'] },
          ].map((group, i) => (
            <div key={i} className="border-b dark:border-gray-700 pb-3 last:border-0 last:pb-0">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{group.category}</h4>
              <div className="grid grid-cols-2 gap-2">
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

      <SubTitle>환경 변수 (운영)</SubTitle>
      <CodeBlock title=".env.production">{`# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Security - 반드시 변경!
JWT_SECRET=your-very-long-and-random-secret-key-at-least-32-chars

# Database
DATABASE_URL=file:./data/parkflow.db

# CORS
CORS_ORIGIN=https://parkflow.example.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# 토스페이먼츠 (운영 키)
TOSS_CLIENT_KEY=live_xxx
TOSS_SECRET_KEY=live_secret_xxx

# 알림 (운영)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=secure-password

# Device API Key
DEVICE_API_KEY=your-secure-device-api-key`}</CodeBlock>

      <SubTitle>systemd 서비스 등록</SubTitle>
      <CodeBlock title="/etc/systemd/system/parkflow-api.service">{`[Unit]
Description=ParkFlow API Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=parkflow
Group=parkflow
WorkingDirectory=/opt/parkflow
ExecStart=/usr/bin/node apps/api-server/dist/index.js
Restart=always
RestartSec=10

# 환경 변수
EnvironmentFile=/opt/parkflow/.env.production

# 리소스 제한
LimitNOFILE=65536
MemoryMax=1G

# 로깅
StandardOutput=append:/var/log/parkflow/api.log
StandardError=append:/var/log/parkflow/api-error.log

[Install]
WantedBy=multi-user.target`}</CodeBlock>

      <CodeBlock title="서비스 관리">{`# 서비스 활성화 및 시작
sudo systemctl daemon-reload
sudo systemctl enable parkflow-api
sudo systemctl start parkflow-api

# 상태 확인
sudo systemctl status parkflow-api

# 로그 확인
sudo journalctl -u parkflow-api -f`}</CodeBlock>

      <SubTitle>자동 백업 스크립트</SubTitle>
      <CodeBlock title="/opt/parkflow/backup.sh">{`#!/bin/bash
# ParkFlow 자동 백업 스크립트

BACKUP_DIR="/backup/parkflow"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/opt/parkflow/apps/api-server/data/parkflow.db"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 데이터베이스 백업
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/parkflow_$DATE.db'"

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

# 백업 결과 로깅
echo "[$DATE] Backup completed: parkflow_$DATE.db" >> /var/log/parkflow/backup.log`}</CodeBlock>

      <CodeBlock title="crontab 설정">{`# 매일 새벽 3시에 백업 실행
0 3 * * * /opt/parkflow/backup.sh`}</CodeBlock>

      <InfoBox type="warning">
        운영 환경에서는 반드시 JWT_SECRET과 기본 비밀번호를 변경하고, HTTPS를 설정하세요.
      </InfoBox>
    </div>
  );
}

function TroubleshootingSection() {
  return (
    <div>
      <SectionTitle>🔧 문제 해결</SectionTitle>

      <Paragraph>
        설치 및 운영 중 발생할 수 있는 문제와 해결 방법입니다.
      </Paragraph>

      <SubTitle>API 서버 문제</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 서버가 시작되지 않음</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> 포트 충돌, 환경 변수 누락, 권한 문제</p>
            <p><strong>해결:</strong></p>
            <CodeBlock>{`# 포트 사용 확인
lsof -i :3000
# 사용 중이면 프로세스 종료
kill -9 <PID>

# 환경 변수 확인
cat .env

# 로그 확인
tail -f /var/log/parkflow/api-error.log`}</CodeBlock>
          </div>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 데이터베이스 오류</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> 파일 권한, 디스크 용량 부족, 파일 손상</p>
            <p><strong>해결:</strong></p>
            <CodeBlock>{`# 권한 확인 및 수정
ls -la data/
chown -R parkflow:parkflow data/
chmod 755 data/

# 디스크 용량 확인
df -h

# 데이터베이스 무결성 검사
sqlite3 data/parkflow.db "PRAGMA integrity_check;"`}</CodeBlock>
          </div>
        </div>
      </div>

      <SubTitle>WebSocket 연결 문제</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 실시간 이벤트가 표시되지 않음</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> WebSocket 연결 실패, 인증 토큰 만료</p>
            <p><strong>해결:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>브라우저 개발자 도구 → 네트워크 탭 → WS 필터로 연결 상태 확인</li>
              <li>로그아웃 후 다시 로그인</li>
              <li>브라우저 캐시 삭제 후 새로고침</li>
            </ul>
          </div>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ Device Agent 연결 실패</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> API 키 불일치, 네트워크 문제</p>
            <p><strong>해결:</strong></p>
            <CodeBlock>{`# API 키 확인
echo $DEVICE_API_KEY

# 연결 테스트
wscat -c "ws://localhost:3000/api/ws?apiKey=YOUR_KEY&deviceId=test"

# 서버 로그 확인
grep "WS" /var/log/parkflow/api.log`}</CodeBlock>
          </div>
        </div>
      </div>

      <SubTitle>LPR 카메라 문제</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 번호판 인식률 저하</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> 렌즈 오염, 조명 문제, 카메라 위치 이탈</p>
            <p><strong>해결:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>렌즈 청소 (마른 천 사용)</li>
              <li>IR 조명 상태 확인 (야간)</li>
              <li>카메라 각도 재조정</li>
              <li>해상도 및 셔터 속도 확인</li>
            </ul>
          </div>
        </div>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 이벤트가 전송되지 않음</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> 네트워크 문제, 잘못된 API 설정</p>
            <p><strong>해결:</strong></p>
            <CodeBlock>{`# 네트워크 연결 확인
ping 192.168.1.10

# API 엔드포인트 테스트
curl -X POST http://192.168.1.10:3000/api/device/lpr/events \\
  -H "Content-Type: application/json" \\
  -d '{"plateNo":"테스트","direction":"ENTRY","deviceId":"test","laneId":"test"}'`}</CodeBlock>
          </div>
        </div>
      </div>

      <SubTitle>차단기 문제</SubTitle>
      <div className="space-y-4 mb-6">
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ 차단기가 열리지 않음</h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>원인:</strong> 전원 문제, 네트워크 연결 끊김, 컨트롤러 오류</p>
            <p><strong>해결:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>전원 공급 확인</li>
              <li>네트워크 케이블 연결 상태 확인</li>
              <li>컨트롤러 재부팅</li>
              <li>수동 레버로 응급 개방</li>
            </ul>
          </div>
        </div>
      </div>

      <SubTitle>긴급 연락처</SubTitle>
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📞 기술 지원</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• 이메일: support@parkflow.example.com</li>
          <li>• 전화: 1588-0000 (평일 09:00~18:00)</li>
          <li>• 긴급: 010-0000-0000 (24시간)</li>
        </ul>
      </div>
    </div>
  );
}
