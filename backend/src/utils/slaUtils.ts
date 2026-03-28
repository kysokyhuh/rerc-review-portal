import { addWorkingDays as addWorkingDaysImpl, computeWorkingDaysBetween } from "./workingDays";

export function workingDaysBetween(
  start: Date,
  end: Date,
  holidays: Iterable<Date | string> = []
): number {
  return computeWorkingDaysBetween(start, end, holidays);
}

export function addWorkingDays(
  start: Date,
  days: number,
  holidays: Iterable<Date | string> = []
): Date {
  return addWorkingDaysImpl(start, days, holidays);
}
