"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DeductionRecord = {
  employee: string;
  department: string;
  type: string;
  amount: string;
  status: "Reviewed" | "Pending";
};

const records: DeductionRecord[] = [
  {
    employee: "Maria Santos",
    department: "College of Education",
    type: "Late attendance",
    amount: "₱420.00",
    status: "Reviewed",
  },
  {
    employee: "Daniel Reyes",
    department: "Administrative Office",
    type: "Undertime",
    amount: "₱315.50",
    status: "Pending",
  },
  {
    employee: "Angela Cruz",
    department: "Senior High School",
    type: "Leave without pay",
    amount: "₱1,280.00",
    status: "Reviewed",
  },
  {
    employee: "Noel Mendoza",
    department: "Maintenance Unit",
    type: "Absence",
    amount: "₱860.00",
    status: "Pending",
  },
];

export function PayrollDeductionsTable() {
  const columns = useMemo<ColumnDef<DeductionRecord>[]>(
    () => [
      {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.employee}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.department}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Deduction",
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.amount}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "Reviewed" ? "secondary" : "outline"}
          >
            {row.original.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  // TanStack Table intentionally returns a mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


