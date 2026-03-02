/**
 * One-time script to set default passwords for all users without a passwordHash.
 *
 * Usage:  cd backend && npx tsx scripts/seedPasswords.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prismaClient";

const DEFAULT_PASSWORD = "changeme123";
const BCRYPT_ROUNDS = 12;

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  const usersWithoutPassword = await prisma.user.findMany({
    where: { passwordHash: null },
    select: { id: true, email: true, fullName: true },
  });

  if (usersWithoutPassword.length === 0) {
    console.log("All users already have passwords set.");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { passwordHash: null },
    data: { passwordHash: hash },
  });

  console.log(`Updated ${result.count} user(s) with default password "${DEFAULT_PASSWORD}":\n`);
  for (const u of usersWithoutPassword) {
    console.log(`  ${u.email} (${u.fullName})`);
  }
  console.log("\nPlease change these passwords after first login.");
}

main()
  .catch((err) => {
    console.error("Failed to seed passwords:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
