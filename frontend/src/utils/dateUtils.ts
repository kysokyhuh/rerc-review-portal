export function workingDaysBetween(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);

  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);

  let count = 0;
  while (s < e) {
    const day = s.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    s.setDate(s.getDate() + 1);
  }

  return count;
}

export function addWorkingDays(start: Date, days: number): Date {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return date;
}

export function formatDateDisplay(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(value: Date | null | undefined) {
  if (!value) return "never";
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
