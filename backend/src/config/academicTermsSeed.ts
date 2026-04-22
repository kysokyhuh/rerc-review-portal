import prisma from "./prismaClient";

type AcademicTermSeedClient = Pick<typeof prisma, "academicTerm">;

export type AcademicTermSeedRecord = {
  academicYear: string;
  term: number;
  startDate: Date;
  endDate: Date;
};

const toUtcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));

const CUSTOM_TERM_DATES: Record<
  string,
  Array<{ term: number; startDate: Date; endDate: Date }>
> = {
  "2023-2024": [
    { term: 1, startDate: toUtcDate(2023, 9, 24), endDate: toUtcDate(2023, 12, 11) },
    { term: 2, startDate: toUtcDate(2024, 1, 8), endDate: toUtcDate(2024, 4, 16) },
    { term: 3, startDate: toUtcDate(2024, 5, 2), endDate: toUtcDate(2024, 8, 9) },
  ],
  "2024-2025": [
    { term: 1, startDate: toUtcDate(2024, 9, 2), endDate: toUtcDate(2024, 12, 9) },
    { term: 2, startDate: toUtcDate(2025, 1, 6), endDate: toUtcDate(2025, 4, 12) },
    { term: 3, startDate: toUtcDate(2025, 5, 5), endDate: toUtcDate(2025, 8, 13) },
  ],
};

export const buildAcademicTermSeedRecords = (
  referenceDate: Date = new Date()
): {
  firstStartYear: number;
  startYear: number;
  terms: AcademicTermSeedRecord[];
} => {
  const currentYear = referenceDate.getUTCFullYear();
  // Reporting AY labels follow the calendar year of the raw submission date.
  // Examples:
  // - 2023-02-13 => Term 2, AY 2023-2024
  // - 2024-10-18 => Term 1, AY 2024-2025
  const startYear = currentYear;
  const firstStartYear = startYear - 4;
  const terms: AcademicTermSeedRecord[] = [];

  for (let ayStartYear = firstStartYear; ayStartYear <= startYear; ayStartYear += 1) {
    const ayLabel = `${ayStartYear}-${ayStartYear + 1}`;
    const customTerms = CUSTOM_TERM_DATES[ayLabel];
    if (customTerms) {
      terms.push(
        ...customTerms.map((term) => ({
          academicYear: ayLabel,
          term: term.term,
          startDate: term.startDate,
          endDate: term.endDate,
        }))
      );
      continue;
    }

    terms.push(
      {
        academicYear: ayLabel,
        term: 2,
        startDate: new Date(Date.UTC(ayStartYear, 0, 1)),
        endDate: new Date(Date.UTC(ayStartYear, 3, 30)),
      },
      {
        academicYear: ayLabel,
        term: 3,
        startDate: new Date(Date.UTC(ayStartYear, 4, 1)),
        endDate: new Date(Date.UTC(ayStartYear, 7, 31)),
      },
      {
        academicYear: ayLabel,
        term: 1,
        startDate: new Date(Date.UTC(ayStartYear, 8, 1)),
        endDate: new Date(Date.UTC(ayStartYear, 11, 31)),
      }
    );
  }

  return { firstStartYear, startYear, terms };
};

export async function seedAcademicTerms(
  client: AcademicTermSeedClient = prisma,
  referenceDate: Date = new Date()
) {
  const { firstStartYear, startYear, terms } = buildAcademicTermSeedRecords(referenceDate);

  for (const term of terms) {
    await client.academicTerm.upsert({
      where: {
        academicYear_term: {
          academicYear: term.academicYear,
          term: term.term,
        },
      },
      update: {
        startDate: term.startDate,
        endDate: term.endDate,
      },
      create: term,
    });
  }

  return {
    firstStartYear,
    startYear,
    termCount: terms.length,
  };
}
