import 'dotenv/config';
import { validateEnv, deviceAgentEnvSchema } from '@parkflow/shared';
import { LprSimulator } from './lpr-simulator.js';
import { BarrierListener } from './barrier-listener.js';
import { EventQueue } from './queue.js';

// Validate environment variables
const env = validateEnv(deviceAgentEnvSchema);
const { API_BASE } = env;

// Device API Key (환경변수 또는 기본값)
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'parkflow-device-key-2024';

async function main() {
  console.log('🚗 ParkFlow Device Agent starting...');
  console.log(`   API: ${API_BASE}`);

  // 이벤트 큐 초기화 (재전송용)
  const queue = new EventQueue(API_BASE);

  // LPR 시뮬레이터
  const lprEntry = new LprSimulator({
    deviceId: 'dev_lpr_entry_1',
    laneId: 'lane_entry_1',
    direction: 'ENTRY',
    apiBase: API_BASE,
    queue,
  });

  const lprExit = new LprSimulator({
    deviceId: 'dev_lpr_exit_1',
    laneId: 'lane_exit_1',
    direction: 'EXIT',
    apiBase: API_BASE,
    queue,
  });

  // 차단기 리스너 (WebSocket)
  const barrierEntry = new BarrierListener({
    deviceId: 'dev_barrier_entry_1',
    laneId: 'lane_entry_1',
    wsUrl: API_BASE.replace('http', 'ws') + '/api/ws',
    apiKey: DEVICE_API_KEY,
  });

  const barrierExit = new BarrierListener({
    deviceId: 'dev_barrier_exit_1',
    laneId: 'lane_exit_1',
    wsUrl: API_BASE.replace('http', 'ws') + '/api/ws',
    apiKey: DEVICE_API_KEY,
  });

  // 시작
  barrierEntry.connect();
  barrierExit.connect();

  // 큐 재전송 시작
  queue.startRetry();

  // 시뮬레이션 메뉴
  console.log('\n📋 명령어:');
  console.log('  e <차량번호>  - 입차 이벤트');
  console.log('  x <차량번호>  - 출차 이벤트');
  console.log('  r            - 랜덤 차량 입/출차');
  console.log('  a            - 자동 시뮬레이션 (5초 간격)');
  console.log('  q            - 종료\n');

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let autoMode = false;
  let autoInterval: NodeJS.Timeout | null = null;

  rl.on('line', async (line: string) => {
    const [cmd, ...args] = line.trim().split(' ');

    switch (cmd?.toLowerCase()) {
      case 'e':
        await lprEntry.sendEvent(args[0]);
        break;

      case 'x':
        await lprExit.sendEvent(args[0]);
        break;

      case 'r':
        // 랜덤 차량 입/출차
        if (Math.random() > 0.3) {
          await lprEntry.sendEvent();
        } else {
          await lprExit.sendEvent();
        }
        break;

      case 'a':
        autoMode = !autoMode;
        if (autoMode) {
          console.log('🔄 자동 시뮬레이션 시작 (5초 간격)');
          autoInterval = setInterval(async () => {
            if (Math.random() > 0.3) {
              await lprEntry.sendEvent();
            } else {
              await lprExit.sendEvent();
            }
          }, 5000);
        } else {
          console.log('⏹️ 자동 시뮬레이션 중지');
          if (autoInterval) clearInterval(autoInterval);
        }
        break;

      case 'q':
        console.log('👋 종료합니다.');
        if (autoInterval) clearInterval(autoInterval);
        rl.close();
        process.exit(0);
        break;

      default:
        console.log('알 수 없는 명령어:', cmd);
    }
  });

  console.log('Device Agent ready. Type commands to simulate events.\n');
}

main().catch(console.error);
