import { Resend } from "resend";
import { env } from "../env";

let client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function getClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!client) {
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}

/**
 * Thrown with a message that's always safe to show a non-technical user
 * directly (see toUserFacingMessage below) - callers should never need to
 * re-wrap or re-word this message before putting it in an API response.
 */
export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

/**
 * Resend's error "name" is a stable, typed code (see RESEND_ERROR_CODE_KEY
 * in the resend package) - this maps every one of them to plain language a
 * small business owner can actually act on, instead of leaking Resend's own
 * wording (e.g. "The gmail.com domain is not verified...") to the UI.
 */
function toUserFacingMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_api_key":
    case "restricted_api_key":
    case "missing_api_key":
    case "invalid_from_address":
    case "invalid_region":
    case "security_error":
      // Server-side configuration problems - not something the user can fix
      // themselves, and not useful to describe in technical terms.
      return "Email sending isn't set up correctly on this server yet. Please contact support.";
    case "rate_limit_exceeded":
    case "monthly_quota_exceeded":
    case "daily_quota_exceeded":
      return "Too many emails have been sent recently. Please wait a few minutes and try again.";
    case "invalid_parameter":
    case "missing_required_field":
    case "validation_error":
    case "invalid_attachment":
      return "This email couldn't be sent - please check the customer's email address and try again.";
    case "internal_server_error":
    case "application_error":
    case "not_found":
    case "method_not_allowed":
      return "Our email provider is temporarily unavailable. Please try again shortly.";
    default:
      return "We couldn't send this email right now. Please try again shortly.";
  }
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getClient();

  let error: { name: string; message: string } | null;
  try {
    ({ error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }));
  } catch (err) {
    // A thrown error here means the request to Resend itself failed (DNS,
    // timeout, network outage) rather than Resend returning a structured
    // error response - still never surface the raw error to the user.
    console.error("[resend] request failed:", err instanceof Error ? err.message : err);
    throw new EmailSendError(toUserFacingMessage(undefined));
  }

  if (error) {
    console.error("[resend] send failed:", error.name, error.message);
    throw new EmailSendError(toUserFacingMessage(error.name));
  }
}
