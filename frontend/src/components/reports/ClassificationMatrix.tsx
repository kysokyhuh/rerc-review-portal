const formatNumber = (value: number) => value.toLocaleString("en-US");

type MatrixRow = {
  key: string;
  label: string;
  exempted: number;
  expedited: number;
  fullReview: number;
  withdrawn: number;
  total: number;
};

type ClassificationMatrixProps = {
  rows: MatrixRow[];
  total: Omit<MatrixRow, "key" | "label">;
  onCellClick?: (filters: {
    category?: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => void;
};

export default function ClassificationMatrix({
  rows,
  total,
  onCellClick,
}: ClassificationMatrixProps) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>Proponent Category</th>
            <th className="num">Exempted</th>
            <th className="num">Expedited</th>
            <th className="num">Full Review</th>
            <th className="num">Withdrawn</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className="num">
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    onCellClick?.({
                      category: row.key as "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING",
                      reviewType: "EXEMPT",
                    })
                  }
                >
                  {formatNumber(row.exempted)}
                </button>
              </td>
              <td className="num">
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    onCellClick?.({
                      category: row.key as "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING",
                      reviewType: "EXPEDITED",
                    })
                  }
                >
                  {formatNumber(row.expedited)}
                </button>
              </td>
              <td className="num">
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    onCellClick?.({
                      category: row.key as "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING",
                      reviewType: "FULL_BOARD",
                    })
                  }
                >
                  {formatNumber(row.fullReview)}
                </button>
              </td>
              <td className="num">{formatNumber(row.withdrawn)}</td>
              <td className="num">{formatNumber(row.total)}</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td>TOTAL</td>
            <td className="num">{formatNumber(total.exempted)}</td>
            <td className="num">{formatNumber(total.expedited)}</td>
            <td className="num">{formatNumber(total.fullReview)}</td>
            <td className="num">{formatNumber(total.withdrawn)}</td>
            <td className="num">{formatNumber(total.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
