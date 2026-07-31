import crypto from "crypto";
import { env } from "../env";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

function getSecretKey(): string {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return env.PAYSTACK_SECRET_KEY;
}

interface InitializeTransactionParams {
  email: string;
  amountMinorUnits: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Starts a Paystack transaction and returns the checkout URL to redirect the
 * payer to. The actual payment confirmation never comes back through this
 * response - it arrives later via the webhook (see paymentsWebhook.ts),
 * which is the only place a transaction is ever marked "success".
 */
export async function initializeTransaction(params: InitializeTransactionParams): Promise<InitializeTransactionResult> {
  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinorUnits,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body?.status) {
    throw new Error(body?.message || `Paystack initialize failed (${response.status})`);
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

/**
 * Verifies that a webhook payload actually came from Paystack by recomputing
 * the HMAC-SHA512 signature over the raw request body using our secret key
 * and comparing it (constant-time) against the x-paystack-signature header.
 * This is the ONLY thing that authorizes a webhook request - there is no
 * user session, API key, or IP allowlist involved, so this check must never
 * be skipped or weakened.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
