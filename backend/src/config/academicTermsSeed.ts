import prisma from "./prismaClient";

type AcademicTermSeedClient = Pick<typeof prisma, "academicTerm">;

export type AcademicTermSeedRecord = {
  academicYear: string;
  term: number;
  startDate: Date;
  endDate: Date;
};

export const buildAcademicTermSeedRecords = (
  referenceDate: Date = new Date()
): {
  firstStartYear: number;
  startYear: number;
  terms: AcademicTermSeedRecord[];
} => {
  const currentYear = referenceDate.getUTCFullYear();
  // AY starts in September (Term 1), so Jan-Aug belongs to the previous AY start year.
  const startYear = referenceDate.getUTCMonth() >= 8 ? currentYear : currentYear - 1;
  const firstStartYear = startYear - 4;
  const terms: AcademicTermSeedRecord[] = [];

  for (let ayStartYear = firstStartYear; ayStartYear <= startYear; ayStartYear += 1) {
    const ayLabel = `${ayStartYear}-${ayStartYear + 1}`;
    terms.push(
      {
        academicYear: ayLabel,
        term: 1,
        startDate: new Date(Date.UTC(ayStartYear, 8, 1)),
        endDate: new Date(Date.UTC(ayStartYear, 11, 31)),
      },
      {
        academicYear: ayLabel,
        term: 2,
        startDate: new Date(Date.UTC(ayStartYear + 1, 0, 1)),
        endDate: new Date(Date.UTC(ayStartYear + 1, 3, 30)),
      },
      {
        academicYear: ayLabel,
        term: 3,
        startDate: new Date(Date.UTC(ayStartYear + 1, 4, 1)),
        endDate: new Date(Date.UTC(ayStartYear + 1, 7, 31)),
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
