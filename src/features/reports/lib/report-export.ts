import type {
  AttendanceReportRow,
  EmployeeReportRow,
  LeaveReportRow,
  PayrollReportRow,
} from "@/features/reports/components/report-tables";

export type ReportTab = "attendance" | "leave" | "payroll" | "employee";

export type ReportExportData = {
  attendanceData: AttendanceReportRow[];
  leaveData: LeaveReportRow[];
  payrollData: PayrollReportRow[];
  employeeData: EmployeeReportRow[];
};

export function getReportFilename(tab: string, from: string, to: string) {
  return `Report_${tab}_${from}_to_${to}`;
}

export function getReportExportRows(tab: string, data: ReportExportData) {
  if (tab === "attendance") {
    return {
      headers: ["Employee Name", "Employee Type", "Date", "Time In", "Time Out", "Status"],
      rows: data.attendanceData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.date,
        row.timeIn || "-",
        row.timeOut || "-",
        row.status + (row.isStatusOverridden ? " (Override)" : ""),
      ]),
    };
  }

  if (tab === "leave") {
    return {
      headers: ["Employee Name", "Leave Type", "Start Date", "End Date", "Reason", "Status"],
      rows: data.leaveData.map((row) => [
        row.employeeName,
        row.leaveType,
        row.startDate,
        row.endDate,
        row.reason || "-",
        row.status,
      ]),
    };
  }

  if (tab === "payroll") {
    return {
      headers: ["Employee Name", "Employee Type", "Pay Period", "Basic Pay", "Deductions", "Net Pay"],
      rows: data.payrollData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.payPeriod,
        row.basicPay.toFixed(2),
        row.deductions.toFixed(2),
        row.netPay.toFixed(2),
      ]),
    };
  }

  if (tab === "employee") {
    return {
      headers: ["Employee Name", "Employee Type", "Department", "Position", "Status", "Total Attendance Records", "Total Leaves"],
      rows: data.employeeData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.departmentName,
        row.positionName,
        row.status,
        row.totalAttendance.toString(),
        row.totalLeaves.toString(),
      ]),
    };
  }

  return { headers: [], rows: [] };
}

export function toCsv(headers: string[], rows: string[][]) {
  return [headers, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

