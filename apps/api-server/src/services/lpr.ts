/**
 * LPR (License Plate Recognition) 카메라 서비스
 *
 * 지원 프로토콜:
 * - HTTP: REST API 기반 (Hikvision, Dahua, 국산 LPR 등)
 * - TCP: 소켓 기반 직접 통신
 * - ONVIF: IP 카메라 표준 프로토콜
 * - MOCK: 개발/테스트용
 *
 * 지원 제조사:
 * - Hikvision (하이크비전)
 * - Dahua (다후아)
 * - 한화비전 (Hanwha Vision)
 * - 파이런테크 (Pylontech) - 국산 LPR
 * - 커스텀 HTTP API
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { getDb } from '../db/index.js';
import { broadcast } from '../ws/handler.js';
import { nowIso, generateId, ID_PREFIX, normalizePlateNo, DEFAULT_SITE_ID } from '@parkflow/shared';

// ============================================================================
// Types
// ============================================================================

export type LprProtocol = 'HTTP' | 'TCP' | 'ONVIF' | 'MOCK';
export type LprVendor = 'HIKVISION' | 'DAHUA' | 'HANWHA' | 'PYLONTECH' | 'CUSTOM';

export interface LprCaptureResult {
  plateNo: string;
  confidence: number;
  capturedAt: string;
  imageUrl?: string;
  imageBase64?: string;
  rawData?: any;
}

export interface LprConfig {
  id: string;
  laneId: string;
  direction: 'ENTRY' | 'EXIT';
  protocol: LprProtocol;
  vendor?: LprVendor;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  timeout?: number;
  retryCount?: number;
  minConfidence?: number;
  // HTTP API 설정
  eventPath?: string;
  statusPath?: string;
  capturePath?: string;
  // TCP 설정
  reconnectDelay?: number;
  heartbeatInterval?: number;
  // 커스텀 설정
  customHeaders?: Record<string, string>;
  customParams?: Record<string, string>;
}

export interface ILprController extends EventEmitter {
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  getLastCapture(): Promise<LprCaptureResult | null>;
  triggerCapture(): Promise<LprCaptureResult | null>;
  getStatus(): Promise<{ online: boolean; lastSeen?: string; error?: string }>;
}

// ============================================================================
// Mock LPR Controller (개발/테스트용)
// ============================================================================

export class MockLprController extends EventEmitter implements ILprController {
  private config: LprConfig;
  private connected: boolean = false;
  private lastCapture: LprCaptureResult | null = null;

  constructor(config: LprConfig) {
    super();
    this.config = config;
    console.log(`[MockLPR] ${config.id} 초기화 (차로: ${config.laneId}, 방향: ${config.direction})`);
  }

  async connect(): Promise<boolean> {
    console.log(`[MockLPR] ${this.config.id} 연결`);
    this.connected = true;
    return true;
  }

  disconnect(): void {
    console.log(`[MockLPR] ${this.config.id} 연결 해제`);
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getLastCapture(): Promise<LprCaptureResult | null> {
    return this.lastCapture;
  }

  async triggerCapture(): Promise<LprCaptureResult | null> {
    const plates = ['12가1234', '34나5678', '56다9012', '서울12바3456', '경기34사5678'];
    const plateNo = plates[Math.floor(Math.random() * plates.length)] ?? '00가0000';

    this.lastCapture = {
      plateNo: normalizePlateNo(plateNo),
      confidence: 0.85 + Math.random() * 0.15,
      capturedAt: nowIso(),
    };

    console.log(`[MockLPR] ${this.config.id} 캡처: ${this.lastCapture.plateNo}`);

    // 이벤트 발생
    this.emit('capture', this.lastCapture);

    return this.lastCapture;
  }

  async getStatus(): Promise<{ online: boolean; lastSeen?: string; error?: string }> {
    return {
      online: this.connected,
      lastSeen: nowIso(),
    };
  }

  /**
   * 시뮬레이션용: 외부에서 캡처 이벤트 트리거
   */
  simulateCapture(plateNo: string, confidence?: number): void {
    this.lastCapture = {
      plateNo: normalizePlateNo(plateNo),
      confidence: confidence ?? (0.85 + Math.random() * 0.15),
      capturedAt: nowIso(),
    };

    this.emit('capture', this.lastCapture);
  }
}

// ============================================================================
// HTTP LPR Controller (REST API 기반)
// ============================================================================

