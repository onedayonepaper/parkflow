import { z } from 'zod';

export const DeviceTypeSchema = z.enum(['LPR', 'BARRIER', 'KIOSK']);
export const DeviceStatusSchema = z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']);
export const LaneDirectionSchema = z.enum(['ENTRY', 'EXIT']);
export const BarrierActionSchema = z.enum(['OPEN', 'CLOSE']);
export const BarrierReasonSchema = z.enum([
  'PAYMENT_CONFIRMED',
  'MEMBERSHIP_VALID',
  'FREE_EXIT',
  'MANUAL_OPEN',
  'EMERGENCY',
]);

/** LPR 이벤트 수신 스키마 */
export const LprEventRequestSchema = z.object({
  deviceId: z.string().min(1),
  laneId: z.string().min(1),
  direction: LaneDirectionSchema,
  plateNo: z.string().min(1).max(20),
  capturedAt: z.string().datetime({ offset: true }),
  confidence: z.number().min(0).max(1).optional(),
  imageUrl: z.string().url().optional(),
});

/** Heartbeat 스키마 */
export const HeartbeatRequestSchema = z.object({
  deviceId: z.string().min(1),
  status: DeviceStatusSchema,
  ts: z.string().datetime({ offset: true }),
});

/** Barrier 명령 스키마 */
export const BarrierCommandRequestSchema = z.object({
  deviceId: z.string().min(1),
  laneId: z.string().min(1),
  action: BarrierActionSchema,
  reason: BarrierReasonSchema,
  correlationId: z.string().optional(),
});
