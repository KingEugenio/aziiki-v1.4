import React, { useState } from "react";
import Logo from "./Logo";
import { supabase } from "../lib/supabaseClient";
import { api, ApiError } from "../lib/api";
import { ShieldCheck, Lock, Envelope as Mail, DeviceMobile as Smartphone, Monitor, Database, WarningCircle as AlertCircle, CheckCircle, CaretRight as ChevronRight, ArrowRight, Key as KeyRound } from "@phosphor-icons/react";

interface AuthPortalProps {
  onAuthSuccess: (info: { user: any; isNewUser: boolean; businessName?: string; currency?: string; seedDemoData?: boolean }) => void;
  onEnterGuest: () => void;
  /** Set by App.tsx when Supabase fires a PASSWORD_RECOVERY auth event
   * (the user landed here via a password-reset email link). */
  recoveryMode?: boolean;
  /** AZIIKI BASIC VERSION: set by App.tsx when the user arrived via an
   * expired or already-used email link (reset, magic link, or signup
   * confirmation). Shown as a banner and routes straight to "request a new
   * link" instead of a bare, unexplained login screen. */
  linkErrorMessage?: string | null;
  onDismissLinkError?: () => void;
}

// AZIIKI BASIC VERSION: how long a user must wait before they can re-request
// a reset link or magic link, to make "click resend" impossible to abuse
// while still being honest that a resend option exists.
const RESEND_COOLDOWN_SECONDS = 30;

type Mode = "password" | "magic-link" | "otp" | "reset-request" | "otp-code" | "mfa-code" | "recovery";

