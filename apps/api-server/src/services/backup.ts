/**
 * Database Backup Service
 *
 * SQLite 데이터베이스 자동 백업 서비스
 * - 스케줄 기반 자동 백업 (cron)
 * - 수동 백업 지원
 * - 백업 파일 압축 (gzip)
 * - 보존 정책에 따른 자동 정리
 * - 백업 복원 기능
 */

import fs from 'fs';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { getDb } from '../db/index.js';
import { nowIso, generateId, ID_PREFIX } from '@parkflow/shared';

// ============================================================================
// Types
// ============================================================================

export interface BackupConfig {
  enabled: boolean;
  backupDir: string;
  schedule: string;
  retentionDays: number;
  maxFiles: number;
  compress: boolean;
}

export interface BackupInfo {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  compressed: boolean;
  dbSize: number;
  dbSizeFormatted: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom?: string;
  error?: string;
}

// ============================================================================
// Backup Service Class
// ============================================================================

class BackupService {
  private config: BackupConfig;
  private dbPath: string;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.config = {
      enabled: true,
      backupDir: './data/backups',
      schedule: '0 3 * * *',
      retentionDays: 30,
      maxFiles: 100,
      compress: true,
    };
    this.dbPath = process.env.DB_PATH || './data/parkflow.db';
  }

  /**
   * 서비스 초기화
   */
  initialize(config: Partial<BackupConfig> = {}): void {
    this.config = { ...this.config, ...config };

    // 백업 디렉토리 생성
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
      console.log(`[Backup] 백업 디렉토리 생성: ${this.config.backupDir}`);
    }

    if (this.config.enabled) {
      this.startScheduler();
      console.log(`[Backup] 백업 서비스 초기화 완료 (스케줄: ${this.config.schedule})`);
    } else {
      console.log('[Backup] 백업 서비스 비활성화됨');
    }
  }

  /**
   * 스케줄러 시작
   */
  private startScheduler(): void {
    // 간단한 cron 파서 (분 시 일 월 요일)
    const scheduleMs = this.parseCronToMs(this.config.schedule);

    if (scheduleMs > 0) {
      this.scheduleTimer = setInterval(async () => {
        if (this.shouldRunNow()) {
          console.log('[Backup] 스케줄 백업 시작...');
          await this.createBackup('scheduled');
        }
      }, 60000); // 1분마다 체크

      console.log(`[Backup] 스케줄러 시작 (${this.config.schedule})`);
    }
  }

  /**
   * 현재 시간이 스케줄과 일치하는지 확인
   */
  private shouldRunNow(): boolean {
    const now = new Date();
    const parts = this.config.schedule.split(' ');
    const minute = parts[0] ?? '*';
    const hour = parts[1] ?? '*';
    const dayOfMonth = parts[2] ?? '*';
    const month = parts[3] ?? '*';
    const dayOfWeek = parts[4] ?? '*';

    const matches = (cronPart: string, value: number): boolean => {
      if (cronPart === '*') return true;
      if (cronPart.includes('/')) {
        const intervalPart = cronPart.split('/')[1];
        if (!intervalPart) return false;
        return value % parseInt(intervalPart, 10) === 0;
      }
      return parseInt(cronPart, 10) === value;
    };

    return (
      matches(minute, now.getMinutes()) &&
      matches(hour, now.getHours()) &&
      matches(dayOfMonth, now.getDate()) &&
      matches(month, now.getMonth() + 1) &&
      matches(dayOfWeek, now.getDay())
    );
  }

  /**
   * Cron 표현식을 밀리초로 변환 (근사치)
   */
  private parseCronToMs(cron: string): number {
    // 간단한 구현: 최소 간격 반환
    const parts = cron.split(' ');
    const minute = parts[0] ?? '*';
    const hour = parts[1] ?? '*';

    if (minute.includes('/')) {
      const intervalPart = minute.split('/')[1];
      if (intervalPart) {
        const interval = parseInt(intervalPart, 10);
        return interval * 60 * 1000;
      }
    }
    if (hour.includes('/')) {
      const intervalPart = hour.split('/')[1];
      if (intervalPart) {
        const interval = parseInt(intervalPart, 10);
        return interval * 60 * 60 * 1000;
      }
    }

    // 기본: 24시간
    return 24 * 60 * 60 * 1000;
  }

  /**
   * 스케줄러 중지
   */
  stopScheduler(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
      console.log('[Backup] 스케줄러 중지');
    }
  }

  /**
   * 백업 생성
   */
  async createBackup(type: 'manual' | 'scheduled' = 'manual'): Promise<BackupResult> {
    if (this.isRunning) {
      return { success: false, error: '백업이 이미 진행 중입니다.' };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // DB 경로 확인
      const absoluteDbPath = path.resolve(this.dbPath);
      if (!fs.existsSync(absoluteDbPath)) {
        return { success: false, error: `데이터베이스 파일을 찾을 수 없습니다: ${absoluteDbPath}` };
      }

      // 백업 파일명 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = generateId(ID_PREFIX.AUDIT).replace('aud_', 'bak_');
      const baseFilename = `parkflow_${timestamp}_${type}`;
      const filename = this.config.compress ? `${baseFilename}.db.gz` : `${baseFilename}.db`;
      const filepath = path.join(this.config.backupDir, filename);

      // DB 원본 크기
      const dbStats = fs.statSync(absoluteDbPath);
      const dbSize = dbStats.size;

      // SQLite VACUUM INTO를 사용한 안전한 백업 (better-sqlite3)
      const db = getDb();
      const tempBackupPath = path.join(this.config.backupDir, `${baseFilename}.db`);

      // VACUUM INTO로 백업 생성 (데이터 무결성 보장)
      db.exec(`VACUUM INTO '${tempBackupPath}'`);

      // 압축 옵션
      if (this.config.compress) {
        await this.compressFile(tempBackupPath, filepath);
        fs.unlinkSync(tempBackupPath); // 임시 파일 삭제
      }

      // 백업 파일 크기
      const backupStats = fs.statSync(filepath);
      const backupSize = backupStats.size;

      const duration = Date.now() - startTime;

      // 오래된 백업 정리
      await this.cleanupOldBackups();

      const backup: BackupInfo = {
        id: backupId,
        filename,
        filepath,
        size: backupSize,
        sizeFormatted: this.formatBytes(backupSize),
        createdAt: nowIso(),
        compressed: this.config.compress,
        dbSize,
        dbSizeFormatted: this.formatBytes(dbSize),
      };

      console.log(`[Backup] 백업 완료: ${filename} (${this.formatBytes(backupSize)}, ${duration}ms)`);

      // 감사 로그 기록
      this.logBackupEvent('BACKUP_CREATED', {
        backupId,
        filename,
        type,
        dbSize,
        backupSize,
        duration,
        compressed: this.config.compress,
      });

      return { success: true, backup };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Backup] 백업 실패:', errorMessage);

      this.logBackupEvent('BACKUP_FAILED', { error: errorMessage, type });

      return { success: false, error: errorMessage };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 파일 압축 (gzip)
   */
  private async compressFile(sourcePath: string, destPath: string): Promise<void> {
    const source = fs.createReadStream(sourcePath);
    const destination = fs.createWriteStream(destPath);
    const gzip = createGzip({ level: 9 });

    await pipeline(source, gzip, destination);
  }

  /**
   * 파일 압축 해제
   */
  private async decompressFile(sourcePath: string, destPath: string): Promise<void> {
    const source = fs.createReadStream(sourcePath);
    const destination = fs.createWriteStream(destPath);
    const gunzip = createGunzip();

    await pipeline(source, gunzip, destination);
  }

  /**
   * 오래된 백업 정리
   */
  async cleanupOldBackups(): Promise<{ deleted: string[]; kept: number }> {
    const deleted: string[] = [];

    try {
      const files = fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('parkflow_') && (f.endsWith('.db') || f.endsWith('.db.gz')))
        .map(filename => {
          const filepath = path.join(this.config.backupDir, filename);
          const stats = fs.statSync(filepath);
          return { filename, filepath, mtime: stats.mtime };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // 최신순 정렬

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let kept = 0;

      for (const file of files) {
        const shouldDelete =
          file.mtime < cutoffDate || // 보존 기간 초과
          kept >= this.config.maxFiles; // 최대 파일 수 초과

        if (shouldDelete) {
          fs.unlinkSync(file.filepath);
          deleted.push(file.filename);
          console.log(`[Backup] 오래된 백업 삭제: ${file.filename}`);
        } else {
          kept++;
        }
      }

      if (deleted.length > 0) {
        this.logBackupEvent('BACKUP_CLEANUP', { deleted: deleted.length, kept });
      }

      return { deleted, kept };
    } catch (error) {
      console.error('[Backup] 백업 정리 실패:', error);
      return { deleted, kept: 0 };
    }
  }

  /**
   * 백업 목록 조회
   */
  listBackups(): BackupInfo[] {
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('parkflow_') && (f.endsWith('.db') || f.endsWith('.db.gz')))
        .map(filename => {
          const filepath = path.join(this.config.backupDir, filename);
          const stats = fs.statSync(filepath);
          const compressed = filename.endsWith('.gz');

          // 파일명에서 타임스탬프 추출
          const match = filename.match(/parkflow_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
          const timestamp = match?.[1];
          const createdAt = timestamp
            ? timestamp.replace(/-/g, (m, i) => (i > 9 ? ':' : '-')).replace('T', 'T').slice(0, 19) + '.000Z'
            : stats.mtime.toISOString();

          return {
            id: filename.replace(/\.(db|db\.gz)$/, ''),
            filename,
            filepath,
            size: stats.size,
            sizeFormatted: this.formatBytes(stats.size),
            createdAt,
            compressed,
            dbSize: 0, // 압축된 경우 원본 크기 알 수 없음
            dbSizeFormatted: '-',
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return files;
    } catch (error) {
      console.error('[Backup] 백업 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 백업에서 복원
   */
  async restoreFromBackup(filename: string): Promise<RestoreResult> {
    if (this.isRunning) {
      return { success: false, error: '다른 백업 작업이 진행 중입니다.' };
    }

    this.isRunning = true;

    try {
      const backupPath = path.join(this.config.backupDir, filename);

      if (!fs.existsSync(backupPath)) {
        return { success: false, error: `백업 파일을 찾을 수 없습니다: ${filename}` };
      }

      const absoluteDbPath = path.resolve(this.dbPath);
      const isCompressed = filename.endsWith('.gz');

      // 현재 DB 백업 (복원 전 안전장치)
      const preRestoreBackup = `${absoluteDbPath}.pre-restore.${Date.now()}`;
      if (fs.existsSync(absoluteDbPath)) {
        fs.copyFileSync(absoluteDbPath, preRestoreBackup);
      }

      try {
        // 압축 해제 또는 직접 복사
        if (isCompressed) {
          await this.decompressFile(backupPath, absoluteDbPath);
        } else {
          fs.copyFileSync(backupPath, absoluteDbPath);
        }

        // 복원 전 백업 삭제 (성공 시)
        if (fs.existsSync(preRestoreBackup)) {
          fs.unlinkSync(preRestoreBackup);
        }

        console.log(`[Backup] 복원 완료: ${filename}`);

        this.logBackupEvent('BACKUP_RESTORED', { filename });

        return { success: true, restoredFrom: filename };
      } catch (restoreError) {
        // 복원 실패 시 원래 DB 복구
        if (fs.existsSync(preRestoreBackup)) {
          fs.copyFileSync(preRestoreBackup, absoluteDbPath);
          fs.unlinkSync(preRestoreBackup);
        }
        throw restoreError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Backup] 복원 실패:', errorMessage);

      this.logBackupEvent('BACKUP_RESTORE_FAILED', { filename, error: errorMessage });

      return { success: false, error: errorMessage };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 특정 백업 삭제
   */
  deleteBackup(filename: string): { success: boolean; error?: string } {
    try {
      const filepath = path.join(this.config.backupDir, filename);

      if (!fs.existsSync(filepath)) {
        return { success: false, error: '백업 파일을 찾을 수 없습니다.' };
      }

      fs.unlinkSync(filepath);
      console.log(`[Backup] 백업 삭제: ${filename}`);

      this.logBackupEvent('BACKUP_DELETED', { filename });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 백업 서비스 상태 조회
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    config: BackupConfig;
    lastBackup: BackupInfo | null;
    totalBackups: number;
    totalSize: number;
    totalSizeFormatted: string;
  } {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      config: this.config,
      lastBackup: backups[0] || null,
      totalBackups: backups.length,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
    };
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * 감사 로그 기록
   */
  private logBackupEvent(action: string, detail: Record<string, unknown>): void {
    try {
      const db = getDb();
      const now = nowIso();

      db.prepare(`
        INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
        VALUES (?, 'site_default', 'system', ?, 'backup', ?, ?, ?)
      `).run(
        generateId(ID_PREFIX.AUDIT),
        action,
        detail.backupId || detail.filename || 'system',
        JSON.stringify(detail),
        now
      );
    } catch (error) {
      // 감사 로그 실패해도 백업 작업은 계속
      console.error('[Backup] 감사 로그 기록 실패:', error);
    }
  }

  /**
   * 서비스 종료
   */
  shutdown(): void {
    this.stopScheduler();
    console.log('[Backup] 백업 서비스 종료');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let backupService: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!backupService) {
    backupService = new BackupService();
  }
  return backupService;
}

export function initializeBackup(config?: Partial<BackupConfig>): void {
  const service = getBackupService();
  service.initialize(config);
}

export function shutdownBackup(): void {
  if (backupService) {
    backupService.shutdown();
    backupService = null;
  }
}
