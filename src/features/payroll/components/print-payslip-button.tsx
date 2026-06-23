"use client";

import { useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import LoopRoundedIcon from "@mui/icons-material/LoopRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import type { LivePayrollResult } from "@/features/payroll/lib/live-payroll";
import { downloadBlob, printElement } from "@/lib/export/browser";
import { createWorkbook } from "@/lib/export/excel";

export function PrintPayslipButton({ payroll }: { payroll: LivePayrollResult }) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportExcel() {
    if (isExporting) return;
    setIsExporting(true);

    try {
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
        worksheet.addRow(["Late threshold penalties", deductionPart(payroll, "late")]);
        worksheet.addRow(["Undertime (no deduction)", 0]);
        worksheet.addRow(["Absence", deductionPart(payroll, "absence")]);
        worksheet.addRow(["Leave without pay", deductionPart(payroll, "lwop")]);
        worksheet.addRow(["Total deductions", payroll.deductions.total]);
        worksheet.addRow(["Net pay", payroll.netPay]);

        if (payroll.deductionRows.length) {
          worksheet.addRow([]);
          worksheet.addRow(["Deduction breakdown"]);
          worksheet.addRow(["Date", "Reason", "Late minutes", "Undertime minutes", "Absence days", "LWOP days", "Penalty units", "Amount"]);
          payroll.deductionRows.forEach((row) => {
            worksheet.addRow([row.date, row.description, row.lateMinutes, row.undertimeMinutes, row.absenceDayValue, row.lwopDayValue, row.dayValue, row.amount]);
          });
        }

        if (payroll.overtimeRows.length) {
          worksheet.addRow([]);
          worksheet.addRow(["Overtime earnings"]);
          worksheet.addRow(["Date", "Hours", "Amount"]);
          payroll.overtimeRows.forEach((row) => worksheet.addRow([row.date, row.hours, row.amount]));
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
      const filename = `Payroll_${payroll.employee.employeeNumber}_${payroll.period.startDate}_to_${payroll.period.endDate}.xlsx`;
      downloadBlob(blob, filename);
      toast.success("Payroll Excel file downloaded.");
    } catch (error) {
      console.error("Payroll Excel generation failed:", error);
      toast.error("Could not export payroll to Excel. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function printPayroll() {
    try {
      printElement(
        "[data-payslip]",
        `Payroll ${payroll.employee.employeeNumber} - ${payroll.period.label}`,
      );
    } catch (error) {
      console.error("Payroll printing failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not open the payroll print window.",
      );
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonVariants({ variant: "outline" })} onClick={exportExcel} disabled={isExporting}>
        {isExporting ? <LoopRoundedIcon data-icon="inline-start" className="animate-spin" /> : <DownloadRoundedIcon data-icon="inline-start" />}
        {isExporting ? "Exporting..." : "Export Excel"}
      </button>
      <button type="button" className={buttonVariants({ variant: "default" })} onClick={printPayroll}>
        <PrintRoundedIcon data-icon="inline-start" />
        Print Payroll
      </button>
    </div>
  );
}

function deductionPart(payroll: LivePayrollResult, kind: "late" | "absence" | "lwop") {
  return payroll.deductionRows
    .filter((row) => kind === "late"
      ? row.lateMinutes > 0 && row.absenceDayValue === 0 && row.lwopDayValue === 0
      : kind === "absence"
        ? row.absenceDayValue > 0
        : row.lwopDayValue > 0)
    .reduce((sum, row) => sum + row.amount, 0);
}
