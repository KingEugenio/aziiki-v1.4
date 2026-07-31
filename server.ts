// Load and validate environment configuration FIRST - this throws (and exits
// the process) before anything else runs if a required secret is missing.
// There are no insecure fallback defaults anywhere in this file or the
// modules it imports.
import "dotenv/config";
import { env } from "./src/server/env";

import express from "express";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
// Express 4 does not forward a rejected promise from an async route handler
// to the error-handling middleware on its own - a network hiccup talking to
// Supabase would otherwise fall through to Express's default HTML error
// page instead of the clean JSON error responses every route in this app is
// written to return. This patches Router methods so async errors are
// forwarded to the error handler registered at the bottom of this file.
import "express-async-errors";

import { apiLimiter, paystackWebhookLimiter } from "./src/server/rateLimiters";
import { requireAuth } from "./src/server/middleware/requireAuth";

import { authRouter } from "./src/server/routes/auth";
import { geminiRouter } from "./src/server/routes/gemini";
import { syncRouter } from "./src/server/routes/sync";
import { businessesRouter } from "./src/server/routes/businesses";
import {
  businessPartnersRouter,
  businessShareholdersRouter,
  businessRolesRouter,
  businessAuditLogsRouter,
} from "./src/server/routes/businessChildren";
import { personalAccountsRouter, personalBudgetsRouter } from "./src/server/routes/personal";
import { customersRouter } from "./src/server/routes/customers";
import { transactionsRouter } from "./src/server/routes/transactions";
import { invoicesRouter } from "./src/server/routes/invoices";
import { receiptsRouter } from "./src/server/routes/receipts";
import { quotationsRouter } from "./src/server/routes/quotations";
import { purchaseOrdersRouter } from "./src/server/routes/purchaseOrders";
import { investmentsRouter } from "./src/server/routes/investments";
import { assetsRouter } from "./src/server/routes/assets";
import { goalsRouter } from "./src/server/routes/goals";
import { debtsRouter } from "./src/server/routes/debts";
import { inventoryRouter } from "./src/server/routes/inventory";
import { feedbackRouter } from "./src/server/routes/feedback";
import { configRouter } from "./src/server/routes/config";
import { brandKitsRouter } from "./src/server/routes/brandKits";
import { documentTemplatesRouter } from "./src/server/routes/documentTemplates";
import { documentNumberingRouter } from "./src/server/routes/documentNumbering";
import { paymentsRouter } from "./src/server/routes/payments";
import { paymentsWebhookRouter } from "./src/server/routes/paymentsWebhook";
import { notificationsRouter } from "./src/server/routes/notifications";
import { runOverdueInvoiceSweep } from "./src/server/notifications/overdueInvoiceSweep";
import { signaturesRouter } from "./src/server/routes/signatures";
import { businessMembershipsRouter } from "./src/server/routes/businessMemberships";
import { exchangeRatesRouter } from "./src/server/routes/exchangeRates";
import { errorsRouter } from "./src/server/routes/errors";
import { logError } from "./src/server/logging/logError";

