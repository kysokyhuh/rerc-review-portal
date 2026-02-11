const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toUtcMidnight = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const toUtcDateKey = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildHolidayDateKeySet = (
  holidays: Iterable<Date | string>
): Set<string> => {
  const keys = new Set<string>();
  for (const holiday of holidays) {
    const parsed =
      typeof holiday === "string" ? new Date(holiday) : new Date(holiday);
    if (Number.isNaN(parsed.getTime())) continue;
    keys.add(toUtcDateKey(parsed));
  }
  return keys;
};

/**
 * Working day calculator used across SLA/report features.
 * Counts weekdays in [start, end), excluding provided holidays.
 */
export const computeWorkingDaysBetween = (
  start: Date,
  end: Date,
  holidays: Iterable<Date | string> = []
): number => {
  const startDate = toUtcMidnight(new Date(start));
  const endDate = toUtcMidnight(new Date(end));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  if (endDate <= startDate) {
    return 0;
  }

  const holidayKeys = buildHolidayDateKeySet(holidays);
  let count = 0;

  for (let cursor = startDate; cursor < endDate; ) {
    const day = cursor.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = holidayKeys.has(toUtcDateKey(cursor));
    if (!isWeekend && !isHoliday) {
      count += 1;
    }
    cursor = new Date(cursor.getTime() + ONE_DAY_MS);
  }

  return count;
};
