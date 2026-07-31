import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logError } from "../logging/logError";

export const errorsRouter = Router();

const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  componentStack: z.string().max(8000).optional(),
  source: z.enum(["error-boundary", "window-error", "unhandled-rejection", "api-error"]),
  status: z.number().int().optional(),
  requestId: z.string().max(100).optional(),
  endpoint: z.string().max(500).optional(),
  currentTab: z.string().max(100).optional(),
  url: z.string().max(1000).optional(),
  userAgent: z.string().max(500).optional(),
  screen: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      viewportWidth: z.number().optional(),
      viewportHeight: z.number().optional(),
    })
    .optional(),
  language: z.string().max(50).optional(),
  online: z.boolean().optional(),
  sessionId: z.string().max(100).optional(),
  environment: z.string().max(50).optional(),
  timestamp: z.string().max(50).optional(),
});

/**
 * Public (no requireAuth) on purpose: a crash on the sign-in screen, before
 * any session exists, still needs to be reportable. Mounted before the
 * requireAuth-gated routes in server.ts, same tier as /api/auth, /api/gemini,
 * /api/config. Still covered by the app-wide apiLimiter (server.ts) so it
 * can't be used to flood the error_logs table for free.
 *
 * Deliberately does NOT try to attach a user id from an Authorization header
 * - lib/errorReporting.ts sends this via sendBeacon/fetch directly rather
 * than through lib/api.ts's request() wrapper (a crash reporter has to work
 * even when the app's own state, including auth, is what's broken), so
 * there's no session token attached to correlate. Server-side errors caught
 * by the global handler in server.ts DO have req.user when available, which
 * is the more valuable half of "who did this happen to" anyway.
 */
errorsRouter.post("/report", async (req: Request, res: Response) => {
  const parsed = clientErrorSchema.safeParse(req.body);
  if (!parsed.success) {
    // A malformed error report is itself not worth erroring loudly over -
    // still 400, but don't let a broken reporter crash-loop the very
    // endpoint meant to catch crashes.
    res.status(400).json({ error: "Invalid error report payload." });
    return;
  }

  const body = parsed.data;

  await logError({
    level: body.source === "error-boundary" || (body.status && body.status >= 500) ? "critical" : "error",
    source: body.source,
    message: body.message,
    stack: body.stack,
    componentStack: body.componentStack,
    endpoint: body.endpoint,
    statusCode: body.status,
    requestId: body.requestId,
    userAgent: body.userAgent ?? req.headers["user-agent"],
    url: body.url,
    ip: req.ip,
    extra: {
      currentTab: body.currentTab,
      screen: body.screen,
      language: body.language,
      online: body.online,
      sessionId: body.sessionId,
      clientTimestamp: body.timestamp,
    },
  });

  // 204 - the client never needs (or waits for) a response body; this is
  // called via sendBeacon in the common case, which doesn't read one anyway.
  res.status(204).end();
});