export class HttpLprController extends EventEmitter implements ILprController {
  private config: LprConfig;
  private connected: boolean = false;
  private lastCapture: LprCaptureResult | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastEventId: string | null = null;

  constructor(config: LprConfig) {
    super();
    this.config = {
      timeout: 10000,
      retryCount: 3,
      minConfidence: 0.7,
      ...config,
    };
  }

  /**
   * Basic Auth 헤더 생성
   */
  private getAuthHeader(): string | undefined {
    if (this.config.username && this.config.password) {
      const encoded = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      return `Basic ${encoded}`;
    }
    return undefined;
  }

  /**
   * 벤더별 API URL 생성
   */
  private getApiUrl(action: 'event' | 'status' | 'capture'): string {
    const base = `http://${this.config.host}:${this.config.port || 80}`;
    const vendor = this.config.vendor || 'CUSTOM';

    switch (vendor) {
      case 'HIKVISION':
        // Hikvision ISAPI
        if (action === 'event') return `${base}/ISAPI/Traffic/channels/1/vehicleDetect/plates`;
        if (action === 'status') return `${base}/ISAPI/System/status`;
        if (action === 'capture') return `${base}/ISAPI/Traffic/channels/1/vehicleDetect/capabilities`;
        break;

      case 'DAHUA':
        // Dahua API
        if (action === 'event') return `${base}/cgi-bin/snapManager.cgi?action=attachFileProc&channel=1`;
        if (action === 'status') return `${base}/cgi-bin/magicBox.cgi?action=getSystemInfo`;
        if (action === 'capture') return `${base}/cgi-bin/snapManager.cgi?action=getSnapInfo&channel=1`;
        break;

      case 'HANWHA':
        // 한화비전 API
        if (action === 'event') return `${base}/stw-cgi/image.cgi?msubmenu=lpr&action=view`;
        if (action === 'status') return `${base}/stw-cgi/system.cgi?msubmenu=deviceinfo&action=view`;
        if (action === 'capture') return `${base}/stw-cgi/image.cgi?msubmenu=lpr&action=snap`;
        break;

      case 'PYLONTECH':
        // 파이런테크 (국산) API
        if (action === 'event') return `${base}/api/lpr/events`;
        if (action === 'status') return `${base}/api/system/status`;
        if (action === 'capture') return `${base}/api/lpr/capture`;
        break;

      case 'CUSTOM':
      default:
        // 커스텀 경로 사용
        if (action === 'event') return `${base}${this.config.eventPath || '/api/events'}`;
        if (action === 'status') return `${base}${this.config.statusPath || '/api/status'}`;
        if (action === 'capture') return `${base}${this.config.capturePath || '/api/capture'}`;
        break;
    }

    return base;
  }

  /**
   * 벤더별 응답 파싱
   */
  private parseResponse(data: any): LprCaptureResult | null {
    const vendor = this.config.vendor || 'CUSTOM';

    try {
      let plateNo: string | undefined;
      let confidence: number | undefined;
      let imageUrl: string | undefined;
      let capturedAt: string | undefined;

      switch (vendor) {
        case 'HIKVISION':
          // Hikvision 응답 형식
          plateNo = data?.PlateResult?.plateInfo?.plateNumber || data?.plateNumber;
          confidence = parseFloat(data?.PlateResult?.plateInfo?.confidence || data?.confidence || '0') / 100;
          imageUrl = data?.PlateResult?.pictureURL;
          capturedAt = data?.PlateResult?.captureTime;
          break;

        case 'DAHUA':
          // Dahua 응답 형식
          plateNo = data?.TrafficCar?.PlateNumber || data?.plates?.[0]?.number;
          confidence = (data?.TrafficCar?.Confidence || data?.plates?.[0]?.confidence || 0) / 100;
          imageUrl = data?.TrafficCar?.PicturePath;
          capturedAt = data?.TrafficCar?.EventTime;
          break;

        case 'HANWHA':
          // 한화비전 응답 형식
          plateNo = data?.LPRResult?.plateNumber || data?.plate;
          confidence = (data?.LPRResult?.confidence || 0) / 100;
          imageUrl = data?.LPRResult?.imageURL;
          break;

        case 'PYLONTECH':
          // 파이런테크 응답 형식
          plateNo = data?.result?.plate_number || data?.plateNo;
          confidence = data?.result?.confidence || data?.confidence || 0;
          imageUrl = data?.result?.image_url || data?.imageUrl;
          capturedAt = data?.result?.captured_at || data?.capturedAt;
          break;

        case 'CUSTOM':
        default:
          // 범용 형식
          plateNo = data?.plateNo || data?.plate_number || data?.plateNumber || data?.plate;
          confidence = data?.confidence || data?.score || 0;
          imageUrl = data?.imageUrl || data?.image_url || data?.image;
          capturedAt = data?.capturedAt || data?.captured_at || data?.time;
          break;
      }

      if (!plateNo) return null;

      // 신뢰도 체크
      if (confidence !== undefined && confidence < (this.config.minConfidence || 0.7)) {
        console.log(`[HttpLPR] ${this.config.id} 신뢰도 부족: ${plateNo} (${confidence})`);
        return null;
      }

      return {
        plateNo: normalizePlateNo(plateNo),
        confidence: confidence || 0.9,
        capturedAt: capturedAt || nowIso(),
        imageUrl,
        rawData: data,
      };
    } catch (error) {
      console.error(`[HttpLPR] ${this.config.id} 응답 파싱 오류:`, error);
      return null;
    }
  }

