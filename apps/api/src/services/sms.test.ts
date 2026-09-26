import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkSmsBdProvider, maskPhone } from './sms';

const provider = new BulkSmsBdProvider({
  apiKey: 'test-key',
  senderId: '8809617000000',
  url: 'https://sms.example/api/smsapi',
});

function mockFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('BulkSmsBdProvider', () => {
  it('posts the message with the number in 880 format', async () => {
    const fetchMock = mockFetch(() => json({ response_code: 202 }));
    await provider.send('+8801712345678', 'code 123456');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sms.example/api/smsapi');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body as URLSearchParams))).toEqual({
      api_key: 'test-key',
      senderid: '8809617000000',
      type: 'text',
      number: '8801712345678',
      message: 'code 123456',
    });
  });

  it('fails with SMS_FAILED on a provider error code', async () => {
    mockFetch(() => json({ response_code: 1007, error_message: 'Balance Insufficient' }));
    await expect(provider.send('+8801712345678', 'x')).rejects.toMatchObject({
      status: 502,
      code: 'SMS_FAILED',
    });
  });

  it('reports a number the provider rejects as INVALID_PHONE', async () => {
    mockFetch(() => json({ response_code: 1001 }));
    await expect(provider.send('+8801712345678', 'x')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_PHONE',
    });
  });

  it('fails with SMS_FAILED on an HTTP error or a non-JSON answer', async () => {
    mockFetch(() => Promise.resolve(new Response('Bad gateway', { status: 500 })));
    await expect(provider.send('+8801712345678', 'x')).rejects.toMatchObject({
      code: 'SMS_FAILED',
    });
  });

  it('fails with SMS_FAILED when the request times out or the network fails', async () => {
    mockFetch(() => Promise.reject(new DOMException('timed out', 'TimeoutError')));
    await expect(provider.send('+8801712345678', 'x')).rejects.toMatchObject({
      code: 'SMS_FAILED',
    });
  });
});

describe('maskPhone', () => {
  it('keeps only the operator prefix and the last digits', () => {
    expect(maskPhone('+8801712345678')).toBe('01712***678');
  });
});
