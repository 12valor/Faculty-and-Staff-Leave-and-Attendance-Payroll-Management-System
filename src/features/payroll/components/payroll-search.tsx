import Link from "next/link";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PayrollEmployee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department: string;
  position: string;
  status: string;
};

export function PayrollSearch({ search, periodLabel, payrollReady, employees }: { search: string; periodLabel: string; payrollReady: boolean; employees: PayrollEmployee[] }) {
  return (
    <div className="flex flex-col gap-5">
      {!payrollReady ? (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center">
          <div><p className="font-semibold">Payroll setup required</p><p className="mt-1 text-sm">Set the faculty overload hourly rate before opening a full payslip.</p></div>
          <Button nativeButton={false} render={<Link href="/settings" />} variant="outline">Open Settings</Button>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Find employee payroll</CardTitle>
          <CardDescription>Live payroll for {periodLabel}. Search by employee number, first name, or last name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input name="search" defaultValue={search} placeholder="Search employee name or ID" aria-label="Search employee name or ID" className="flex-1" />
            <Button type="submit"><SearchRoundedIcon data-icon="inline-start" />Search</Button>
          </form>
        </CardContent>
      </Card>
      {search ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {employees.length ? employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono font-medium">{employee.employeeNumber}</TableCell>
                  <TableCell><p className="font-medium">{employee.fullName}</p><p className="text-xs text-muted-foreground">{employee.department} | {employee.position}</p></TableCell>
                  <TableCell><Badge variant="secondary">{employee.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/payroll/${employee.id}`} />} size="sm" disabled={!payrollReady}><VisibilityRoundedIcon data-icon="inline-start" />View Payroll</Button></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">No current-month employees match “{search}”.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center"><SearchRoundedIcon className="text-muted-foreground" /><p className="mt-3 font-medium">Search to view payroll</p><p className="mt-1 text-sm text-muted-foreground">Only employees whose service overlaps the current month are shown.</p></div>
      )}
    </div>
  );
}
