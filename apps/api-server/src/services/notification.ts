/**
 * 알림 서비스 (Notification Service)
 *
 * 지원 채널:
 * - Email: SMTP / AWS SES
 * - SMS: NHN Cloud (한국) / Twilio (글로벌)
 * - KakaoTalk: 카카오 알림톡
 *
 * 환경 설정:
 * - NOTIFICATION_MODE: 'live' | 'mock'
 * - EMAIL_PROVIDER: 'smtp' | 'ses'
 * - SMS_PROVIDER: 'nhn' | 'twilio'
 */

import * as nodemailer from 'nodemailer';

// ============================================================================
// Types
// ============================================================================

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
}

export interface SendSmsRequest {
  to: string | string[];
  body: string;
}

export interface SendKakaoRequest {
  to: string;
  templateCode: string;
  variables: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Notification Service Interface
// ============================================================================

export interface IEmailService {
  send(request: SendEmailRequest): Promise<NotificationResult>;
  verify(): Promise<boolean>;
}

export interface ISmsService {
  send(request: SendSmsRequest): Promise<NotificationResult>;
  verify(): Promise<boolean>;
}

export interface IKakaoService {
  send(request: SendKakaoRequest): Promise<NotificationResult>;
  verify(): Promise<boolean>;
}

export interface INotificationService {
  email: IEmailService;
  sms: ISmsService;
  kakao: IKakaoService;
}

// ============================================================================
// SMTP Email Service
// ============================================================================

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(request: SendEmailRequest): Promise<NotificationResult> {
    try {
      const recipients = Array.isArray(request.to) ? request.to.join(', ') : request.to;

      const info = await this.transporter.sendMail({
        from: this.from,
        to: recipients,
        subject: request.subject,
        text: request.body,
        html: request.html,
      });

      console.log(`[Email/SMTP] Sent to ${recipients}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
      };
    } catch (error: any) {
      console.error('[Email/SMTP] Send failed:', error);
      return {
        success: false,
        provider: 'smtp',
        error: {
          code: error.code || 'SMTP_ERROR',
          message: error.message || '이메일 발송에 실패했습니다.',
        },
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('[Email/SMTP] Connection verified');
      return true;
    } catch (error) {
      console.error('[Email/SMTP] Verification failed:', error);
      return false;
    }
  }
}

// ============================================================================
// AWS SES Email Service
// ============================================================================

interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string;
}

export class SesEmailService implements IEmailService {
  private config: SesConfig;

  constructor(config: SesConfig) {
    this.config = config;
  }

  async send(request: SendEmailRequest): Promise<NotificationResult> {
    try {
      const recipients = Array.isArray(request.to) ? request.to : [request.to];

      // AWS SES API 호출
      const response = await fetch(
        `https://email.${this.config.region}.amazonaws.com/v2/email/outbound-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
            // 실제로는 AWS Signature V4 필요 - 프로덕션에서는 AWS SDK 사용 권장
          },
          body: JSON.stringify({
            FromEmailAddress: this.config.from,
            Destination: {
              ToAddresses: recipients,
            },
            Content: {
              Simple: {
                Subject: { Data: request.subject },
                Body: {
                  Text: { Data: request.body },
                  ...(request.html ? { Html: { Data: request.html } } : {}),
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'SES API error');
      }

      const result = await response.json();
      console.log(`[Email/SES] Sent to ${recipients.join(', ')}: ${result.MessageId}`);

      return {
        success: true,
        messageId: result.MessageId,
        provider: 'ses',
      };
    } catch (error: any) {
      console.error('[Email/SES] Send failed:', error);
      return {
        success: false,
        provider: 'ses',
        error: {
          code: 'SES_ERROR',
          message: error.message || '이메일 발송에 실패했습니다.',
        },
      };
    }
  }

  async verify(): Promise<boolean> {
    // SES 설정 검증은 실제 발송 시도로 확인
    return !!(this.config.region && this.config.accessKeyId && this.config.secretAccessKey && this.config.from);
  }
}

// ============================================================================
// NHN Cloud SMS Service (한국)
// ============================================================================

interface NhnSmsConfig {
  appKey: string;
  secretKey: string;
  sender: string;
}

export class NhnSmsService implements ISmsService {
  private config: NhnSmsConfig;
  private baseUrl = 'https://api-sms.cloud.toast.com';

  constructor(config: NhnSmsConfig) {
    this.config = config;
  }

  async send(request: SendSmsRequest): Promise<NotificationResult> {
    try {
      const recipients = Array.isArray(request.to) ? request.to : [request.to];

      const response = await fetch(
        `${this.baseUrl}/sms/v3.0/appKeys/${this.config.appKey}/sender/sms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': this.config.secretKey,
          },
          body: JSON.stringify({
            body: request.body,
            sendNo: this.config.sender,
            recipientList: recipients.map(recipientNo => ({
              recipientNo: recipientNo.replace(/-/g, ''),
            })),
          }),
        }
      );

      const result = await response.json();

      if (!result.header?.isSuccessful) {
        throw new Error(result.header?.resultMessage || 'NHN SMS API error');
      }

      console.log(`[SMS/NHN] Sent to ${recipients.join(', ')}: ${result.body?.data?.requestId}`);

      return {
        success: true,
        messageId: result.body?.data?.requestId,
        provider: 'nhn',
      };
    } catch (error: any) {
      console.error('[SMS/NHN] Send failed:', error);
      return {
        success: false,
        provider: 'nhn',
        error: {
          code: 'NHN_SMS_ERROR',
          message: error.message || 'SMS 발송에 실패했습니다.',
        },
      };
    }
  }

  async verify(): Promise<boolean> {
    return !!(this.config.appKey && this.config.secretKey && this.config.sender);
  }
}

// ============================================================================
// Twilio SMS Service (글로벌)
// ============================================================================

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsService implements ISmsService {
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  async send(request: SendSmsRequest): Promise<NotificationResult> {
    try {
      const recipients = Array.isArray(request.to) ? request.to : [request.to];
      const results: NotificationResult[] = [];

      // Twilio는 개별 발송
      for (const to of recipients) {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              To: to,
              From: this.config.fromNumber,
              Body: request.body,
            }),
          }
        );

        const result = await response.json();

        if (result.error_code) {
          throw new Error(result.error_message || 'Twilio API error');
        }

        results.push({
          success: true,
          messageId: result.sid,
          provider: 'twilio',
        });

        console.log(`[SMS/Twilio] Sent to ${to}: ${result.sid}`);
      }

      // 모든 발송 성공 여부 확인
      const allSuccess = results.every(r => r.success);

      return {
        success: allSuccess,
        messageId: results.map(r => r.messageId).join(','),
        provider: 'twilio',
      };
    } catch (error: any) {
      console.error('[SMS/Twilio] Send failed:', error);
      return {
        success: false,
        provider: 'twilio',
        error: {
          code: 'TWILIO_ERROR',
          message: error.message || 'SMS 발송에 실패했습니다.',
        },
      };
    }
  }

  async verify(): Promise<boolean> {
    return !!(this.config.accountSid && this.config.authToken && this.config.fromNumber);
  }
}

// ============================================================================
// Kakao 알림톡 Service
// ============================================================================

interface KakaoConfig {
  apiKey: string;
  senderKey: string;
  channelId: string;
}

export class KakaoAlimtalkService implements IKakaoService {
  private config: KakaoConfig;
  private baseUrl = 'https://api-alimtalk.cloud.toast.com'; // NHN Cloud 카카오 알림톡

  constructor(config: KakaoConfig) {
    this.config = config;
  }

  async send(request: SendKakaoRequest): Promise<NotificationResult> {
    try {
      // 전화번호 형식 정리 (하이픈 제거)
      const recipientNo = request.to.replace(/-/g, '');

      const response = await fetch(
        `${this.baseUrl}/alimtalk/v2.2/appkeys/${this.config.apiKey}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': this.config.senderKey,
          },
          body: JSON.stringify({
            senderKey: this.config.channelId,
            templateCode: request.templateCode,
            recipientList: [
              {
                recipientNo,
                templateParameter: request.variables,
              },
            ],
          }),
        }
      );

      const result = await response.json();

      if (!result.header?.isSuccessful) {
        throw new Error(result.header?.resultMessage || 'Kakao Alimtalk API error');
      }

      console.log(`[Kakao] Sent to ${recipientNo}: ${result.message?.requestId}`);

      return {
        success: true,
        messageId: result.message?.requestId,
        provider: 'kakao',
      };
    } catch (error: any) {
      console.error('[Kakao] Send failed:', error);
      return {
        success: false,
        provider: 'kakao',
        error: {
          code: 'KAKAO_ERROR',
          message: error.message || '카카오 알림톡 발송에 실패했습니다.',
        },
      };
    }
  }

  async verify(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.senderKey && this.config.channelId);
  }
}

