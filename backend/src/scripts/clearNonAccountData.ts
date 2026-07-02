import "dotenv/config";

const CONFIRMATION = "DELETE_NON_ACCOUNT_DATA";

type TableGroup = {
  label: string;
  tables: string[];
};

const accountTables = ["User", "AuthSession"];

const operationalTables = [
  "WorkflowEvent",
  "LetterDraft",
  "SubmissionDecision",
  "SubmissionDocument",
  "ReviewAssignment",
  "Review",
  "SubmissionReminderLog",
  "SubmissionStatusHistory",
  "SubmissionChangeLog",
  "ClassificationVote",
  "ClassificationDecision",
  "Classification",
  "ProjectChangeLog",
  "ProjectSnapshot",
  "ProtocolMilestone",
  "ProtocolProfile",
  "ProjectMember",
  "ProjectProponent",
  "Proponent",
  "Submission",
  "ProjectStatusHistory",
  "Project",
  "ImportBatch",
  "AuditLog",
];

const setupTables = [
  "PanelMember",
  "CommitteeMember",
  "Panel",
  "Committee",
  "ConfigSLA",
  "ContractPeriod",
  "Holiday",
  "AcademicTerm",
];

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    confirmed: args.has(`--confirm=${CONFIRMATION}`),
    keepSetup: args.has("--keep-setup"),
    dryRun: args.has("--dry-run"),
  };
};

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const countRows = async (prisma: any, tables: string[]) => {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)}`
    )) as Array<{ count: bigint | number | string }>;
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
};

const printCounts = (title: string, counts: Record<string, number>) => {
  console.log(`\n${title}`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
};

const main = async () => {
  const { confirmed, keepSetup, dryRun } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Refusing to clear data without an explicit database target.");
  }

  const { default: prisma } = await import("../config/prismaClient");

  const groups: TableGroup[] = [
    { label: "operational data", tables: operationalTables },
    ...(keepSetup ? [] : [{ label: "setup data", tables: setupTables }]),
  ];
  const tablesToClear = groups.flatMap((group) => group.tables);
  const tablesToKeep = keepSetup ? [...accountTables, ...setupTables] : accountTables;

  try {
    const beforeClear = await countRows(prisma, tablesToClear);
    const beforeKeep = await countRows(prisma, tablesToKeep);

    printCounts("Rows that will be cleared", beforeClear);
    printCounts("Rows that will be kept", beforeKeep);

    if (dryRun) {
      console.log("\nDry run only. No data was deleted.");
      return;
    }

    if (!confirmed) {
      throw new Error(
        `Missing confirmation flag. Re-run with --confirm=${CONFIRMATION} to delete these rows.`
      );
    }

    const tableList = tablesToClear.map(quoteIdentifier).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

    const afterClear = await countRows(prisma, tablesToClear);
    const afterKeep = await countRows(prisma, tablesToKeep);

    printCounts("Rows cleared after reset", afterClear);
    printCounts("Rows kept after reset", afterKeep);
    console.log("\nDone. User accounts were preserved.");
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
