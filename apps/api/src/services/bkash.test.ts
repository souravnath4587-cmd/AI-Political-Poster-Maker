import { afterEach, describe, expect, it, vi } from 'vitest';
import { BkashClient, BkashRequestError } from './bkash';

const config = {
  baseUrl: 'https://bkash.example/v1.2.0-beta',
  appKey: 'app-key',
  appSecret: 'app-secret',
  username: 'merchant',
  password: 'secret-password',
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function mockFetch(...responses: (() => Promise<Response>)[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockImplementationOnce(r);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const grant = () => json({ statusCode: '0000', id_token: 'tok-1', expires_in: 3600 });

afterEach(() => vi.unstubAllGlobals());

describe('BkashClient', () => {
  it('grants a token, then creates a one-time payment with it', async () => {
    const fetchMock = mockFetch(grant, () =>
      json({
        statusCode: '0000',
        paymentID: 'TR0011abc',
        bkashURL: 'https://sandbox.payment.bkash.com/?paymentId=TR0011abc',
      }),
    );
    const client = new BkashClient(config);
    const created = await client.createPayment({
      amountBdt: 100,
      invoiceNumber: 'PM123',
      payerReference: '01712345678',
      callbackURL: 'http://localhost:3000/api/payments/bkash/callback',
    });

    expect(created).toMatchObject({ statusCode: '0000', paymentID: 'TR0011abc' });
    expect(created.bkashURL).toContain('TR0011abc');

    const [grantUrl, grantInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(grantUrl).toBe('https://bkash.example/v1.2.0-beta/tokenized/checkout/token/grant');
    expect(grantInit.headers).toMatchObject({ username: 'merchant', password: 'secret-password' });
    expect(JSON.parse(grantInit.body as string)).toEqual({
      app_key: 'app-key',
      app_secret: 'app-secret',
    });

    const [createUrl, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toBe('https://bkash.example/v1.2.0-beta/tokenized/checkout/create');
    expect(createInit.headers).toMatchObject({ Authorization: 'tok-1', 'X-APP-Key': 'app-key' });
    expect(JSON.parse(createInit.body as string)).toEqual({
      mode: '0011',
      payerReference: '01712345678',
      callbackURL: 'http://localhost:3000/api/payments/bkash/callback',
      amount: '100.00',
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: 'PM123',
    });
  });

  it('reuses the token until it is close to expiring', async () => {
    const fetchMock = mockFetch(
      grant,
      () => json({ statusCode: '0000', transactionStatus: 'Completed' }),
      () => json({ statusCode: '0000', transactionStatus: 'Completed' }),
    );
    const client = new BkashClient(config);
    await client.queryPayment('TR1');
    await client.queryPayment('TR2');
    expect(fetchMock).toHaveBeenCalledTimes(3); // one grant, two queries
  });

  it('reads execute results and the older bKashURL / errorCode spellings', async () => {
    mockFetch(
      grant,
      () =>
        json({
          statusCode: '0000',
          paymentID: 'TR1',
          trxID: 'BFK1234',
          transactionStatus: 'Completed',
          amount: '150',
          currency: 'BDT',
          merchantInvoiceNumber: 'PM9',
        }),
      () => json({ errorCode: '2023', errorMessage: 'Insufficient Balance' }),
      () => json({ statusCode: '0000', bKashURL: 'https://pay.example/x', paymentID: 'TR3' }),
    );
    const client = new BkashClient(config);
    expect(await client.executePayment('TR1')).toMatchObject({
      trxID: 'BFK1234',
      transactionStatus: 'Completed',
      amount: '150',
    });
    expect(await client.executePayment('TR2')).toMatchObject({
      statusCode: '2023',
      statusMessage: 'Insufficient Balance',
    });
    const created = await client.createPayment({
      amountBdt: 1,
      invoiceNumber: 'x',
      payerReference: 'y',
      callbackURL: 'https://z.example',
    });
    expect(created.bkashURL).toBe('https://pay.example/x');
  });

  it('throws BkashRequestError when bKash is unreachable or refuses the grant', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(new BkashClient(config).queryPayment('TR1')).rejects.toBeInstanceOf(
      BkashRequestError,
    );

    mockFetch(() => json({ statusCode: '2001', statusMessage: 'Invalid App Key' }));
    await expect(new BkashClient(config).queryPayment('TR1')).rejects.toBeInstanceOf(
      BkashRequestError,
    );
  });
});
