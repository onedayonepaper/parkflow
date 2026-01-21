import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../../data/parkflow.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(customPath?: string): Database.Database {
  if (db) return db;

  const dbPath = customPath || DB_PATH;

  // For in-memory database, skip directory creation
  if (dbPath !== ':memory:') {
    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  const schema = `
    -- 1) Sites
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 2) Lanes
    CREATE TABLE IF NOT EXISTS lanes (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('ENTRY','EXIT')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    -- 3) Devices
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      lane_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('LPR','BARRIER','KIOSK')),
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(status IN ('ONLINE','OFFLINE','UNKNOWN')),
      last_seen_at TEXT,
      config_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(lane_id) REFERENCES lanes(id)
    );

    -- 4) Plate Events
    CREATE TABLE IF NOT EXISTS plate_events (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      lane_id TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('ENTRY','EXIT')),
      plate_no_raw TEXT NOT NULL,
      plate_no_norm TEXT NOT NULL,
      confidence REAL,
      image_url TEXT,
      captured_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(device_id) REFERENCES devices(id),
      FOREIGN KEY(lane_id) REFERENCES lanes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_plate_events_captured_at ON plate_events(captured_at);
    CREATE INDEX IF NOT EXISTS idx_plate_events_plate ON plate_events(plate_no_norm);

    -- 5) Rate Plans
    CREATE TABLE IF NOT EXISTS rate_plans (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      rules_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    -- 6) Parking Sessions
    CREATE TABLE IF NOT EXISTS parking_sessions (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      entry_lane_id TEXT,
      exit_lane_id TEXT,
      plate_no TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PARKING','EXIT_PENDING','PAID','CLOSED','ERROR')),
      entry_at TEXT NOT NULL,
      exit_at TEXT,
      rate_plan_id TEXT,
      raw_fee INTEGER NOT NULL DEFAULT 0,
      discount_total INTEGER NOT NULL DEFAULT 0,
      final_fee INTEGER NOT NULL DEFAULT 0,
      fee_breakdown_json TEXT NOT NULL DEFAULT '{}',
      payment_status TEXT NOT NULL DEFAULT 'NONE' CHECK(payment_status IN ('NONE','PENDING','PAID','FAILED','CANCELLED')),
      close_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(entry_lane_id) REFERENCES lanes(id),
      FOREIGN KEY(exit_lane_id) REFERENCES lanes(id),
      FOREIGN KEY(rate_plan_id) REFERENCES rate_plans(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_plate_status ON parking_sessions(plate_no, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_entry_at ON parking_sessions(entry_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON parking_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_site ON parking_sessions(site_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_payment_status ON parking_sessions(payment_status);

    -- 7) Discount Rules
    CREATE TABLE IF NOT EXISTS discount_rules (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('AMOUNT','PERCENT','FREE_MINUTES','FREE_ALL')),
      value INTEGER NOT NULL,
      is_stackable INTEGER NOT NULL DEFAULT 1,
      max_apply_count INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    -- 8) Discount Applications
    CREATE TABLE IF NOT EXISTS discount_applications (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      discount_rule_id TEXT NOT NULL,
      applied_value INTEGER NOT NULL,
      applied_by_user_id TEXT,
      applied_at TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY(session_id) REFERENCES parking_sessions(id),
      FOREIGN KEY(discount_rule_id) REFERENCES discount_rules(id)
    );

    CREATE INDEX IF NOT EXISTS idx_discount_session ON discount_applications(session_id);

    -- 9) Memberships
    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      plate_no TEXT NOT NULL,
      member_name TEXT,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_memberships_plate ON memberships(plate_no);
    CREATE INDEX IF NOT EXISTS idx_memberships_validity ON memberships(valid_from, valid_to);
    CREATE INDEX IF NOT EXISTS idx_memberships_site ON memberships(site_id);

    -- 10) Payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','PAID','FAILED','CANCELLED')),
      pg_tx_id TEXT,
      approved_at TEXT,
      cancelled_at TEXT,
      cancel_reason TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES parking_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

    -- 11) Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN','OPERATOR','AUDITOR')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    -- 12) Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

    -- 13) Barrier Commands
    CREATE TABLE IF NOT EXISTS barrier_commands (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      lane_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('OPEN','CLOSE')),
      reason TEXT NOT NULL,
      correlation_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','EXECUTED','FAILED')),
      executed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(device_id) REFERENCES devices(id),
      FOREIGN KEY(lane_id) REFERENCES lanes(id)
    );
  `;

  database.exec(schema);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
