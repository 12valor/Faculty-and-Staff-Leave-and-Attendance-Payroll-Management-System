-- This migration preserves Phase 1-2 rows while normalizing them into the
-- Phase 3 summary/detail and approval-status structures.
-- Its timestamp intentionally follows the checked-in Phase 1-2 migration.
-- CreateTable
CREATE TABLE "LeaveAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaveRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dayValue" DECIMAL NOT NULL,
    "paidDayValue" DECIMAL NOT NULL DEFAULT 0,
    "unpaidDayValue" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveAllocation_leaveRecordId_fkey" FOREIGN KEY ("leaveRecordId") REFERENCES "LeaveRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyLeaveCreditGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "serviceDays" DECIMAL NOT NULL,
    "lwopDays" DECIMAL NOT NULL,
    "vacationEarned" DECIMAL NOT NULL,
    "sickEarned" DECIMAL NOT NULL,
    "oldVacationBalance" DECIMAL NOT NULL,
    "oldSickBalance" DECIMAL NOT NULL,
    "newVacationBalance" DECIMAL NOT NULL,
    "newSickBalance" DECIMAL NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyLeaveCreditGeneration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyLeaveCreditGeneration_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollDeductionBreakdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollDeductionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "leaveAllocationId" TEXT,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "absenceDayValue" DECIMAL NOT NULL DEFAULT 0,
    "lwopDayValue" DECIMAL NOT NULL DEFAULT 0,
    "dayValue" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollDeductionBreakdown_payrollDeductionId_fkey" FOREIGN KEY ("payrollDeductionId") REFERENCES "PayrollDeduction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollDeductionBreakdown_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PayrollDeductionBreakdown_leaveAllocationId_fkey" FOREIGN KEY ("leaveAllocationId") REFERENCES "LeaveAllocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "employeeType" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "monthlySalary" DECIMAL NOT NULL DEFAULT 0,
    "serviceStartDate" TEXT NOT NULL DEFAULT '2000-01-01',
    "serviceEndDate" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("createdAt", "departmentId", "employeeNumber", "employeeType", "employmentStatus", "firstName", "id", "lastName", "middleName", "monthlySalary", "positionId", "remarks", "serviceStartDate", "suffix", "updatedAt") SELECT "createdAt", "departmentId", "employeeNumber", "employeeType", "employmentStatus", "firstName", "id", "lastName", "middleName", "monthlySalary", "positionId", "remarks", substr("createdAt", 1, 10), "suffix", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");
CREATE INDEX "Employee_employeeType_idx" ON "Employee"("employeeType");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");
CREATE INDEX "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");
CREATE TABLE "new_LeaveRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "numberOfDays" DECIMAL NOT NULL,
    "paidDays" DECIMAL NOT NULL DEFAULT 0,
    "unpaidDays" DECIMAL NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "remarks" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "approvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LeaveRecord" ("approvedAt", "createdAt", "employeeId", "endDate", "id", "isPaid", "leaveType", "numberOfDays", "paidDays", "unpaidDays", "reason", "remarks", "startDate", "status", "updatedAt") SELECT "approvedAt", "createdAt", "employeeId", "endDate", "id", "isPaid", "leaveType", "numberOfDays", CASE WHEN "status" = 'APPROVED' AND "isPaid" = 1 THEN "numberOfDays" ELSE 0 END, CASE WHEN "status" = 'APPROVED' AND "isPaid" = 0 THEN "numberOfDays" ELSE 0 END, "reason", "remarks", "startDate", "status", "updatedAt" FROM "LeaveRecord";
DROP TABLE "LeaveRecord";
ALTER TABLE "new_LeaveRecord" RENAME TO "LeaveRecord";
CREATE INDEX "LeaveRecord_employeeId_startDate_endDate_idx" ON "LeaveRecord"("employeeId", "startDate", "endDate");
CREATE INDEX "LeaveRecord_status_idx" ON "LeaveRecord"("status");
WITH RECURSIVE legacy_leave_dates(leaveRecordId, employeeId, date, endDate, remaining, isPaid, status) AS (
  SELECT id, employeeId, startDate, endDate, CAST(numberOfDays AS REAL), isPaid, status FROM LeaveRecord WHERE CAST(numberOfDays AS REAL) > 0
  UNION ALL
  SELECT leaveRecordId, employeeId, date(date, '+1 day'), endDate, remaining - MIN(1.0, remaining), isPaid, status
  FROM legacy_leave_dates
  WHERE remaining > 1.0 AND date < endDate
)
INSERT INTO LeaveAllocation (id, leaveRecordId, employeeId, date, dayValue, paidDayValue, unpaidDayValue, updatedAt)
SELECT 'legacy-' || leaveRecordId || '-' || date, leaveRecordId, employeeId, date, MIN(1.0, remaining), CASE WHEN status = 'APPROVED' AND isPaid = 1 THEN MIN(1.0, remaining) ELSE 0 END, CASE WHEN status = 'APPROVED' AND isPaid = 0 THEN MIN(1.0, remaining) ELSE 0 END, CURRENT_TIMESTAMP
FROM legacy_leave_dates;
CREATE TABLE "new_LeaveTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "leaveRecordId" TEXT,
    "generationId" TEXT,
    "transactionType" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "balanceAfter" DECIMAL NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveTransaction_leaveRecordId_fkey" FOREIGN KEY ("leaveRecordId") REFERENCES "LeaveRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeaveTransaction_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "MonthlyLeaveCreditGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LeaveTransaction" ("amount", "balanceAfter", "createdAt", "description", "employeeId", "id", "leaveRecordId", "leaveType", "transactionType") SELECT "amount", "balanceAfter", "createdAt", "description", "employeeId", "id", "leaveRecordId", "leaveType", "transactionType" FROM "LeaveTransaction";
