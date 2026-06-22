"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type DeductionRow = { employee: string; department: string; type: string; amount: string; status: string };
const columns: ColumnDef<DeductionRow>[] = [
  { accessorKey: "employee", header: "Employee", cell: ({ row }) => <div><p className="font-medium">{row.original.employee}</p><p className="text-xs text-muted-foreground">{row.original.department}</p></div> },
  { accessorKey: "type", header: "Deduction" },
  { accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className="font-mono font-medium">{row.original.amount}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
];
export function PayrollDeductionsTable({ records }: { records: DeductionRow[] }) {
  // TanStack Table intentionally returns a mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: records, columns, getCoreRowModel: getCoreRowModel() });
  return <Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No deductions recorded yet.</TableCell></TableRow>}</TableBody></Table>;
}