// A generic, non-committal message shown for EVERY login failure - wrong
// password, unknown email, unverified account - so the response never
// reveals which case it was. See src/server/routes/auth.ts for the matching
// server-side behavior.
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export default function AuthPortal({ onAuthSuccess, onEnterGuest, recoveryMode, linkErrorMessage, onDismissLinkError }: AuthPortalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [mode, setMode] = useState<Mode>(recoveryMode ? "recovery" : linkErrorMessage ? "reset-request" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  // AZIIKI BASIC VERSION: expands the demoted magic-link/OTP options, kept
  // collapsed by default so password is unambiguously the primary method.
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // AZIIKI BASIC VERSION: resend cooldown, in seconds remaining, for
  // reset-link / magic-link requests. 0 means "ready to send".
  const [resendCooldown, setResendCooldown] = useState(0);

  const [initialBusinessName, setInitialBusinessName] = useState("My First SME Group");
  const [initialCurrency, setInitialCurrency] = useState("GHS");
  const [seedDemoData, setSeedDemoData] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(linkErrorMessage ?? null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetNotices = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    onDismissLinkError?.();
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function establishSessionAndContinue(session: any, isNewUser: boolean) {
    await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    const { data } = await supabase.auth.getUser();
    onAuthSuccess({
      user: data.user,
      isNewUser,
      businessName: initialBusinessName,
      currency: initialCurrency,
      seedDemoData,
    });
  }

  // AZIIKI BASIC VERSION: Google/Apple are account-creation providers only in
  // the MVP — sign-in is email+password only. (Handler kept generic so
  // re-enabling OAuth sign-in later, or adding Microsoft back, is a one-line change.)
  const handleOAuth = async (provider: "google" | "apple") => {
    resetNotices();
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    // Browser navigates away to the provider; nothing else to do here.
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();

    if (!email || !password) {
      setErrorMsg("Please fill in both your email and password.");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await api.auth.signup({ email, password });
        setSuccessMsg("Account created! Check your inbox for a verification link before signing in.");
        setIsSignUp(false);
      } else {
        const result = await api.auth.login({ email, password });
        if (result.mfaRequired) {
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
          const { factors: factorData } = await api.auth.mfaFactors();
          const factor = factorData?.totp?.find((f: any) => f.status === "verified");
          if (!factor) {
            setErrorMsg("Multi-factor authentication is required on this account, but no verified authenticator was found. Please contact support.");
            setIsLoading(false);
            return;
          }
          const challenge = await api.auth.mfaChallenge(factor.id);
          setMfaFactorId(factor.id);
          setMfaChallengeId(challenge.challengeId);
          setMode("mfa-code");
          setIsLoading(false);
          return;
        }
        await establishSessionAndContinue(result.session, false);
      }
    } catch (err) {
      // Every failure - wrong password, unknown email, unverified email -
      // surfaces identically, matching the server's generic response.
      setErrorMsg(err instanceof ApiError ? err.message : GENERIC_LOGIN_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    if (!mfaFactorId || !mfaChallengeId) return;
    setIsLoading(true);
    try {
      const result = await api.auth.mfaVerify(mfaFactorId, mfaChallengeId, otpCode);
      await establishSessionAndContinue(result.session, false);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "That code is invalid or has expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    if (!email) {
      setErrorMsg("Enter your email first.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.auth.magicLink(email);
      setSuccessMsg(result.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    if (!email) {
      setErrorMsg("Enter your email first.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.auth.otpRequest(email);
      setSuccessMsg(result.message);
      setMode("otp-code");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    setIsLoading(true);
    try {
      const result = await api.auth.otpVerify(email, otpCode);
      if (!result.session) throw new Error("Verification failed");
      await establishSessionAndContinue(result.session, false);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "That code is invalid or has expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    if (!email) {
      setErrorMsg("Enter your email first.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.auth.passwordResetRequest(email);
      setSuccessMsg(result.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    if (newPassword.length < 8) {
      setErrorMsg("Your new password must be at least 8 characters.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccessMsg("Password updated. Taking you to your workspace...");
      const { data } = await supabase.auth.getUser();
      // AZIIKI BASIC VERSION: brief pause so the success confirmation is
      // actually visible before navigating away, instead of flashing for a
      // single frame.
      setTimeout(() => onAuthSuccess({ user: data.user, isNewUser: false }), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not update your password. Please request a new reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "recovery") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <Logo size={36} className="shadow-md rounded-xl" />
            <h2 className="text-base font-black tracking-tight text-slate-900">Set a new password</h2>
          </div>
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-start gap-2.5 text-xs">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> {successMsg}
            </div>
          )}
          <form onSubmit={handleSetNewPassword} className="space-y-3">
            <input
              type="password"
              required
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50"
            >
              {isLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="auth-portal-frame" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-5xl bg-white border border-slate-205 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-900/5 grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        {/* LEFT COLUMN: branding */}
        <div className="lg:col-span-5 bg-slate-900 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <Logo size={36} className="shadow-md rounded-xl" />
              <div>
                <h2 className="text-base font-black tracking-tight text-white font-sans">Aziiki</h2>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">Your Business. Organized.</p>
              </div>
            </div>
          </div>

          <div className="my-8 space-y-6 relative">
            <div className="space-y-1.5">
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-mono font-bold tracking-widest uppercase">
                Supabase Secured
              </span>
              <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug">One Account. Real Data Protection.</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Your credentials are managed by Supabase Auth, and every record you save is protected by row-level
                security in a real Postgres database - not a shared document. Sign in from your phone, tablet, or
                browser and pick up exactly where you left off.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-3 text-slate-400">
              <div className="flex items-center gap-1.5 text-xs">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android/iOS App</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
              <div className="flex items-center gap-1.5 text-xs">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span>Web Browser App</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-sans border-t border-slate-800 pt-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted in transit and at rest. Row Level Security enforced on every table.</span>
          </div>
        </div>

        {/* RIGHT COLUMN: auth forms */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setMode("password");
                  resetNotices();
                }}
                className={`pb-2.5 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-all ${
                  !isSignUp && mode === "password" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setMode("password");
                  resetNotices();
                }}
                className={`pb-2.5 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-all ${
                  isSignUp ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                Create Account
              </button>
            </div>

            <button
              onClick={onEnterGuest}
              type="button"
              className="text-[10px] font-mono text-slate-500 hover:text-emerald-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Skip as Guest <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="my-6">
            <h1 className="text-xl font-black text-slate-900 tracking-tight font-sans">
              {mode === "mfa-code"
                ? "Enter your authenticator code"
                : mode === "otp-code"
                ? "Enter your one-time code"
                : mode === "magic-link"
                ? "Sign in with a magic link"
                : mode === "otp"
                ? "Sign in with a one-time code"
                : mode === "reset-request"
                ? "Reset your password"
                : isSignUp
                ? "Set up your secure SME workspace"
                : "Welcome back"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              {isSignUp && mode === "password"
                ? "We'll email you a verification link before your workspace unlocks."
                : "Every request runs through Supabase Auth - no passwords are ever handled by this app's own code."}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in font-sans mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-bold text-[11px] leading-relaxed">{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in font-sans mb-4">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-bold text-[11px] leading-relaxed">{successMsg}</p>
            </div>
          )}

          {mode === "password" && (
            <>
              {/* AZIIKI BASIC VERSION: Google/Apple are account-creation providers only —
                  shown on Create Account, not on Sign In, so email+password is the one,
                  unambiguous way back in. */}
              {isSignUp && (
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    className="border border-slate-200 rounded-xl py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth("apple")}
                    className="border border-slate-200 rounded-xl py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Continue with Apple
                  </button>
                </div>
              )}
              {isSignUp && (
                <div className="flex items-center gap-2.5 mb-4 text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                  <div className="h-px flex-1 bg-slate-150" />
                  or with email
                  <div className="h-px flex-1 bg-slate-150" />
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-450 uppercase tracking-widest font-bold">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 focus:bg-white font-sans transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-450 uppercase tracking-widest font-bold">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 focus:bg-white font-mono transition-all"
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-[10px] font-mono text-slate-450 uppercase tracking-widest font-bold">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 focus:bg-white font-mono transition-all"
                      />
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3.5 animate-fade-in">
                    <span className="text-[9px] font-mono text-emerald-600 block uppercase font-black tracking-widest">
                      Configure Your Workspace
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-450 block mb-1">Company Display Name</label>
                        <input
                          type="text"
                          value={initialBusinessName}
                          onChange={(e) => setInitialBusinessName(e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2 outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-450 block mb-1">Primary Trade Currency</label>
                        <select
                          value={initialCurrency}
                          onChange={(e) => setInitialCurrency(e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2 outline-none font-sans"
                        >
                          <option value="GHS">GHS (₵ - Ghanaian Cedi)</option>
                          <option value="NGN">NGN (₦ - Nigerian Naira)</option>
                          <option value="KES">KES (KSh - Kenyan Shilling)</option>
                          <option value="USD">USD ($ - United States Dollar)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Working...</span>
                  ) : (
                    <>
                      <span>{isSignUp ? "Create account" : "Sign in"}</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </form>

              {!isSignUp && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <button onClick={() => { resetNotices(); setMode("reset-request"); }} className="text-slate-600 hover:underline">
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions((v) => !v)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showMoreOptions ? "Hide other sign-in options" : "Trouble signing in? More options"}
                    </button>
                  </div>
                  {/* AZIIKI BASIC VERSION: magic link / OTP demoted — verification/recovery
                      fallbacks only, tucked behind a disclosure instead of sitting next to
                      password as an equal "which method?" choice. */}
                  {showMoreOptions && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 animate-fade-in">
                      <button onClick={() => { resetNotices(); setMode("magic-link"); }} className="text-emerald-700 hover:underline text-[10px] font-bold">
                        Email me a sign-in link
                      </button>
                      <button onClick={() => { resetNotices(); setMode("otp"); }} className="text-emerald-700 hover:underline text-[10px] font-bold">
                        Email me a one-time code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "magic-link" && (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4 text-xs">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <button type="submit" disabled={isLoading || resendCooldown > 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50">
                {isLoading ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : successMsg ? "Resend link" : "Send magic link"}
              </button>
              <button type="button" onClick={() => { resetNotices(); setMode("password"); }} className="text-[10px] font-bold text-slate-500 hover:underline">
                Back to password sign-in
              </button>
            </form>
          )}

          {mode === "otp" && (
            <form onSubmit={handleOtpRequest} className="space-y-4 text-xs">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50">
                {isLoading ? "Sending..." : "Send one-time code"}
              </button>
              <button type="button" onClick={() => { resetNotices(); setMode("password"); }} className="text-[10px] font-bold text-slate-500 hover:underline">
                Back to password sign-in
              </button>
            </form>
          )}

          {mode === "otp-code" && (
            <form onSubmit={handleOtpVerify} className="space-y-4 text-xs">
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 font-mono tracking-widest"
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50">
                {isLoading ? "Verifying..." : "Verify & sign in"}
              </button>
            </form>
          )}

          {mode === "mfa-code" && (
            <form onSubmit={handleMfaSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500">Enter the 6-digit code from your authenticator app.</p>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 font-mono tracking-widest"
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50">
                {isLoading ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}

          {mode === "reset-request" && (
            <form onSubmit={handleResetRequest} className="space-y-4 text-xs">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <button type="submit" disabled={isLoading || resendCooldown > 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3.5 rounded-xl disabled:opacity-50">
                {isLoading ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : successMsg ? "Resend reset link" : "Send reset link"}
              </button>
              {successMsg && (
                <p className="text-[10px] text-slate-450 text-center">
                  Link expired or didn't arrive? You can request a new one once the timer above runs out.
                </p>
              )}
              <button type="button" onClick={() => { resetNotices(); setMode("password"); }} className="text-[10px] font-bold text-slate-500 hover:underline">
                Back to password sign-in
              </button>
            </form>
          )}

          <div className="border-t border-slate-100 pt-4 mt-6 text-center text-[10px] text-slate-400 font-mono flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              Supabase Postgres + RLS
            </span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span>v3.026 Production</span>
          </div>
        </div>
      </div>
    </div>
  );
}
