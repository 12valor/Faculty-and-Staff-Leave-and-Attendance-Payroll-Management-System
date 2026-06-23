"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import LoopRoundedIcon from "@mui/icons-material/LoopRounded";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { createWorkbook } from "@/lib/export/excel";

import {
  AttendanceReportTable,
  LeaveReportTable,
  PayrollReportTable,
  EmployeeReportTable,
  type AttendanceReportRow,
  type LeaveReportRow,
  type PayrollReportRow,
  type EmployeeReportRow,
} from "./report-tables";

type SummaryMetrics = {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingLeaves: number;
  approvedLeaves: number;
  payrollPeriodsCount: number;
};

type ReferenceData = {
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  payrollPeriods: { id: string; name: string; startDate: string; endDate: string }[];
};

type ReportsDashboardProps = {
  metrics: SummaryMetrics;
  references: ReferenceData;
  attendanceData: AttendanceReportRow[];
  leaveData: LeaveReportRow[];
  payrollData: PayrollReportRow[];
  employeeData: EmployeeReportRow[];
  defaultFrom: string;
  defaultTo: string;
};

export function ReportsDashboard({
  metrics,
  references,
  attendanceData,
  leaveData,
  payrollData,
  employeeData,
  defaultFrom,
  defaultTo,
}: ReportsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse current query values
  const currentTab = searchParams.get("tab") || "attendance";
  const currentFrom = searchParams.get("from") || defaultFrom;
  const currentTo = searchParams.get("to") || defaultTo;
  const currentType = searchParams.get("type") || "";
  const currentDept = searchParams.get("department") || "";
  const currentPos = searchParams.get("position") || "";
  const currentPeriod = searchParams.get("period") || "";

  // Cards layout
  const summaryCards = [
    { label: "Total Employees", value: metrics.totalEmployees, desc: "Active employees in database", icon: GroupsRoundedIcon, color: "text-primary bg-secondary" },
    { label: "Present Today", value: metrics.presentToday, desc: "Recorded present today", icon: EventAvailableRoundedIcon, color: "text-green-600 bg-green-50" },
    { label: "Absent Today", value: metrics.absentToday, desc: "Recorded absent today", icon: EventBusyRoundedIcon, color: "text-red-600 bg-red-50" },
    { label: "Late Today", value: metrics.lateToday, desc: "Late arrivals today", icon: AccessTimeFilledRoundedIcon, color: "text-amber-600 bg-amber-50" },
    { label: "Pending Leaves", value: metrics.pendingLeaves, desc: "Applications pending review", icon: HourglassEmptyRoundedIcon, color: "text-indigo-600 bg-indigo-50" },
    { label: "Approved Leaves", value: metrics.approvedLeaves, desc: "Total approved leaves", icon: CheckCircleRoundedIcon, color: "text-teal-600 bg-teal-50" },
    { label: "Payroll Records", value: metrics.payrollPeriodsCount, desc: "Total pay periods defined", icon: PaymentsRoundedIcon, color: "text-purple-600 bg-purple-50" },
  ];

  // Apply filters
  const handleApplyFilters = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());

    // Update query params
    params.set("from", formData.get("from") as string);
    params.set("to", formData.get("to") as string);
    params.set("type", formData.get("type") as string);
    params.set("department", formData.get("department") as string);
    params.set("position", formData.get("position") as string);
    if (currentTab === "payroll") {
      params.set("period", formData.get("period") as string);
    } else {
      params.delete("period");
    }

    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  };

  // Switch tabs
  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    
    // Clear period filter if switching away from payroll
    if (tab !== "payroll") {
      params.delete("period");
    }

    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  };

  // Print & PDF logic
  const handlePrint = () => {
    window.print();
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const filename = `Report_${currentTab}_${currentFrom}_to_${currentTo}`;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (currentTab === "attendance") {
      headers = ["Employee Name", "Employee Type", "Date", "Time In", "Time Out", "Status"];
      rows = attendanceData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.date,
        row.timeIn || "—",
        row.timeOut || "—",
        row.status + (row.isStatusOverridden ? " (Override)" : ""),
      ]);
    } else if (currentTab === "leave") {
      headers = ["Employee Name", "Leave Type", "Start Date", "End Date", "Reason", "Status"];
      rows = leaveData.map((row) => [
        row.employeeName,
        row.leaveType,
        row.startDate,
        row.endDate,
        row.reason || "—",
        row.status,
      ]);
    } else if (currentTab === "payroll") {
      headers = ["Employee Name", "Employee Type", "Pay Period", "Basic Pay", "Deductions", "Net Pay"];
      rows = payrollData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.payPeriod,
        row.basicPay.toFixed(2),
        row.deductions.toFixed(2),
        row.netPay.toFixed(2),
      ]);
    } else if (currentTab === "employee") {
      headers = ["Employee Name", "Employee Type", "Department", "Position", "Status", "Total Attendance Records", "Total Leaves"];
      rows = employeeData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.departmentName,
        row.positionName,
        row.status,
        row.totalAttendance.toString(),
        row.totalLeaves.toString(),
      ]);
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel Exporter using dynamic ExcelJS workbook helper
  const handleExportExcel = async () => {
    const filename = `Report_${currentTab}_${currentFrom}_to_${currentTo}`;
    const sheetName = `${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)} Report`;
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (currentTab === "attendance") {
      headers = ["Employee Name", "Employee Type", "Date", "Time In", "Time Out", "Status"];
      rows = attendanceData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.date,
        row.timeIn || "—",
        row.timeOut || "—",
        row.status + (row.isStatusOverridden ? " (Override)" : ""),
      ]);
    } else if (currentTab === "leave") {
      headers = ["Employee Name", "Leave Type", "Start Date", "End Date", "Reason", "Status"];
      rows = leaveData.map((row) => [
        row.employeeName,
        row.leaveType,
        row.startDate,
        row.endDate,
        row.reason || "—",
        row.status,
      ]);
    } else if (currentTab === "payroll") {
      headers = ["Employee Name", "Employee Type", "Pay Period", "Basic Pay", "Deductions", "Net Pay"];
      rows = payrollData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.payPeriod,
        row.basicPay,
        row.deductions,
        row.netPay,
      ]);
    } else if (currentTab === "employee") {
      headers = ["Employee Name", "Employee Type", "Department", "Position", "Status", "Total Attendance Records", "Total Leaves"];
      rows = employeeData.map((row) => [
        row.employeeName,
        row.employeeType,
        row.departmentName,
        row.positionName,
        row.status,
        row.totalAttendance,
        row.totalLeaves,
      ]);
    }

    try {
      const workbook = await createWorkbook(sheetName, (ws) => {
        // Add header row
        const headerRow = ws.addRow(headers);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" }, // Primary Blue
          };
        });

        // Add data rows
        rows.forEach((row) => {
          ws.addRow(row);
        });

        // Format column widths roughly
        ws.columns.forEach((col) => {
          col.width = 22;
        });

        // Specific formatting for Payroll Currency fields
        if (currentTab === "payroll") {
          ws.getColumn(4).numFmt = "₱#,##0.00";
          ws.getColumn(5).numFmt = "₱#,##0.00";
          ws.getColumn(6).numFmt = "₱#,##0.00";
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.xlsx`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Excel generation failed:", error);
    }
  };

  const getActiveTabTitle = () => {
    switch (currentTab) {
      case "attendance":
        return "Attendance Records Report";
      case "leave":
        return "Leave Requests Report";
      case "payroll":
        return "Payroll & Deductions Report";
      case "employee":
        return "Employee Overview & Totals Report";
      default:
        return "Report Table";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards panel (data-print-hidden matches other hidden elements) */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7" data-print-hidden="true">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="overflow-hidden border border-border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-[0.68rem] font-bold tracking-wide uppercase">
                  {card.label}
                </CardDescription>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-bold tracking-tight text-foreground">{card.value}</span>
                  <div className={`flex size-8 items-center justify-center rounded-md ${card.color}`}>
                    <Icon className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <p className="text-[0.65rem] text-muted-foreground line-clamp-1">{card.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b pb-1 border-border" data-print-hidden="true">
        {(["attendance", "leave", "payroll", "employee"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize -mb-[2px] ${
              currentTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab} Reports
          </button>
        ))}
      </div>

      {/* Filters Form */}
      <div className="filter-panel" data-print-hidden="true">
        <form onSubmit={handleApplyFilters} className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">From Date</span>
            <Input type="date" name="from" defaultValue={currentFrom} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">To Date</span>
            <Input type="date" name="to" defaultValue={currentTo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Employee Type</span>
            <NativeSelect name="type" defaultValue={currentType} className="w-full">
              <NativeSelectOption value="">All types</NativeSelectOption>
              <NativeSelectOption value="FACULTY">Faculty</NativeSelectOption>
              <NativeSelectOption value="STAFF">Staff</NativeSelectOption>
              <NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Department</span>
            <NativeSelect name="department" defaultValue={currentDept} className="w-full">
              <NativeSelectOption value="">All departments</NativeSelectOption>
              {references.departments.map((dept) => (
                <NativeSelectOption key={dept.id} value={dept.id}>
                  {dept.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Position</span>
            <NativeSelect name="position" defaultValue={currentPos} className="w-full">
              <NativeSelectOption value="">All positions</NativeSelectOption>
              {references.positions.map((pos) => (
                <NativeSelectOption key={pos.id} value={pos.id}>
                  {pos.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {/* Conditional Payroll Period filter */}
          {currentTab === "payroll" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Pay Period</span>
              <NativeSelect name="period" defaultValue={currentPeriod} className="w-full">
                <NativeSelectOption value="">All periods</NativeSelectOption>
                {references.payrollPeriods.map((per) => (
                  <NativeSelectOption key={per.id} value={per.id}>
                    {per.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="flex gap-2 sm:col-span-2 md:col-span-1">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <LoopRoundedIcon className="animate-spin size-4" /> : <FilterListRoundedIcon className="size-4" />}
                Generate
              </Button>
            </div>
          )}

          {currentTab === "payroll" && (
            <div className="flex gap-2 sm:col-span-2 md:col-span-1 lg:col-start-6">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <LoopRoundedIcon className="animate-spin size-4" /> : <FilterListRoundedIcon className="size-4" />}
                Generate
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Export actions (shown only on screen, hidden in print layout) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border" data-print-hidden="true">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Report Actions:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <PrintRoundedIcon className="size-4 mr-1.5" />
            Print Report
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <PictureAsPdfRoundedIcon className="size-4 mr-1.5" />
            Export to PDF
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <TableChartRoundedIcon className="size-4 mr-1.5" />
            Export CSV
          </Button>
          <Button onClick={handleExportExcel} variant="secondary" size="sm">
            <TableChartRoundedIcon className="size-4 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Report results container */}
      <div className="flex flex-col gap-4 relative">
        {/* Printable header, only visible when printing */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <h2 className="text-xl font-bold tracking-tight text-primary">Faculty and Staff Payroll System</h2>
          <h3 className="text-2xl font-extrabold tracking-tight mt-1 text-slate-800">{getActiveTabTitle()}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Generated on: {new Date().toLocaleString()} | Period: {currentFrom} to {currentTo}
          </p>
          <div className="grid grid-cols-4 gap-4 mt-4 bg-muted/20 p-3 rounded-lg border text-xs">
            <div>
              <span className="font-semibold block">Total Active Employees:</span> {metrics.totalEmployees}
            </div>
            <div>
              <span className="font-semibold block">Present Today:</span> {metrics.presentToday}
            </div>
            <div>
              <span className="font-semibold block">Absent Today:</span> {metrics.absentToday}
            </div>
            <div>
              <span className="font-semibold block">Pending Leaves:</span> {metrics.pendingLeaves}
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isPending && (
          <div className="absolute inset-0 bg-background/50 z-10 flex flex-col items-center justify-center min-h-[200px] rounded-xl backdrop-blur-xs">
            <div className="flex items-center gap-2.5 bg-card px-5 py-3 rounded-xl border shadow-sm">
              <LoopRoundedIcon className="animate-spin text-primary size-5" />
              <span className="text-sm font-semibold">Generating report data...</span>
            </div>
          </div>
        )}

        {/* Dynamic Table based on currentTab */}
        <div>
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {currentTab === "attendance" && <AttendanceReportTable data={attendanceData} />}
              {currentTab === "leave" && <LeaveReportTable data={leaveData} />}
              {currentTab === "payroll" && <PayrollReportTable data={payrollData} />}
              {currentTab === "employee" && <EmployeeReportTable data={employeeData} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
