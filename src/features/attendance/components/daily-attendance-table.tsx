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
import { computeAttendanceStatus, getLateMinutes, getRenderedMinutes } from "@/lib/calculations/attendance";

export type DailyAttendanceEmployee = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeeType: string;
  department: string;
  position: string;
  schedule: { expectedTimeIn: string; expectedTimeOut: string; source: string } | null;
  approvedLeave: boolean;
  timeIn: string;
  timeOut: string;
  remarks: string;
  storedStatus: AttendanceStatus | null;
  isStatusOverridden: boolean;
};

export function DailyAttendanceTable({ date, employees }: { date: string; employees: DailyAttendanceEmployee[] }) {
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
      const result = await removeAttendanceForDateAction(date);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) => current.map((row) => ({ ...row, timeIn: "", timeOut: "", remarks: "", storedStatus: null, isStatusOverridden: false })));
      toast.success(`${result.count} attendance row(s) removed. You can encode the date again.`);
      router.refresh();
    });
  }

  if (!employees.length) return <div className="rounded-xl border bg-card py-10"><Empty><EmptyHeader><EmptyTitle>No active employees</EmptyTitle><EmptyDescription>Add or reactivate an employee before encoding attendance.</EmptyDescription></EmptyHeader></Empty></div>;

  return <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-end md:justify-between">
      <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">Attendance date<Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} disabled={isNavigating || isSaving} /></label>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground"><p>All active employees are automatically listed. Encode time in and time out, then save changes.</p><p className="text-xs">Late is computed after the fixed 15-minute grace period. Undertime applies below 6 rendered hours.</p></div>
      <div className="flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={isRemoving || isSaving || isNavigating} />}>
            <DeleteSweepRoundedIcon data-icon="inline-start" />
            Remove Date Records
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove attendance for {date}?</AlertDialogTitle>
              <AlertDialogDescription>This deletes all saved attendance rows for this date so you can encode and test them again. Locked payroll attendance cannot be removed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={removeAttendance} disabled={isRemoving}>{isRemoving ? "Removing…" : "Remove Attendance"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={save} disabled={isSaving || isRemoving || isNavigating}><SaveRoundedIcon data-icon="inline-start" />{isSaving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
    <div className="relative overflow-x-auto rounded-xl border bg-card" aria-busy={isNavigating || isSaving}>
      {isNavigating ? <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">Loading attendance…</div> : null}
      <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type / Assignment</TableHead><TableHead>Schedule</TableHead><TableHead>Time In</TableHead><TableHead>Time Out</TableHead><TableHead>Total Hours</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
        const calculation = calculateRow(row);
        const disabled = !row.schedule || row.approvedLeave;
        return <TableRow key={row.employeeId}><TableCell className="min-w-52"><p className="font-medium">{row.employeeName}</p><p className="text-xs text-muted-foreground">{row.employeeNumber}</p></TableCell><TableCell className="min-w-52"><p>{formatLabel(row.employeeType)}</p><p className="text-xs text-muted-foreground">{row.department} · {row.position}</p></TableCell><TableCell className="min-w-40">{row.schedule ? <><p className="font-mono text-xs">{row.schedule.expectedTimeIn}–{row.schedule.expectedTimeOut}</p><Badge variant="outline">{formatLabel(row.schedule.source)}</Badge></> : <Badge variant="outline">No Schedule</Badge>}</TableCell><TableCell><Input type="time" className="min-w-28" value={row.timeIn} onChange={(event) => updateRow(row.employeeId, "timeIn", event.target.value)} disabled={disabled} aria-label={`Time in for ${row.employeeName}`} /></TableCell><TableCell><Input type="time" className="min-w-28" value={row.timeOut} onChange={(event) => updateRow(row.employeeId, "timeOut", event.target.value)} disabled={disabled} aria-label={`Time out for ${row.employeeName}`} /></TableCell><TableCell className="font-mono text-xs">{formatMinutes(calculation.renderedMinutes)}</TableCell><TableCell><StatusBadge status={row.isStatusOverridden && calculation.unchanged ? row.storedStatus ?? calculation.status : calculation.status} overridden={row.isStatusOverridden && calculation.unchanged} /></TableCell><TableCell><Input className="min-w-48" value={row.remarks} onChange={(event) => updateRow(row.employeeId, "remarks", event.target.value)} placeholder="Optional remarks" aria-label={`Remarks for ${row.employeeName}`} /></TableCell></TableRow>;
      })}</TableBody></Table>
    </div>
  </div>;

  function calculateRow(row: DailyAttendanceEmployee) {
    const initial = initialRows.get(row.employeeId);
    const renderedMinutes = getRenderedMinutes(row.timeIn, row.timeOut);
    return {
      renderedMinutes,
      status: computeAttendanceStatus({ timeIn: row.timeIn || null, timeOut: row.timeOut || null, schedule: row.schedule, graceMinutes: 15, approvedLeave: row.approvedLeave ? { isPaid: true } : null }),
      lateMinutes: row.schedule && row.timeIn ? getLateMinutes(row.schedule.expectedTimeIn, row.timeIn, 15) : 0,
      unchanged: Boolean(initial && initial.timeIn === row.timeIn && initial.timeOut === row.timeOut && initial.remarks === row.remarks),
    };
  }
}

export function StatusBadge({ status, overridden = false }: { status: AttendanceStatus; overridden?: boolean }) {
  const variant = status === "ABSENT" ? "destructive" : ["LATE","UNDERTIME","LATE_UNDERTIME","INCOMPLETE"].includes(status) ? "warning" : status === "PRESENT" ? "success" : "secondary";
  return <Badge variant={variant}>{formatLabel(status)}{overridden ? " · Override" : ""}</Badge>;
}

function formatMinutes(minutes: number) { return minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "—"; }
function formatLabel(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
