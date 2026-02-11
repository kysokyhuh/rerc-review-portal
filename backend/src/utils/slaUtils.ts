import { computeWorkingDaysBetween } from "./workingDays";

export function workingDaysBetween(start: Date, end: Date): number {
  return computeWorkingDaysBetween(start, end);
}
