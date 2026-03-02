const formatNumber = (value: number) => value.toLocaleString("en-US");

type OverviewRow = {
  label: string;
  received: number;
  exempted: number;
  expedited: number;
  fullReview: number;
  withdrawn: number;
};

type OverviewTableProps = {
  title: string;
  rows: OverviewRow[];
  totals: Omit<OverviewRow, "label">;
};

export default function OverviewTable({ title, rows, totals }: OverviewTableProps) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Group</th>
            <th className="num">Received</th>
            <th className="num">Exempted</th>
            <th className="num">Expedited</th>
            <th className="num">Full Review</th>
            <th className="num">Withdrawn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="num">{formatNumber(row.received)}</td>
              <td className="num">{formatNumber(row.exempted)}</td>
              <td className="num">{formatNumber(row.expedited)}</td>
              <td className="num">{formatNumber(row.fullReview)}</td>
              <td className="num">{formatNumber(row.withdrawn)}</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td>TOTAL</td>
            <td className="num">{formatNumber(totals.received)}</td>
            <td className="num">{formatNumber(totals.exempted)}</td>
            <td className="num">{formatNumber(totals.expedited)}</td>
            <td className="num">{formatNumber(totals.fullReview)}</td>
            <td className="num">{formatNumber(totals.withdrawn)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