async function startServer() {
  const app = express();

  app.set("trust proxy", 1); // required for correct req.ip behind a load balancer / reverse proxy

  // Vite's dev server needs eval() for its module transform runtime and
  // inline styles/websocket for HMR - none of which exist in the production
  // build (everything ships as hashed, same-origin <script type="module">
  // files with no inline <script> tags). So the real CSP below only applies
  // in production; dev keeps the same permissive setup it always had.
  //
  // Directives are scoped to exactly what this app actually loads, checked
  // against the real code, not a generic template:
  //  - styleSrc needs 'unsafe-inline' because React's `style={{...}}` prop
  //    compiles to inline style="" attributes, which CSP's style-src
  //    governs regardless of whether it came from a <style> tag - avoiding
  //    it would mean ripping out every inline style in the app.
  //  - connectSrc needs the Supabase project origin because the browser
  //    talks to Supabase directly (auth, session refresh) - not proxied
  //    through this server. The wss variant covers Supabase Realtime.
  //  - imgSrc allows data:/blob: for the inline SVG favicon and the
  //    FileReader/createObjectURL-based PDF import and backup-export
  //    features (BusinessDashboard.tsx, InvoiceReceiptBuilder.tsx).
  //  - Paystack checkout opens in a new tab via window.open() and Gemini
  //    calls are proxied through our own /api/gemini - neither ever needs a
  //    CSP entry since they're not fetch/connect calls from this page.
  const supabaseHttpsOrigin = env.SUPABASE_URL;
  const supabaseWssOrigin = env.SUPABASE_URL.replace(/^https:/, "wss:");

  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'", supabaseHttpsOrigin, supabaseWssOrigin],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Mounted BEFORE the global express.json() below: Paystack webhook
  // signature verification needs the exact raw, unparsed request bytes (see
  // paymentsWebhook.ts) - parsing JSON first would make recomputing that
  // signature impossible. It carries its own rate limiter since it's a
  // public endpoint the apiLimiter below (mounted after this) never reaches.
  app.use("/api/payments/paystack/webhook", paystackWebhookLimiter, paymentsWebhookRouter);

  app.use(express.json({ limit: "2mb" }));

  // General throttle on every /api route. Auth-specific routes layer their
  // own tighter limiters on top of this (see rateLimiters.ts).
  app.use("/api/", apiLimiter);

  // ---------------------------------------------------------------------
  // Public (no session required) routes
  // ---------------------------------------------------------------------
  app.use("/api/auth", authRouter);
  app.use("/api/gemini", geminiRouter);
  app.use("/api/config", configRouter);
  // AZIIKI ERROR SYSTEM: public on purpose - a crash on the sign-in screen,
  // before any session exists, still needs to be reportable. See errors.ts.
  app.use("/api/errors", errorsRouter);

  // ---------------------------------------------------------------------
  // Everything below requires a valid Supabase session. requireAuth attaches
  // req.user and a request-scoped, RLS-bound Supabase client (req.supabase) -
  // there is no in-memory user store or hand-rolled JWT anywhere in this
  // file or the routers it mounts.
  // ---------------------------------------------------------------------
  app.use("/api/sync", requireAuth, syncRouter);
  app.use("/api/businesses", requireAuth, businessesRouter);
  app.use("/api/business-partners", requireAuth, businessPartnersRouter);
  app.use("/api/business-shareholders", requireAuth, businessShareholdersRouter);
  app.use("/api/business-roles", requireAuth, businessRolesRouter);
  app.use("/api/business-audit-logs", requireAuth, businessAuditLogsRouter);
  app.use("/api/personal-accounts", requireAuth, personalAccountsRouter);
  app.use("/api/personal-budgets", requireAuth, personalBudgetsRouter);
  app.use("/api/customers", requireAuth, customersRouter);
  app.use("/api/transactions", requireAuth, transactionsRouter);
  app.use("/api/invoices", requireAuth, invoicesRouter);
  app.use("/api/receipts", requireAuth, receiptsRouter);
  app.use("/api/quotations", requireAuth, quotationsRouter);
  app.use("/api/purchase-orders", requireAuth, purchaseOrdersRouter);
  app.use("/api/investments", requireAuth, investmentsRouter);
  app.use("/api/assets", requireAuth, assetsRouter);
  app.use("/api/goals", requireAuth, goalsRouter);
  app.use("/api/debts", requireAuth, debtsRouter);
  app.use("/api/inventory", requireAuth, inventoryRouter);
  app.use("/api/feedback", requireAuth, feedbackRouter);
  app.use("/api/brand-kits", requireAuth, brandKitsRouter);
  app.use("/api/document-templates", requireAuth, documentTemplatesRouter);
  app.use("/api/document-numbering", requireAuth, documentNumberingRouter);
  app.use("/api/payments", requireAuth, paymentsRouter);
  app.use("/api/notifications", requireAuth, notificationsRouter);
  app.use("/api/signatures", requireAuth, signaturesRouter);
  app.use("/api/business-memberships", requireAuth, businessMembershipsRouter);
  app.use("/api/exchange-rates", requireAuth, exchangeRatesRouter);

  // AZIIKI ERROR SYSTEM: a clean JSON 404 for any /api/* path that didn't
  // match one of the routers mounted above, instead of falling through to
  // the SPA catch-all below and returning index.html with a 200 status for
  // what was actually a typo'd or removed API endpoint - which would make a
  // broken request look successful to any caller checking response.ok.
  app.use("/api", (_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "That API endpoint doesn't exist." });
  });

  // ---------------------------------------------------------------------
  // Vite (dev) / static build (prod) - unchanged from before.
  // ---------------------------------------------------------------------
  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Serve pre-compressed .br/.gz siblings (built by vite-plugin-compression,
    // see vite.config.ts) when the browser's Accept-Encoding supports them,
    // instead of compressing every response on the fly.
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }

      const requestedPath = decodeURIComponent(req.path);
      const filePath = path.join(distPath, requestedPath);
      // Guard against path traversal escaping dist/.
      if (!filePath.startsWith(distPath)) {
        next();
        return;
      }

      const acceptsBrotli = req.acceptsEncodings("br") === "br";
      const acceptsGzip = req.acceptsEncodings("gzip") === "gzip";

      const tryEncoding = (ext: string, encoding: string, contentType: string | false) => {
        const compressedPath = `${filePath}${ext}`;
        if (fs.existsSync(compressedPath)) {
          res.set("Content-Encoding", encoding);
          res.set("Vary", "Accept-Encoding");
          if (contentType) res.type(contentType);
          res.sendFile(compressedPath);
          return true;
        }
        return false;
      };

      if (acceptsBrotli && tryEncoding(".br", "br", mime.lookup(filePath))) return;
      if (acceptsGzip && tryEncoding(".gz", "gzip", mime.lookup(filePath))) return;
      next();
    });

    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Final error-handling middleware (must be registered last, and must take
  // 4 arguments for Express to recognize it as an error handler). Catches
  // everything express-async-errors forwards, plus anything thrown
  // synchronously - always responds with clean JSON, never Express's default
  // HTML error page, and never leaks internal error details to the client.
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[unhandled route error]", err);

    // AZIIKI ERROR SYSTEM: persist to error_logs (best-effort, never throws
    // - see logError()'s own try/catch) and, since every uncaught exception
    // reaching this handler is by definition a 5xx, fire the optional
    // Slack/Discord/Telegram alert if one is configured. Deliberately not
    // awaited - the client's response must not wait on a Supabase write or
    // a webhook POST it doesn't care about.
    logError({
      level: "critical",
      source: "server",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      endpoint: req.path,
      statusCode: 500,
      requestId: (req.headers["x-request-id"] as string) || undefined,
      userId: req.user?.id ?? null,
      userAgent: req.headers["user-agent"],
      url: req.originalUrl,
      ip: req.ip,
    }).catch(() => {
      /* logError already swallows its own errors - this catch is just a backstop */
    });

    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong on our end. Please try again shortly." });
  });

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`[aziiki] server listening on http://0.0.0.0:${env.PORT} [env: ${env.NODE_ENV}]`);
  });

  // Overdue-invoice reminders have no single request to trigger them, so
  // they run on a plain timer within this same long-lived process instead -
  // once shortly after boot (so a restart doesn't wait 6 hours for the
  // first check), then on a steady interval after that.
  const OVERDUE_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    runOverdueInvoiceSweep().catch((err) => console.error("[overdue sweep] failed:", err));
  }, 30_000);
  setInterval(() => {
    runOverdueInvoiceSweep().catch((err) => console.error("[overdue sweep] failed:", err));
  }, OVERDUE_SWEEP_INTERVAL_MS);
}

startServer();
