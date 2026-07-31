import { Router, type Request, type Response } from "express";
import { getAnonClient } from "../supabaseClients";
import { requireAuth } from "../middleware/requireAuth";
import {
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  magicLinkLimiter,
  otpLimiter,
} from "../rateLimiters";
import {
  signupSchema,
  loginSchema,
  magicLinkSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetRequestSchema,
  mfaEnrollSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
} from "../validation/auth";
import { checkLockout, recordFailedAttempt, clearLockout } from "../security/loginLockout";
import { logSecurityEvent } from "../security/logSecurityEvent";

export const authRouter = Router();

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

authRouter.post("/signup", signupLimiter, async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { email, password, displayName } = parsed.data;
  const supabase = getAnonClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: displayName ? { display_name: displayName } : undefined },
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // Supabase intentionally returns a user object with an empty `identities`
  // array (instead of an error) when signing up with an email that's
  // already registered and confirmed, precisely to prevent account
  // enumeration. We surface the exact same generic response either way.
  await logSecurityEvent({ action: "AUTH_SIGNUP", email, userId: data.user?.id, ip: req.ip });

  res.status(201).json({
    message: "Account created. Check your email to verify your address before signing in.",
  });
});

authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: GENERIC_LOGIN_ERROR });
    return;
  }

  const { email, password } = parsed.data;

  const lockout = await checkLockout(email);
  if (lockout.locked) {
    res.status(429).json({
      error: "Too many attempts. Please try again later.",
      retryAfterSeconds: lockout.retryAfterSeconds,
    });
    return;
  }

  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Every failure path - wrong password, unknown email, unverified email -
  // collapses to the exact same status code and message. Supabase itself
  // returns different error codes/messages for these (invalid_credentials,
  // email_not_confirmed, etc); we deliberately do not pass any of that
  // through to the client.
  if (error || !data.session || !data.user) {
    const lockStatus = await recordFailedAttempt(email);
    await logSecurityEvent({ action: "AUTH_FAILURE", email, ip: req.ip, details: error?.message });
    if (lockStatus.locked) {
      res.status(429).json({
        error: "Too many attempts. Please try again later.",
        retryAfterSeconds: lockStatus.retryAfterSeconds,
      });
      return;
    }
    res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    return;
  }

  await clearLockout(email);
  await logSecurityEvent({ action: "AUTH_LOGIN", email, userId: data.user.id, ip: req.ip });

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = Boolean(aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel);

  res.json({
    session: data.session,
    user: { id: data.user.id, email: data.user.email },
    mfaRequired,
  });
});

authRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  await req.supabase!.auth.signOut();
  await logSecurityEvent({ action: "AUTH_LOGOUT", userId: req.user!.id, email: req.user!.email, ip: req.ip });
  res.status(204).send();
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required." });
    return;
  }

  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    res.status(401).json({ error: "Session expired. Please sign in again." });
    return;
  }

  res.json({ session: data.session });
});

authRouter.post("/magic-link", magicLinkLimiter, async (req: Request, res: Response) => {
  const parsed = magicLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = getAnonClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error("[auth/magic-link] error:", error.message);
  }
  await logSecurityEvent({ action: "MAGIC_LINK_REQUESTED", email: parsed.data.email, ip: req.ip });

  // Always respond the same way regardless of outcome - do not reveal
  // whether the email exists.
  res.json({ message: "If that email is registered, a sign-in link is on its way." });
});

authRouter.post("/otp/request", otpLimiter, async (req: Request, res: Response) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = getAnonClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[auth/otp/request] error:", error.message);
  }
  await logSecurityEvent({ action: "OTP_REQUESTED", email: parsed.data.email, ip: req.ip });

  res.json({ message: "If that email is registered, a one-time code is on its way." });
});

authRouter.post("/otp/verify", otpLimiter, async (req: Request, res: Response) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error || !data.session) {
    await logSecurityEvent({ action: "AUTH_FAILURE", email: parsed.data.email, ip: req.ip, details: "otp_verify_failed" });
    res.status(401).json({ error: "That code is invalid or has expired." });
    return;
  }

  await logSecurityEvent({ action: "AUTH_LOGIN", email: parsed.data.email, userId: data.user?.id, ip: req.ip });
  res.json({ session: data.session, user: data.user ? { id: data.user.id, email: data.user.email } : null });
});

authRouter.post("/password-reset/request", passwordResetLimiter, async (req: Request, res: Response) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = getAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);

  if (error) {
    console.error("[auth/password-reset] error:", error.message);
  }
  await logSecurityEvent({ action: "PASSWORD_RESET_REQUESTED", email: parsed.data.email, ip: req.ip });

  // Same response whether or not the email exists.
  res.json({ message: "If that email is registered, a password reset link is on its way." });
});

// ---------------------------------------------------------------------------
// MFA (TOTP) - enroll/challenge/verify wrap Supabase's own multi-factor auth
// APIs. Session/refresh handling is entirely Supabase's; there is no custom
// token logic here.
// ---------------------------------------------------------------------------

authRouter.get("/mfa/factors", requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await req.supabase!.auth.mfa.listFactors();
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ factors: data });
});

authRouter.post("/mfa/enroll", requireAuth, async (req: Request, res: Response) => {
  const parsed = mfaEnrollSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { data, error } = await req.supabase!.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: parsed.data.friendlyName,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
});

authRouter.post("/mfa/challenge", requireAuth, async (req: Request, res: Response) => {
  const parsed = mfaChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { data, error } = await req.supabase!.auth.mfa.challenge({ factorId: parsed.data.factorId });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ challengeId: data.id });
});

authRouter.post("/mfa/verify", requireAuth, async (req: Request, res: Response) => {
  const parsed = mfaVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { data, error } = await req.supabase!.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: parsed.data.challengeId,
    code: parsed.data.code,
  });

  if (error) {
    await logSecurityEvent({ action: "MFA_CHALLENGE_FAILED", userId: req.user!.id, email: req.user!.email, ip: req.ip });
    res.status(401).json({ error: "That code is invalid or has expired." });
    return;
  }

  await logSecurityEvent({ action: "MFA_ENROLLED", userId: req.user!.id, email: req.user!.email, ip: req.ip });
  res.json({ session: data });
});

authRouter.post("/mfa/unenroll", requireAuth, async (req: Request, res: Response) => {
  const factorId = typeof req.body?.factorId === "string" ? req.body.factorId : undefined;
  if (!factorId) {
    res.status(400).json({ error: "factorId is required." });
    return;
  }

  const { error } = await req.supabase!.auth.mfa.unenroll({ factorId });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
