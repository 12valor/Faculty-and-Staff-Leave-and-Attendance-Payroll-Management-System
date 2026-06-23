import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LivePayrollResult } from "@/features/payroll/lib/live-payroll";

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function Payslip({ payroll, preparedBy }: { payroll: LivePayrollResult; preparedBy: string }) {
  const generatedAt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" }).format(new Date());
  return (
    <article data-payslip className="mx-auto w-full max-w-5xl rounded-xl border bg-white p-5 text-slate-950 shadow-sm sm:p-8">
      <header className="flex items-center gap-4 border-b-2 border-primary pb-5">
        <Image src="/images/tup-seal.png" alt="Technological University of the Philippines seal" width={72} height={72} className="size-16 object-contain sm:size-[72px]" priority />
        <div className="min-w-0 flex-1 text-center"><p className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">Technological University of the Philippines</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Employee Payslip</h2><p className="mt-1 text-sm text-slate-600">{payroll.period.label} | {payroll.period.startDate} to {payroll.period.endDate}</p></div>
        <Badge variant="outline" className="hidden sm:inline-flex">{payroll.mode === "manual" ? "Manual calculation" : "Live calculation"}</Badge>
      </header>

      {payroll.availability.attendanceRecords === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          No attendance records found for this range. Payroll values are based on available data.
        </p>
      ) : null}

      <section className="mt-6 grid gap-x-8 gap-y-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Detail label="Employee" value={payroll.employee.fullName} />
        <Detail label="Employee ID" value={payroll.employee.employeeNumber} mono />
        <Detail label="Department" value={payroll.employee.department} />
        <Detail label="Position" value={payroll.employee.position} />
        <Detail label="Employee type" value={payroll.employee.employeeType.replaceAll("_", " ")} />
        <Detail label="Employment status" value={payroll.employee.employmentStatus} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <SummaryTable title="Earnings" rows={[
          ["Prorated basic pay", payroll.earnings.basicPay],
          ["Approved overtime", payroll.earnings.overtimePay],
          ["Approved faculty overload", payroll.earnings.overloadPay],
        ]} totalLabel="Gross pay" total={payroll.earnings.grossPay} />
        <SummaryTable title="Deductions" rows={[
          [`Late threshold (${payroll.deductions.totalLateMinutes} min)`, deductionPart(payroll, "late")],
          [`Undertime (${payroll.deductions.totalUndertimeMinutes} min, no deduction)`, 0],
          [`Absence (${payroll.deductions.absenceDays.toFixed(3)} day)`, deductionPart(payroll, "absence")],
          [`Leave without pay (${payroll.deductions.lwopDays.toFixed(3)} day)`, deductionPart(payroll, "lwop")],
        ]} totalLabel="Total deductions" total={payroll.deductions.total} />
      </section>

      <div className="mt-5 flex flex-col justify-between gap-4 rounded-lg bg-primary px-5 py-4 text-primary-foreground sm:flex-row sm:items-center"><div><p className="text-xs font-semibold tracking-wider uppercase opacity-80">Net pay</p><p className="mt-1 text-sm opacity-80">Gross earnings less attendance and LWOP deductions</p></div><p className="font-mono text-3xl font-bold tabular-nums">{money.format(payroll.netPay)}</p></div>

      <section className="mt-6"><h3 className="mb-3 text-sm font-bold tracking-wider uppercase text-slate-600">Payroll basis</h3><div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3"><Detail label="Monthly salary" value={money.format(payroll.employee.monthlySalary)} mono /><Detail label="Eligible scheduled days" value={`${payroll.proration.eligibleDays} of ${payroll.proration.scheduledDays}`} mono /><Detail label="Basic-pay factor" value={`${(payroll.proration.ratio * 100).toFixed(2)}%`} mono /></div></section>

      {payroll.deductionRows.length ? <DetailTable title="Deduction breakdown" headers={["Date", "Reason", "Late", "Undertime", "Penalty units", "Amount"]}>{payroll.deductionRows.map((row) => <TableRow key={`${row.date}-${row.source}`}><TableCell className="font-mono text-xs">{row.date}</TableCell><TableCell><p className="font-medium">{row.description}</p><p className="text-xs text-slate-500">{row.source.replaceAll("_", " ")}</p></TableCell><TableCell>{row.lateMinutes}</TableCell><TableCell>{row.undertimeMinutes}</TableCell><TableCell>{row.dayValue.toFixed(3)}</TableCell><TableCell className="font-mono">{money.format(row.amount)}</TableCell></TableRow>)}</DetailTable> : null}

      {payroll.overtimeRows.length ? <DetailTable title="Overtime earnings" headers={["Date", "Hours", "Hourly rate", "Multiplier", "Amount"]}>{payroll.overtimeRows.map((row) => <TableRow key={row.date}><TableCell className="font-mono text-xs">{row.date}</TableCell><TableCell>{row.hours.toFixed(3)}</TableCell><TableCell className="font-mono">{money.format(row.hourlyRate)}</TableCell><TableCell>{row.multiplier.toFixed(2)}x</TableCell><TableCell className="font-mono">{money.format(row.amount)}</TableCell></TableRow>)}</DetailTable> : null}

      {payroll.overloadRows.length ? <DetailTable title="Faculty overload earnings" headers={["Week", "Hours", "Hourly rate", "Amount"]}>{payroll.overloadRows.map((row) => <TableRow key={row.weekStart}><TableCell className="font-mono text-xs">{row.weekStart} to {row.weekEnd}</TableCell><TableCell>{row.hours.toFixed(3)}</TableCell><TableCell className="font-mono">{money.format(row.hourlyRate)}</TableCell><TableCell className="font-mono">{money.format(row.amount)}</TableCell></TableRow>)}</DetailTable> : null}

      <footer className="mt-12 grid gap-12 pt-4 text-center text-sm sm:grid-cols-2"><Signature label="Prepared by" name={preparedBy} /><Signature label="Employee signature" name={payroll.employee.fullName} /></footer>
      <p className="mt-8 text-center text-[0.65rem] text-slate-500">{payroll.mode === "manual" ? "Manual" : "Live"} payroll generated {generatedAt}. This view does not create or lock a payroll record.</p>
    </article>
  );
}

