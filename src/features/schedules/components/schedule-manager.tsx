"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Archive from "@mui/icons-material/ArchiveRounded";
import Pencil from "@mui/icons-material/EditRounded";
import Plus from "@mui/icons-material/AddRounded";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
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
import { archiveScheduleAction, saveFacultyScheduleAction, saveWorkScheduleAction } from "@/features/schedules/actions";
import { facultyScheduleSchema, type FacultyScheduleValues, workScheduleSchema, type WorkScheduleValues } from "@/features/schedules/schemas/schedule-schema";

const days = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;
type EmployeeOption = { id: string; label: string; employeeType: "FACULTY" | "STAFF" | "FACULTY_WITH_STAFF_WORK" };
export type WorkRow = WorkScheduleValues & { id: string; employeeLabel: string; isActive: boolean };
export type FacultyRow = FacultyScheduleValues & { id: string; employeeLabel: string; totalTeachingHours: number; isActive: boolean };

export function ScheduleManager({ employees, workSchedules, facultySchedules, summaries }: { employees: EmployeeOption[]; workSchedules: WorkRow[]; facultySchedules: FacultyRow[]; summaries: Array<{ employeeLabel: string; workDays: number; teachingHours: number }> }) {
  const [workOpen, setWorkOpen] = useState(false); const [facultyOpen, setFacultyOpen] = useState(false);
  const workForm = useForm<WorkScheduleValues>({ resolver: zodResolver(workScheduleSchema), defaultValues: { employeeId: "", dayOfWeek: "MONDAY", expectedTimeIn: "08:00", expectedTimeOut: "17:00", breakMinutes: 60, requiredHours: 8 } });
  const facultyForm = useForm<FacultyScheduleValues>({ resolver: zodResolver(facultyScheduleSchema), defaultValues: { employeeId: "", subjectOrClass: "", dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00", roomOrSection: "", remarks: "" } });
  const workEmployees = employees.filter((item) => item.employeeType !== "FACULTY"); const facultyEmployees = employees.filter((item) => item.employeeType !== "STAFF");

  function openWork(row?: WorkRow) { workForm.reset(row ?? { employeeId: workEmployees[0]?.id ?? "", dayOfWeek: "MONDAY", expectedTimeIn: "08:00", expectedTimeOut: "17:00", breakMinutes: 60, requiredHours: 8 }); setWorkOpen(true); }
  function openFaculty(row?: FacultyRow) { facultyForm.reset(row ?? { employeeId: facultyEmployees[0]?.id ?? "", subjectOrClass: "", dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00", roomOrSection: "", remarks: "" }); setFacultyOpen(true); }
  async function submitWork(values: WorkScheduleValues) { const result = await saveWorkScheduleAction(values); if (!result.ok) return toast.error(result.error); toast.success("Staff schedule saved."); setWorkOpen(false); }
  async function submitFaculty(values: FacultyScheduleValues) { const result = await saveFacultyScheduleAction(values); if (!result.ok) return toast.error(result.error); toast.success("Teaching schedule saved."); setFacultyOpen(false); }
  async function archive(kind: "work" | "faculty", id: string) { await archiveScheduleAction(kind, id); toast.success("Schedule archived."); }

  return (
    <>
      {summaries.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summaries.map((summary) => <div key={summary.employeeLabel} className="rounded-xl border bg-card p-4"><p className="font-medium">{summary.employeeLabel}</p><div className="mt-3 flex gap-2"><Badge variant="secondary">{summary.workDays} work days</Badge><Badge variant="outline">{summary.teachingHours.toFixed(2)} teaching hours</Badge></div></div>)}</div> : null}
      <Tabs defaultValue="work">
        <TabsList><TabsTrigger value="work">Staff Work Schedules</TabsTrigger><TabsTrigger value="faculty">Faculty Teaching Schedules</TabsTrigger></TabsList>
        <TabsContent value="work" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-end"><Button onClick={() => openWork()} disabled={!workEmployees.length}><Plus data-icon="inline-start" />Add staff schedule</Button></div>
          <ScheduleTable headers={["Employee","Day","Time","Break","Hours","Status","Actions"]} rows={workSchedules.map((row) => [row.employeeLabel, row.dayOfWeek, `${row.expectedTimeIn}–${row.expectedTimeOut}`, `${row.breakMinutes} min`, row.requiredHours, <Badge key="s" variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Archived"}</Badge>, <div key="a" className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="Edit staff schedule" onClick={() => openWork(row)}><Pencil /></Button>{row.isActive ? <Button size="icon-sm" variant="ghost" aria-label="Archive staff schedule" onClick={() => archive("work", row.id)}><Archive /></Button> : null}</div>])} />
        </TabsContent>
        <TabsContent value="faculty" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-end"><Button onClick={() => openFaculty()} disabled={!facultyEmployees.length}><Plus data-icon="inline-start" />Add teaching schedule</Button></div>
          <ScheduleTable headers={["Employee","Class","Day","Time","Hours","Room/Section","Status","Actions"]} rows={facultySchedules.map((row) => [row.employeeLabel, row.subjectOrClass, row.dayOfWeek, `${row.startTime}–${row.endTime}`, row.totalTeachingHours, row.roomOrSection || "—", <Badge key="s" variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Archived"}</Badge>, <div key="a" className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="Edit teaching schedule" onClick={() => openFaculty(row)}><Pencil /></Button>{row.isActive ? <Button size="icon-sm" variant="ghost" aria-label="Archive teaching schedule" onClick={() => archive("faculty", row.id)}><Archive /></Button> : null}</div>])} />
        </TabsContent>
      </Tabs>

      <Dialog open={workOpen} onOpenChange={setWorkOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Staff work schedule</DialogTitle><DialogDescription>One active work schedule per employee and day.</DialogDescription></DialogHeader><form onSubmit={workForm.handleSubmit(submitWork)} className="flex flex-col gap-4"><input type="hidden" {...workForm.register("id")} /><FieldGroup className="grid gap-4 md:grid-cols-2"><ScheduleField label="Employee"><NativeSelect className="w-full" {...workForm.register("employeeId")}>{workEmployees.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect></ScheduleField><DayField register={workForm.register("dayOfWeek")} /><ScheduleField label="Expected time in"><Input type="time" {...workForm.register("expectedTimeIn")} /></ScheduleField><ScheduleField label="Expected time out"><Input type="time" {...workForm.register("expectedTimeOut")} /></ScheduleField><ScheduleField label="Break minutes"><Input type="number" min="0" {...workForm.register("breakMinutes", { valueAsNumber: true })} /></ScheduleField><ScheduleField label="Required hours"><Input type="number" min="0.25" step="0.25" {...workForm.register("requiredHours", { valueAsNumber: true })} /></ScheduleField></FieldGroup><FieldError>{Object.values(workForm.formState.errors)[0]?.message}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={() => setWorkOpen(false)}>Cancel</Button><Button type="submit">Save schedule</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={facultyOpen} onOpenChange={setFacultyOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Faculty teaching schedule</DialogTitle><DialogDescription>Overlapping active classes are rejected.</DialogDescription></DialogHeader><form onSubmit={facultyForm.handleSubmit(submitFaculty)} className="flex flex-col gap-4"><input type="hidden" {...facultyForm.register("id")} /><FieldGroup className="grid gap-4 md:grid-cols-2"><ScheduleField label="Employee"><NativeSelect className="w-full" {...facultyForm.register("employeeId")}>{facultyEmployees.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect></ScheduleField><DayField register={facultyForm.register("dayOfWeek")} /><ScheduleField label="Subject or class"><Input {...facultyForm.register("subjectOrClass")} /></ScheduleField><ScheduleField label="Room or section"><Input {...facultyForm.register("roomOrSection")} /></ScheduleField><ScheduleField label="Start time"><Input type="time" {...facultyForm.register("startTime")} /></ScheduleField><ScheduleField label="End time"><Input type="time" {...facultyForm.register("endTime")} /></ScheduleField><Field className="md:col-span-2"><FieldLabel>Remarks</FieldLabel><Textarea {...facultyForm.register("remarks")} /></Field></FieldGroup><FieldError>{Object.values(facultyForm.formState.errors)[0]?.message}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={() => setFacultyOpen(false)}>Cancel</Button><Button type="submit">Save schedule</Button></DialogFooter></form></DialogContent></Dialog>
    </>
  );
}

function ScheduleField({ label, children }: { label: string; children: React.ReactNode }) { return <Field><FieldLabel>{label}</FieldLabel>{children}</Field>; }
function DayField({ register }: { register: UseFormRegisterReturn }) { return <ScheduleField label="Day"><NativeSelect className="w-full" {...register}>{days.map((day) => <NativeSelectOption key={day} value={day}>{day}</NativeSelectOption>)}</NativeSelect></ScheduleField>; }
function ScheduleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">No schedules found.</TableCell></TableRow>}</TableBody></Table></div>; }
