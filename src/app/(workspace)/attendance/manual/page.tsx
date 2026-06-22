import { PageTitle } from "@/components/page-title";
import { ManualAttendanceForm } from "@/features/attendance/components/manual-attendance-form";
import type { AttendanceEntryValues } from "@/features/attendance/schemas/attendance-schema";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function ManualAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const id = typeof params.id === "string" ? params.id : undefined;
  const [employees, record] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    id ? getPrisma().attendanceRecord.findUnique({ where: { id } }) : null,
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const initialValues: AttendanceEntryValues = record ? { id: record.id, employeeId: record.employeeId, date: record.date, timeIn: record.timeIn ?? "", timeOut: record.timeOut ?? "", statusOverride: record.isStatusOverridden ? record.status : "", overrideReason: record.overrideReason ?? "", remarks: record.remarks ?? "" } : { employeeId: employees[0]?.id ?? "", date: today, timeIn: "", timeOut: "", statusOverride: "", overrideReason: "", remarks: "" };
  return <section className="flex flex-col gap-6"><PageTitle title={record ? "Edit Attendance" : "Manual Attendance"} description="Encode one daily attendance record and review its computed deduction before saving." /><ManualAttendanceForm employees={employees.map((employee) => ({ id: employee.id, label: `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}` }))} initialValues={initialValues} /></section>;
}