// ============================================================================
// Mock Services (개발/테스트용)
// ============================================================================

export class MockEmailService implements IEmailService {
  async send(request: SendEmailRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.to) ? request.to.join(', ') : request.to;
    console.log(`[MOCK Email] To: ${recipients}`);
    console.log(`[MOCK Email] Subject: ${request.subject}`);
    console.log(`[MOCK Email] Body: ${request.body.substring(0, 200)}...`);

    // 시뮬레이션 딜레이
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock_email_${Date.now()}`,
      provider: 'mock',
    };
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

export class MockSmsService implements ISmsService {
  async send(request: SendSmsRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.to) ? request.to.join(', ') : request.to;
    console.log(`[MOCK SMS] To: ${recipients}`);
    console.log(`[MOCK SMS] Body: ${request.body}`);

    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      success: true,
      messageId: `mock_sms_${Date.now()}`,
      provider: 'mock',
    };
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

export class MockKakaoService implements IKakaoService {
  async send(request: SendKakaoRequest): Promise<NotificationResult> {
    console.log(`[MOCK Kakao] To: ${request.to}`);
    console.log(`[MOCK Kakao] Template: ${request.templateCode}`);
    console.log(`[MOCK Kakao] Variables:`, request.variables);

    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      success: true,
      messageId: `mock_kakao_${Date.now()}`,
      provider: 'mock',
    };
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// Service Factory
// ============================================================================

let notificationServiceInstance: INotificationService | null = null;

/**
 * 알림 서비스 인스턴스 가져오기
 *
 * NOTIFICATION_MODE 환경변수에 따라 적절한 서비스를 반환합니다:
 * - 'live': 실제 알림 발송 (환경변수에 따라 provider 선택)
 * - 'mock': Mock 서비스 (콘솔 로그만, 기본값)
 */
export function getNotificationService(): INotificationService {
  if (notificationServiceInstance) {
    return notificationServiceInstance;
  }

  const mode = process.env.NOTIFICATION_MODE || 'mock';
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log(`[Notification] Initializing notification service (mode: ${mode}, env: ${nodeEnv})`);

  if (mode === 'mock') {
    console.log('[Notification] Using Mock notification services');
    notificationServiceInstance = {
      email: new MockEmailService(),
      sms: new MockSmsService(),
      kakao: new MockKakaoService(),
    };
    return notificationServiceInstance;
  }

  // Live mode - 각 채널별 서비스 초기화
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
  const smsProvider = process.env.SMS_PROVIDER || 'nhn';

  // Email 서비스 초기화
  let emailService: IEmailService;
  if (emailProvider === 'ses') {
    const sesConfig = {
      region: process.env.AWS_SES_REGION || '',
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || '',
      from: process.env.AWS_SES_FROM || '',
    };

    if (sesConfig.region && sesConfig.accessKeyId && sesConfig.secretAccessKey && sesConfig.from) {
      console.log('[Notification] Using AWS SES for email');
      emailService = new SesEmailService(sesConfig);
    } else {
      console.warn('[Notification] AWS SES not configured, falling back to mock');
      emailService = new MockEmailService();
    }
  } else {
    const smtpConfig = {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || '',
    };

    if (smtpConfig.host && smtpConfig.user && smtpConfig.pass && smtpConfig.from) {
      console.log('[Notification] Using SMTP for email');
      emailService = new SmtpEmailService(smtpConfig);
    } else {
      console.warn('[Notification] SMTP not configured, falling back to mock');
      emailService = new MockEmailService();
    }
  }

  // SMS 서비스 초기화
  let smsService: ISmsService;
  if (smsProvider === 'twilio') {
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    };

    if (twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.fromNumber) {
      console.log('[Notification] Using Twilio for SMS');
      smsService = new TwilioSmsService(twilioConfig);
    } else {
      console.warn('[Notification] Twilio not configured, falling back to mock');
      smsService = new MockSmsService();
    }
  } else {
    const nhnConfig = {
      appKey: process.env.NHN_SMS_APP_KEY || '',
      secretKey: process.env.NHN_SMS_SECRET_KEY || '',
      sender: process.env.NHN_SMS_SENDER || '',
    };

    if (nhnConfig.appKey && nhnConfig.secretKey && nhnConfig.sender) {
      console.log('[Notification] Using NHN Cloud for SMS');
      smsService = new NhnSmsService(nhnConfig);
    } else {
      console.warn('[Notification] NHN Cloud SMS not configured, falling back to mock');
      smsService = new MockSmsService();
    }
  }

  // Kakao 서비스 초기화
  let kakaoService: IKakaoService;
  const kakaoConfig = {
    apiKey: process.env.KAKAO_API_KEY || '',
    senderKey: process.env.KAKAO_SENDER_KEY || '',
    channelId: process.env.KAKAO_CHANNEL_ID || '',
  };

  if (kakaoConfig.apiKey && kakaoConfig.senderKey && kakaoConfig.channelId) {
    console.log('[Notification] Using Kakao Alimtalk');
    kakaoService = new KakaoAlimtalkService(kakaoConfig);
  } else {
    console.warn('[Notification] Kakao Alimtalk not configured, falling back to mock');
    kakaoService = new MockKakaoService();
  }

  notificationServiceInstance = {
    email: emailService,
    sms: smsService,
    kakao: kakaoService,
  };

  return notificationServiceInstance;
}

/**
 * 알림 서비스 리셋 (테스트용)
 */
export function resetNotificationService(): void {
  notificationServiceInstance = null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 템플릿 변수 치환
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

/**
 * 전화번호 포맷팅 (한국)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * 이메일 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 전화번호 유효성 검사 (한국)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11 && cleaned.startsWith('0');
}
