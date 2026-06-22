"use client";

import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { previewAttendanceAction, saveManualAttendanceAction } from "@/features/attendance/actions";
import { attendanceEntrySchema, type AttendanceEntryValues } from "@/features/attendance/schemas/attendance-schema";

type Preview = { schedule: { expectedTimeIn: string; expectedTimeOut: string } | null; computedStatus: string; finalStatus: string; lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number; deductionDayValue: number; deductionAmount: number };

export function ManualAttendanceForm({ employees, initialValues }: { employees: Array<{ id: string; label: string }>; initialValues: AttendanceEntryValues }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const form = useForm<AttendanceEntryValues>({ resolver: zodResolver(attendanceEntrySchema), defaultValues: initialValues });
  async function calculate() { const result = await previewAttendanceAction(form.getValues()); if (!result.ok || !result.preview) return toast.error(result.error ?? "Unable to preview attendance."); setPreview(result.preview); }
  async function submit(values: AttendanceEntryValues) { const result = await saveManualAttendanceAction(values); if (!result.ok) return toast.error(result.error); toast.success(values.id ? "Attendance updated." : "Attendance saved."); router.push("/attendance"); }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Card><CardHeader><CardTitle>Attendance entry</CardTitle><CardDescription>Times are compared with the employee schedule when available.</CardDescription></CardHeader><CardContent><form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5"><input type="hidden" {...form.register("id")} /><FieldGroup className="grid gap-4 md:grid-cols-2"><AField label="Employee" error={form.formState.errors.employeeId?.message}><NativeSelect className="w-full" {...form.register("employeeId")}>{employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.label}</NativeSelectOption>)}</NativeSelect></AField><AField label="Date" error={form.formState.errors.date?.message}><Input type="date" {...form.register("date")} /></AField><AField label="Time in"><Input type="time" {...form.register("timeIn")} /></AField><AField label="Time out"><Input type="time" {...form.register("timeOut")} /></AField><AField label="Status override"><NativeSelect className="w-full" {...form.register("statusOverride")}><NativeSelectOption value="">Use computed status</NativeSelectOption>{["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "UNDERTIME"].map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}</NativeSelect></AField><AField label="Override reason" error={form.formState.errors.overrideReason?.message}><Input {...form.register("overrideReason")} placeholder="Required only when overriding" /></AField><Field className="md:col-span-2"><FieldLabel>Remarks</FieldLabel><Textarea {...form.register("remarks")} /></Field></FieldGroup><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={calculate}><CalculateRoundedIcon data-icon="inline-start" />Preview calculation</Button><Button type="submit" disabled={form.formState.isSubmitting}><SaveRoundedIcon data-icon="inline-start" />Save attendance</Button></div></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Computation preview</CardTitle><CardDescription>Computed and final values are separated for quick review.</CardDescription></CardHeader><CardContent>{preview ? <div className="flex flex-col gap-4">{[["Schedule", preview.schedule ? `${preview.schedule.expectedTimeIn}–${preview.schedule.expectedTimeOut}` : "No schedule"], ["Computed status", preview.computedStatus], ["Final status", preview.finalStatus], ["Late minutes", preview.lateMinutes], ["Undertime minutes", preview.undertimeMinutes], ["Overtime minutes", preview.overtimeMinutes], ["Deduction day", preview.deductionDayValue], ["Deduction amount", `₱${preview.deductionAmount.toFixed(2)}`]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b pb-3"><span className="text-sm text-muted-foreground">{label}</span><Badge variant={label === "Final status" ? "success" : "outline"}>{value}</Badge></div>)}</div> : <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">Enter attendance details, then select Preview calculation.</div>}</CardContent></Card>
  </div>;
}

function AField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <Field data-invalid={Boolean(error)}><FieldLabel>{label}</FieldLabel>{children}<FieldError>{error}</FieldError></Field>; }
