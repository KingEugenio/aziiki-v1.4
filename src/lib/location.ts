/** Best-effort browser-side detection of the user's current IANA timezone
 * and ISO 3166-1 alpha-2 country code - used to prefill a new business's
 * home location, and to detect when a returning user is currently
 * somewhere other than "home" (see useTravelingUserBanner in App.tsx). */

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function detectBrowserCountryCode(): string | undefined {
  try {
    const locale = navigator.language || (navigator.languages && navigator.languages[0]);
    if (!locale) return undefined;
    const region = locale.split("-")[1];
    if (region && region.length === 2) return region.toUpperCase();
  } catch {
    // navigator unavailable (SSR, older browsers) - no default guess.
  }
  return undefined;
}

/** Human-readable label for a timezone difference, e.g. "3 hours ahead". */
export function describeTimezoneOffsetDiff(homeTimezone: string, currentTimezone: string): string | null {
  try {
    const now = new Date();
    const homeOffset = getOffsetMinutes(homeTimezone, now);
    const currentOffset = getOffsetMinutes(currentTimezone, now);
    const diffMinutes = currentOffset - homeOffset;
    if (diffMinutes === 0) return null;
    const hours = Math.abs(diffMinutes) / 60;
    const direction = diffMinutes > 0 ? "ahead of" : "behind";
    const hoursLabel = hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
    return `${hoursLabel} hour${hours === 1 ? "" : "s"} ${direction} your business's home timezone`;
  } catch {
    return null;
  }
}

function getOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - date.getTime()) / 60000;
}
