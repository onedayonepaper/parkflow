import { initDb, getDb, closeDb } from './index.js';
import { generateId, ID_PREFIX, DEFAULT_SITE_ID, nowIso } from '@parkflow/shared';

// 한국 차량 번호판 생성
const PLATE_PREFIXES = ['서울', '경기', '인천', '부산', '대구', '대전', '광주'];
const PLATE_CHARS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '허', '하', '호'];

function randomPlate(): string {
  const prefix = PLATE_PREFIXES[Math.floor(Math.random() * PLATE_PREFIXES.length)];
  const num1 = Math.floor(Math.random() * 90 + 10);
  const char = PLATE_CHARS[Math.floor(Math.random() * PLATE_CHARS.length)];
  const num2 = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${num1}${char}${num2}`;
}

// 날짜 유틸리티
function daysAgo(days: number, hoursOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() + hoursOffset);
  return date.toISOString();
}

function hoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function minutesAgo(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

async function seedDemo() {
  console.log('🎭 Seeding demo data...');

  initDb();
  const db = getDb();
  const now = nowIso();

  // ============================================
  // 1. 주차 세션 - 다양한 상태
  // ============================================
  console.log('\n📦 Creating parking sessions...');

  const sessionStmt = db.prepare(`
    INSERT INTO parking_sessions (
      id, site_id, entry_lane_id, exit_lane_id, plate_no, status,
      entry_at, exit_at, rate_plan_id, raw_fee, discount_total, final_fee,
      fee_breakdown_json, payment_status, paid_at, close_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sessions: Array<{
    id: string;
    plateNo: string;
    status: string;
    entryAt: string;
    exitAt: string | null;
    rawFee: number;
    discountTotal: number;
    finalFee: number;
    paymentStatus: string;
    paidAt: string | null;
    closeReason: string | null;
  }> = [];

  // 현재 주차 중 (PARKING) - 8개
  const parkingPlates = [
    { plate: '서울12가3456', hours: 2 },
    { plate: '경기34나5678', hours: 5 },
    { plate: '인천56다7890', hours: 1 },
    { plate: '부산78라1234', hours: 8 },
    { plate: '대구90마2345', hours: 0.5 },
    { plate: '대전23바3456', hours: 3 },
    { plate: '광주45사4567', hours: 12 },
    { plate: '서울67아5678', hours: 0.25 },
  ];

  for (const { plate, hours } of parkingPlates) {
    const id = generateId(ID_PREFIX.SESSION);
    const entryAt = hoursAgo(hours);
    const rawFee = Math.max(0, Math.floor((hours * 60 - 30) / 10) * 500 + 1000);
    sessions.push({
      id, plateNo: plate, status: 'PARKING', entryAt, exitAt: null,
      rawFee, discountTotal: 0, finalFee: rawFee,
      paymentStatus: 'NONE', paidAt: null, closeReason: null
    });
  }

  // 출차 대기 (EXIT_PENDING) - 5개
  const exitPendingPlates = [
    { plate: '서울11허1111', hours: 3 },
    { plate: '경기22호2222', hours: 6 },
    { plate: '인천33하3333', hours: 2 },
    { plate: '부산44가4444', hours: 4 },
    { plate: '대구55나5555', hours: 1 },
  ];

  for (const { plate, hours } of exitPendingPlates) {
    const id = generateId(ID_PREFIX.SESSION);
    const entryAt = hoursAgo(hours + 0.1);
    const exitAt = minutesAgo(5);
    const rawFee = Math.max(0, Math.floor((hours * 60 - 30) / 10) * 500 + 1000);
    sessions.push({
      id, plateNo: plate, status: 'EXIT_PENDING', entryAt, exitAt,
      rawFee, discountTotal: 0, finalFee: rawFee,
      paymentStatus: 'PENDING', paidAt: null, closeReason: null
    });
  }

  // 결제 완료 대기 (PAID) - 5개
  const paidPlates = [
    { plate: '서울77다7777', hours: 2, discount: 1000 },
    { plate: '경기88라8888', hours: 4, discount: 0 },
    { plate: '인천99마9999', hours: 3, discount: 2000 },
    { plate: '부산10바1010', hours: 1, discount: 0 },
    { plate: '대구20사2020', hours: 5, discount: 1000 },
  ];

  for (const { plate, hours, discount } of paidPlates) {
    const id = generateId(ID_PREFIX.SESSION);
    const entryAt = hoursAgo(hours + 0.5);
    const exitAt = minutesAgo(15);
    const rawFee = Math.max(0, Math.floor((hours * 60 - 30) / 10) * 500 + 1000);
    const finalFee = Math.max(0, rawFee - discount);
    sessions.push({
      id, plateNo: plate, status: 'PAID', entryAt, exitAt,
      rawFee, discountTotal: discount, finalFee,
      paymentStatus: 'PAID', paidAt: minutesAgo(10), closeReason: null
    });
  }

  // 종료됨 (CLOSED) - 과거 데이터 30개
  for (let i = 0; i < 30; i++) {
    const id = generateId(ID_PREFIX.SESSION);
    const daysBack = Math.floor(Math.random() * 30) + 1;
    const hours = Math.floor(Math.random() * 8) + 1;
    const entryAt = daysAgo(daysBack, 8 + Math.floor(Math.random() * 10));
    const exitAt = daysAgo(daysBack, 8 + Math.floor(Math.random() * 10) + hours);
    const rawFee = Math.max(0, Math.floor((hours * 60 - 30) / 10) * 500 + 1000);
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 3) * 1000 : 0;
    const finalFee = Math.max(0, rawFee - discount);
    sessions.push({
      id, plateNo: randomPlate(), status: 'CLOSED', entryAt, exitAt,
      rawFee, discountTotal: discount, finalFee,
      paymentStatus: 'PAID', paidAt: exitAt, closeReason: 'NORMAL_EXIT'
    });
  }

  // 세션 삽입
  for (const s of sessions) {
    const breakdown = JSON.stringify({
      baseFee: 1000,
      additionalFee: s.rawFee - 1000,
      totalMinutes: Math.floor(s.rawFee / 500 * 10 + 30),
      discounts: s.discountTotal > 0 ? [{ name: '할인', amount: s.discountTotal }] : []
    });

    sessionStmt.run(
      s.id, DEFAULT_SITE_ID, 'lane_entry_1',
      s.exitAt ? 'lane_exit_1' : null,
      s.plateNo, s.status, s.entryAt, s.exitAt, 'rp_default',
      s.rawFee, s.discountTotal, s.finalFee, breakdown,
      s.paymentStatus, s.paidAt, s.closeReason, s.entryAt, now
    );
  }
  console.log(`✅ Created ${sessions.length} parking sessions`);

  // ============================================
  // 2. 결제 내역
  // ============================================
  console.log('\n💳 Creating payments...');

  const paymentStmt = db.prepare(`
    INSERT INTO payments (
      id, session_id, site_id, amount, method, status, pg_provider,
      pg_tx_id, approved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const paidSessions = sessions.filter(s => s.paymentStatus === 'PAID');
  const paymentMethods = ['CARD', 'CASH', 'CARD', 'CARD', 'TRANSFER']; // CARD가 더 많이
  let paymentCount = 0;

  for (const s of paidSessions) {
    const payId = generateId(ID_PREFIX.PAYMENT);
    const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const isCancelled = Math.random() < 0.1; // 10% 취소

    paymentStmt.run(
      payId, s.id, DEFAULT_SITE_ID, s.finalFee, method,
      isCancelled ? 'CANCELLED' : 'PAID',
      'MOCK',
      `mock_tx_${Date.now()}_${paymentCount}`,
      s.paidAt,
      s.paidAt || now, now
    );
    paymentCount++;
  }
  console.log(`✅ Created ${paymentCount} payments`);

  // ============================================
  // 3. 감사 로그
  // ============================================
  console.log('\n📋 Creating audit logs...');

  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const auditActions = [
    { action: 'CREATE', entity: 'SESSION', detail: { reason: '차량 입차' } },
    { action: 'UPDATE', entity: 'SESSION', detail: { field: 'status', from: 'PARKING', to: 'EXIT_PENDING' } },
    { action: 'CREATE', entity: 'PAYMENT', detail: { method: 'CARD', amount: 3000 } },
    { action: 'APPLY', entity: 'DISCOUNT', detail: { discountName: '1,000원 할인', amount: 1000 } },
    { action: 'LOGIN', entity: 'USER', detail: { username: 'admin' } },
    { action: 'UPDATE', entity: 'RATE_PLAN', detail: { field: 'is_active', to: true } },
    { action: 'CREATE', entity: 'DISCOUNT_RULE', detail: { name: '신규 할인' } },
    { action: 'CANCEL', entity: 'PAYMENT', detail: { reason: '고객 요청' } },
    { action: 'FORCE_CLOSE', entity: 'SESSION', detail: { reason: '관리자 강제 종료' } },
    { action: 'OPEN', entity: 'BARRIER', detail: { lane: '출구 1차로' } },
  ];

  for (let i = 0; i < 50; i++) {
    const daysBack = Math.floor(Math.random() * 30);
    const audit = auditActions[Math.floor(Math.random() * auditActions.length)]!;
    const entityId = sessions[Math.floor(Math.random() * sessions.length)]?.id || 'unknown';

    auditStmt.run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      Math.random() > 0.3 ? 'usr_admin' : 'usr_operator',
      audit.action,
      audit.entity,
      entityId,
      JSON.stringify(audit.detail),
      daysAgo(daysBack, Math.floor(Math.random() * 12))
    );
  }
  console.log('✅ Created 50 audit logs');

  // ============================================
  // 4. 정기권
  // ============================================
  console.log('\n🎫 Creating memberships...');

  const membershipStmt = db.prepare(`
    INSERT INTO memberships (id, site_id, plate_no, member_name, valid_from, valid_to, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const memberships = [
    { plate: '서울01가0001', name: '김철수', validDays: 365, note: '연간 정기권' },
    { plate: '경기02나0002', name: '이영희', validDays: 30, note: '월간 정기권' },
    { plate: '인천03다0003', name: '박민수', validDays: 90, note: '분기 정기권' },
    { plate: '부산04라0004', name: '최지영', validDays: 180, note: '반기 정기권' },
    { plate: '대구05마0005', name: '정현우', validDays: 30, note: '월간 정기권' },
    { plate: '대전06바0006', name: '강서연', validDays: -10, note: '만료된 정기권' }, // 만료
    { plate: '광주07사0007', name: '윤도현', validDays: -30, note: '만료된 정기권' }, // 만료
  ];

  for (const m of memberships) {
    const validFrom = m.validDays > 0 ? daysAgo(30) : daysAgo(Math.abs(m.validDays) + 30);
    const validTo = m.validDays > 0
      ? new Date(Date.now() + m.validDays * 24 * 60 * 60 * 1000).toISOString()
      : daysAgo(Math.abs(m.validDays));

    membershipStmt.run(
      generateId(ID_PREFIX.MEMBERSHIP),
      DEFAULT_SITE_ID,
      m.plate,
      m.name,
      validFrom,
      validTo,
      m.note,
      validFrom,
      now
    );
  }
  console.log(`✅ Created ${memberships.length} memberships`);

  // ============================================
  // 5. 블랙리스트
  // ============================================
  console.log('\n🚫 Creating blacklist entries...');

  const blacklistStmt = db.prepare(`
    INSERT INTO blacklist (id, site_id, plate_no, reason, is_active, blocked_until, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const blacklist = [
    { plate: '서울99가9999', reason: '요금 미납 3회 이상', active: 1, days: 30 },
    { plate: '경기88나8888', reason: '시설물 파손', active: 1, days: 90 },
    { plate: '인천77다7777', reason: '불법 주차 반복', active: 1, days: 14 },
    { plate: '부산66라6666', reason: '해제됨 - 요금 납부 완료', active: 0, days: 0 },
  ];

  for (const b of blacklist) {
    const blockedUntil = b.days > 0
      ? new Date(Date.now() + b.days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    blacklistStmt.run(
      generateId(ID_PREFIX.BLACKLIST),
      DEFAULT_SITE_ID,
      b.plate,
      b.reason,
      b.active,
      blockedUntil,
      'usr_admin',
      daysAgo(Math.floor(Math.random() * 30)),
      now
    );
  }
  console.log(`✅ Created ${blacklist.length} blacklist entries`);

  // ============================================
  // 6. 차단기 명령 기록
  // ============================================
  console.log('\n🚧 Creating barrier commands...');

  const barrierStmt = db.prepare(`
    INSERT INTO barrier_commands (id, device_id, lane_id, action, reason, correlation_id, status, executed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const barrierReasons = ['PAYMENT_COMPLETE', 'MEMBERSHIP_VALID', 'MANUAL_OPEN', 'ENTRY_ALLOWED'];

  for (let i = 0; i < 20; i++) {
    const isEntry = Math.random() > 0.5;
    const daysBack = Math.floor(Math.random() * 7);
    const createdAt = daysAgo(daysBack, Math.floor(Math.random() * 12));

    barrierStmt.run(
      generateId(ID_PREFIX.BARRIER_CMD),
      isEntry ? 'dev_barrier_entry_1' : 'dev_barrier_exit_1',
      isEntry ? 'lane_entry_1' : 'lane_exit_1',
      'OPEN',
      barrierReasons[Math.floor(Math.random() * barrierReasons.length)],
      sessions[Math.floor(Math.random() * sessions.length)]?.id,
      'EXECUTED',
      createdAt,
      createdAt
    );
  }
  console.log('✅ Created 20 barrier commands');

  // ============================================
  // 7. 플레이트 이벤트 (LPR 인식 기록)
  // ============================================
  console.log('\n📸 Creating plate events...');

  const plateEventStmt = db.prepare(`
    INSERT INTO plate_events (
      id, site_id, device_id, lane_id, direction, plate_no_raw, plate_no_norm,
      confidence, image_url, captured_at, received_at, session_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of sessions.slice(0, 30)) {
    // 입차 이벤트
    const entryEventId = generateId(ID_PREFIX.PLATE_EVENT);
    plateEventStmt.run(
      entryEventId, DEFAULT_SITE_ID, 'dev_lpr_entry_1', 'lane_entry_1', 'ENTRY',
      s.plateNo, s.plateNo, 0.95 + Math.random() * 0.05,
      `/images/plates/${entryEventId}.jpg`,
      s.entryAt, s.entryAt, s.id, s.entryAt
    );

    // 출차 이벤트 (있는 경우)
    if (s.exitAt) {
      const exitEventId = generateId(ID_PREFIX.PLATE_EVENT);
      plateEventStmt.run(
        exitEventId, DEFAULT_SITE_ID, 'dev_lpr_exit_1', 'lane_exit_1', 'EXIT',
        s.plateNo, s.plateNo, 0.95 + Math.random() * 0.05,
        `/images/plates/${exitEventId}.jpg`,
        s.exitAt, s.exitAt, s.id, s.exitAt
      );
    }
  }
  console.log('✅ Created plate events');

  // ============================================
  // 8. 알림 템플릿
  // ============================================
  console.log('\n🔔 Creating notification templates...');

  const notifTemplateStmt = db.prepare(`
    INSERT OR IGNORE INTO notification_templates (id, site_id, type, event_type, subject, body_template, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const templates = [
    { type: 'EMAIL', event: 'PAYMENT_COMPLETE', subject: '결제 완료 안내', body: '{{plateNo}} 차량의 주차 요금 {{amount}}원이 결제되었습니다.' },
    { type: 'SMS', event: 'OVERSTAY_WARNING', subject: null, body: '[ParkFlow] {{plateNo}} 차량 장기 주차 알림. 현재 {{hours}}시간 주차 중입니다.' },
    { type: 'PUSH', event: 'BARRIER_OPEN', subject: '차단기 열림', body: '{{lane}} 차단기가 열렸습니다.' },
  ];

  for (const t of templates) {
    notifTemplateStmt.run(
      generateId(ID_PREFIX.NOTIFICATION),
      DEFAULT_SITE_ID,
      t.type,
      t.event,
      t.subject,
      t.body,
      1,
      now,
      now
    );
  }
  console.log(`✅ Created ${templates.length} notification templates`);

  // ============================================
  // 완료
  // ============================================
  closeDb();
  console.log('\n🎉 Demo data seeding completed!');
  console.log(`
📊 Summary:
  - Parking Sessions: ${sessions.length}
    • PARKING: ${sessions.filter(s => s.status === 'PARKING').length}
    • EXIT_PENDING: ${sessions.filter(s => s.status === 'EXIT_PENDING').length}
    • PAID: ${sessions.filter(s => s.status === 'PAID').length}
    • CLOSED: ${sessions.filter(s => s.status === 'CLOSED').length}
  - Payments: ${paymentCount}
  - Audit Logs: 50
  - Memberships: ${memberships.length}
  - Blacklist: ${blacklist.length}
  - Barrier Commands: 20
  - Plate Events: ~${sessions.slice(0, 30).length * 2}
  - Notification Templates: ${templates.length}
  `);
}

seedDemo().catch(console.error);
