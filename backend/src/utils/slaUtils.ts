import { computeWorkingDaysBetween } from "./workingDays";

export function workingDaysBetween(
  start: Date,
  end: Date,
  holidays: Iterable<Date | string> = []
): number {
  return computeWorkingDaysBetween(start, end, holidays);
}
