export const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

export const toUtcStartOfDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const parseHolidayDateInput = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const yyyyMmDdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (yyyyMmDdMatch) {
    const year = Number(yyyyMmDdMatch[1]);
    const month = Number(yyyyMmDdMatch[2]);
    const day = Number(yyyyMmDdMatch[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  const parsed = new Date(raw);
  if (!isValidDate(parsed)) return null;
  return toUtcStartOfDay(parsed);
};

export const normalizeHolidayName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
};