function deductionPart(payroll: LivePayrollResult, kind: "late" | "absence" | "lwop") { return payroll.deductionRows.filter((row) => kind === "late" ? row.lateMinutes > 0 && row.absenceDayValue === 0 && row.lwopDayValue === 0 : kind === "absence" ? row.absenceDayValue > 0 : row.lwopDayValue > 0).reduce((sum, row) => sum + row.amount, 0); }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><p className="text-[0.68rem] font-semibold tracking-wider text-slate-500 uppercase">{label}</p><p className={`mt-1 font-medium ${mono ? "font-mono tabular-nums" : ""}`}>{value}</p></div>; }
function SummaryTable({ title, rows, totalLabel, total }: { title: string; rows: Array<[string, number]>; totalLabel: string; total: number }) { return <div className="overflow-hidden rounded-lg border"><div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-bold">{title}</h3></div><div className="p-4">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b py-2 text-sm last:border-b-0"><span className="text-slate-600">{label}</span><span className="font-mono font-medium tabular-nums">{money.format(value)}</span></div>)}<div className="mt-2 flex justify-between gap-4 border-t-2 pt-3 font-bold"><span>{totalLabel}</span><span className="font-mono tabular-nums">{money.format(total)}</span></div></div></div>; }
function DetailTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) { return <section className="mt-7 break-inside-avoid"><h3 className="mb-3 text-sm font-bold tracking-wider uppercase text-slate-600">{title}</h3><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div></section>; }
function Signature({ label, name }: { label: string; name: string }) { return <div className="pt-8"><div className="border-t border-slate-500 pt-2"><p className="font-semibold">{name}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div></div>; }
