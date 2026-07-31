import { env } from "../env";

// AZIIKI ERROR SYSTEM — pluggable critical-error alert dispatch.
//
// IMPORTANT, read before assuming this is "connected" to anything: none of
// these channels are wired to a real Slack workspace, Discord server, or
// Telegram bot right now, because doing that needs YOUR webhook URL / bot
// token, which nobody but you can generate. Every channel below is
// independently optional (see env.ts) and no-ops with a one-line console log
// if its env vars aren't set - the exact same feature-flagged pattern
// already used for Paystack/Gemini/Resend elsewhere in this codebase. To
// actually turn one on:
//   Slack:    create an Incoming Webhook (api.slack.com/messaging/webhooks),
//             set ERROR_ALERT_SLACK_WEBHOOK_URL.
//   Discord:  server settings -> Integrations -> Webhooks -> New Webhook,
//             set ERROR_ALERT_DISCORD_WEBHOOK_URL.
//   Telegram: message @BotFather to create a bot and get a token, message
//             your bot once so it can DM you, then set
//             ERROR_ALERT_TELEGRAM_BOT_TOKEN and ERROR_ALERT_TELEGRAM_CHAT_ID.
// Nothing else in this file needs to change - each sender is a plain HTTPS
// POST with no SDK dependency (this sandbox has no npm registry access to
// install one anyway, and a raw webhook POST is genuinely all any of these
// three need).
//
// SMS is intentionally NOT implemented here - every SMS provider (Twilio
// etc.) needs a paid account + phone number you'd have to provision, unlike
// the three above which are free webhook URLs. Add it the same way if/when
// you have one: a sendSmsAlert() function called from dispatchErrorAlert().

export interface CriticalErrorAlert {
  message: string;
  source: string;
  statusCode?: number;
  endpoint?: string;
  requestId?: string;
  environment: string;
  releaseVersion: string;
  occurredAt: string;
}

async function sendSlackAlert(alert: CriticalErrorAlert): Promise<void> {
  if (!env.ERROR_ALERT_SLACK_WEBHOOK_URL) return;
  try {
    await fetch(env.ERROR_ALERT_SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:rotating_light: *Aziiki critical error* (${alert.environment}, ${alert.releaseVersion})\n*Source:* ${alert.source}${alert.endpoint ? ` • *Endpoint:* ${alert.endpoint}` : ""}${alert.statusCode ? ` • *Status:* ${alert.statusCode}` : ""}\n*Message:* ${alert.message}\n*Request ID:* ${alert.requestId ?? "n/a"}\n*Occurred:* ${alert.occurredAt}`,
      }),
    });
  } catch (err) {
    console.error("[errorAlert] Slack dispatch failed:", err);
  }
}

async function sendDiscordAlert(alert: CriticalErrorAlert): Promise<void> {
  if (!env.ERROR_ALERT_DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.ERROR_ALERT_DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **Aziiki critical error** (${alert.environment}, ${alert.releaseVersion})\n**Source:** ${alert.source}${alert.endpoint ? ` • **Endpoint:** ${alert.endpoint}` : ""}${alert.statusCode ? ` • **Status:** ${alert.statusCode}` : ""}\n**Message:** ${alert.message}\n**Request ID:** ${alert.requestId ?? "n/a"}\n**Occurred:** ${alert.occurredAt}`,
      }),
    });
  } catch (err) {
    console.error("[errorAlert] Discord dispatch failed:", err);
  }
}

async function sendTelegramAlert(alert: CriticalErrorAlert): Promise<void> {
  if (!env.ERROR_ALERT_TELEGRAM_BOT_TOKEN || !env.ERROR_ALERT_TELEGRAM_CHAT_ID) return;
  try {
    const text = `🚨 Aziiki critical error (${alert.environment}, ${alert.releaseVersion})\nSource: ${alert.source}${alert.endpoint ? ` • Endpoint: ${alert.endpoint}` : ""}${alert.statusCode ? ` • Status: ${alert.statusCode}` : ""}\nMessage: ${alert.message}\nRequest ID: ${alert.requestId ?? "n/a"}\nOccurred: ${alert.occurredAt}`;
    await fetch(`https://api.telegram.org/bot${env.ERROR_ALERT_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.ERROR_ALERT_TELEGRAM_CHAT_ID, text }),
    });
  } catch (err) {
    console.error("[errorAlert] Telegram dispatch failed:", err);
  }
}

const hasAnyChannelConfigured = () =>
  Boolean(env.ERROR_ALERT_SLACK_WEBHOOK_URL || env.ERROR_ALERT_DISCORD_WEBHOOK_URL || (env.ERROR_ALERT_TELEGRAM_BOT_TOKEN && env.ERROR_ALERT_TELEGRAM_CHAT_ID));

/**
 * Fires every configured alert channel in parallel, best-effort. Called from
 * src/server/logging/logError.ts for level:"critical" entries only (5xx
 * server errors and render crashes) - not for every 404 or validation
 * error, which would be noise, not a page. Never throws: alerting failure
 * must never affect the request/response it's observing.
 */
export async function dispatchErrorAlert(alert: CriticalErrorAlert): Promise<void> {
  if (!hasAnyChannelConfigured()) {
    console.warn(
      "[errorAlert] A critical error occurred but no alert channel is configured - it was still logged to error_logs and the console. " +
        "Set ERROR_ALERT_SLACK_WEBHOOK_URL / ERROR_ALERT_DISCORD_WEBHOOK_URL / ERROR_ALERT_TELEGRAM_BOT_TOKEN+CHAT_ID to get paged for these."
    );
    return;
  }
  await Promise.allSettled([sendSlackAlert(alert), sendDiscordAlert(alert), sendTelegramAlert(alert)]);
}
