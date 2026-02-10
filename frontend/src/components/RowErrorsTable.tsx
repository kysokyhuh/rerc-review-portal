import type { ImportRowError } from "@/types";

interface RowErrorsTableProps {
  errors: ImportRowError[];
  maxDisplay?: number;
}

export function RowErrorsTable({ errors, maxDisplay = 50 }: RowErrorsTableProps) {
  if (errors.length === 0) return null;
  const visibleErrors = errors.slice(0, maxDisplay);

  return (
    <section className="import-errors" aria-labelledby="row-errors-title">
      <div className="import-errors-header">
        <h3 id="row-errors-title">Failed rows</h3>
        <p>Showing first {visibleErrors.length} of {errors.length} error(s).</p>
      </div>
      <div className="import-errors-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Field</th>
              <th scope="col">Message</th>
            </tr>
          </thead>
          <tbody>
            {visibleErrors.map((error, index) => (
              <tr key={`${error.row}-${error.field}-${index}`}>
                <td>{error.row}</td>
                <td>{error.field}</td>
                <td>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
