import React, { useEffect, useState } from "react";
import { Plus, Trash as Trash2, Truck, Package, CheckCircle } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import { LoadingSwap } from "./LoadingSwap";
import { SkeletonTable } from "./Skeleton";
import { SUPPORTED_CURRENCY_CODES, getCurrencySymbol } from "../lib/currency";

interface PurchaseOrderItem {
  description: string;
  quantity: number;
  rate: number;
}

interface PurchaseOrder {
  id: string;
  businessId: string;
  poNumber: string;
  supplierName: string;
  supplierContact?: string;
  date: string;
  expectedDeliveryDate?: string;
  items: PurchaseOrderItem[];
  discount: number;
  totalAmount: number;
  status: "Draft" | "Sent" | "Confirmed" | "Received" | "Cancelled";
  notes?: string;
  currency: string;
  exchangeRateToBusinessCurrency: number;
}

interface PurchaseOrderManagerProps {
  businessId: string;
  businessCurrency: string;
}

const STATUS_STYLES: Record<PurchaseOrder["status"], string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Sent: "bg-amber-50 text-amber-700 border-amber-200",
  Confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const EMPTY_ITEM: PurchaseOrderItem = { description: "", quantity: 1, rate: 0 };

/**
 * Self-fetching document manager for the "buying FROM a supplier" direction
 * (the opposite of an invoice) - follows the same pattern as TemplateGallery
 * and BrandKitSettings: it calls the real /api/purchase-orders routes
 * directly rather than going through App.tsx's central sync state, since
 * purchase orders have no customer-facing fields to share with the
 * invoice/receipt/quotation modes this panel lives alongside.
 */
