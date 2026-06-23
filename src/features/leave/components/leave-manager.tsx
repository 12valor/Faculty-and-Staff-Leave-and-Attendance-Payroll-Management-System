"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Check from "@mui/icons-material/CheckCircleRounded";
import Plus from "@mui/icons-material/AddRounded";
import X from "@mui/icons-material/CancelRounded";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { approveLeaveAction, cancelLeaveAction, createLeaveRecordAction, generateLeaveCreditsAction, getScheduledLeaveDatesAction, previewLeaveCreditsAction, rejectLeaveAction } from "@/features/leave/actions";
import { leaveRecordSchema, type LeaveRecordValues } from "@/features/leave/schemas/leave-schema";

type EmployeeOption = { id: string; label: string };
type LeaveRow = { id: string; employee: string; department: string; leaveType: string; status: string; startDate: string; endDate: string; numberOfDays: number; paidDays: number; unpaidDays: number; reason: string };
type BalanceRow = { employee: string; department: string; vacation: number; sick: number };
type TransactionRow = { id: string; employee: string; createdAt: string; transactionType: string; leaveType: string; amount: number; balanceAfter: number; description: string };
type CreditPreview = { employeeId: string; employee: string; serviceDays: number; lwopDays: number; vacationEarned: number; sickEarned: number; oldVacation: number; oldSick: number; newVacation: number; newSick: number; alreadyGenerated: boolean };

const today = new Date().toISOString().slice(0, 10);
const SERVER_ACTION_ERROR = "The server connection was interrupted. Refresh the page and try again.";
const initialValues: LeaveRecordValues = { employeeId: "", leaveType: "VACATION", startDate: today, endDate: today, otherIsPaid: true, reason: "", remarks: "", allocations: [] };

