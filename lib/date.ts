export type PeriodLabel = "daily" | "weekly" | "monthly" | "yearly";

export function formatRelative(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;

  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName} · ${time}`;
}

export function formatPeriodLabel(period: PeriodLabel): string {
  const labels: Record<PeriodLabel, string> = {
    daily: "Today",
    weekly: "This Week",
    monthly: "This Month",
    yearly: "This Year",
  };
  return labels[period];
}

export function startOfPeriod(period: PeriodLabel): Date {
  const now = new Date();
  switch (period) {
    case "daily": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "weekly": {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "monthly": {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case "yearly": {
      return new Date(now.getFullYear(), 0, 1);
    }
  }
}