  async connect(): Promise<boolean> {
    try {
      const statusUrl = this.getApiUrl('status');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.customHeaders,
      };

      const authHeader = this.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (response.ok) {
        this.connected = true;
        console.log(`[HttpLPR] ${this.config.id} 연결 성공`);

        // 이벤트 폴링 시작
        this.startEventPolling();
        return true;
      }

      console.error(`[HttpLPR] ${this.config.id} 연결 실패: HTTP ${response.status}`);
      return false;
    } catch (error) {
      console.error(`[HttpLPR] ${this.config.id} 연결 오류:`, error);
      this.connected = false;
      return false;
    }
  }

  disconnect(): void {
    this.stopEventPolling();
    this.connected = false;
    console.log(`[HttpLPR] ${this.config.id} 연결 해제`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getLastCapture(): Promise<LprCaptureResult | null> {
    return this.lastCapture;
  }

  async triggerCapture(): Promise<LprCaptureResult | null> {
    try {
      const captureUrl = this.getApiUrl('capture');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.customHeaders,
      };

      const authHeader = this.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(captureUrl, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (response.ok) {
        const data = await response.json();
        const result = this.parseResponse(data);

        if (result) {
          this.lastCapture = result;
          this.emit('capture', result);
        }

        return result;
      }

      return null;
    } catch (error) {
      console.error(`[HttpLPR] ${this.config.id} 캡처 오류:`, error);
      return null;
    }
  }

  async getStatus(): Promise<{ online: boolean; lastSeen?: string; error?: string }> {
    try {
      const statusUrl = this.getApiUrl('status');
      const headers: Record<string, string> = {
        ...this.config.customHeaders,
      };

      const authHeader = this.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });

      return {
        online: response.ok,
        lastSeen: nowIso(),
      };
    } catch (error: any) {
      return {
        online: false,
        error: error.message,
      };
    }
  }

  /**
   * 이벤트 폴링 시작
   */
  private startEventPolling(): void {
    if (this.pollingInterval) return;

    // 1초마다 이벤트 폴링
    this.pollingInterval = setInterval(async () => {
      await this.pollEvents();
    }, 1000);

    console.log(`[HttpLPR] ${this.config.id} 이벤트 폴링 시작`);
  }

  /**
   * 이벤트 폴링 중지
   */
  private stopEventPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * 이벤트 폴링
   */
  private async pollEvents(): Promise<void> {
    try {
      const eventUrl = this.getApiUrl('event');
      const headers: Record<string, string> = {
        ...this.config.customHeaders,
      };

      const authHeader = this.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(eventUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return;

      const data = await response.json();

      // 배열 형태면 각 이벤트 처리
      const events = Array.isArray(data) ? data : (data.events || data.results || [data]);

      for (const event of events) {
        // 중복 이벤트 체크
        const eventId = event.id || event.eventId || event.EventID;
        if (eventId && eventId === this.lastEventId) continue;

        const result = this.parseResponse(event);
        if (result) {
          this.lastEventId = eventId;
          this.lastCapture = result;
          this.emit('capture', result);
        }
      }
    } catch (error) {
      // 폴링 에러는 무시 (연결 끊김은 별도 체크)
    }
  }
}

// ============================================================================
// TCP LPR Controller (소켓 기반)
// ============================================================================

