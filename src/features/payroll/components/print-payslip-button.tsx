"use client";

import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { Button } from "@/components/ui/button";
import type { LivePayrollResult } from "@/features/payroll/lib/live-payroll";
import { createWorkbook } from "@/lib/export/excel";

export function PrintPayslipButton({ payroll }: { payroll: LivePayrollResult }) {
  async function exportExcel() {
    const workbook = await createWorkbook("Payroll", (worksheet) => {
      worksheet.addRow(["Employee Payroll"]);
      worksheet.addRow(["Employee", payroll.employee.fullName]);
      worksheet.addRow(["Employee ID", payroll.employee.employeeNumber]);
      worksheet.addRow(["Department", payroll.employee.department]);
      worksheet.addRow(["Position", payroll.employee.position]);
      worksheet.addRow(["Pay period", payroll.period.label]);
      worksheet.addRow(["Start date", payroll.period.startDate]);
      worksheet.addRow(["End date", payroll.period.endDate]);
      worksheet.addRow([]);
      worksheet.addRow(["Earnings", "Amount"]);
      worksheet.addRow(["Prorated basic pay", payroll.earnings.basicPay]);
      worksheet.addRow(["Approved overtime", payroll.earnings.overtimePay]);
      worksheet.addRow(["Approved faculty overload", payroll.earnings.overloadPay]);
      worksheet.addRow(["Gross pay", payroll.earnings.grossPay]);
      worksheet.addRow([]);
      worksheet.addRow(["Deductions", "Amount"]);
      worksheet.addRow(["Late and undertime", deductionPart(payroll, "time")]);
      worksheet.addRow(["Absence", deductionPart(payroll, "absence")]);
      worksheet.addRow(["Leave without pay", deductionPart(payroll, "lwop")]);
      worksheet.addRow(["Total deductions", payroll.deductions.total]);
      worksheet.addRow(["Net pay", payroll.netPay]);

      if (payroll.deductionRows.length) {
        worksheet.addRow([]);
        worksheet.addRow(["Deduction breakdown"]);
        worksheet.addRow(["Date", "Reason", "Late minutes", "Undertime minutes", "Absence days", "LWOP days", "Day value", "Amount"]);
        payroll.deductionRows.forEach((row) => {
          worksheet.addRow([row.date, row.description, row.lateMinutes, row.undertimeMinutes, row.absenceDayValue, row.lwopDayValue, row.dayValue, row.amount]);
        });
      }

      if (payroll.overtimeRows.length) {
        worksheet.addRow([]);
        worksheet.addRow(["Overtime earnings"]);
        worksheet.addRow(["Date", "Hours", "Hourly rate", "Multiplier", "Amount"]);
        payroll.overtimeRows.forEach((row) => worksheet.addRow([row.date, row.hours, row.hourlyRate, row.multiplier, row.amount]));
      }

      if (payroll.overloadRows.length) {
        worksheet.addRow([]);
        worksheet.addRow(["Faculty overload earnings"]);
        worksheet.addRow(["Week start", "Week end", "Hours", "Hourly rate", "Amount"]);
        payroll.overloadRows.forEach((row) => worksheet.addRow([row.weekStart, row.weekEnd, row.hours, row.hourlyRate, row.amount]));
      }

      worksheet.columns.forEach((column) => {
        column.width = 22;
      });
      worksheet.getRow(1).font = { bold: true, size: 16 };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Payroll_${payroll.employee.employeeNumber}_${payroll.period.startDate}_to_${payroll.period.endDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={exportExcel}>
        <DownloadRoundedIcon data-icon="inline-start" />
        Export Excel
      </Button>
      <Button type="button" onClick={() => window.print()}>
        <PrintRoundedIcon data-icon="inline-start" />
        Print Payslip
      </Button>
    </div>
  );
}

function deductionPart(payroll: LivePayrollResult, kind: "time" | "absence" | "lwop") {
  return payroll.deductionRows
    .filter((row) => kind === "time"
      ? row.lateMinutes > 0 || row.undertimeMinutes > 0
      : kind === "absence"
        ? row.absenceDayValue > 0
        : row.lwopDayValue > 0)
    .reduce((sum, row) => sum + row.amount, 0);
}
