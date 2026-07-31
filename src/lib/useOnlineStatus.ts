import { useEffect, useState } from "react";

// AZIIKI ERROR SYSTEM — connectivity detection.
//
// navigator.onLine is a browser signal for "is there a network interface
// with a connection at all" - it can't tell you the connection actually
// reaches Aziiki's server (a captive wifi portal, VPN misconfiguration, or
// a fully offline LAN all report navigator.onLine === true). It's still the
// right first signal: it fires instantly and covers the overwhelmingly
// common real-world case (airplane mode, no signal, wifi dropped). Anything
// wired through lib/api.ts already surfaces a real "couldn't reach the
// server" toast/StatusScreen on an actual failed request regardless of what
// this hook reports - this hook is for the ambient "you appear to be
// offline" banner, not the source of truth for whether a specific request
// will succeed.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
