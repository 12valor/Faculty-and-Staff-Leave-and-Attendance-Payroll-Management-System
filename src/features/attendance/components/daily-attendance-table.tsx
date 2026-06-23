"use client";

import { useState, useTransition } from "react";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeAttendanceForDateAction, saveDailyAttendanceAction } from "@/features/attendance/actions";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { calculateAttendancePenaltyShared, isPast5PM } from "@/lib/calculations/attendance";

export type DailyAttendanceEmployee = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeeType: string;
  department: string;
  position: string;
  schedule: { expectedTimeIn: string; expectedTimeOut: string; source: string } | null;
  approvedLeave: boolean;
  approvedLeaveType: string | null;
  timeIn: string;
  timeOut: string;
  remarks: string;
  storedStatus: AttendanceStatus | null;
  isStatusOverridden: boolean;
  priorLateMinutes: number;
  scheduledDailyHours: number;
  monthlySalary: number;
  workingDaysPerMonth: number;
  absencePenaltyAmount: number;
};

export function DailyAttendanceTable({
  date,
  employees,
  conversions,
}: {
  date: string;
  employees: DailyAttendanceEmployee[];
  conversions: Array<{ unit: "HOUR" | "MINUTE"; value: number; equivalentDay: number }>;
}) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [rows, setRows] = useState(() => employees.map((row) => ({ ...row })));
  const [initialRows] = useState(() => new Map(employees.map((row) => [row.employeeId, row])));
  const [isSaving, startSaving] = useTransition();
  const [isRemoving, startRemoving] = useTransition();

  function changeDate(nextDate: string) {
    startNavigation(() => router.push(`/attendance?tab=daily&date=${nextDate}`));
  }

  function updateRow(employeeId: string, field: "timeIn" | "timeOut" | "remarks", value: string) {
    setRows((current) => current.map((row) => row.employeeId === employeeId ? { ...row, [field]: value } : row));
  }

  function save() {
    startSaving(async () => {
      const result = await saveDailyAttendanceAction(date, rows.map((row) => {
        const initial = initialRows.get(row.employeeId);
        return {
          employeeId: row.employeeId,
          timeIn: row.timeIn,
          timeOut: row.timeOut,
          remarks: row.remarks,
          preserveOverride: Boolean(row.isStatusOverridden && initial && initial.timeIn === row.timeIn && initial.timeOut === row.timeOut && initial.remarks === row.remarks),
        };
      }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.count} attendance row(s) saved.`);
      router.refresh();
    });
  }

  function removeAttendance() {
    startRemoving(async () => {
      try {
        const result = await removeAttendanceForDateAction(date);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setRows((current) => current.map((row) => ({ ...row, timeIn: "", timeOut: "", remarks: "", storedStatus: null, isStatusOverridden: false })));
        toast.success(`${result.count} attendance row(s) removed. You can encode the date again.`);
        router.refresh();
      } catch {
        toast.error("Unable to remove attendance. Refresh the page and try again.");
      }
    });
  }

  if (!employees.length) return <div className="rounded-xl border bg-card py-10"><Empty><EmptyHeader><EmptyTitle>No active employees</EmptyTitle><EmptyDescription>Add or reactivate an employee before encoding attendance.</EmptyDescription></EmptyHeader></Empty></div>;

  return <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-end md:justify-between">
      <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">Attendance date<Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} disabled={isNavigating || isSaving} /></label>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground"><p>All active employees are automatically listed. Encode time in and time out, then save changes.</p><p className="text-xs">Late is computed after the fixed 15-minute grace period. Undertime applies below 6 rendered hours.</p></div>
    </div>
    <div className="relative overflow-x-auto rounded-xl border bg-card" aria-busy={isNavigating || isSaving}>
      {isNavigating ? <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">Loading attendance…</div> : null}
      <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type / Assignment</TableHead><TableHead>Schedule</TableHead><TableHead>Time In</TableHead><TableHead>Time Out</TableHead><TableHead>Late</TableHead><TableHead>Accum. Late</TableHead><TableHead className="text-right">Deduction</TableHead><TableHead>Status</TableHead><TableHead>Overtime/Overload</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
        const calculation = calculateRow(row);
        const disabled = !row.schedule || row.approvedLeave;
        return <TableRow key={row.employeeId}><TableCell className="min-w-52"><p className="font-medium">{row.employeeName}</p><p className="text-xs text-muted-foreground">{row.employeeNumber}</p></TableCell><TableCell className="min-w-40"><p>{formatLabel(row.employeeType)}</p><p className="text-xs text-muted-foreground">{row.department} · {row.position}</p></TableCell><TableCell className="min-w-32">{row.schedule ? <><p className="font-mono text-xs">{row.schedule.expectedTimeIn}–{row.schedule.expectedTimeOut}</p><Badge variant="outline">{formatLabel(row.schedule.source)}</Badge></> : <Badge variant="outline" className="text-destructive border-destructive">No Schedule</Badge>}</TableCell><TableCell><Input type="time" className="min-w-24" value={row.timeIn} onChange={(event) => updateRow(row.employeeId, "timeIn", event.target.value)} disabled={disabled} aria-label={`Time in for ${row.employeeName}`} /></TableCell><TableCell><Input type="time" className="min-w-24" value={row.timeOut} onChange={(event) => updateRow(row.employeeId, "timeOut", event.target.value)} disabled={disabled} aria-label={`Time out for ${row.employeeName}`} /></TableCell><TableCell className="font-mono text-center">{calculation.lateMinutes > 0 ? `${calculation.lateMinutes}m` : "—"}</TableCell><TableCell className="font-mono text-center">{calculation.accumulatedLateMinutes > 0 ? `${calculation.accumulatedLateMinutes}m` : "—"}</TableCell><TableCell className="font-semibold font-mono text-right min-w-24">{calculation.deductionAmount > 0 ? `₱${calculation.deductionAmount.toFixed(2)}` : "—"}</TableCell><TableCell><StatusBadge status={row.isStatusOverridden && calculation.unchanged ? row.storedStatus ?? calculation.status : calculation.status} overridden={row.isStatusOverridden && calculation.unchanged} leaveType={row.approvedLeaveType} /></TableCell><TableCell className="min-w-36 text-center">{calculation.overtimeOverloadLabel ? <Badge variant={calculation.overtimeOverloadLabel.startsWith("Pending") ? "warning" : "success"}>{calculation.overtimeOverloadLabel}</Badge> : "—"}</TableCell><TableCell><Input className="min-w-40" value={row.remarks} onChange={(event) => updateRow(row.employeeId, "remarks", event.target.value)} placeholder="Optional remarks" aria-label={`Remarks for ${row.employeeName}`} /></TableCell></TableRow>;
      })}</TableBody></Table>
    </div>
  </div>;

  function calculateRow(row: DailyAttendanceEmployee) {
    const initial = initialRows.get(row.employeeId);
    const penalty = calculateAttendancePenaltyShared({
      employeeType: row.employeeType,
      monthlySalary: row.monthlySalary,
      workingDaysPerMonth: row.workingDaysPerMonth,
      timeIn: row.timeIn || null,
      timeOut: row.timeOut || null,
      statusOverride: row.isStatusOverridden && initial && initial.timeIn === row.timeIn && initial.timeOut === row.timeOut ? row.storedStatus : null,
      schedule: row.schedule,
      priorLateMinutes: row.priorLateMinutes,
      scheduledDailyHours: row.scheduledDailyHours,
      conversionTable: conversions,
      approvedLeave: row.approvedLeave ? { isPaid: true } : null,
      isCurrentDayPast5PM: isPast5PM(date),
      absencePenaltyAmount: row.absencePenaltyAmount,
    });
    return {
      ...penalty,
      unchanged: Boolean(initial && initial.timeIn === row.timeIn && initial.timeOut === row.timeOut && initial.remarks === row.remarks),
    };
  }
}

export function StatusBadge({ status, overridden = false, leaveType }: { status: AttendanceStatus; overridden?: boolean; leaveType?: string | null }) {
  const variant = status === "ABSENT" ? "destructive" : ["LATE","UNDERTIME","LATE_UNDERTIME","INCOMPLETE"].includes(status) ? "warning" : status === "PRESENT" ? "success" : "secondary";
  const label = status === "ON_LEAVE"
    ? leaveType === "SICK" ? "SL" : leaveType === "VACATION" ? "VL" : "Leave"
    : formatLabel(status);
  return <Badge variant={variant}>{label}{overridden ? " · Override" : ""}</Badge>;
}

function formatLabel(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
