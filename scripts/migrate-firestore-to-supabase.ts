/**
 * One-time migration: existing Firestore `userData/{uid}` documents -> the
 * new normalized Supabase Postgres schema.
 *
 * WHY THIS IS SEPARATE FROM THE APP: this is an admin/offline tool, run once
 * per legacy user by a human operator - it is NOT part of the running app,
 * is never deployed, and deliberately uses the Supabase SERVICE ROLE key
 * (which bypasses Row Level Security) because it writes data on behalf of
 * users who have not logged in yet. Never wire this pattern into a
 * user-facing API route.
 *
 * WHAT IT DOES NOT DO: migrate passwords. Firebase Auth and Supabase Auth
 * use different, incompatible password hashes, so there is no way to carry
 * a password over even if you wanted to. Every migrated user must either:
 *   (a) use "Forgot password" to set a new one via Supabase Auth, or
 *   (b) be sent a magic link / invite email to sign in passwordlessly first.
 * This script creates each Supabase Auth user via admin.inviteUserByEmail(),
 * which does both: creates the account AND emails them a sign-in link.
 *
 * HOW TO RUN:
 *   1. From the Firebase console (or `firebase firestore:export`), export
 *      every document in the `userData` collection to JSON, one file per
 *      user, named `<uid>.json`, into a local `./firestore-export/` folder.
 *      Each file's shape should match the old UserAppState interface
 *      (businesses, transactions, customers, invoices, receipts,
 *      quotations, investments, assets, goals, debts, inventory) plus an
 *      "email" field for that user (pull this from the Firebase Auth user
 *      export / Authentication tab, since the old Firestore doc itself
 *      didn't store it).
 *   2. `npm install --no-save firebase-admin` is NOT required - this script
 *      only reads the JSON files you already exported, it does not talk to
 *      Firebase directly.
 *   3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
 *      (the same values as your production .env, never commit them).
 *   4. `npx tsx scripts/migrate-firestore-to-supabase.ts ./firestore-export`
 *   5. Review the printed summary, then individually notify each migrated
 *      user to check their email for the sign-in link.
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

interface LegacyUserExport {
  email: string;
  businesses?: any[];
  customers?: any[];
  transactions?: any[];
  invoices?: any[];
  receipts?: any[];
  quotations?: any[];
  investments?: any[];
  assets?: any[];
  goals?: any[];
  debts?: any[];
  inventory?: any[];
}

async function migrateOneUser(legacyUid: string, data: LegacyUserExport) {
  console.log(`\n--- Migrating ${legacyUid} (${data.email}) ---`);

  // 1. Create (or fetch) the Supabase Auth user and send them a sign-in
  // invite email - this is the only correct way to move a real user across
  // auth systems without ever handling their password.
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(data.email);
  let newUserId = invited?.user?.id;
  if (inviteError) {
    if (inviteError.message.toLowerCase().includes("already been registered")) {
      const { data: existing } = await supabase.auth.admin.listUsers();
      newUserId = (existing?.users ?? []).find((u: { email?: string; id: string }) => u.email === data.email)?.id;
    } else {
      console.error(`  Failed to create/invite auth user for ${data.email}:`, inviteError.message);
      return;
    }
  }
  if (!newUserId) {
    console.error(`  Could not resolve a Supabase user id for ${data.email}, skipping.`);
    return;
  }

  const businessIdMap = new Map<string, string>();
  const customerIdMap = new Map<string, string>();

  for (const biz of data.businesses ?? []) {
    const { data: row, error } = await supabase
      .from("businesses")
      .insert({
        user_id: newUserId,
        name: biz.name,
        industry: biz.industry,
        logo: biz.logo,
        primary_color: biz.primaryColor,
        tax_rate: biz.taxRate ?? 0,
        currency: biz.currency ?? "GHS",
        description: biz.description,
        business_type: biz.businessType,
        allow_financial_approvals: Boolean(biz.allowFinancialApprovals),
        is_personal: Boolean(biz.isPersonal),
        locked: Boolean(biz.locked),
      })
      .select("id")
      .single();
    if (error) {
      console.error(`  Failed to migrate business "${biz.name}":`, error.message);
      continue;
    }
    businessIdMap.set(biz.id, row.id);
  }

  const resolveBusiness = (id: string) => businessIdMap.get(id) ?? null;

  for (const c of data.customers ?? []) {
    const businessId = resolveBusiness(c.businessId);
    if (!businessId) continue;
    const { data: row, error } = await supabase
      .from("customers")
      .insert({
        user_id: newUserId,
        business_id: businessId,
        name: c.name,
        email: c.email || null,
        phone: c.phone,
        notes: c.notes,
        category: c.category,
        avatar_color: c.avatarColor,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`  Failed to migrate customer "${c.name}":`, error.message);
      continue;
    }
    customerIdMap.set(c.id, row.id);
  }

  const resolveCustomer = (id?: string) => (id ? customerIdMap.get(id) ?? null : null);

  for (const t of data.transactions ?? []) {
    const businessId = resolveBusiness(t.businessId);
    if (!businessId) continue;
    const { error } = await supabase.from("transactions").insert({
      user_id: newUserId,
      business_id: businessId,
      customer_id: resolveCustomer(t.customerId),
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      payment_method: t.paymentMethod,
      proof_uri: t.proofUri,
    });
    if (error) console.error(`  Failed to migrate a transaction:`, error.message);
  }

  for (const inv of data.invoices ?? []) {
    const businessId = resolveBusiness(inv.businessId);
    if (!businessId) continue;
    const customerId = resolveCustomer(inv.customerId);
    const { data: invRow, error } = await supabase
      .from("invoices")
      .insert({
        user_id: newUserId,
        business_id: businessId,
        customer_id: customerId,
        custom_client_name: customerId ? null : inv.customerId ?? "Migrated Client",
        invoice_number: inv.invoiceNumber,
        date: inv.date,
        due_date: inv.dueDate,
        discount: inv.discount ?? 0,
        tax_rate: inv.taxRate ?? 0,
        status: inv.status ?? "Draft",
        partial_paid_amount: inv.partialPaidAmount ?? 0,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`  Failed to migrate invoice "${inv.invoiceNumber}":`, error.message);
      continue;
    }
    const items = (inv.items ?? []).map((item: any, index: number) => ({
      invoice_id: invRow.id,
      user_id: newUserId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    }));
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("invoice_items").insert(items);
      if (itemsError) console.error(`  Failed to migrate items for invoice "${inv.invoiceNumber}":`, itemsError.message);
    }
  }

  for (const r of data.receipts ?? []) {
    const businessId = resolveBusiness(r.businessId);
    if (!businessId) continue;
    const customerId = resolveCustomer(r.customerId);
    const { error } = await supabase.from("receipts").insert({
      user_id: newUserId,
      business_id: businessId,
      customer_id: customerId,
      custom_client_name: customerId ? null : r.customerId ?? "Migrated Client",
      receipt_number: r.receiptNumber,
      date: r.date,
      description: r.description,
      amount_paid: r.amountPaid,
      payment_method: r.paymentMethod,
    });
    if (error) console.error(`  Failed to migrate a receipt:`, error.message);
  }

  for (const inv of data.investments ?? []) {
    const { error } = await supabase.from("investments").insert({
      user_id: newUserId,
      business_id: inv.businessId ? resolveBusiness(inv.businessId) : null,
      type: inv.type,
      name: inv.name,
      institution: inv.institution,
      value: inv.value,
      amount_invested: inv.amountInvested,
      maturity_date: inv.maturityDate ?? null,
      expected_return_rate: inv.expectedReturnRate ?? 0,
      date_acquired: inv.dateAcquired,
      notes: inv.notes,
    });
    if (error) console.error(`  Failed to migrate an investment:`, error.message);
  }

  for (const a of data.assets ?? []) {
    const { error } = await supabase.from("assets").insert({
      user_id: newUserId,
      business_id: a.businessId ? resolveBusiness(a.businessId) : null,
      name: a.name,
      category: a.category,
      purchase_date: a.purchaseDate,
      purchase_price: a.purchasePrice,
      current_value: a.currentValue,
      depreciation_method: a.depreciationMethod,
      useful_life_years: a.usefulLifeYears,
      salvage_value: a.salvageValue,
      notes: a.notes,
    });
    if (error) console.error(`  Failed to migrate an asset:`, error.message);
  }

  for (const g of data.goals ?? []) {
    const businessId = resolveBusiness(g.businessId);
    if (!businessId) continue;
    const { error } = await supabase.from("goals").insert({
      user_id: newUserId,
      business_id: businessId,
      type: g.type,
      name: g.name,
      current_amount: g.currentAmount ?? 0,
      target_amount: g.targetAmount,
      deadline: g.deadline,
    });
    if (error) console.error(`  Failed to migrate a goal:`, error.message);
  }

  for (const d of data.debts ?? []) {
    const { error } = await supabase.from("debts").insert({
      user_id: newUserId,
      business_id: d.businessId ? resolveBusiness(d.businessId) : null,
      creditor: d.creditor,
      amount: d.amount,
      interest_rate: d.interestRate ?? 0,
      due_date: d.dueDate,
      type: d.type,
    });
    if (error) console.error(`  Failed to migrate a debt:`, error.message);
  }

  for (const i of data.inventory ?? []) {
    const businessId = resolveBusiness(i.businessId);
    if (!businessId) continue;
    const { error } = await supabase.from("inventory").insert({
      user_id: newUserId,
      business_id: businessId,
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      min_stock_alert: i.minStockAlert,
      unit_cost: i.unitCost,
      unit_price: i.unitPrice,
      supplier_name: i.supplierName,
      supplier_contact: i.supplierContact,
    });
    if (error) console.error(`  Failed to migrate an inventory item:`, error.message);
  }

  console.log(`  Done: ${businessIdMap.size} businesses, ${customerIdMap.size} customers migrated.`);
}

async function main() {
  const exportDir = process.argv[2];
  if (!exportDir) {
    console.error("Usage: npx tsx scripts/migrate-firestore-to-supabase.ts <path-to-firestore-export-folder>");
    process.exit(1);
  }

  const files = readdirSync(exportDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} exported user document(s) in ${exportDir}.`);

  for (const file of files) {
    const legacyUid = file.replace(/\.json$/, "");
    const data: LegacyUserExport = JSON.parse(readFileSync(join(exportDir, file), "utf8"));
    if (!data.email) {
      console.error(`Skipping ${file}: no "email" field. Add the user's email from the Firebase Auth export first.`);
      continue;
    }
    await migrateOneUser(legacyUid, data);
  }

  console.log("\nMigration pass complete. Verify row counts in the Supabase table editor before deleting the Firestore export.");
}

main().catch((err) => {
  console.error("Migration script crashed:", err);
  process.exit(1);
});