DROP TABLE "LeaveTransaction";
ALTER TABLE "new_LeaveTransaction" RENAME TO "LeaveTransaction";
CREATE INDEX "LeaveTransaction_employeeId_createdAt_idx" ON "LeaveTransaction"("employeeId", "createdAt");
CREATE TABLE "new_OverloadRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "totalTeachingHours" DECIMAL NOT NULL,
    "regularLoadHours" DECIMAL NOT NULL,
    "overloadHours" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OverloadRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OverloadRecord_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OverloadRecord" ("amount", "createdAt", "employeeId", "id", "overloadHours", "regularLoadHours", "remarks", "status", "totalTeachingHours", "updatedAt", "weekEnd", "weekStart")
SELECT amount, createdAt, employeeId, id, MAX(0, CAST(teachingHours AS REAL) - 18), 18, remarks, CASE WHEN isApproved = 1 THEN 'APPROVED' ELSE 'PENDING' END, teachingHours, updatedAt, date(createdAt, printf('+%d days', 6 + ROW_NUMBER() OVER (PARTITION BY employeeId, date(createdAt) ORDER BY id) - 1)), date(createdAt, printf('+%d days', ROW_NUMBER() OVER (PARTITION BY employeeId, date(createdAt) ORDER BY id) - 1)) FROM OverloadRecord;
DROP TABLE "OverloadRecord";
ALTER TABLE "new_OverloadRecord" RENAME TO "OverloadRecord";
CREATE INDEX "OverloadRecord_weekStart_weekEnd_idx" ON "OverloadRecord"("weekStart", "weekEnd");
CREATE INDEX "OverloadRecord_status_idx" ON "OverloadRecord"("status");
CREATE UNIQUE INDEX "OverloadRecord_employeeId_weekStart_key" ON "OverloadRecord"("employeeId", "weekStart");
CREATE TABLE "new_OvertimeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "hours" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OvertimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OvertimeRecord_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OvertimeRecord_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT OR IGNORE INTO AttendanceRecord (id, employeeId, date, entryMethod, computedStatus, status, overtimeMinutes, deductionDayValue, deductionAmount, createdAt, updatedAt)
SELECT 'legacy-overtime-' || id, employeeId, date, 'ADMIN_MANUAL', 'PRESENT', 'PRESENT', minutes, 0, 0, createdAt, updatedAt FROM OvertimeRecord;
INSERT INTO "new_OvertimeRecord" ("amount", "attendanceRecordId", "createdAt", "date", "employeeId", "hours", "id", "minutes", "remarks", "status", "updatedAt") SELECT overtime.amount, attendance.id, overtime.createdAt, overtime.date, overtime.employeeId, overtime.hours, overtime.id, overtime.minutes, overtime.remarks, CASE WHEN overtime.isApproved = 1 THEN 'APPROVED' ELSE 'PENDING' END, overtime.updatedAt FROM OvertimeRecord overtime JOIN AttendanceRecord attendance ON attendance.employeeId = overtime.employeeId AND attendance.date = overtime.date;
DROP TABLE "OvertimeRecord";
ALTER TABLE "new_OvertimeRecord" RENAME TO "OvertimeRecord";
CREATE UNIQUE INDEX "OvertimeRecord_attendanceRecordId_key" ON "OvertimeRecord"("attendanceRecordId");
CREATE INDEX "OvertimeRecord_employeeId_date_idx" ON "OvertimeRecord"("employeeId", "date");
CREATE INDEX "OvertimeRecord_status_idx" ON "OvertimeRecord"("status");
CREATE TABLE "new_PayrollDeduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monthlySalary" DECIMAL NOT NULL,
    "dailyRate" DECIMAL NOT NULL,
    "totalLateMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalUndertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "absenceDays" DECIMAL NOT NULL DEFAULT 0,
    "lwopDays" DECIMAL NOT NULL DEFAULT 0,
    "dayValue" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollDeduction_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TEMP TABLE "legacy_PayrollDeduction" AS SELECT * FROM "PayrollDeduction";
