"use client";

import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper to format status text
const formatStatus = (status: string) => {
  return status.replaceAll("_", " ");
};

// Common Empty State Component
function TableEmptyState({ message = "No records found matching the filters." }: { message?: string }) {
  return (
    <div className="py-12 border rounded-xl bg-card">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AssessmentRoundedIcon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>No data available</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

// 1. Attendance Reports Table
export type AttendanceReportRow = {
  id: string;
  employeeName: string;
  employeeType: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string;
  isStatusOverridden: boolean;
};

export function AttendanceReportTable({ data }: { data: AttendanceReportRow[] }) {
  if (!data.length) {
    return <TableEmptyState message="Try adjusting your date range or employee filters." />;
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "success";
      case "LATE":
      case "UNDERTIME":
        return "warning";
      case "ABSENT":
        return "destructive";
      case "ON_LEAVE":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="data-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead>Employee Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Time Out</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.employeeName}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatStatus(row.employeeType)}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.date}</TableCell>
              <TableCell className="font-mono text-xs">{row.timeIn || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{row.timeOut || "—"}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(row.status)}>
                  {formatStatus(row.status)}
                  {row.isStatusOverridden ? " (Override)" : ""}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// 2. Leave Reports Table
export type LeaveReportRow = {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
};

export function LeaveReportTable({ data }: { data: LeaveReportRow[] }) {
  if (!data.length) {
    return <TableEmptyState message="No leave requests matched your filter parameters." />;
  }

  const getLeaveStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "success";
      case "PENDING":
        return "warning";
      case "REJECTED":
      case "CANCELLED":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="data-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.employeeName}</TableCell>
              <TableCell>
                <Badge variant="secondary">{formatStatus(row.leaveType)}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.startDate}</TableCell>
              <TableCell className="font-mono text-xs">{row.endDate}</TableCell>
              <TableCell className="max-w-[280px] truncate" title={row.reason}>
                {row.reason || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={getLeaveStatusBadgeVariant(row.status)}>
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// 3. Payroll Reports Table
export type PayrollReportRow = {
  id: string;
  employeeName: string;
  employeeType: string;
  payPeriod: string;
  basicPay: number;
  deductions: number;
  netPay: number;
};

export function PayrollReportTable({ data }: { data: PayrollReportRow[] }) {
  if (!data.length) {
    return <TableEmptyState message="No payroll records generated for the chosen date range." />;
  }

  return (
    <div className="data-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead>Employee Type</TableHead>
            <TableHead>Pay Period</TableHead>
            <TableHead className="text-right">Basic Pay</TableHead>
            <TableHead className="text-right">Deductions</TableHead>
            <TableHead className="text-right">Net Pay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.employeeName}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatStatus(row.employeeType)}</Badge>
              </TableCell>
              <TableCell className="text-xs">{row.payPeriod}</TableCell>
              <TableCell className="font-mono text-right text-xs">
                {formatCurrency(row.basicPay)}
              </TableCell>
              <TableCell className="font-mono text-right text-xs text-destructive font-medium">
                -{formatCurrency(row.deductions)}
              </TableCell>
              <TableCell className="font-mono text-right text-xs font-semibold text-primary">
                {formatCurrency(row.netPay)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// 4. Employee Reports Table
export type EmployeeReportRow = {
  id: string;
  employeeName: string;
  employeeType: string;
  departmentName: string;
  positionName: string;
  status: string;
  totalAttendance: number;
  totalLeaves: number;
};

export function EmployeeReportTable({ data }: { data: EmployeeReportRow[] }) {
  if (!data.length) {
    return <TableEmptyState message="No employees match the specified filters." />;
  }

  return (
    <div className="data-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead>Employee Type</TableHead>
            <TableHead>Department / Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Total Attendance Records</TableHead>
            <TableHead className="text-center">Total Leaves (Approved)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.employeeName}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatStatus(row.employeeType)}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-xs font-medium">{row.departmentName}</span>
                <span className="text-xs text-muted-foreground"> · {row.positionName}</span>
              </TableCell>
              <TableCell>
                <Badge variant={row.status === "ACTIVE" ? "success" : "outline"}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-center text-xs">
                {row.totalAttendance}
              </TableCell>
              <TableCell className="font-mono text-center text-xs font-medium text-amber-700">
                {row.totalLeaves}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
