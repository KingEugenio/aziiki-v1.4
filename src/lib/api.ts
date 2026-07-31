import { supabase } from "./supabaseClient";
import { reportClientError } from "./errorReporting";

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

class ApiError extends Error {
  status: number;
  issues?: unknown;
  /** Client-generated, sent as X-Request-Id and echoed by the server's error
   * logging (see server/routes/errors.ts and the global error handler in
   * server.ts) - lets a user's "report issue" or a support conversation be
   * matched to the exact server-side log line, without exposing any of the
   * actual stack trace/internals to the client. */
  requestId: string;
  constructor(message: string, status: number, requestId: string, issues?: unknown) {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.issues = issues;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers });
  } catch (networkErr) {
    // fetch() itself only throws for network-level failures (offline, DNS,
    // CORS, the server process being down) - never for a non-2xx response,
    // which is handled below instead. This is exactly the "can't reach
    // Aziiki at all" case, distinct from "reached it, got an error back".
    reportClientError({
      message: networkErr instanceof Error ? networkErr.message : "Network request failed",
      source: "api-error",
      endpoint: path,
      requestId,
    });
    throw new ApiError("Couldn't reach Aziiki. Check your connection and try again.", 0, requestId);
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 5xx is always "our side, not yours" - worth a client-side report even
    // though the server's own error handler already logs it server-side,
    // because only the browser knows what the user was doing, on what
    // device, in what browser, right before it happened.
    if (response.status >= 500) {
      reportClientError({
        message: body.error || `Request failed (${response.status})`,
        source: "api-error",
        status: response.status,
        endpoint: path,
        requestId,
      });
    }
    throw new ApiError(body.error || `Request failed (${response.status})`, response.status, requestId, body.issues);
  }
  return body as T;
}

/**
 * Maps an error thrown by request() (or anything else) to copy that's safe
 * and sensible to put directly in a toast/StatusScreen - never a raw status
 * code, never a stack trace. Falls back to the server's own message for 4xx
 * errors (validation messages, "Invoice already exists", etc. are already
 * written to be user-facing - see the various server/validation/*.ts
 * schemas and server/routes/*.ts handlers), since those are genuinely
 * useful to show verbatim, unlike 5xx internals.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message; // offline/network
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status === 404) return "We couldn't find that. It may have been deleted.";
    if (error.status === 409) return error.message || "That already exists.";
    if (error.status === 413) return "That file is too large.";
    if (error.status === 422) return error.message || "Please check the highlighted fields.";
    if (error.status === 429) return "You're doing that a little too fast. Please wait a moment and try again.";
    if (error.status >= 500) return "We've run into an unexpected problem on our end. It's already been reported and we're looking into it.";
    return error.message || "Something didn't work as expected.";
  }
  return "Something didn't work as expected. Please try again.";
}

/** Reads the server's Retry-After hint for a 429, in seconds, if present. */
export function getRetryAfterSeconds(error: unknown, fallback = 30): number {
  if (error instanceof ApiError && typeof error.issues === "object" && error.issues && "retryAfterSeconds" in (error.issues as any)) {
    const val = (error.issues as any).retryAfterSeconds;
    if (typeof val === "number" && val > 0) return val;
  }
  return fallback;
}

