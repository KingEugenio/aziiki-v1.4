import { Router, type Request, type Response } from "express";
import { createCrudRouter } from "./crudFactory";
import { cached, invalidate } from "../redis";
import {
  businessPartnerSchema,
  businessShareholderSchema,
  businessRoleSchema,
} from "../validation/businesses";
import { nonEmptyString } from "../validation/common";
import { z } from "zod";

type PartnerInput = z.infer<typeof businessPartnerSchema>;
interface PartnerRow {
  id: string;
  business_id: string;
  name: string;
  ownership_percentage: number;
  capital_contribution: number;
  withdrawals: number;
}

export const businessPartnersRouter = createCrudRouter<PartnerInput, Partial<PartnerInput>, PartnerRow, unknown>({
  table: "business_partners",
  cacheKeyPrefix: "business_partners",
  supportsBusinessFilter: true,
  createSchema: businessPartnerSchema,
  updateSchema: businessPartnerSchema.partial(),
  toInsertRow: (_userId, input) => ({
    business_id: input.businessId,
    name: input.name,
    ownership_percentage: input.ownershipPercentage,
    capital_contribution: input.capitalContribution,
    withdrawals: input.withdrawals,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.ownershipPercentage !== undefined) row.ownership_percentage = input.ownershipPercentage;
    if (input.capitalContribution !== undefined) row.capital_contribution = input.capitalContribution;
    if (input.withdrawals !== undefined) row.withdrawals = input.withdrawals;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    ownershipPercentage: Number(row.ownership_percentage),
    capitalContribution: Number(row.capital_contribution),
    withdrawals: Number(row.withdrawals),
  }),
});

type ShareholderInput = z.infer<typeof businessShareholderSchema>;
interface ShareholderRow {
  id: string;
  business_id: string;
  name: string;
  shares_count: number;
  equity_value: number;
  capital_contribution: number;
}

export const businessShareholdersRouter = createCrudRouter<
  ShareholderInput,
  Partial<ShareholderInput>,
  ShareholderRow,
  unknown
>({
  table: "business_shareholders",
  cacheKeyPrefix: "business_shareholders",
  supportsBusinessFilter: true,
  createSchema: businessShareholderSchema,
  updateSchema: businessShareholderSchema.partial(),
  toInsertRow: (_userId, input) => ({
    business_id: input.businessId,
    name: input.name,
    shares_count: input.sharesCount,
    equity_value: input.equityValue,
    capital_contribution: input.capitalContribution,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.sharesCount !== undefined) row.shares_count = input.sharesCount;
    if (input.equityValue !== undefined) row.equity_value = input.equityValue;
    if (input.capitalContribution !== undefined) row.capital_contribution = input.capitalContribution;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sharesCount: row.shares_count,
    equityValue: Number(row.equity_value),
    capitalContribution: Number(row.capital_contribution),
  }),
});

type RoleInput = z.infer<typeof businessRoleSchema>;
interface RoleRow {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: string;
}

export const businessRolesRouter = createCrudRouter<RoleInput, Partial<RoleInput>, RoleRow, unknown>({
  table: "business_roles",
  cacheKeyPrefix: "business_roles",
  supportsBusinessFilter: true,
  createSchema: businessRoleSchema,
  updateSchema: businessRoleSchema.partial(),
  toInsertRow: (_userId, input) => ({
    business_id: input.businessId,
    name: input.name,
    email: input.email,
    role: input.role,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.email !== undefined) row.email = input.email;
    if (input.role !== undefined) row.role = input.role;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email,
    role: row.role,
  }),
});

// Audit logs are append-only: list + create, no update/delete.
const auditLogCreateSchema = z.object({
  businessId: z.string().uuid(),
  userName: nonEmptyString.max(200),
  action: nonEmptyString.max(200),
  details: z.string().trim().max(2000).optional(),
});

export const businessAuditLogsRouter = Router();

businessAuditLogsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:business_audit_logs:${userId}`;

  const allRows = await cached(cacheKey, 45, async () => {
    const { data, error } = await supabase
      .from("business_audit_logs")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? allRows.filter((r: any) => r.business_id === businessId) : allRows;

  res.json({
    data: rows.map((row: any) => ({
      id: row.id,
      businessId: row.business_id,
      timestamp: row.occurred_at,
      userName: row.user_name,
      action: row.action,
      details: row.details ?? "",
    })),
  });
});

businessAuditLogsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = auditLogCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("business_audit_logs")
    .insert({
      business_id: parsed.data.businessId,
      user_id: userId,
      user_name: parsed.data.userName,
      action: parsed.data.action,
      details: parsed.data.details,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await invalidate(`cache:business_audit_logs:${userId}`);
  res.status(201).json({
    data: {
      id: data.id,
      businessId: data.business_id,
      timestamp: data.occurred_at,
      userName: data.user_name,
      action: data.action,
      details: data.details ?? "",
    },
  });
});
