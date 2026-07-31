import React, { useEffect, useState } from "react";
import { Envelope as Mail, X } from "@phosphor-icons/react";
import { api } from "../lib/api";

interface NotificationBannerProps {
  userEmail?: string;
}

/**
 * Aziiki's notifications (payment received, low stock, overdue invoice) are
 * emailed - this banner is the only in-app signal that one went out, since
 * there's no SMS/push channel by design. It disappears once every unread
 * notification is dismissed, and comes back next time something new fires.
 */
export default function NotificationBanner({ userEmail }: NotificationBannerProps) {
  const [unread, setUnread] = useState<any[]>([]);
  const [isDismissing, setIsDismissing] = useState(false);

  const load = () => {
    api.notifications
      .list()
      .then((rows) => setUnread(rows.filter((r: any) => !r.readAt)))
      .catch(() => setUnread([]));
  };

  useEffect(load, []);

  if (unread.length === 0) return null;

  const latest = unread[0];

  const dismissAll = async () => {
    setIsDismissing(true);
    try {
      await api.notifications.markAllRead();
      setUnread([]);
    } catch {
      // Best-effort - if this fails, the banner just stays until reload.
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in text-left">
      <div className="flex items-start gap-3">
        <div className="bg-amber-100 text-amber-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
          <Mail className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-xs font-extrabold">
            {unread.length === 1 ? "You have a new alert" : `You have ${unread.length} new alerts`} - check your email{userEmail ? ` (${userEmail})` : ""}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">{latest.title}: {latest.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismissAll}
        disabled={isDismissing}
        className="shrink-0 flex items-center gap-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[10px] px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" /> Dismiss
      </button>
    </div>
  );
}
