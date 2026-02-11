export type TermSelector = "ALL" | number;

export interface AcademicTermRecord {
  academicYear: string;
  term: number;
  startDate: Date;
  endDate: Date;
}

export interface ResolvedAcademicTermRange {
  academicYear: string;
  term: TermSelector;
  startDate: Date;
  endDate: Date;
  selectedTerms: number[];
}

export const listAcademicYears = (terms: AcademicTermRecord[]) => {
  const grouped = new Map<string, Set<number>>();
  for (const term of terms) {
    if (!grouped.has(term.academicYear)) {
      grouped.set(term.academicYear, new Set<number>());
    }
    grouped.get(term.academicYear)!.add(term.term);
  }

  return Array.from(grouped.entries())
    .map(([academicYear, termSet]) => ({
      academicYear,
      terms: Array.from(termSet.values()).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear));
};

export const resolveAcademicTermRange = (
  terms: AcademicTermRecord[],
  academicYear: string,
  term: TermSelector
): ResolvedAcademicTermRange => {
  const byYear = terms.filter((item) => item.academicYear === academicYear);
  if (byYear.length === 0) {
    throw new Error(`Academic year not found: ${academicYear}`);
  }

  if (term === "ALL") {
    const selectedTerms = byYear.map((item) => item.term).sort((a, b) => a - b);
    const startDate = byYear.reduce(
      (min, item) => (item.startDate < min ? item.startDate : min),
      byYear[0].startDate
    );
    const endDate = byYear.reduce(
      (max, item) => (item.endDate > max ? item.endDate : max),
      byYear[0].endDate
    );
    return {
      academicYear,
      term,
      startDate,
      endDate,
      selectedTerms,
    };
  }

  const selected = byYear.find((item) => item.term === term);
  if (!selected) {
    throw new Error(`Term ${term} not found for ${academicYear}`);
  }

  return {
    academicYear,
    term,
    startDate: selected.startDate,
    endDate: selected.endDate,
    selectedTerms: [selected.term],
  };
};

export const parseTermSelector = (value: unknown): TermSelector => {
  const raw = String(value ?? "ALL").trim().toUpperCase();
  if (!raw || raw === "ALL") return "ALL";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("term must be 1, 2, 3, or ALL");
  }
  return parsed;
};
