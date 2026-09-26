import { bkash } from '../config/env';
import { logger } from '../lib/logger';

export interface BkashConfig {
  /** e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta (no trailing slash). */
  baseUrl: string;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
}

/** bKash's success status code on every endpoint. */
export const BKASH_OK = '0000';

/** The fields we use from create / execute / status responses (bKash sends more). */
export interface BkashPayment {
  statusCode: string;
  statusMessage?: string;
  paymentID?: string;
  bkashURL?: string;
  trxID?: string;
  /** Initiated, Completed, Cancelled, Failed, … */
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  merchantInvoiceNumber?: string;
}

/** bKash didn't answer, or answered with something we can't read. */
export class BkashRequestError extends Error {
  constructor(
    readonly endpoint: string,
    readonly reason: string,
  ) {
    super(`bKash ${endpoint} failed: ${reason}`);
    this.name = 'BkashRequestError';
  }
}

const TIMEOUT_MS = 15_000;
/** Re-grant this long before bKash says the token expires. */
const TOKEN_MARGIN_MS = 5 * 60_000;

/**
 * bKash Tokenized Checkout, one-time payments (mode 0011): grant token → create payment →
 * the user pays on bKash's page → execute (or query) payment. Credentials and tokens are never
 * logged; only endpoints and bKash status codes are.
 */
export class BkashClient {
  private token: { idToken: string; expiresAt: number } | null = null;

  constructor(private readonly config: BkashConfig) {}

  private async post(
    endpoint: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'unknown';
      logger.error({ endpoint, reason }, 'bKash request failed');
      throw new BkashRequestError(endpoint, reason);
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
      logger.error({ endpoint, status: res.status }, 'bKash sent an unreadable response');
      throw new BkashRequestError(endpoint, `HTTP ${res.status}`);
    }
    return data;
  }

  /** Older API versions answer errors as { errorCode, errorMessage }. */
  private static statusOf(data: Record<string, unknown>): {
    statusCode: string;
    statusMessage?: string;
  } {
    const code = data.statusCode ?? data.errorCode;
    const message = data.statusMessage ?? data.errorMessage;
    return {
      statusCode: typeof code === 'string' ? code : 'UNKNOWN',
      statusMessage: typeof message === 'string' ? message : undefined,
    };
  }

  private async idToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.idToken;

    const data = await this.post(
      '/tokenized/checkout/token/grant',
      { username: this.config.username, password: this.config.password },
      { app_key: this.config.appKey, app_secret: this.config.appSecret },
    );
    const idToken = data.id_token;
    if (typeof idToken !== 'string' || !idToken) {
      const { statusCode } = BkashClient.statusOf(data);
      logger.error({ statusCode }, 'bKash refused the token grant');
      throw new BkashRequestError('token/grant', `status ${statusCode}`);
    }
    const expiresInSec = Number(data.expires_in) || 3600;
    this.token = { idToken, expiresAt: Date.now() + expiresInSec * 1000 - TOKEN_MARGIN_MS };
    return idToken;
  }

  private async call(endpoint: string, body: unknown): Promise<BkashPayment> {
    const data = await this.post(
      endpoint,
      { Authorization: await this.idToken(), 'X-APP-Key': this.config.appKey },
      body,
    );
    const str = (key: string) =>
      typeof data[key] === 'string' ? (data[key] as string) : undefined;
    const result: BkashPayment = {
      ...BkashClient.statusOf(data),
      paymentID: str('paymentID'),
      // The docs spell it both ways.
      bkashURL: str('bkashURL') ?? str('bKashURL'),
      trxID: str('trxID'),
      transactionStatus: str('transactionStatus'),
      amount: str('amount'),
      currency: str('currency'),
      merchantInvoiceNumber: str('merchantInvoiceNumber'),
    };
    if (result.statusCode !== BKASH_OK) {
      logger.warn(
        { endpoint, statusCode: result.statusCode, paymentID: result.paymentID },
        'bKash answered with an error',
      );
    }
    return result;
  }

  createPayment(input: {
    amountBdt: number;
    invoiceNumber: string;
    payerReference: string;
    callbackURL: string;
  }): Promise<BkashPayment> {
    return this.call('/tokenized/checkout/create', {
      mode: '0011',
      payerReference: input.payerReference,
      callbackURL: input.callbackURL,
      amount: input.amountBdt.toFixed(2),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: input.invoiceNumber,
    });
  }

  executePayment(paymentID: string): Promise<BkashPayment> {
    return this.call('/tokenized/checkout/execute', { paymentID });
  }

  /** The payment's current state; used when execute fails or times out. */
  queryPayment(paymentID: string): Promise<BkashPayment> {
    return this.call('/tokenized/checkout/payment/status', { paymentID });
  }
}

const client = bkash ? new BkashClient(bkash) : null;

/** The configured client, or null when the BKASH_* settings are missing. */
export function getBkash(): BkashClient | null {
  return client;
}
