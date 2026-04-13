import prisma from "../config/prismaClient";
import { seedAcademicTerms } from "../config/academicTermsSeed";

async function main() {
  const result = await seedAcademicTerms(prisma);
  console.log(
    `Seeded academic terms for AY ${result.firstStartYear}-${result.firstStartYear + 1} through ${result.startYear}-${result.startYear + 1} (${result.termCount} terms).`
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed academic terms.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
