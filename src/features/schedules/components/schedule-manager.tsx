"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Archive from "@mui/icons-material/ArchiveRounded";
import Pencil from "@mui/icons-material/EditRounded";
import Plus from "@mui/icons-material/AddRounded";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { archiveScheduleAction, saveFacultyScheduleAction, saveWorkScheduleAction } from "@/features/schedules/actions";
import { dayValues, facultyScheduleSchema, type FacultyScheduleValues, workScheduleSchema, type WorkScheduleValues } from "@/features/schedules/schemas/schedule-schema";
import type { DayOfWeek } from "@/generated/prisma/client";
import { todayInTimeZone } from "@/lib/dates";

const dayLabels: Record<DayOfWeek, string> = { MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday" };
type EmployeeOption = { id: string; label: string; employeeType: "FACULTY" | "STAFF" | "FACULTY_WITH_STAFF_WORK" };
export type WorkRow = WorkScheduleValues & { scheduleGroupId: string; employeeLabel: string; effectiveTo: string | null; isActive: boolean };
export type FacultyRow = FacultyScheduleValues & { scheduleGroupId: string; employeeLabel: string; totalTeachingHours: number; effectiveTo: string | null; isActive: boolean };

export function ScheduleManager({ employees, workSchedules, facultySchedules, summaries }: { employees: EmployeeOption[]; workSchedules: WorkRow[]; facultySchedules: FacultyRow[]; summaries: Array<{ employeeLabel: string; workDays: number; teachingHours: number }> }) {
  const today = todayInTimeZone();
  const [workOpen, setWorkOpen] = useState(false);
  const [facultyOpen, setFacultyOpen] = useState(false);
  const workEmployees = employees.filter((item) => item.employeeType !== "FACULTY");
  const facultyEmployees = employees.filter((item) => item.employeeType !== "STAFF");
  const workForm = useForm<WorkScheduleValues>({ resolver: zodResolver(workScheduleSchema), defaultValues: workDefaults(workEmployees[0]?.id ?? "", today) });
  const facultyForm = useForm<FacultyScheduleValues>({ resolver: zodResolver(facultyScheduleSchema), defaultValues: facultyDefaults(facultyEmployees[0]?.id ?? "", today) });

  function openWork(row?: WorkRow) { workForm.reset(row ? { ...row, effectiveFrom: row.effectiveFrom < today ? today : row.effectiveFrom } : workDefaults(workEmployees[0]?.id ?? "", today)); setWorkOpen(true); }
  function openFaculty(row?: FacultyRow) { facultyForm.reset(row ? { ...row, effectiveFrom: row.effectiveFrom < today ? today : row.effectiveFrom } : facultyDefaults(facultyEmployees[0]?.id ?? "", today)); setFacultyOpen(true); }
  async function submitWork(values: WorkScheduleValues) { const result = await saveWorkScheduleAction(values); if (!result.ok) return toast.error(result.error); toast.success("Staff schedule saved."); setWorkOpen(false); }
  async function submitFaculty(values: FacultyScheduleValues) { const result = await saveFacultyScheduleAction(values); if (!result.ok) return toast.error(result.error); toast.success("Teaching schedule saved."); setFacultyOpen(false); }
  async function archive(kind: "work" | "faculty", groupId: string) { const result = await archiveScheduleAction(kind, groupId); if (!result.ok) return toast.error(result.error); toast.success("Schedule ended without removing its history."); }

  return <>
    {summaries.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summaries.map((summary) => <div key={summary.employeeLabel} className="rounded-xl border bg-card p-4"><p className="font-medium">{summary.employeeLabel}</p><div className="mt-3 flex gap-2"><Badge variant="secondary">{summary.workDays} work days</Badge><Badge variant="outline">{summary.teachingHours.toFixed(2)} teaching hours</Badge></div></div>)}</div> : null}
    <Tabs defaultValue="work">
      <TabsList><TabsTrigger value="work">Staff Work Schedules</TabsTrigger><TabsTrigger value="faculty">Faculty Teaching Schedules</TabsTrigger></TabsList>
      <TabsContent value="work" className="mt-4 flex flex-col gap-4">
        <div className="flex justify-end"><Button onClick={() => openWork()} disabled={!workEmployees.length}><Plus data-icon="inline-start" />Add schedule version</Button></div>
        <ScheduleTable headers={["Employee","Working days","Time","Effective period","Hours","Status","Actions"]} rows={workSchedules.map((row) => [row.employeeLabel, formatDays(row.workingDays), `${row.expectedTimeIn}–${row.expectedTimeOut}`, formatPeriod(row.effectiveFrom, row.effectiveTo), row.requiredHours, <Badge key="s" variant={isCurrent(row, today) ? "secondary" : "outline"}>{isCurrent(row, today) ? "Current" : "Historical"}</Badge>, <RowActions key="a" onEdit={() => openWork(row)} onArchive={() => archive("work", row.scheduleGroupId)} canArchive={isCurrent(row, today)} />])} />
      </TabsContent>
      <TabsContent value="faculty" className="mt-4 flex flex-col gap-4">
        <div className="flex justify-end"><Button onClick={() => openFaculty()} disabled={!facultyEmployees.length}><Plus data-icon="inline-start" />Add teaching schedule</Button></div>
        <ScheduleTable headers={["Employee","Class","Working days","Time","Effective period","Hours","Status","Actions"]} rows={facultySchedules.map((row) => [row.employeeLabel, row.subjectOrClass, formatDays(row.workingDays), `${row.startTime}–${row.endTime}`, formatPeriod(row.effectiveFrom, row.effectiveTo), row.totalTeachingHours, <Badge key="s" variant={isCurrent(row, today) ? "secondary" : "outline"}>{isCurrent(row, today) ? "Current" : "Historical"}</Badge>, <RowActions key="a" onEdit={() => openFaculty(row)} onArchive={() => archive("faculty", row.scheduleGroupId)} canArchive={isCurrent(row, today)} />])} />
      </TabsContent>
    </Tabs>

    <Dialog open={workOpen} onOpenChange={setWorkOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Staff work schedule</DialogTitle><DialogDescription>Select all working days that share this schedule. The effective date preserves older versions.</DialogDescription></DialogHeader><form onSubmit={workForm.handleSubmit(submitWork)} className="flex flex-col gap-5"><input type="hidden" {...workForm.register("scheduleGroupId")} /><FieldGroup className="grid gap-4 md:grid-cols-2"><ScheduleField label="Employee"><NativeSelect className="w-full" {...workForm.register("employeeId")}>{workEmployees.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect></ScheduleField><ScheduleField label="Effective from"><Input type="date" {...workForm.register("effectiveFrom")} /></ScheduleField><ScheduleField label="Expected time in"><Input type="time" {...workForm.register("expectedTimeIn")} /></ScheduleField><ScheduleField label="Expected time out"><Input type="time" {...workForm.register("expectedTimeOut")} /></ScheduleField><ScheduleField label="Break minutes"><Input type="number" min="0" {...workForm.register("breakMinutes", { valueAsNumber: true })} /></ScheduleField><ScheduleField label="Required hours"><Input type="number" min="0.25" step="0.25" {...workForm.register("requiredHours", { valueAsNumber: true })} /></ScheduleField></FieldGroup><WorkingDaysField form={workForm} /><FieldError>{firstError(workForm.formState.errors)}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={() => setWorkOpen(false)}>Cancel</Button><Button type="submit" disabled={workForm.formState.isSubmitting}>Save schedule</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={facultyOpen} onOpenChange={setFacultyOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Faculty teaching schedule</DialogTitle><DialogDescription>The same class and time will be repeated on every selected day.</DialogDescription></DialogHeader><form onSubmit={facultyForm.handleSubmit(submitFaculty)} className="flex flex-col gap-5"><input type="hidden" {...facultyForm.register("scheduleGroupId")} /><FieldGroup className="grid gap-4 md:grid-cols-2"><ScheduleField label="Employee"><NativeSelect className="w-full" {...facultyForm.register("employeeId")}>{facultyEmployees.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect></ScheduleField><ScheduleField label="Effective from"><Input type="date" {...facultyForm.register("effectiveFrom")} /></ScheduleField><ScheduleField label="Subject or class"><Input {...facultyForm.register("subjectOrClass")} /></ScheduleField><ScheduleField label="Room or section"><Input {...facultyForm.register("roomOrSection")} /></ScheduleField><ScheduleField label="Start time"><Input type="time" {...facultyForm.register("startTime")} /></ScheduleField><ScheduleField label="End time"><Input type="time" {...facultyForm.register("endTime")} /></ScheduleField><Field className="md:col-span-2"><FieldLabel>Remarks</FieldLabel><Textarea {...facultyForm.register("remarks")} /></Field></FieldGroup><WorkingDaysField form={facultyForm} /><FieldError>{firstError(facultyForm.formState.errors)}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={() => setFacultyOpen(false)}>Cancel</Button><Button type="submit" disabled={facultyForm.formState.isSubmitting}>Save schedule</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}

function WorkingDaysField<T extends WorkScheduleValues | FacultyScheduleValues>({ form }: { form: UseFormReturn<T> }) {
  const daysForm = form as unknown as UseFormReturn<WorkScheduleValues>;
  const selected = daysForm.watch("workingDays") as DayOfWeek[];
  const setDays = (days: DayOfWeek[]) => daysForm.setValue("workingDays", days, { shouldValidate: true, shouldDirty: true });
  const toggle = (day: DayOfWeek, checked: boolean) => setDays(checked ? [...new Set([...selected, day])] : selected.filter((item) => item !== day));
  return <FieldSet><FieldLegend>Working Days</FieldLegend><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDays(dayValues.slice(0, 5) as DayOfWeek[])}>Monday to Friday</Button><Button type="button" size="sm" variant="outline" onClick={() => setDays(["MONDAY","WEDNESDAY","FRIDAY"])}>Monday, Wednesday, Friday</Button><Button type="button" size="sm" variant="outline" onClick={() => setDays(["TUESDAY","THURSDAY"])}>Tuesday, Thursday</Button><Button type="button" size="sm" variant="ghost" onClick={() => setDays([])}>Clear Selection</Button></div><div data-slot="checkbox-group" className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">{dayValues.map((day) => <Field key={day} orientation="horizontal"><Checkbox id={`${form.control._names.mount.size}-${day}`} checked={selected.includes(day)} onCheckedChange={(checked) => toggle(day, checked === true)} /><FieldLabel>{dayLabels[day]}</FieldLabel></Field>)}</div></FieldSet>;
}

function workDefaults(employeeId: string, effectiveFrom: string): WorkScheduleValues { return { employeeId, workingDays: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"], effectiveFrom, expectedTimeIn: "08:00", expectedTimeOut: "17:00", breakMinutes: 60, requiredHours: 8 }; }
function facultyDefaults(employeeId: string, effectiveFrom: string): FacultyScheduleValues { return { employeeId, subjectOrClass: "", workingDays: ["MONDAY"], effectiveFrom, startTime: "08:00", endTime: "09:00", roomOrSection: "", remarks: "" }; }
function ScheduleField({ label, children }: { label: string; children: React.ReactNode }) { return <Field><FieldLabel>{label}</FieldLabel>{children}</Field>; }
function formatDays(days: DayOfWeek[]) { return days.map((day) => dayLabels[day].slice(0, 3)).join(", "); }
function formatPeriod(from: string, to: string | null) { return `${from} – ${to ?? "Present"}`; }
function isCurrent(row: { isActive: boolean; effectiveFrom: string; effectiveTo: string | null }, today: string) { return row.isActive && row.effectiveFrom <= today && (!row.effectiveTo || row.effectiveTo >= today); }
function firstError(errors: object) { return Object.values(errors)[0]?.message as string | undefined; }
function RowActions({ onEdit, onArchive, canArchive }: { onEdit: () => void; onArchive: () => void; canArchive: boolean }) { return <div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="Edit schedule" onClick={onEdit}><Pencil /></Button>{canArchive ? <Button size="icon-sm" variant="ghost" aria-label="End schedule" onClick={onArchive}><Archive /></Button> : null}</div>; }
function ScheduleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">No schedules found.</TableCell></TableRow>}</TableBody></Table></div>; }