export class TcpLprController extends EventEmitter implements ILprController {
  private config: LprConfig;
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private lastCapture: LprCaptureResult | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(config: LprConfig) {
    super();
    this.config = {
      timeout: 10000,
      reconnectDelay: 5000,
      heartbeatInterval: 30000,
      minConfidence: 0.7,
      ...config,
    };
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.destroy();
      }

      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        console.log(`[TcpLPR] ${this.config.id} 연결 성공`);
        this.connected = true;
        this.startHeartbeat();
        resolve(true);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error) => {
        console.error(`[TcpLPR] ${this.config.id} 소켓 오류:`, error);
        this.connected = false;
      });

      this.socket.on('close', () => {
        console.log(`[TcpLPR] ${this.config.id} 연결 종료`);
        this.connected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.socket.connect(this.config.port || 5000, this.config.host || 'localhost');

      // 타임아웃
      setTimeout(() => {
        if (!this.connected) {
          this.socket?.destroy();
          resolve(false);
        }
      }, this.config.timeout);
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    console.log(`[TcpLPR] ${this.config.id} 연결 해제`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getLastCapture(): Promise<LprCaptureResult | null> {
    return this.lastCapture;
  }

  async triggerCapture(): Promise<LprCaptureResult | null> {
    if (!this.socket || !this.connected) return null;

    // 캡처 명령 전송 (프로토콜에 따라 다름)
    const command = JSON.stringify({ cmd: 'capture', ts: Date.now() });
    this.socket.write(command + '\n');

    // 응답 대기 (간단히 마지막 캡처 반환)
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.lastCapture;
  }

  async getStatus(): Promise<{ online: boolean; lastSeen?: string; error?: string }> {
    return {
      online: this.connected,
      lastSeen: this.connected ? nowIso() : undefined,
    };
  }

  /**
   * 수신 데이터 처리
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // 줄바꿈 기준으로 메시지 분리
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const message = this.buffer.subarray(0, newlineIndex).toString('utf8').trim();
      this.buffer = this.buffer.subarray(newlineIndex + 1);

      if (message) {
        this.processMessage(message);
      }
    }
  }

  /**
   * 메시지 처리
   */
  private processMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      // 번호판 인식 이벤트
      if (data.type === 'plate' || data.plateNo || data.plate_number) {
        const plateNo = data.plateNo || data.plate_number || data.plate;
        const confidence = data.confidence || data.score || 0.9;

        if (confidence < (this.config.minConfidence || 0.7)) {
          console.log(`[TcpLPR] ${this.config.id} 신뢰도 부족: ${plateNo} (${confidence})`);
          return;
        }

        this.lastCapture = {
          plateNo: normalizePlateNo(plateNo),
          confidence,
          capturedAt: data.timestamp || nowIso(),
          imageBase64: data.image,
          rawData: data,
        };

        console.log(`[TcpLPR] ${this.config.id} 캡처: ${this.lastCapture.plateNo}`);
        this.emit('capture', this.lastCapture);
      }

      // Heartbeat 응답
      if (data.type === 'pong' || data.cmd === 'pong') {
        // 연결 유지 확인
      }
    } catch {
      // JSON이 아닌 경우 원시 데이터로 처리
      console.log(`[TcpLPR] ${this.config.id} 원시 데이터:`, message);
    }
  }

  /**
   * Heartbeat 시작
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.write(JSON.stringify({ cmd: 'ping', ts: Date.now() }) + '\n');
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Heartbeat 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log(`[TcpLPR] ${this.config.id} 재연결 시도...`);
      await this.connect();
    }, this.config.reconnectDelay);
  }
}

// ============================================================================
// LPR Manager
// ============================================================================

class LprManager {
  private controllers: Map<string, ILprController> = new Map();
  private eventHandlers: Map<string, (capture: LprCaptureResult) => void> = new Map();

  /**
   * LPR 컨트롤러 초기화
   */
  async initialize(): Promise<void> {
    console.log('[LprManager] 초기화 시작...');

    const db = getDb();
    const lprDevices = db.prepare(`
      SELECT d.*, l.direction
      FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.type = 'LPR'
    `).all() as any[];

    for (const device of lprDevices) {
      try {
        const config = device.config_json ? JSON.parse(device.config_json) : {};

        const lprConfig: LprConfig = {
          id: device.id,
          laneId: device.lane_id,
          direction: device.direction || 'ENTRY',
          protocol: config.protocol || 'MOCK',
          vendor: config.vendor,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          timeout: config.timeout,
          minConfidence: config.minConfidence,
          eventPath: config.eventPath,
          statusPath: config.statusPath,
          capturePath: config.capturePath,
          customHeaders: config.customHeaders,
          customParams: config.customParams,
        };

        await this.registerLpr(lprConfig);
      } catch (error) {
        console.error(`[LprManager] LPR ${device.id} 초기화 실패:`, error);
      }
    }

    console.log(`[LprManager] 초기화 완료: ${this.controllers.size}개 LPR 등록`);
  }

  /**
   * LPR 등록
   */
  async registerLpr(config: LprConfig): Promise<void> {
    let controller: ILprController;

    switch (config.protocol) {
      case 'HTTP':
        controller = new HttpLprController(config);
        break;
      case 'TCP':
        controller = new TcpLprController(config);
        break;
      case 'MOCK':
      default:
        controller = new MockLprController(config);
        break;
    }

    // 캡처 이벤트 핸들러 등록
    const handler = (capture: LprCaptureResult) => {
      this.handleCapture(config.id, config.laneId, config.direction, capture);
    };

    controller.on('capture', handler);
    this.eventHandlers.set(config.id, handler);
    this.controllers.set(config.id, controller);

    // 연결 시도
    const connected = await controller.connect();
    console.log(`[LprManager] LPR 등록: ${config.id} (${config.protocol}) - 연결: ${connected}`);

    // DB 상태 업데이트
    const db = getDb();
    db.prepare(`
      UPDATE devices SET status = ?, last_seen_at = ?, updated_at = ?
      WHERE id = ?
    `).run(connected ? 'ONLINE' : 'OFFLINE', nowIso(), nowIso(), config.id);
  }

  /**
   * 캡처 이벤트 처리 -> API 서버로 전달
   */
  private async handleCapture(
    deviceId: string,
    laneId: string,
    direction: 'ENTRY' | 'EXIT',
    capture: LprCaptureResult
  ): Promise<void> {
    console.log(`[LprManager] 캡처 이벤트: ${direction} ${capture.plateNo} (장치: ${deviceId})`);

    const db = getDb();
    const eventId = generateId(ID_PREFIX.PLATE_EVENT);
    const now = nowIso();

    // 이벤트 저장
    db.prepare(`
      INSERT INTO plate_events (
        id, site_id, device_id, lane_id, direction,
        plate_no_raw, plate_no_norm, confidence, image_url,
        captured_at, received_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      DEFAULT_SITE_ID,
      deviceId,
      laneId,
      direction,
      capture.plateNo,
      capture.plateNo,
      capture.confidence,
      capture.imageUrl || null,
      capture.capturedAt,
      now,
      now
    );

    // WebSocket 브로드캐스트
    broadcast({
      type: 'LPR_CAPTURE',
      data: {
        eventId,
        deviceId,
        laneId,
        direction,
        plateNo: capture.plateNo,
        confidence: capture.confidence,
        capturedAt: capture.capturedAt,
        imageUrl: capture.imageUrl,
      },
    });

    // 디바이스 상태 업데이트
    db.prepare(`
      UPDATE devices SET status = 'ONLINE', last_seen_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, deviceId);
  }

  /**
   * LPR 컨트롤러 가져오기
   */
  getController(deviceId: string): ILprController | undefined {
    return this.controllers.get(deviceId);
  }

  /**
   * 모든 LPR 상태 조회
   */
  async getAllStatuses(): Promise<Array<{ deviceId: string; online: boolean; lastSeen?: string }>> {
    const statuses: Array<{ deviceId: string; online: boolean; lastSeen?: string }> = [];

    for (const [deviceId, controller] of this.controllers) {
      const status = await controller.getStatus();
      statuses.push({ deviceId, ...status });
    }

    return statuses;
  }

  /**
   * 종료
   */
  shutdown(): void {
    for (const [deviceId, controller] of this.controllers) {
      const handler = this.eventHandlers.get(deviceId);
      if (handler) {
        controller.off('capture', handler);
      }
      controller.disconnect();
    }

    this.controllers.clear();
    this.eventHandlers.clear();
    console.log('[LprManager] 종료');
  }
}

// ============================================================================
// Singleton & Export
// ============================================================================

let lprManager: LprManager | null = null;

export function getLprManager(): LprManager {
  if (!lprManager) {
    lprManager = new LprManager();
  }
  return lprManager;
}

export async function initializeLpr(): Promise<void> {
  const manager = getLprManager();
  await manager.initialize();
}

export function shutdownLpr(): void {
  if (lprManager) {
    lprManager.shutdown();
    lprManager = null;
  }
}
