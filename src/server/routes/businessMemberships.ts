import type { Request, Response } from "express";
import { Router } from "express";
import { membershipInviteSchema, membershipUpdateSchema } from "../validation/businessMemberships";
import { getServiceRoleClient } from "../supabaseClients";

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    memberUserId: row.member_user_id,
    role: row.role,
    invitedEmail: row.invited_email,
    createdAt: row.created_at,
  };
}

export const businessMembershipsRouter = Router();

businessMembershipsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  const { data, error } = await supabase
    .from("business_memberships")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

// The auth.admin API has no direct "find user by email" in this SDK version -
// only paginated listUsers(). Bounded to 10 pages (10k users) since this is
// only ever used as a fallback when inviteUserByEmail reports the address is
// already registered; beyond that bound we report a clear error rather than
// searching indefinitely.
async function findExistingUserByEmail(email: string) {
  const adminClient = getServiceRoleClient();
  const normalized = email.trim().toLowerCase();
  const MAX_PAGES = 10;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    // Cast needed because listUsers()'s return type is a discriminated union
    // on { data, error } that TypeScript can't narrow through the
    // already-checked `result.error` above once accessed as
    // `result.data.users` (a known limitation of destructured/nested
    // discriminant narrowing) - the runtime check on the line above is what
    // actually guarantees this is the non-error branch.
    const users = result.data.users as Array<{ id: string; email?: string | null }>;
    const match = users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (users.length < 1000) break;
  }
  return null;
}

businessMembershipsRouter.post("/invite", async (req: Request, res: Response) => {
  const parsed = membershipInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const { businessId, email, role } = parsed.data;

  // Explicit check BEFORE triggering a real invite email: RLS on the
  // eventual business_memberships insert would also reject an
  // unauthorized caller, but by then the admin API below would have
  // already sent an email to an arbitrary address - a side effect RLS
  // can't undo. inviteUserByEmail also, deliberately, is never reachable
  // by a Staff/Accountant caller even if this check were ever bypassed by
  // a future refactor, since it needs the service-role key this route
  // controls access to.
  const { data: callerRole, error: roleError } = await supabase.rpc("business_role_for", {
    p_business_id: businessId,
  });
  if (roleError) {
    res.status(400).json({ error: roleError.message });
    return;
  }
  if (callerRole !== "Owner" && callerRole !== "Admin") {
    res.status(403).json({ error: "Only the business owner or an Admin can invite team members." });
    return;
  }

  let memberUserId: string;
  try {
    const adminClient = getServiceRoleClient();
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      const alreadyExists = /already.*(registered|exists)/i.test(inviteError.message);
      if (!alreadyExists) {
        res.status(400).json({ error: inviteError.message });
        return;
      }
      const existingUser = await findExistingUserByEmail(email);
      if (!existingUser) {
        res.status(404).json({
          error: "This email is already registered but could not be located. Please double-check the address.",
        });
        return;
      }
      memberUserId = existingUser.id;
    } else {
      memberUserId = inviteData.user.id;
    }
  } catch {
    res.status(502).json({ error: "Failed to invite this team member. Please try again shortly." });
    return;
  }

  const { data, error } = await supabase
    .from("business_memberships")
    .insert({
      business_id: businessId,
      member_user_id: memberUserId,
      role,
      invited_by: userId,
      invited_email: email,
    })
    .select("*")
    .single();

  if (error) {
    const alreadyMember = /duplicate key|unique constraint/i.test(error.message);
    res.status(400).json({ error: alreadyMember ? "This person is already on the team." : error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

businessMembershipsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = membershipUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("business_memberships")
    .update({ role: parsed.data.role })
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ data: fromRow(data) });
});

businessMembershipsRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("business_memberships")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.status(204).send();
});
