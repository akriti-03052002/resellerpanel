export default function Table({ columns, rows, empty = "Nothing to show yet." }) {
  const hasRows = rows && rows.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="py-3 px-4 font-medium whitespace-nowrap">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            rows.map((row, i) => (
              <tr key={row._id || row.id || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="text-center py-16 text-slate-400 text-sm">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
