import { getServiceRoleClient } from "../supabaseClients";
import { createNotification, hasExistingNotification } from "./notify";

/**
 * Runs on a periodic timer (see server.ts) rather than being triggered by
 * any single request - there is no user session to scope a client to here,
 * so this always uses the service-role client, scanning across every
 * business at once (the same reasoning as the Paystack webhook).
 *
 * Each invoice is only ever notified about once (tracked via
 * notification_log - see hasExistingNotification), not once per sweep, so a
 * business owner gets a single "this is overdue" email rather than one
 * every few hours until they act on it.
 */
export async function runOverdueInvoiceSweep(): Promise<void> {
  const supabase = getServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdueInvoices, error } = await supabase
    .from("invoices")
    .select("*")
    .neq("status", "Paid")
    .lt("due_date", today);

  if (error) {
    console.error("[overdue sweep] failed to load invoices:", error.message);
    return;
  }

  for (const invoice of overdueInvoices ?? []) {
    try {
      const alreadyNotified = await hasExistingNotification("invoice_overdue", invoice.id);
      if (alreadyNotified) continue;

      const { data: profile } = await supabase.from("profiles").select("email").eq("id", invoice.user_id).maybeSingle();
      if (!profile?.email) continue;

      await createNotification({
        userId: invoice.user_id,
        businessId: invoice.business_id,
        type: "invoice_overdue",
        referenceId: invoice.id,
        title: `Invoice ${invoice.invoice_number} is overdue`,
        message: `Invoice ${invoice.invoice_number} was due on ${invoice.due_date} and hasn't been marked paid yet. Consider following up with your customer.`,
        recipientEmail: profile.email,
      });
    } catch (err) {
      // One invoice failing to notify shouldn't stop the sweep from
      // processing the rest.
      console.error("[overdue sweep] failed to process invoice", invoice.id, err instanceof Error ? err.message : err);
    }
  }
}
