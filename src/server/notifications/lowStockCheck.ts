import { createNotification } from "./notify";

interface LowStockCheckParams {
  userId: string;
  businessId: string;
  itemId: string;
  itemName: string;
  oldQuantity: number;
  newQuantity: number;
  minStockAlert: number;
  recipientEmail?: string | null;
}

/**
 * Fires only on the crossing itself (was above the threshold, now at or
 * below it) - not on every request while stock is already low, so a
 * business selling the last few units of something doesn't get a fresh
 * email for every single sale.
 */
export async function checkLowStockAndNotify(params: LowStockCheckParams): Promise<void> {
  const crossedBelowThreshold = params.oldQuantity > params.minStockAlert && params.newQuantity <= params.minStockAlert;
  if (!crossedBelowThreshold || !params.recipientEmail) return;

  await createNotification({
    userId: params.userId,
    businessId: params.businessId,
    type: "low_stock",
    referenceId: params.itemId,
    title: `Low stock: ${params.itemName}`,
    message: `${params.itemName} has dropped to ${params.newQuantity} unit${params.newQuantity === 1 ? "" : "s"}, at or below your alert threshold of ${params.minStockAlert}. Consider restocking soon.`,
    recipientEmail: params.recipientEmail,
  });
}
