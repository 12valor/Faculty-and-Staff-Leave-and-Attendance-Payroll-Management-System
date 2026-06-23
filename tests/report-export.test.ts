import assert from "node:assert/strict";
import test from "node:test";

import { getReportExportRows, getReportFilename, toCsv } from "../src/features/reports/lib/report-export";

test("payroll report CSV export uses current payroll rows", () => {
  const exportRows = getReportExportRows("payroll", {
    attendanceData: [],
    leaveData: [],
    employeeData: [],
    payrollData: [{
      id: "payroll-1",
      employeeName: "Dela Cruz, Ana",
      employeeType: "FACULTY",
      payPeriod: "June 2026",
      basicPay: 22000,
      deductions: 500,
      netPay: 21500,
    }],
  });

  assert.deepEqual(exportRows.headers, ["Employee Name", "Employee Type", "Pay Period", "Basic Pay", "Deductions", "Net Pay"]);
  assert.deepEqual(exportRows.rows[0], ["Dela Cruz, Ana", "FACULTY", "June 2026", "22000.00", "500.00", "21500.00"]);
  assert.equal(
    toCsv(exportRows.headers, exportRows.rows),
    "\"Employee Name\",\"Employee Type\",\"Pay Period\",\"Basic Pay\",\"Deductions\",\"Net Pay\"\r\n\"Dela Cruz, Ana\",\"FACULTY\",\"June 2026\",\"22000.00\",\"500.00\",\"21500.00\"",
  );
  assert.equal(getReportFilename("payroll", "2026-06-01", "2026-06-30"), "Report_payroll_2026-06-01_to_2026-06-30");
});

