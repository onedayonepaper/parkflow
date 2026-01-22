/**
 * Backup API Routes
 *
 * 데이터베이스 백업 관리 API
 * - 백업 목록 조회
 * - 수동 백업 생성
 * - 백업 복원
 * - 백업 삭제
 * - 백업 서비스 상태 조회
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getBackupService } from '../services/backup.js';

// Fastify 인스턴스 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function backupRoutes(app: FastifyInstance) {
  // 모든 백업 라우트는 SUPER_ADMIN 권한 필요
  const checkSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '백업 관리는 SUPER_ADMIN만 가능합니다.' },
      });
    }
  };

  // GET /api/backups - 백업 목록 조회
  app.get('/', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '백업 목록 조회',
      description: '생성된 백업 파일 목록을 조회합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                backups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      filename: { type: 'string' },
                      size: { type: 'number' },
                      sizeFormatted: { type: 'string' },
                      createdAt: { type: 'string' },
                      compressed: { type: 'boolean' },
                    },
                  },
                },
                total: { type: 'number' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const backupService = getBackupService();
    const backups = backupService.listBackups();

    return reply.send({
      ok: true,
      data: {
        backups: backups.map(b => ({
          id: b.id,
          filename: b.filename,
          size: b.size,
          sizeFormatted: b.sizeFormatted,
          createdAt: b.createdAt,
          compressed: b.compressed,
        })),
        total: backups.length,
      },
      error: null,
    });
  });

  // GET /api/backups/status - 백업 서비스 상태 조회
  app.get('/status', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '백업 서비스 상태',
      description: '백업 서비스의 현재 상태와 설정을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const backupService = getBackupService();
    const status = backupService.getStatus();

    return reply.send({
      ok: true,
      data: {
        enabled: status.enabled,
        isRunning: status.isRunning,
        schedule: status.config.schedule,
        retentionDays: status.config.retentionDays,
        maxFiles: status.config.maxFiles,
        compress: status.config.compress,
        backupDir: status.config.backupDir,
        lastBackup: status.lastBackup ? {
          filename: status.lastBackup.filename,
          createdAt: status.lastBackup.createdAt,
          sizeFormatted: status.lastBackup.sizeFormatted,
        } : null,
        totalBackups: status.totalBackups,
        totalSizeFormatted: status.totalSizeFormatted,
      },
      error: null,
    });
  });

  // POST /api/backups - 수동 백업 생성
  app.post('/', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '수동 백업 생성',
      description: '데이터베이스의 수동 백업을 생성합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              nullable: true,
              properties: {
                backup: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    filename: { type: 'string' },
                    size: { type: 'number' },
                    sizeFormatted: { type: 'string' },
                    createdAt: { type: 'string' },
                    compressed: { type: 'boolean' },
                    dbSizeFormatted: { type: 'string' },
                  },
                },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const backupService = getBackupService();
    const result = await backupService.createBackup('manual');

    if (!result.success) {
      return reply.code(500).send({
        ok: false,
        data: null,
        error: { code: 'BACKUP_FAILED', message: result.error },
      });
    }

    app.log.info({ backup: result.backup?.filename }, 'Manual backup created');

    return reply.send({
      ok: true,
      data: {
        backup: {
          id: result.backup!.id,
          filename: result.backup!.filename,
          size: result.backup!.size,
          sizeFormatted: result.backup!.sizeFormatted,
          createdAt: result.backup!.createdAt,
          compressed: result.backup!.compressed,
          dbSizeFormatted: result.backup!.dbSizeFormatted,
        },
      },
      error: null,
    });
  });

  // POST /api/backups/:filename/restore - 백업 복원
  app.post<{
    Params: { filename: string };
  }>('/:filename/restore', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '백업 복원',
      description: '지정된 백업 파일에서 데이터베이스를 복원합니다. 주의: 현재 데이터가 덮어씌워집니다!',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '복원할 백업 파일명' },
        },
        required: ['filename'],
      },
    },
  }, async (request, reply) => {
    const { filename } = request.params;

    // 복원 확인용 헤더 체크 (안전장치)
    const confirmHeader = request.headers['x-confirm-restore'];
    if (confirmHeader !== 'true') {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: '복원을 확인하려면 x-confirm-restore: true 헤더를 포함해야 합니다.',
        },
      });
    }

    const backupService = getBackupService();
    const result = await backupService.restoreFromBackup(filename);

    if (!result.success) {
      return reply.code(500).send({
        ok: false,
        data: null,
        error: { code: 'RESTORE_FAILED', message: result.error },
      });
    }

    app.log.warn({ filename }, 'Database restored from backup');

    return reply.send({
      ok: true,
      data: {
        restoredFrom: result.restoredFrom,
        message: '데이터베이스가 복원되었습니다. 서버 재시작이 필요할 수 있습니다.',
      },
      error: null,
    });
  });

  // DELETE /api/backups/:filename - 백업 삭제
  app.delete<{
    Params: { filename: string };
  }>('/:filename', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '백업 삭제',
      description: '지정된 백업 파일을 삭제합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '삭제할 백업 파일명' },
        },
        required: ['filename'],
      },
    },
  }, async (request, reply) => {
    const { filename } = request.params;
    const backupService = getBackupService();
    const result = backupService.deleteBackup(filename);

    if (!result.success) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DELETE_FAILED', message: result.error },
      });
    }

    app.log.info({ filename }, 'Backup deleted');

    return reply.send({
      ok: true,
      data: { deleted: filename },
      error: null,
    });
  });

  // POST /api/backups/cleanup - 수동 정리 실행
  app.post('/cleanup', {
    preHandler: [app.authenticate, checkSuperAdmin],
    schema: {
      tags: ['Backup'],
      summary: '오래된 백업 정리',
      description: '보존 정책에 따라 오래된 백업 파일을 정리합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const backupService = getBackupService();
    const result = await backupService.cleanupOldBackups();

    return reply.send({
      ok: true,
      data: {
        deleted: result.deleted,
        deletedCount: result.deleted.length,
        kept: result.kept,
      },
      error: null,
    });
  });
}
