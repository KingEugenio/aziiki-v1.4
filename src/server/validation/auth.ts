import { z } from "zod";

export const emailField = z.string().trim().toLowerCase().email("Enter a valid email address");

// Min 8 chars, at least one letter and one digit. Deliberately not more
// aggressive than that (no forced special characters) - overly strict rules
// push users toward predictable substitutions and don't meaningfully
// improve real-world security once Supabase's modern hashing is in place.
export const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt/Argon2 input limits upstream
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const magicLinkSchema = z.object({
  email: emailField,
});

export const otpRequestSchema = z.object({
  email: emailField,
});

export const otpVerifySchema = z.object({
  email: emailField,
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const passwordResetRequestSchema = z.object({
  email: emailField,
});

export const mfaEnrollSchema = z.object({
  friendlyName: z.string().trim().min(1).max(60).optional(),
});

export const mfaChallengeSchema = z.object({
  factorId: z.string().min(1),
});

export const mfaVerifySchema = z.object({
  factorId: z.string().min(1),
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit authenticator code"),
});
