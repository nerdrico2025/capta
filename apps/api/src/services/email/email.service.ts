import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import type { AlertTemplateData } from './template.js';
import { renderAlertTemplate } from './template.js';

export interface SendPayload {
  to: string;
  templateData: AlertTemplateData;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailService {
  send(payload: SendPayload): Promise<SendResult>;
  batchSend(payloads: SendPayload[], ratePerMinute?: number): Promise<SendResult[]>;
}

// ─── Rate-limited batch helper ────────────────────────────────────────────────

async function runBatch(
  service: EmailService,
  payloads: SendPayload[],
  ratePerMinute: number,
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  const batchSize = ratePerMinute;

  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((p) => service.send(p)));
    results.push(...batchResults);

    const hasMore = i + batchSize < payloads.length;
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    }
  }

  return results;
}

// ─── Resend implementation ────────────────────────────────────────────────────

export class ResendEmailService implements EmailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const { subject, html } = renderAlertTemplate(payload.templateData);
      const result = await this.resend.emails.send({
        from: this.from,
        to: [payload.to],
        subject,
        html,
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, messageId: result.data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  batchSend(payloads: SendPayload[], ratePerMinute = 50): Promise<SendResult[]> {
    return runBatch(this, payloads, ratePerMinute);
  }
}

// ─── SMTP / Nodemailer implementation ────────────────────────────────────────

export class SmtpEmailService implements EmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    secure?: boolean;
  }) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const { subject, html } = renderAlertTemplate(payload.templateData);
      const info = await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  batchSend(payloads: SendPayload[], ratePerMinute = 50): Promise<SendResult[]> {
    return runBatch(this, payloads, ratePerMinute);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER ?? 'smtp';
  const from = process.env.EMAIL_FROM ?? 'Capta <alertas@capta.app>';

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    return new ResendEmailService(apiKey, from);
  }

  return new SmtpEmailService({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from,
  });
}
