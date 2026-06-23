"use server";

import { revalidatePath } from "next/cache";

import { leaveCreditPeriodSchema, leaveRecordSchema, type LeaveRecordValues } from "@/features/leave/schemas/leave-schema";
import { computeMonthlyLeaveCredit, getServiceDaysForMonth, splitPaidAndUnpaidDays } from "@/lib/calculations/leave";
import { createAuditLog } from "@/lib/audit";
import { getActionAdmin } from "@/lib/server-action";
import { getDayOfWeek, inclusiveDates } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export async function getScheduledLeaveDatesAction(employeeId: string, startDate: string, endDate: string) {
  const auth = await getActionAdmin();
  if (!auth.ok) return auth;

  if (!employeeId || !startDate || !endDate || endDate < startDate) return { ok: false, error: "Select a valid employee and date range." };
  try {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId }, include: { workSchedules: { where: { isActive: true } }, facultySchedules: { where: { isActive: true } } } });
    if (!employee) return { ok: false, error: "Employee was not found." };
    const dates = inclusiveDates(startDate, endDate).filter((date) => {
      const work = employee.employeeType === "FACULTY" ? [] : employee.workSchedules;
      const faculty = employee.employeeType === "STAFF" ? [] : employee.facultySchedules;
      return [...work, ...faculty].some((row) => row.dayOfWeek === getDayOfWeek(date) && row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo >= date));
    });
    return { ok: true, dates };
  } catch {
    return { ok: false, error: "Unable to load scheduled leave dates." };
  }
}
export async function createLeaveRecordAction(values: LeaveRecordValues) {
  const auth = await getActionAdmin();
  if (!auth.ok) return auth;
  const { admin } = auth;

  const parsed = leaveRecordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave record." };
  const data = parsed.data;
  const dateSet = new Set(data.allocations.map((row) => row.date));
  if (dateSet.size !== data.allocations.length || data.allocations.some((row) => row.date < data.startDate || row.date > data.endDate)) return { ok: false, error: "Leave date allocations are invalid." };
  const total = data.allocations.reduce((sum, row) => sum + row.dayValue, 0);
  const isPaid = data.leaveType === "LEAVE_WITHOUT_PAY" ? false : data.leaveType === "OTHER" ? data.otherIsPaid : true;

  try {
    const existing = await getPrisma().leaveAllocation.findFirst({ where: { employeeId: data.employeeId, date: { in: [...dateSet] }, leaveRecord: { status: { in: ["PENDING", "APPROVED"] } } } });
    if (existing) return { ok: false, error: `A pending or approved leave already covers ${existing.date}.` };
    const record = await getPrisma().$transaction(async (tx) => {
      const created = await tx.leaveRecord.create({ data: { employeeId: data.employeeId, leaveType: data.leaveType, startDate: data.startDate, endDate: data.endDate, numberOfDays: total, isPaid, reason: data.reason || null, remarks: data.remarks || null, allocations: { create: data.allocations.map((row) => ({ employeeId: data.employeeId, date: row.date, dayValue: row.dayValue })) } } });
      await createAuditLog({ adminId: admin.id, action: "LEAVE_CREATED", entityType: "LEAVE_RECORD", entityId: created.id, summary: `Leave record for ${total} day(s) was created.`, metadata: data }, tx);
      return created;
    });
    revalidateLeavePaths();
    return { ok: true, id: record.id };
  } catch { return { ok: false, error: "Unable to create the leave record." }; }
}
export async function approveLeaveAction(id: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  try {
    await getPrisma().$transaction(async (tx) => {
      const leave = await tx.leaveRecord.findUniqueOrThrow({ where: { id }, include: { allocations: { orderBy: { date: "asc" } }, employee: { include: { leaveBalance: true } } } });
      if (leave.status !== "PENDING") throw new Error("Only pending leave can be approved.");
      const balance = leave.employee.leaveBalance ?? await tx.leaveBalance.create({ data: { employeeId: leave.employeeId } });
      const days = leave.allocations.map((row) => ({ date: row.date, dayValue: Number(row.dayValue) as 0.5 | 1 }));
      let allocations = days.map((row) => ({ ...row, paidDayValue: leave.isPaid ? row.dayValue : 0, unpaidDayValue: leave.isPaid ? 0 : row.dayValue }));
      let debit = 0;
      if (leave.leaveType === "VACATION" || leave.leaveType === "SICK") {
        const available = Number(leave.leaveType === "VACATION" ? balance.vacationBalance : balance.sickBalance);
        allocations = splitPaidAndUnpaidDays(days, available);
        debit = allocations.reduce((sum, row) => sum + row.paidDayValue, 0);
      }
      const paidDays = allocations.reduce((sum, row) => sum + row.paidDayValue, 0);
      const unpaidDays = allocations.reduce((sum, row) => sum + row.unpaidDayValue, 0);
      for (const row of allocations) await tx.leaveAllocation.update({ where: { leaveRecordId_date: { leaveRecordId: leave.id, date: row.date } }, data: { paidDayValue: row.paidDayValue, unpaidDayValue: row.unpaidDayValue } });
      if (debit > 0) {
        const vacation = Number(balance.vacationBalance) - (leave.leaveType === "VACATION" ? debit : 0);
        const sick = Number(balance.sickBalance) - (leave.leaveType === "SICK" ? debit : 0);
        await tx.leaveBalance.update({ where: { employeeId: leave.employeeId }, data: { vacationBalance: vacation, sickBalance: sick } });
        await tx.leaveTransaction.create({ data: { employeeId: leave.employeeId, leaveRecordId: leave.id, transactionType: "DEBIT", leaveType: leave.leaveType, amount: -debit, balanceAfter: leave.leaveType === "VACATION" ? vacation : sick, description: `Approved ${leave.leaveType.replaceAll("_", " ").toLowerCase()}.` } });
      }
      await tx.leaveRecord.update({ where: { id }, data: { status: "APPROVED", paidDays, unpaidDays, isPaid: unpaidDays === 0, approvedAt: new Date(), approvedById: admin.id } });
      await createAuditLog({ adminId: admin.id, action: "LEAVE_APPROVED", entityType: "LEAVE_RECORD", entityId: id, summary: `Leave was approved with ${paidDays} paid and ${unpaidDays} unpaid day(s).`, metadata: { paidDays, unpaidDays, debit } }, tx);
    });
    revalidateLeavePaths(); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to approve leave." }; }
}

export async function rejectLeaveAction(id: string, remarks?: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  try {
    await getPrisma().$transaction(async (tx) => {
      const leave = await tx.leaveRecord.findUniqueOrThrow({ where: { id } });
      if (leave.status !== "PENDING") throw new Error("Only pending leave can be rejected.");
      await tx.leaveRecord.update({ where: { id }, data: { status: "REJECTED", rejectedAt: new Date(), remarks: remarks || leave.remarks } });
      await createAuditLog({ adminId: admin.id, action: "LEAVE_REJECTED", entityType: "LEAVE_RECORD", entityId: id, summary: "Leave was rejected.", metadata: { remarks } }, tx);
    });
    revalidateLeavePaths(); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to reject leave." }; }
}

export async function cancelLeaveAction(id: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  try {
    await getPrisma().$transaction(async (tx) => {
      const leave = await tx.leaveRecord.findUniqueOrThrow({ where: { id }, include: { transactions: true } });
      if (!(["PENDING", "APPROVED"] as const).includes(leave.status as "PENDING" | "APPROVED")) throw new Error("Only pending or approved leave can be cancelled.");
      const locked = await tx.payrollPeriod.findFirst({ where: { status: "LOCKED", startDate: { lte: leave.endDate }, endDate: { gte: leave.startDate } } });
      if (locked) throw new Error(`Leave overlaps locked payroll period ${locked.name}.`);
      if (leave.status === "APPROVED") {
        const debit = leave.transactions.filter((row) => row.transactionType === "DEBIT").reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
        if (debit > 0 && (leave.leaveType === "VACATION" || leave.leaveType === "SICK")) {
          const balance = await tx.leaveBalance.findUniqueOrThrow({ where: { employeeId: leave.employeeId } });
          const updatedBalance = Number(leave.leaveType === "VACATION" ? balance.vacationBalance : balance.sickBalance) + debit;
          await tx.leaveBalance.update({ where: { employeeId: leave.employeeId }, data: leave.leaveType === "VACATION" ? { vacationBalance: updatedBalance } : { sickBalance: updatedBalance } });
          await tx.leaveTransaction.create({ data: { employeeId: leave.employeeId, leaveRecordId: leave.id, transactionType: "ADJUSTMENT", leaveType: leave.leaveType, amount: debit, balanceAfter: updatedBalance, description: "Leave cancellation reversal." } });
        }
      }
      await tx.leaveRecord.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await createAuditLog({ adminId: admin.id, action: "LEAVE_CANCELLED", entityType: "LEAVE_RECORD", entityId: id, summary: "Leave was cancelled and applicable balances were reversed." }, tx);
    });
    revalidateLeavePaths(); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to cancel leave." }; }
}

async function buildCreditPreview(year: number, month: number) {
  const [employees, monthly, daily, lwopRows] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { leaveBalance: true, leaveAllocations: { where: { unpaidDayValue: { gt: 0 }, leaveRecord: { status: "APPROVED" } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().cscMonthlyLeaveCredit.findUnique({ where: { numberOfMonths: 1 } }),
    getPrisma().cscDailyLeaveCredit.findMany(),
    getPrisma().cscLwopLeaveCredit.findMany(),
  ]);
  if (!monthly) throw new Error("CSC monthly leave-credit table is not seeded.");
  const start = `${year}-${String(month).padStart(2, "0")}-01`; const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const existing = await getPrisma().monthlyLeaveCreditGeneration.findMany({ where: { year, month }, select: { employeeId: true } });
  const existingIds = new Set(existing.map((row) => row.employeeId));
  return employees.map((employee) => {
    const serviceDays = getServiceDaysForMonth(employee.serviceStartDate, employee.serviceEndDate, year, month);
    const lwopDays = employee.leaveAllocations.filter((row) => row.date >= start && row.date <= end).reduce((sum, row) => sum + Number(row.unpaidDayValue), 0);
    const earned = computeMonthlyLeaveCredit({ serviceDays, lwopDays, monthlyCredit: { vacationLeaveEarned: Number(monthly.vacationLeaveEarned), sickLeaveEarned: Number(monthly.sickLeaveEarned) }, dailyRows: daily.map((row) => ({ numberOfDays: row.numberOfDays, vacationLeaveEarned: Number(row.vacationLeaveEarned), sickLeaveEarned: Number(row.sickLeaveEarned) })), lwopRows: lwopRows.map((row) => ({ daysOnLwop: Number(row.daysOnLwop), leaveCreditsEarned: Number(row.leaveCreditsEarned) })) });
    const oldVacation = Number(employee.leaveBalance?.vacationBalance ?? 0); const oldSick = Number(employee.leaveBalance?.sickBalance ?? 0);
    return { employeeId: employee.id, employee: `${employee.lastName}, ${employee.firstName}`, serviceDays, lwopDays, vacationEarned: earned.vacation, sickEarned: earned.sick, oldVacation, oldSick, newVacation: Number((oldVacation + earned.vacation).toFixed(3)), newSick: Number((oldSick + earned.sick).toFixed(3)), alreadyGenerated: existingIds.has(employee.id) };
  });
}

export async function previewLeaveCreditsAction(year: number, month: number) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
  const parsed = leaveCreditPeriodSchema.safeParse({ year, month });
  if (!parsed.success) return { ok: false, error: "Select a valid month and year." };
  try { return { ok: true, rows: await buildCreditPreview(year, month) }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to preview leave credits." }; }
}

export async function generateLeaveCreditsAction(year: number, month: number) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  const parsed = leaveCreditPeriodSchema.safeParse({ year, month });
  if (!parsed.success) return { ok: false, error: "Select a valid month and year." };
  try {
    const rows = (await buildCreditPreview(year, month)).filter((row) => !row.alreadyGenerated && (row.vacationEarned > 0 || row.sickEarned > 0));
    await getPrisma().$transaction(async (tx) => {
      for (const row of rows) {
        const balance = await tx.leaveBalance.upsert({ where: { employeeId: row.employeeId }, create: { employeeId: row.employeeId }, update: {} });
        const generation = await tx.monthlyLeaveCreditGeneration.create({ data: { employeeId: row.employeeId, year, month, serviceDays: row.serviceDays, lwopDays: row.lwopDays, vacationEarned: row.vacationEarned, sickEarned: row.sickEarned, oldVacationBalance: balance.vacationBalance, oldSickBalance: balance.sickBalance, newVacationBalance: row.newVacation, newSickBalance: row.newSick, generatedById: admin.id } });
        await tx.leaveBalance.update({ where: { employeeId: row.employeeId }, data: { vacationBalance: row.newVacation, sickBalance: row.newSick } });
        await tx.leaveTransaction.createMany({ data: [{ employeeId: row.employeeId, generationId: generation.id, transactionType: "CREDIT", leaveType: "VACATION", amount: row.vacationEarned, balanceAfter: row.newVacation, description: `Monthly leave credit ${year}-${String(month).padStart(2, "0")}.` }, { employeeId: row.employeeId, generationId: generation.id, transactionType: "CREDIT", leaveType: "SICK", amount: row.sickEarned, balanceAfter: row.newSick, description: `Monthly leave credit ${year}-${String(month).padStart(2, "0")}.` }] });
      }
      await createAuditLog({ adminId: admin.id, action: "MONTHLY_LEAVE_CREDITS_GENERATED", entityType: "LEAVE_CREDIT_BATCH", entityId: `${year}-${month}`, summary: `${rows.length} employee leave-credit record(s) were generated.`, metadata: { year, month, count: rows.length } }, tx);
    });
    revalidateLeavePaths(); return { ok: true, count: rows.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to generate leave credits." }; }
}

function revalidateLeavePaths() { revalidatePath("/leave"); revalidatePath("/attendance"); revalidatePath("/payroll"); revalidatePath("/dashboard"); }
