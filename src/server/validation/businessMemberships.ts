import { z } from "zod";
import { uuidField } from "./common";

export const membershipRoleField = z.enum(["Admin", "Accountant", "Staff"]);

export const membershipInviteSchema = z.object({
  businessId: uuidField,
  email: z.string().trim().toLowerCase().email("Must be a valid email address"),
  role: membershipRoleField,
});

export const membershipUpdateSchema = z.object({
  role: membershipRoleField,
});
