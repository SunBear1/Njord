interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-border ${className}`}>
      <table className="w-full text-sm text-left">
        {children}
      </table>
    </div>
  );
}

interface TableHeadProps {
  children: React.ReactNode;
}

export function TableHead({ children }: TableHeadProps) {
  return (
    <thead className="bg-bg-hover text-text-secondary text-xs uppercase tracking-wider">
      {children}
    </thead>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function TableRow({ children, className = '' }: TableRowProps) {
  return (
    <tr className={`border-b border-border last:border-0 ${className}`}>
      {children}
    </tr>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}

export function TableCell({ children, className = '', mono }: TableCellProps) {
  return (
    <td className={`px-4 py-3 text-text-primary ${mono ? 'font-mono' : ''} ${className}`}>
      {children}
    </td>
  );
}

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeaderCell({ children, className = '' }: TableHeaderCellProps) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      {children}
    </th>
  );
}