function makeResource<T>(basePath: string) {
  return {
    list: (businessId?: string) =>
      request<{ data: T[] }>(`${basePath}${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`).then(
        (r) => r.data
      ),
    create: (payload: unknown) => request<{ data: T }>(basePath, { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    update: (id: string, payload: unknown) =>
      request<{ data: T }>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`${basePath}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  auth: {
    signup: (payload: { email: string; password: string; displayName?: string }) =>
      request<{ message: string }>("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload: { email: string; password: string }) =>
      request<{ session: any; user: { id: string; email: string }; mfaRequired: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    magicLink: (email: string) => request<{ message: string }>("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) }),
    otpRequest: (email: string) => request<{ message: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) }),
    otpVerify: (email: string, token: string) =>
      request<{ session: any; user: { id: string; email: string } | null }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, token }),
      }),
    passwordResetRequest: (email: string) =>
      request<{ message: string }>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
    mfaFactors: () => request<{ factors: any }>("/auth/mfa/factors"),
    mfaEnroll: (friendlyName?: string) =>
      request<{ factorId: string; qrCode: string; secret: string; uri: string }>("/auth/mfa/enroll", {
        method: "POST",
        body: JSON.stringify({ friendlyName }),
      }),
    mfaChallenge: (factorId: string) =>
      request<{ challengeId: string }>("/auth/mfa/challenge", { method: "POST", body: JSON.stringify({ factorId }) }),
    mfaVerify: (factorId: string, challengeId: string, code: string) =>
      request<{ session: any }>("/auth/mfa/verify", { method: "POST", body: JSON.stringify({ factorId, challengeId, code }) }),
    mfaUnenroll: (factorId: string) => request<void>("/auth/mfa/unenroll", { method: "POST", body: JSON.stringify({ factorId }) }),
  },

  sync: {
    fetchAll: () => request<{ data: any }>("/sync").then((r) => r.data),
  },

  businesses: makeResource<any>("/businesses"),
  personalAccounts: makeResource<any>("/personal-accounts"),
  personalBudgets: makeResource<any>("/personal-budgets"),
  customers: makeResource<any>("/customers"),
  transactions: makeResource<any>("/transactions"),
  receipts: {
    ...makeResource<any>("/receipts"),
    sendEmail: (id: string) => request<{ message: string }>(`/receipts/${id}/send-email`, { method: "POST" }),
  },
  investments: makeResource<any>("/investments"),
  assets: makeResource<any>("/assets"),
  inventory: {
    ...makeResource<any>("/inventory"),
    adjust: (id: string, delta: number) =>
      request<{ data: any }>(`/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify({ delta }) }).then((r) => r.data),
  },
  goals: {
    ...makeResource<any>("/goals"),
    contribute: (id: string, amount: number, currency?: string) =>
      request<{ data: any }>(`/goals/${id}/contribute`, { method: "POST", body: JSON.stringify({ amount, currency }) }).then(
        (r) => r.data
      ),
  },
  debts: {
    ...makeResource<any>("/debts"),
    repay: (id: string, amount: number) =>
      request<{ data: any; settled: boolean }>(`/debts/${id}/repay`, { method: "POST", body: JSON.stringify({ amount }) }),
  },
  invoices: {
    ...makeResource<any>("/invoices"),
    sendEmail: (id: string) => request<{ message: string }>(`/invoices/${id}/send-email`, { method: "POST" }),
  },
  quotations: {
    ...makeResource<any>("/quotations"),
    convertToInvoice: (id: string, payload: { invoiceNumber: string; dueDate: string; taxRate: number }) =>
      request<{ invoice: any }>(`/quotations/${id}/convert-to-invoice`, { method: "POST", body: JSON.stringify(payload) }).then(
        (r) => r.invoice
      ),
  },
  purchaseOrders: makeResource<any>("/purchase-orders"),

  feedback: {
    submit: (payload: { name: string; email: string; message: string }) =>
      request<{ message: string }>("/feedback", { method: "POST", body: JSON.stringify(payload) }),
  },

  config: {
    features: () =>
      request<{
        emailSendingEnabled: boolean;
        paystackEnabled: boolean;
        maintenanceMode: boolean;
        maintenanceEstimatedReturn: string | null;
      }>("/config/features"),
  },

  brandKits: {
    get: (businessId: string) => request<{ data: any }>(`/brand-kits?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    save: (payload: Record<string, unknown>) =>
      request<{ data: any }>("/brand-kits", { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.data),
  },

  documentTemplates: {
    list: (params?: { documentType?: string; category?: string; folder?: string; favoriteOnly?: boolean; search?: string }) => {
      const query = new URLSearchParams();
      if (params?.documentType) query.set("documentType", params.documentType);
      if (params?.category) query.set("category", params.category);
      if (params?.folder) query.set("folder", params.folder);
      if (params?.favoriteOnly) query.set("favoriteOnly", "true");
      if (params?.search) query.set("search", params.search);
      const qs = query.toString();
      return request<{ data: any[] }>(`/document-templates${qs ? `?${qs}` : ""}`).then((r) => r.data);
    },
    create: (payload: Record<string, unknown>) =>
      request<{ data: any }>("/document-templates", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    update: (id: string, payload: Record<string, unknown>) =>
      request<{ data: any }>(`/document-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/document-templates/${id}`, { method: "DELETE" }),
    duplicate: (id: string, businessId: string) =>
      request<{ data: any }>(`/document-templates/${id}/duplicate`, { method: "POST", body: JSON.stringify({ businessId }) }).then(
        (r) => r.data
      ),
    versions: (id: string) => request<{ data: any[] }>(`/document-templates/${id}/versions`).then((r) => r.data),
  },

  documentNumbering: {
    peek: (businessId: string, documentType: string, defaultPrefix?: string) => {
      const query = new URLSearchParams({ businessId, documentType });
      if (defaultPrefix) query.set("defaultPrefix", defaultPrefix);
      return request<{ preview: string }>(`/document-numbering/peek?${query.toString()}`).then((r) => r.preview);
    },
  },

  payments: {
    list: (businessId?: string) =>
      request<{ data: any[] }>(`/payments${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`).then((r) => r.data),
    initializePaystack: (payload: {
      businessId: string;
      invoiceId?: string;
      customerId?: string;
      email?: string;
      amount: number;
      currency?: string;
    }) =>
      request<{ data: any; authorizationUrl: string }>("/payments/paystack/initialize", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  notifications: {
    list: () => request<{ data: any[] }>("/notifications").then((r) => r.data),
    markRead: (id: string) => request<{ data: any }>(`/notifications/${id}/read`, { method: "POST" }).then((r) => r.data),
    markAllRead: () => request<void>("/notifications/read-all", { method: "POST" }),
  },

  exchangeRates: {
    list: (businessId: string) =>
      request<{ data: any[] }>(`/exchange-rates?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    upsert: (payload: { businessId: string; currency: string; rateToBusinessCurrency: number }) =>
      request<{ data: any }>("/exchange-rates", { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/exchange-rates/${id}`, { method: "DELETE" }),
  },

  businessMemberships: {
    list: (businessId: string) =>
      request<{ data: any[] }>(`/business-memberships?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    invite: (payload: { businessId: string; email: string; role: "Admin" | "Accountant" | "Staff" }) =>
      request<{ data: any }>("/business-memberships/invite", { method: "POST", body: JSON.stringify(payload) }).then(
        (r) => r.data
      ),
    updateRole: (id: string, role: "Admin" | "Accountant" | "Staff") =>
      request<{ data: any }>(`/business-memberships/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }).then(
        (r) => r.data
      ),
    remove: (id: string) => request<void>(`/business-memberships/${id}`, { method: "DELETE" }),
  },

  signatures: {
    get: (documentType: string, documentId: string) => {
      const query = new URLSearchParams({ documentType, documentId });
      return request<{ data: any | null }>(`/signatures?${query.toString()}`).then((r) => r.data);
    },
    create: (payload: {
      businessId: string;
      documentType: string;
      documentId: string;
      signerName: string;
      signatureKind: "drawn" | "typed";
      signatureData: string;
    }) => request<{ data: any }>("/signatures", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/signatures/${id}`, { method: "DELETE" }),
  },
};

export { ApiError };
