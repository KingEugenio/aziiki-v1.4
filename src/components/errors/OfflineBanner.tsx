import React, { useEffect, useRef } from "react";
import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useToast } from "./ToastProvider";

// AZIIKI ERROR SYSTEM — persistent "you're offline" banner, self-contained
// (no props) so it can be dropped once near the app shell. Shows a
// dismissable-by-nature banner (it just disappears the moment connectivity
// returns - no manual dismiss needed) plus a brief confirmation toast on
// reconnect, so the user isn't left wondering whether they're back online.
// Placed in App.tsx rather than main.tsx because it needs useToast(), and
// main.tsx's <ToastProvider> wraps <App/> - see that file.
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      showToast({
        variant: "success",
        title: "You're back online",
        message: "Any changes you made offline are syncing now.",
        duration: 4000,
      });
    }
  }, [isOnline, showToast]);

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4 text-[11px] font-bold font-sans animate-slide-up"
      style={{ background: "var(--warning)", color: "#1a1200" }}
      role="status"
    >
      <WifiSlash className="w-3.5 h-3.5 shrink-0" />
      <span>You're offline. Changes are saved on this device and will sync once you're back.</span>
    </div>
  );
}

export { WifiHigh };