INSERT INTO "new_PayrollDeduction" ("absenceDays", "amount", "createdAt", "dailyRate", "dayValue", "employeeId", "id", "lwopDays", "monthlySalary", "payrollPeriodId", "remarks", "updatedAt")
SELECT SUM(CASE WHEN upper(legacy.deductionType) LIKE '%ABSEN%' THEN CAST(legacy.dayValue AS REAL) ELSE 0 END), SUM(CAST(legacy.amount AS REAL)), MIN(legacy.createdAt), CAST(employee.monthlySalary AS REAL) / COALESCE(NULLIF(CAST((SELECT value FROM SystemSetting WHERE key = 'workingDaysPerMonth') AS REAL), 0), 22), SUM(CAST(legacy.dayValue AS REAL)), legacy.employeeId, MIN(legacy.id), SUM(CASE WHEN upper(legacy.deductionType) LIKE '%LWOP%' OR upper(legacy.deductionType) LIKE '%WITHOUT_PAY%' THEN CAST(legacy.dayValue AS REAL) ELSE 0 END), employee.monthlySalary, legacy.payrollPeriodId, group_concat(legacy.remarks, '; '), MAX(legacy.updatedAt)
FROM legacy_PayrollDeduction legacy JOIN Employee employee ON employee.id = legacy.employeeId GROUP BY legacy.payrollPeriodId, legacy.employeeId;
DROP TABLE "PayrollDeduction";
ALTER TABLE "new_PayrollDeduction" RENAME TO "PayrollDeduction";
CREATE INDEX "PayrollDeduction_employeeId_idx" ON "PayrollDeduction"("employeeId");
CREATE UNIQUE INDEX "PayrollDeduction_payrollPeriodId_employeeId_key" ON "PayrollDeduction"("payrollPeriodId", "employeeId");
INSERT INTO PayrollDeductionBreakdown (id, payrollDeductionId, date, source, attendanceRecordId, lateMinutes, undertimeMinutes, absenceDayValue, lwopDayValue, dayValue, amount, description)
SELECT 'legacy-payroll-' || MIN(legacy.id), (SELECT MIN(summary.id) FROM legacy_PayrollDeduction summary WHERE summary.payrollPeriodId = legacy.payrollPeriodId AND summary.employeeId = legacy.employeeId), COALESCE(attendance.date, period.startDate), CASE WHEN upper(group_concat(legacy.deductionType)) LIKE '%LWOP%' OR upper(group_concat(legacy.deductionType)) LIKE '%WITHOUT_PAY%' THEN 'LEAVE_WITHOUT_PAY' ELSE 'ATTENDANCE' END, MAX(legacy.attendanceRecordId), MAX(COALESCE(attendance.lateMinutes, 0)), MAX(COALESCE(attendance.undertimeMinutes, 0)), SUM(CASE WHEN upper(legacy.deductionType) LIKE '%ABSEN%' THEN CAST(legacy.dayValue AS REAL) ELSE 0 END), SUM(CASE WHEN upper(legacy.deductionType) LIKE '%LWOP%' OR upper(legacy.deductionType) LIKE '%WITHOUT_PAY%' THEN CAST(legacy.dayValue AS REAL) ELSE 0 END), SUM(CAST(legacy.dayValue AS REAL)), SUM(CAST(legacy.amount AS REAL)), group_concat(legacy.deductionType, ', ')
FROM legacy_PayrollDeduction legacy JOIN PayrollPeriod period ON period.id = legacy.payrollPeriodId LEFT JOIN AttendanceRecord attendance ON attendance.id = legacy.attendanceRecordId GROUP BY legacy.payrollPeriodId, legacy.employeeId, COALESCE(attendance.date, period.startDate);
DROP TABLE legacy_PayrollDeduction;
CREATE TABLE "new_PayrollPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "generatedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PayrollPeriod" ("createdAt", "createdById", "endDate", "generatedAt", "id", "lockedAt", "name", "startDate", "status", "updatedAt") SELECT "createdAt", (SELECT id FROM AdminUser ORDER BY createdAt LIMIT 1), "endDate", "generatedAt", "id", "lockedAt", "name", "startDate", "status", "updatedAt" FROM "PayrollPeriod";
DROP TABLE "PayrollPeriod";
ALTER TABLE "new_PayrollPeriod" RENAME TO "PayrollPeriod";
CREATE UNIQUE INDEX "PayrollPeriod_name_key" ON "PayrollPeriod"("name");
CREATE INDEX "PayrollPeriod_startDate_endDate_idx" ON "PayrollPeriod"("startDate", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LeaveAllocation_employeeId_date_idx" ON "LeaveAllocation"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveAllocation_leaveRecordId_date_key" ON "LeaveAllocation"("leaveRecordId", "date");

-- CreateIndex
CREATE INDEX "MonthlyLeaveCreditGeneration_year_month_idx" ON "MonthlyLeaveCreditGeneration"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyLeaveCreditGeneration_employeeId_year_month_key" ON "MonthlyLeaveCreditGeneration"("employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollDeductionBreakdown_attendanceRecordId_idx" ON "PayrollDeductionBreakdown"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "PayrollDeductionBreakdown_leaveAllocationId_idx" ON "PayrollDeductionBreakdown"("leaveAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDeductionBreakdown_payrollDeductionId_date_key" ON "PayrollDeductionBreakdown"("payrollDeductionId", "date");
