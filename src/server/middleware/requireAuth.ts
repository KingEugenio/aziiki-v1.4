import type { Request, Response, NextFunction } from "express";
import { getUserScopedClient } from "../supabaseClients";

/**
 * Verifies the caller's Supabase access token and, on success, attaches:
 *  - req.user: the authenticated Supabase user
 *  - req.supabase: a client scoped to that user's token, so every query made
 *    through it is subject to Postgres RLS as that user
 *  - req.accessToken: the raw token, in case a route needs it
 *
 * There is no hand-rolled JWT verification here - session/refresh token
 * handling is entirely Supabase's built-in mechanism. This middleware just
 * asks Supabase's auth server "who is this token for" via getUser().
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const supabase = getUserScopedClient(token);

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    req.user = data.user;
    req.supabase = supabase;
    req.accessToken = token;
    next();
  } catch (err) {
    // A network/DNS failure reaching Supabase must not fall through to
    // Express's default HTML error page - always respond with clean JSON.
    console.error("[requireAuth] failed to verify session:", err);
    res.status(503).json({ error: "Authentication service is temporarily unavailable. Please try again shortly." });
  }
}
