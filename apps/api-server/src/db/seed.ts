import { initDb, getDb, closeDb } from './index.js';
import { generateId, ID_PREFIX, DEFAULT_SITE_ID, nowIso, DEFAULT_RATE_RULES } from '@parkflow/shared';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('🌱 Seeding database...');

  initDb();
  const db = getDb();
  const now = nowIso();

  // 1. Create default site
  const siteStmt = db.prepare(`
    INSERT OR IGNORE INTO sites (id, name, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  siteStmt.run(DEFAULT_SITE_ID, '기본 주차장', 'Asia/Seoul', now, now);
  console.log('✅ Site created');

  // 2. Create lanes
  const laneStmt = db.prepare(`
    INSERT OR IGNORE INTO lanes (id, site_id, name, direction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  laneStmt.run('lane_entry_1', DEFAULT_SITE_ID, '입구 1차로', 'ENTRY', now, now);
  laneStmt.run('lane_exit_1', DEFAULT_SITE_ID, '출구 1차로', 'EXIT', now, now);
  console.log('✅ Lanes created');

  // 3. Create devices
  const deviceStmt = db.prepare(`
    INSERT OR IGNORE INTO devices (id, site_id, lane_id, type, name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  deviceStmt.run('dev_lpr_entry_1', DEFAULT_SITE_ID, 'lane_entry_1', 'LPR', '입구 LPR', 'UNKNOWN', now, now);
  deviceStmt.run('dev_lpr_exit_1', DEFAULT_SITE_ID, 'lane_exit_1', 'LPR', '출구 LPR', 'UNKNOWN', now, now);
  deviceStmt.run('dev_barrier_entry_1', DEFAULT_SITE_ID, 'lane_entry_1', 'BARRIER', '입구 차단기', 'UNKNOWN', now, now);
  deviceStmt.run('dev_barrier_exit_1', DEFAULT_SITE_ID, 'lane_exit_1', 'BARRIER', '출구 차단기', 'UNKNOWN', now, now);
  console.log('✅ Devices created');

  // 4. Create default rate plan
  const ratePlanStmt = db.prepare(`
    INSERT OR IGNORE INTO rate_plans (id, site_id, name, is_active, rules_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  ratePlanStmt.run(
    'rp_default',
    DEFAULT_SITE_ID,
    '기본 요금제',
    1,
    JSON.stringify(DEFAULT_RATE_RULES),
    now,
    now
  );
  console.log('✅ Rate plan created');

  // 5. Create discount rules
  const discountStmt = db.prepare(`
    INSERT OR IGNORE INTO discount_rules (id, site_id, name, type, value, is_stackable, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  discountStmt.run('dr_1000', DEFAULT_SITE_ID, '1,000원 할인', 'AMOUNT', 1000, 1, now, now);
  discountStmt.run('dr_2000', DEFAULT_SITE_ID, '2,000원 할인', 'AMOUNT', 2000, 1, now, now);
  discountStmt.run('dr_50pct', DEFAULT_SITE_ID, '50% 할인', 'PERCENT', 50, 0, now, now);
  discountStmt.run('dr_1h_free', DEFAULT_SITE_ID, '1시간 무료', 'FREE_MINUTES', 60, 1, now, now);
  discountStmt.run('dr_free_all', DEFAULT_SITE_ID, '전액 무료', 'FREE_ALL', 0, 0, now, now);
  console.log('✅ Discount rules created');

  // 6. Create admin user
  const userStmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, site_id, username, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  userStmt.run(
    'usr_admin',
    DEFAULT_SITE_ID,
    'admin',
    hashPassword('admin123'),
    'SUPER_ADMIN',
    1,
    now,
    now
  );
  userStmt.run(
    'usr_operator',
    DEFAULT_SITE_ID,
    'operator',
    hashPassword('operator123'),
    'OPERATOR',
    1,
    now,
    now
  );
  console.log('✅ Users created');

  closeDb();
  console.log('🎉 Seed completed!');
}

seed().catch(console.error);
