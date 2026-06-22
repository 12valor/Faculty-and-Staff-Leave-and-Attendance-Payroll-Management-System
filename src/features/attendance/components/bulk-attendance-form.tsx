"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveBulkAttendanceAction } from "@/features/attendance/actions";
import { bulkAttendanceSchema, type BulkAttendanceValues } from "@/features/attendance/schemas/attendance-schema";

export function BulkAttendanceForm({ employees }: { employees: Array<{ id: string; label: string }> }) {
  const router = useRouter(); const today = new Date().toISOString().slice(0, 10); const [date, setDate] = useState(today); const [selected, setSelected] = useState<Set<number>>(new Set());
  const form = useForm<BulkAttendanceValues>({ resolver: zodResolver(bulkAttendanceSchema), defaultValues: { rows: employees.map((employee) => ({ employeeId: employee.id, date: today, timeIn: "08:00", timeOut: "17:00", statusOverride: "", overrideReason: "", remarks: "" })) } });
  const { fields } = useFieldArray({ control: form.control, name: "rows" });
  function toggle(index: number) { setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; }); }
  function changeDate(value: string) { setDate(value); fields.forEach((_, index) => form.setValue(`rows.${index}.date`, value)); }
  async function submit(values: BulkAttendanceValues) { const rows = values.rows.filter((_, index) => selected.has(index)); if (!rows.length) return toast.error("Select at least one employee."); const result = await saveBulkAttendanceAction(rows); if (!result.ok) return toast.error(result.error); toast.success(`${result.count} attendance records saved.`); router.push("/attendance"); }
  return <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4"><div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"><label className="flex flex-col gap-2 text-sm font-medium">Attendance date<Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} /></label><Button type="button" variant="outline" onClick={() => setSelected(new Set(fields.map((_, index) => index)))}>Select all</Button><Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button><span className="text-sm text-muted-foreground">{selected.size} selected</span></div><div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Employee</TableHead><TableHead>Time in</TableHead><TableHead>Time out</TableHead><TableHead>Status override</TableHead><TableHead>Reason / Remarks</TableHead></TableRow></TableHeader><TableBody>{fields.map((field, index) => <TableRow key={field.id}><TableCell><Checkbox checked={selected.has(index)} onCheckedChange={() => toggle(index)} aria-label={`Select ${employees[index].label}`} /></TableCell><TableCell className="min-w-56 font-medium">{employees[index].label}<input type="hidden" {...form.register(`rows.${index}.employeeId`)} /><input type="hidden" {...form.register(`rows.${index}.date`)} /></TableCell><TableCell><Input type="time" className="min-w-28" {...form.register(`rows.${index}.timeIn`)} /></TableCell><TableCell><Input type="time" className="min-w-28" {...form.register(`rows.${index}.timeOut`)} /></TableCell><TableCell><NativeSelect className="min-w-40" {...form.register(`rows.${index}.statusOverride`)}><NativeSelectOption value="">Computed</NativeSelectOption>{["PRESENT","LATE","ABSENT","ON_LEAVE","UNDERTIME"].map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}</NativeSelect></TableCell><TableCell><div className="grid min-w-72 gap-2"><Input placeholder="Override reason" {...form.register(`rows.${index}.overrideReason`)} /><Input placeholder="Remarks" {...form.register(`rows.${index}.remarks`)} /></div></TableCell></TableRow>)}</TableBody></Table></div>{form.formState.errors.rows ? <p role="alert" className="text-sm text-destructive">Check the selected rows for missing override reasons or invalid values.</p> : null}<div><Button type="submit" disabled={form.formState.isSubmitting}>Save selected attendance</Button></div></form>;
}