import { formatBdPhoneLocal } from '@app/shared';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

/** Development: writes the message to the log instead of sending it. */
class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string) {
    logger.warn({ phone: formatBdPhoneLocal(phone) }, `[DEV SMS] ${message}`);
  }
}

/** No real provider yet (real SMS is a stretch goal): refuse, so codes aren't silently lost. */
class UnavailableSmsProvider implements SmsProvider {
  async send(): Promise<void> {
    throw new HttpError(503, 'SMS_UNAVAILABLE', 'SMS sending is not configured');
  }
}

export const smsProvider: SmsProvider = env.OTP_DEV_MODE
  ? new ConsoleSmsProvider()
  : new UnavailableSmsProvider();
