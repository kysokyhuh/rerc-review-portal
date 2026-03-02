const formatNumber = (value: number) => value.toLocaleString("en-US");

type WithdrawnRow = {
  key: string;
  label: string;
  withdrawn: number;
};

type WithdrawnTableProps = {
  rows: WithdrawnRow[];
  total: number;
};

export default function WithdrawnTable({ rows, total }: WithdrawnTableProps) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>Proponent Category</th>
            <th className="num">Withdrawn Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className="num">{formatNumber(row.withdrawn)}</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td>TOTAL</td>
            <td className="num">{formatNumber(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

