"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveEmployeeAction, setEmployeeStatusAction } from "@/features/employees/actions";
import { employeeSchema, type EmployeeValues } from "@/features/employees/schemas/employee-schema";

type Reference = { id: string; name: string };
export type EmployeeRow = EmployeeValues & { id: string; departmentName: string; positionName: string; fullName: string };

type Mode = "create" | "edit" | "view";

const emptyValues: EmployeeValues = { employeeNumber: "", firstName: "", middleName: "", lastName: "", suffix: "", employeeType: "STAFF", departmentId: "", positionId: "", monthlySalary: 0, serviceStartDate: new Date().toISOString().slice(0, 10), serviceEndDate: "", employmentStatus: "ACTIVE", remarks: "" };
const SERVER_ACTION_ERROR = "The server connection was interrupted. Refresh the page and try again.";

export function EmployeeManager({ employees, departments, positions }: { employees: EmployeeRow[]; departments: Reference[]; positions: Reference[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const form = useForm<EmployeeValues>({ resolver: zodResolver(employeeSchema), defaultValues: emptyValues });

  function show(modeValue: Mode, employee?: EmployeeRow) {
    setMode(modeValue);
    setSelected(employee ?? null);
    form.reset(employee ?? { ...emptyValues, departmentId: departments[0]?.id ?? "", positionId: positions[0]?.id ?? "" });
    setOpen(true);
  }

  async function submit(values: EmployeeValues) {
    try {
      const result = await saveEmployeeAction(values);
      if (!result.ok) return toast.error(result.error);
      toast.success(values.id ? "Employee updated." : "Employee created.");
      setOpen(false);
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  async function changeStatus(employee: EmployeeRow) {
    const status = employee.employmentStatus === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    try {
      const result = await setEmployeeStatusAction(employee.id, status);
      if (!result.ok) return toast.error(result.error);
      toast.success(status === "ARCHIVED" ? "Employee archived." : "Employee reactivated.");
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  const columns: ColumnDef<EmployeeRow>[] = [
    { accessorKey: "employeeNumber", header: "Employee No." },
    { accessorKey: "fullName", header: "Employee", cell: ({ row }) => <div><p className="font-medium">{row.original.fullName}</p><p className="text-xs text-muted-foreground">{row.original.departmentName} · {row.original.positionName}</p></div> },
    { accessorKey: "employeeType", header: "Type", cell: ({ row }) => <Badge variant="secondary">{row.original.employeeType.replaceAll("_", " ")}</Badge> },
    { accessorKey: "monthlySalary", header: "Monthly salary", cell: ({ row }) => <span className="font-mono">₱{Number(row.original.monthlySalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
    { accessorKey: "employmentStatus", header: "Status", cell: ({ row }) => <Badge variant={row.original.employmentStatus === "ACTIVE" ? "secondary" : "outline"}>{row.original.employmentStatus}</Badge> },
    { id: "actions", header: "Actions", cell: ({ row }) => <div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="View employee" onClick={() => show("view", row.original)}><VisibilityRoundedIcon /></Button><Button size="icon-sm" variant="ghost" aria-label="Edit employee" onClick={() => show("edit", row.original)}><EditRoundedIcon /></Button><Button size="icon-sm" variant="ghost" aria-label={row.original.employmentStatus === "ARCHIVED" ? "Reactivate employee" : "Archive employee"} onClick={() => changeStatus(row.original)}><ArchiveRoundedIcon /></Button></div> },
  ];

  // TanStack Table intentionally returns a mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: employees, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => show("create")} disabled={!departments.length || !positions.length}><AddRoundedIcon data-icon="inline-start" />Add employee</Button></div>
      {!departments.length || !positions.length ? <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">Add at least one active department and position in Settings before creating employees.</p> : null}
      <div className="data-table-shell">
        <Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No employees match the current filters.</TableCell></TableRow>}</TableBody></Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{mode === "create" ? "Add employee" : mode === "edit" ? "Edit employee" : "Employee details"}</DialogTitle><DialogDescription>Employees are records only and never receive login access.</DialogDescription></DialogHeader>
          {mode === "view" && selected ? <EmployeeDetails employee={selected} /> : (
            <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
              <input type="hidden" {...form.register("id")} />
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <EmployeeField label="Employee number" error={form.formState.errors.employeeNumber?.message}><Input {...form.register("employeeNumber")} aria-invalid={Boolean(form.formState.errors.employeeNumber)} /></EmployeeField>
                <EmployeeField label="First name" error={form.formState.errors.firstName?.message}><Input {...form.register("firstName")} /></EmployeeField>
                <EmployeeField label="Middle name"><Input {...form.register("middleName")} /></EmployeeField>
                <EmployeeField label="Last name" error={form.formState.errors.lastName?.message}><Input {...form.register("lastName")} /></EmployeeField>
                <EmployeeField label="Suffix"><Input {...form.register("suffix")} /></EmployeeField>
                <EmployeeField label="Employee type"><NativeSelect className="w-full" {...form.register("employeeType")}><NativeSelectOption value="FACULTY">FACULTY</NativeSelectOption><NativeSelectOption value="STAFF">STAFF</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">FACULTY WITH STAFF WORK</NativeSelectOption></NativeSelect></EmployeeField>
                <EmployeeField label="Department"><NativeSelect className="w-full" {...form.register("departmentId")}>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></EmployeeField>
                <EmployeeField label="Position"><NativeSelect className="w-full" {...form.register("positionId")}>{positions.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></EmployeeField>
                <EmployeeField label="Monthly salary"><Input type="number" min="0" step="0.01" {...form.register("monthlySalary", { valueAsNumber: true })} /></EmployeeField>
                <EmployeeField label="Service start" error={form.formState.errors.serviceStartDate?.message}><Input type="date" {...form.register("serviceStartDate")} /></EmployeeField>
                <EmployeeField label="Service end" error={form.formState.errors.serviceEndDate?.message}><Input type="date" {...form.register("serviceEndDate")} /></EmployeeField>
                <EmployeeField label="Employment status"><NativeSelect className="w-full" {...form.register("employmentStatus")}><NativeSelectOption value="ACTIVE">ACTIVE</NativeSelectOption><NativeSelectOption value="INACTIVE">INACTIVE</NativeSelectOption><NativeSelectOption value="ARCHIVED">ARCHIVED</NativeSelectOption></NativeSelect></EmployeeField>
                <Field className="md:col-span-2"><FieldLabel>Remarks</FieldLabel><Textarea {...form.register("remarks")} /></Field>
              </FieldGroup>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Save employee"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmployeeField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <Field data-invalid={Boolean(error)}><FieldLabel>{label}</FieldLabel>{children}<FieldError>{error}</FieldError></Field>; }
function EmployeeDetails({ employee }: { employee: EmployeeRow }) { return <div className="grid gap-4 rounded-xl bg-muted/50 p-4 md:grid-cols-2">{[["Employee number", employee.employeeNumber],["Full name", employee.fullName],["Type", employee.employeeType.replaceAll("_", " ")],["Department", employee.departmentName],["Position", employee.positionName],["Monthly salary", `₱${Number(employee.monthlySalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],["Service dates", `${employee.serviceStartDate}${employee.serviceEndDate ? ` to ${employee.serviceEndDate}` : " onward"}`],["Status", employee.employmentStatus],["Remarks", employee.remarks || "—"]].map(([label,value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}</div>; }