export default function PurchaseOrderManager({ businessId, businessCurrency }: PurchaseOrderManagerProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [items, setItems] = useState<PurchaseOrderItem[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState(businessCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [savedExchangeRates, setSavedExchangeRates] = useState<Record<string, number>>({});

  useEffect(() => {
    setCurrency(businessCurrency);
  }, [businessCurrency]);

  useEffect(() => {
    api.exchangeRates
      .list(businessId)
      .then((rates: any[]) => {
        const map: Record<string, number> = {};
        for (const r of rates) map[r.currency] = r.rateToBusinessCurrency;
        setSavedExchangeRates(map);
      })
      .catch(() => {});
  }, [businessId]);

  // Auto-fill from a saved rate (see the "Exchange Rates" pane) instead of
  // leaving a foreign-currency PO stuck at the rate-1 default.
  useEffect(() => {
    if (currency === businessCurrency) {
      setExchangeRate(1);
    } else if (savedExchangeRates[currency]) {
      setExchangeRate(savedExchangeRates[currency]);
    }
  }, [currency, savedExchangeRates, businessCurrency]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.purchaseOrders
      .list(businessId)
      .then((data) => {
        if (!cancelled) setOrders(data as PurchaseOrder[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load purchase orders.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const resetForm = () => {
    setSupplierName("");
    setSupplierContact("");
    setDate(new Date().toISOString().slice(0, 10));
    setExpectedDeliveryDate("");
    setItems([{ ...EMPTY_ITEM }]);
    setDiscount(0);
    setNotes("");
    setCurrency(businessCurrency);
    setExchangeRate(1);
  };

  const updateItem = (index: number, patch: Partial<PurchaseOrderItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const itemsSubtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const previewTotal = itemsSubtotal * (1 - discount / 100);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      setError("Please enter a supplier name.");
      return;
    }
    const validItems = items.filter((item) => item.description.trim().length > 0);
    if (validItems.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const created = await api.purchaseOrders.create({
        businessId,
        supplierName: supplierName.trim(),
        supplierContact: supplierContact.trim() || undefined,
        date,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        items: validItems,
        discount,
        status: "Draft",
        notes: notes.trim() || undefined,
        currency,
        exchangeRateToBusinessCurrency: exchangeRate,
      });
      setOrders((prev) => [created as PurchaseOrder, ...prev]);
      resetForm();
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create purchase order.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (order: PurchaseOrder, status: PurchaseOrder["status"]) => {
    try {
      const updated = await api.purchaseOrders.update(order.id, { status });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? (updated as PurchaseOrder) : o)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.purchaseOrders.remove(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete purchase order.");
    }
  };

  return (
    <div id="purchase-order-manager-root" className="space-y-4 text-slate-800 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            Purchase Orders
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">What this business is buying from suppliers.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> New Order
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs">{error}</div>
      )}

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="po-supplier-name" className="text-[9px] font-mono font-bold text-slate-450 block">Supplier Name</label>
              <input
                id="po-supplier-name"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Alaba Import Ltd"
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none"
              />
            </div>
            <div>
              <label htmlFor="po-supplier-contact" className="text-[9px] font-mono font-bold text-slate-450 block">Supplier Contact</label>
              <input
                id="po-supplier-contact"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                placeholder="+234 81..."
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="po-date" className="text-[9px] font-mono font-bold text-slate-450 block">Order Date</label>
              <input
                id="po-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
              />
            </div>
            <div>
              <label htmlFor="po-expected-delivery" className="text-[9px] font-mono font-bold text-slate-450 block">Expected Delivery</label>
              <input
                id="po-expected-delivery"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-slate-450">Line Items</span>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-750 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add item
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-1.5 items-center">
                <input
                  aria-label={`Item ${index + 1} description`}
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Description"
                  className="col-span-6 bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 outline-none"
                />
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  className="col-span-2 bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 outline-none font-mono"
                />
                <input
                  aria-label={`Item ${index + 1} rate`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.rate}
                  onChange={(e) => updateItem(index, { rate: Number(e.target.value) })}
                  className="col-span-3 bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove item ${index + 1}`}
                  className="col-span-1 text-rose-500 hover:text-rose-700 cursor-pointer flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
            <div>
              <label htmlFor="po-currency" className="text-[9px] font-mono font-bold text-slate-450 block">Currency</label>
              <select
                id="po-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
              >
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            {currency !== businessCurrency && (
              <div>
                <label htmlFor="po-exchange-rate" className="text-[9px] font-mono font-bold text-slate-450 block">
                  1 {currency} = ? {businessCurrency}
                </label>
                <input
                  id="po-exchange-rate"
                  type="number"
                  min={0}
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                  className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
            <div>
              <label htmlFor="po-discount" className="text-[9px] font-mono font-bold text-slate-450 block">Discount (%)</label>
              <input
                id="po-discount"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
              />
            </div>
            <div className="flex flex-col justify-end">
              <span className="text-[9px] font-mono font-bold text-slate-450">Estimated Total</span>
              <strong className="font-mono text-sm text-slate-900">
                {getCurrencySymbol(currency)}
                {previewTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div>
            <label htmlFor="po-notes" className="text-[9px] font-mono font-bold text-slate-450 block">Notes</label>
            <textarea
              id="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2.5 rounded-lg text-white font-semibold uppercase tracking-wider text-[10px] cursor-pointer mt-2"
          >
            {isSaving ? "Saving..." : "Create Purchase Order"}
          </button>
        </form>
      )}

      <LoadingSwap isLoading={isLoading} skeleton={<SkeletonTable rows={4} cols={3} />}>
      <div className="space-y-2.5">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No purchase orders yet. Click "New Order" to record what you're buying from a supplier.
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="border border-slate-200 rounded-xl p-3.5 bg-white text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="font-mono text-[10px] text-slate-400">#{order.poNumber}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[order.status]}`}>
                    {order.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(order.id)}
                  aria-label={`Delete purchase order ${order.poNumber}`}
                  className="w-6 h-6 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-rose-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{order.supplierName}</p>
                  {order.supplierContact && <p className="text-slate-500 text-[10px]">{order.supplierContact}</p>}
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    Ordered {order.date}
                    {order.expectedDeliveryDate ? ` · Expected ${order.expectedDeliveryDate}` : ""}
                  </p>
                </div>
                <strong className="font-mono text-sm text-slate-900">
                  {getCurrencySymbol(order.currency)}
                  {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                {(["Draft", "Sent", "Confirmed", "Received", "Cancelled"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(order, status)}
                    disabled={order.status === status}
                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border cursor-pointer disabled:cursor-default transition-colors ${
                      order.status === status
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {order.status === status && <CheckCircle className="w-3 h-3 inline mr-0.5" />}
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      </LoadingSwap>
    </div>
  );
}
