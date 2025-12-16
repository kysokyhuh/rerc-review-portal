// Very simple working-days calculator (Mon-Fri). Inclusive of start, exclusive of end.
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