export function LeaveManager({ employees, records, balances, transactions }: { employees: EmployeeOption[]; records: LeaveRow[]; balances: BalanceRow[]; transactions: TransactionRow[] }) {
  const [open, setOpen] = useState(false);
  const [scheduledDates, setScheduledDates] = useState<Array<{ date: string; dayValue: 0 | 0.5 | 1 }>>([]);
  const form = useForm<LeaveRecordValues>({ resolver: zodResolver(leaveRecordSchema), defaultValues: { ...initialValues, employeeId: employees[0]?.id ?? "" } });
  const leaveType = useWatch({ control: form.control, name: "leaveType" });
  const otherIsPaid = useWatch({ control: form.control, name: "otherIsPaid" });

  useEffect(() => {
    form.setValue("allocations", scheduledDates.filter((row) => row.dayValue > 0) as any, { shouldValidate: form.formState.isSubmitted });
  }, [scheduledDates, form, form.formState.isSubmitted]);

  async function loadDates() {
    try {
      const result = await getScheduledLeaveDatesAction(form.getValues("employeeId"), form.getValues("startDate"), form.getValues("endDate"));
      if (!result.ok) return toast.error(result.error);
      const dates = result.dates ?? [];
      if (!dates.length) return toast.error("No active scheduled dates fall inside this range.");
      setScheduledDates(dates.map((date) => ({ date, dayValue: 1 })));
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  async function submit(values: LeaveRecordValues) {
    const allocations = scheduledDates.filter((row) => row.dayValue > 0).map((row) => ({ date: row.date, dayValue: row.dayValue as 0.5 | 1 }));
    try {
      const result = await createLeaveRecordAction({ ...values, allocations });
      if (!result.ok) return toast.error(result.error);
      toast.success("Leave record created."); setOpen(false); setScheduledDates([]); form.reset({ ...initialValues, employeeId: employees[0]?.id ?? "" });
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  async function decide(action: "approve" | "reject" | "cancel", id: string) {
    try {
      const result = action === "approve" ? await approveLeaveAction(id) : action === "reject" ? await rejectLeaveAction(id) : await cancelLeaveAction(id);
      if (!result.ok) return toast.error(result.error);
      toast.success(`Leave ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled"}.`);
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  return <Tabs defaultValue="records" className="flex flex-col gap-4">
    <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="balances">Balances</TabsTrigger><TabsTrigger value="transactions">Transactions</TabsTrigger><TabsTrigger value="credits">Leave Credits</TabsTrigger></TabsList>
    <TabsContent value="records" className="flex flex-col gap-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)} disabled={!employees.length}><Plus data-icon="inline-start" />Create leave</Button></div>
      <DataTable headers={["Employee", "Type", "Dates", "Days", "Paid / Unpaid", "Status", "Reason", "Actions"]} empty="No leave records found.">
        {records.map((row) => <TableRow key={row.id}><TableCell><p className="font-medium">{row.employee}</p><p className="text-xs text-muted-foreground">{row.department}</p></TableCell><TableCell><Badge variant="outline">{label(row.leaveType)}</Badge></TableCell><TableCell className="font-mono text-xs">{row.startDate}<br />{row.endDate}</TableCell><TableCell className="font-mono">{row.numberOfDays.toFixed(1)}</TableCell><TableCell className="font-mono text-xs">{row.paidDays.toFixed(1)} / {row.unpaidDays.toFixed(1)}</TableCell><TableCell><Badge variant={row.status === "APPROVED" ? "secondary" : "outline"}>{row.status}</Badge></TableCell><TableCell className="max-w-48 truncate">{row.reason || "—"}</TableCell><TableCell><div className="flex gap-1">{row.status === "PENDING" ? <><Button size="icon-sm" variant="ghost" aria-label="Approve leave" onClick={() => decide("approve", row.id)}><Check /></Button><Button size="icon-sm" variant="ghost" aria-label="Reject leave" onClick={() => decide("reject", row.id)}><X /></Button></> : null}{row.status === "PENDING" || row.status === "APPROVED" ? <Button size="sm" variant="outline" onClick={() => decide("cancel", row.id)}>Cancel</Button> : null}</div></TableCell></TableRow>)}
      </DataTable>
    </TabsContent>
    <TabsContent value="balances"><DataTable headers={["Employee", "Department", "Vacation Leave", "Sick Leave"]} empty="No employee balances found.">{balances.map((row) => <TableRow key={row.employee}><TableCell className="font-medium">{row.employee}</TableCell><TableCell>{row.department}</TableCell><TableCell className="font-mono">{row.vacation.toFixed(3)}</TableCell><TableCell className="font-mono">{row.sick.toFixed(3)}</TableCell></TableRow>)}</DataTable></TabsContent>
    <TabsContent value="transactions"><DataTable headers={["Date", "Employee", "Type", "Leave", "Amount", "Balance after", "Description"]} empty="No leave transactions found.">{transactions.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.createdAt}</TableCell><TableCell className="font-medium">{row.employee}</TableCell><TableCell><Badge variant="outline">{row.transactionType}</Badge></TableCell><TableCell>{label(row.leaveType)}</TableCell><TableCell className="font-mono">{row.amount.toFixed(3)}</TableCell><TableCell className="font-mono">{row.balanceAfter.toFixed(3)}</TableCell><TableCell>{row.description || "—"}</TableCell></TableRow>)}</DataTable></TabsContent>
    <TabsContent value="credits"><LeaveCreditPanel /></TabsContent>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Create leave record</DialogTitle><DialogDescription>Select the range, load scheduled dates, then mark each date as full, half, or excluded.</DialogDescription></DialogHeader><form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5"><FieldGroup className="grid gap-4 md:grid-cols-2"><Field><FieldLabel>Employee</FieldLabel><NativeSelect className="w-full" {...form.register("employeeId")} onChange={(event) => { form.setValue("employeeId", event.target.value); setScheduledDates([]); }}>{employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.label}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel>Leave type</FieldLabel><NativeSelect className="w-full" {...form.register("leaveType")}><NativeSelectOption value="VACATION">Vacation</NativeSelectOption><NativeSelectOption value="SICK">Sick</NativeSelectOption><NativeSelectOption value="LEAVE_WITHOUT_PAY">Leave without pay</NativeSelectOption><NativeSelectOption value="OTHER">Other</NativeSelectOption></NativeSelect></Field><Field><FieldLabel>Start date</FieldLabel><Input type="date" {...form.register("startDate")} onChange={(event) => { form.setValue("startDate", event.target.value); setScheduledDates([]); }} /></Field><Field><FieldLabel>End date</FieldLabel><Input type="date" {...form.register("endDate")} onChange={(event) => { form.setValue("endDate", event.target.value); setScheduledDates([]); }} /></Field>{leaveType === "OTHER" ? <Field><FieldLabel>Payroll treatment</FieldLabel><NativeSelect className="w-full" value={otherIsPaid ? "paid" : "unpaid"} onChange={(event) => form.setValue("otherIsPaid", event.target.value === "paid")}><NativeSelectOption value="paid">Paid</NativeSelectOption><NativeSelectOption value="unpaid">Unpaid</NativeSelectOption></NativeSelect></Field> : null}<Field className="md:col-span-2"><FieldLabel>Reason</FieldLabel><Textarea {...form.register("reason")} /></Field><Field className="md:col-span-2"><FieldLabel>Remarks</FieldLabel><Textarea {...form.register("remarks")} /></Field></FieldGroup><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Scheduled leave dates</p><p className="text-sm text-muted-foreground">Excluded dates will not be saved.</p></div><Button type="button" variant="outline" onClick={loadDates}>Load dates</Button></div>{scheduledDates.length ? <div className="grid gap-2 sm:grid-cols-2">{scheduledDates.map((row, index) => <div key={row.date} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="font-mono text-sm">{row.date}</span><NativeSelect className="w-28" value={String(row.dayValue)} onChange={(event) => setScheduledDates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dayValue: Number(event.target.value) as 0 | 0.5 | 1 } : item))}><NativeSelectOption value="1">Full</NativeSelectOption><NativeSelectOption value="0.5">Half</NativeSelectOption><NativeSelectOption value="0">Excluded</NativeSelectOption></NativeSelect></div>)}</div> : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Load scheduled dates to continue.</p>}<FieldError>{Object.values(form.formState.errors)[0]?.message}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting || !scheduledDates.some((row) => row.dayValue > 0)}>Create leave</Button></DialogFooter></form></DialogContent></Dialog>
  </Tabs>;
}

function LeaveCreditPanel() {
  const now = new Date(); const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth() + 1); const [rows, setRows] = useState<CreditPreview[]>([]); const [loading, setLoading] = useState(false);
  async function preview() {
    setLoading(true);
    try {
      const result = await previewLeaveCreditsAction(year, month);
      if (!result.ok) return toast.error(result.error);
      setRows(result.rows ?? []);
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    } finally {
      setLoading(false);
    }
  }
  async function generate() {
    setLoading(true);
    try {
      const result = await generateLeaveCreditsAction(year, month);
      if (!result.ok) return toast.error(result.error);
      toast.success(`${result.count} leave-credit record(s) generated.`);
      await preview();
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    } finally {
      setLoading(false);
    }
  }
  return <div className="flex flex-col gap-4"><div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"><Field><FieldLabel>Month</FieldLabel><Input type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /></Field><Field><FieldLabel>Year</FieldLabel><Input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></Field><Button variant="outline" onClick={preview} disabled={loading}>Preview</Button><Button onClick={generate} disabled={loading || !rows.some((row) => !row.alreadyGenerated)}>Generate credits</Button></div><DataTable headers={["Employee", "Service", "LWOP", "VL earned", "SL earned", "Old VL", "Old SL", "New VL", "New SL", "Status"]} empty="Choose a month and preview leave credits.">{rows.map((row) => <TableRow key={row.employeeId}><TableCell className="font-medium">{row.employee}</TableCell><TableCell className="font-mono">{row.serviceDays}</TableCell><TableCell className="font-mono">{row.lwopDays}</TableCell><TableCell className="font-mono">{row.vacationEarned.toFixed(3)}</TableCell><TableCell className="font-mono">{row.sickEarned.toFixed(3)}</TableCell><TableCell className="font-mono">{row.oldVacation.toFixed(3)}</TableCell><TableCell className="font-mono">{row.oldSick.toFixed(3)}</TableCell><TableCell className="font-mono">{row.newVacation.toFixed(3)}</TableCell><TableCell className="font-mono">{row.newSick.toFixed(3)}</TableCell><TableCell><Badge variant={row.alreadyGenerated ? "outline" : "secondary"}>{row.alreadyGenerated ? "Generated" : "Ready"}</Badge></TableCell></TableRow>)}</DataTable></div>;
}

function DataTable({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) { const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children); return <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{hasRows ? children : <TableRow><TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">{empty}</TableCell></TableRow>}</TableBody></Table></div>; }
function label(value: string) { return value.replaceAll("_", " "); }
