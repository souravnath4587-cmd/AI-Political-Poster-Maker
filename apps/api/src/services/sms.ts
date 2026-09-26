import { formatBdPhoneLocal } from '@app/shared';
import { bulkSmsBd, env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

/** `+8801712345678` → `01712***678`, so logs can tell numbers apart without storing them. */
export function maskPhone(e164: string): string {
  const local = formatBdPhoneLocal(e164);
  return `${local.slice(0, 5)}***${local.slice(-3)}`;
}

/** Development: writes the message to the log instead of sending it. */
class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string) {
    logger.warn({ phone: formatBdPhoneLocal(phone) }, `[DEV SMS] ${message}`);
  }
}

/** No provider configured: refuse, so codes aren't silently lost. */
class UnavailableSmsProvider implements SmsProvider {
  async send(): Promise<void> {
    throw new HttpError(503, 'SMS_UNAVAILABLE', 'SMS sending is not configured');
  }
}

/** BulkSMSBD's "invalid number" response code. */
const BULKSMSBD_INVALID_NUMBER = 1001;
const BULKSMSBD_TIMEOUT_MS = 10_000;

/**
 * BulkSMSBD (https://bulksmsbd.net) HTTP API. Answers `{ response_code: 202, ... }` when the
 * message is accepted, or a 10xx code (1001 invalid number, 1007 low balance, 1032 IP not
 * whitelisted, ...). Only the response code and a masked number are logged: never the message
 * (it contains the code) or the API key.
 */
export class BulkSmsBdProvider implements SmsProvider {
  constructor(private readonly config: { apiKey: string; senderId: string; url: string }) {}

  async send(phone: string, message: string): Promise<void> {
    const body = new URLSearchParams({
      api_key: this.config.apiKey,
      senderid: this.config.senderId,
      type: 'text',
      number: phone.replace(/^\+/, ''),
      message,
    });

    let providerCode: number | undefined;
    try {
      const res = await fetch(this.config.url, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(BULKSMSBD_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => null)) as { response_code?: unknown } | null;
      providerCode = Number(data?.response_code);
      if (res.ok && providerCode === 202) return;

      logger.error(
        { phone: maskPhone(phone), status: res.status, providerCode },
        'BulkSMSBD rejected the message',
      );
    } catch (err) {
      logger.error(
        { phone: maskPhone(phone), reason: err instanceof Error ? err.name : 'unknown' },
        'BulkSMSBD request failed',
      );
    }

    if (providerCode === BULKSMSBD_INVALID_NUMBER) {
      throw new HttpError(400, 'INVALID_PHONE', 'The SMS provider rejected this number');
    }
    throw new HttpError(502, 'SMS_FAILED', 'The SMS could not be sent');
  }
}

function createSmsProvider(): SmsProvider {
  if (env.OTP_DEV_MODE) return new ConsoleSmsProvider();
  if (bulkSmsBd) return new BulkSmsBdProvider(bulkSmsBd);
  logger.warn('No SMS provider configured: only reviewer numbers can log in');
  return new UnavailableSmsProvider();
}

/** The app's provider. Tests replace `send` with vi.spyOn. */
export const smsProvider: SmsProvider = createSmsProvider();
