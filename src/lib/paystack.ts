import { config } from "../config.js";

export interface PaystackInitParams {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export class PaystackError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function isPaystackConfigured(): boolean {
  return Boolean(config.paystack.secretKey);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.paystack.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: T;
  } | null;
  if (!res.ok || !json?.status) {
    // Upstream failure — return 502 so clients know it's not their fault, without
    // leaking Paystack's internal status codes (e.g. 401 for an invalid key).
    throw new PaystackError(json?.message ?? `Paystack request failed (${res.status})`, 502);
  }
  return json.data as T;
}

export async function initializeTransaction(params: PaystackInitParams): Promise<PaystackInitData> {
  return request<PaystackInitData>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: config.currency,
      metadata: params.metadata,
    }),
  });
}

export interface VerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  customer?: { email?: string };
}

export async function verifyTransaction(reference: string): Promise<VerifyData> {
  return request<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
}
