/**
 * 시나리오 기반 시뮬레이터
 * 여러 차량의 입출차를 시뮬레이션
 */
import { generateRandomPlate, nowIso } from '@parkflow/shared';

const API_BASE = process.env['API_BASE'] || 'http://localhost:3000';

interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

interface LprEventResponse {
  eventId: string;
  sessionId: string;
}

interface PaymentResponse {
  paymentId: string;
}

interface SessionResponse {
  id: string;
  finalFee: number;
  status: string;
}

async function sendLprEvent(direction: 'ENTRY' | 'EXIT', plateNo: string): Promise<ApiResponse<LprEventResponse> | null> {
  const deviceId = direction === 'ENTRY' ? 'dev_lpr_entry_1' : 'dev_lpr_exit_1';
  const laneId = direction === 'ENTRY' ? 'lane_entry_1' : 'lane_exit_1';

  try {
    const response = await fetch(`${API_BASE}/api/device/lpr/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        laneId,
        direction,
        plateNo,
        capturedAt: nowIso(),
        confidence: 0.9 + Math.random() * 0.1,
      }),
    });

    const result = await response.json() as ApiResponse<LprEventResponse>;
    const icon = direction === 'ENTRY' ? '🟢' : '🔴';
    console.log(`${icon} ${direction} ${plateNo} -> sessionId: ${result.data?.sessionId || 'N/A'}`);

    return result;
  } catch (err) {
    console.error(`❌ 전송 실패:`, err);
    return null;
  }
}

async function mockPayment(sessionId: string, amount: number): Promise<ApiResponse<PaymentResponse> | null> {
  try {
    const response = await fetch(`${API_BASE}/api/payments/mock/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, amount }),
    });

    const result = await response.json() as ApiResponse<PaymentResponse>;
    console.log(`💳 결제 완료 - ${amount}원 (paymentId: ${result.data?.paymentId})`);
    return result;
  } catch (err) {
    console.error(`❌ 결제 실패:`, err);
    return null;
  }
}

async function getSession(sessionId: string): Promise<ApiResponse<SessionResponse> | null> {
  try {
    const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
    return await response.json() as ApiResponse<SessionResponse>;
  } catch {
    return null;
  }
}

async function runScenario() {
  console.log('🚗 ParkFlow 시뮬레이션 시작\n');
  console.log('='.repeat(50));

  // 시나리오 1: 정상 입출차 흐름
  console.log('\n📋 시나리오 1: 정상 입출차 흐름 (1시간 주차)');
  const car1 = generateRandomPlate();
  const entry1 = await sendLprEvent('ENTRY', car1);
  await sleep(1000);

  // 출차 (요금 발생)
  const exit1 = await sendLprEvent('EXIT', car1);
  await sleep(500);

  // 결제
  if (exit1?.data?.sessionId) {
    // 세션 조회해서 요금 확인
    const session = await getSession(exit1.data.sessionId);
    const fee = session?.data?.finalFee || 0;

    if (fee > 0) {
      await mockPayment(exit1.data.sessionId, fee);
    } else {
      console.log('🆓 무료 출차');
    }
  }

  console.log('='.repeat(50));

  // 시나리오 2: 무료 시간 내 출차
  console.log('\n📋 시나리오 2: 무료 시간 내 출차');
  const car2 = generateRandomPlate();
  await sendLprEvent('ENTRY', car2);
  await sleep(500);
  await sendLprEvent('EXIT', car2);

  console.log('='.repeat(50));

  // 시나리오 3: 중복 입차 이벤트
  console.log('\n📋 시나리오 3: 중복 입차 이벤트');
  const car3 = generateRandomPlate();
  await sendLprEvent('ENTRY', car3);
  await sleep(300);
  console.log('(동일 차량 재입차 시도)');
  await sendLprEvent('ENTRY', car3);
  await sleep(500);
  await sendLprEvent('EXIT', car3);

  console.log('='.repeat(50));

  // 시나리오 4: 세션 없는 출차 (고아 이벤트)
  console.log('\n📋 시나리오 4: 세션 없는 출차 (고아 이벤트)');
  const car4 = generateRandomPlate();
  await sendLprEvent('EXIT', car4);

  console.log('='.repeat(50));

  // 시나리오 5: 여러 차량 동시 주차
  console.log('\n📋 시나리오 5: 여러 차량 동시 주차');
  const cars = Array.from({ length: 5 }, () => generateRandomPlate());

  // 모두 입차
  for (const car of cars) {
    await sendLprEvent('ENTRY', car);
    await sleep(300);
  }

  // 랜덤하게 출차
  for (const car of cars.sort(() => Math.random() - 0.5)) {
    const exit = await sendLprEvent('EXIT', car);
    await sleep(500);

    if (exit?.data?.sessionId) {
      const session = await getSession(exit.data.sessionId);
      const fee = session?.data?.finalFee || 0;

      if (fee > 0) {
        await mockPayment(exit.data.sessionId, fee);
      }
    }
  }

  console.log('\n✅ 시뮬레이션 완료');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runScenario().catch(console.error);
