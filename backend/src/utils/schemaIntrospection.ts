import "dotenv/config";

type ColumnRow = {
  table_name: string;
  column_name: string;
};

type PgClient = {
  connect(): Promise<void>;
  query<T>(sql: string): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

const { Client } = require("pg") as {
  Client: new (config: { connectionString: string }) => PgClient;
};

let schemaColumnsPromise: Promise<Map<string, Set<string>>> | null = null;

const loadSchemaColumns = async () => {
  if (!process.env.DATABASE_URL) {
    return new Map<string, Set<string>>();
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const result = await client.query<ColumnRow>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `);

    const tableColumns = new Map<string, Set<string>>();

    for (const row of result.rows) {
      const existing = tableColumns.get(row.table_name) ?? new Set<string>();
      existing.add(row.column_name);
      tableColumns.set(row.table_name, existing);
    }

    return tableColumns;
  } finally {
    await client.end().catch(() => {});
  }
};

const getSchemaColumns = async () => {
  if (!schemaColumnsPromise) {
    schemaColumnsPromise = loadSchemaColumns().catch((error) => {
      schemaColumnsPromise = null;
      throw error;
    });
  }

  return schemaColumnsPromise;
};

export async function hasTableColumns(tableName: string, columns: readonly string[]) {
  const schemaColumns = await getSchemaColumns();
  const tableColumns = schemaColumns.get(tableName);

  if (!tableColumns) {
    return false;
  }

  return columns.every((column) => tableColumns.has(column));
}
