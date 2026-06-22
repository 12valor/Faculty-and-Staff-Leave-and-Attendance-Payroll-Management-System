import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScheduleManager, type FacultyRow, type WorkRow } from "@/features/schedules/components/schedule-manager";
import type { DayOfWeek, EmployeeType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function SchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const employeeId = typeof params.employee === "string" && params.employee ? params.employee : undefined;
  const day = typeof params.day === "string" && params.day ? params.day as DayOfWeek : undefined;
  const type = typeof params.type === "string" && params.type ? params.type as EmployeeType : undefined;
  const departmentId = typeof params.department === "string" && params.department ? params.department : undefined;
  const [employees, departments, workSchedules, facultySchedules] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { department: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().workSchedule.findMany({ where: { employeeId, dayOfWeek: day, employee: { employeeType: type, departmentId } }, include: { employee: true }, orderBy: [{ dayOfWeek: "asc" }, { expectedTimeIn: "asc" }] }),
    getPrisma().facultySchedule.findMany({ where: { employeeId, dayOfWeek: day, employee: { employeeType: type, departmentId } }, include: { employee: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
  ]);
  const options = employees.map((employee) => ({ id: employee.id, label: `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}`, employeeType: employee.employeeType }));
  const workRows: WorkRow[] = workSchedules.map((row) => ({ id: row.id, employeeId: row.employeeId, employeeLabel: `${row.employee.employeeNumber} · ${row.employee.lastName}, ${row.employee.firstName}`, dayOfWeek: row.dayOfWeek, expectedTimeIn: row.expectedTimeIn, expectedTimeOut: row.expectedTimeOut, breakMinutes: row.breakMinutes, requiredHours: Number(row.requiredHours), isActive: row.isActive }));
  const facultyRows: FacultyRow[] = facultySchedules.map((row) => ({ id: row.id, employeeId: row.employeeId, employeeLabel: `${row.employee.employeeNumber} · ${row.employee.lastName}, ${row.employee.firstName}`, subjectOrClass: row.subjectOrClass, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime, totalTeachingHours: Number(row.totalTeachingHours), roomOrSection: row.roomOrSection ?? "", remarks: row.remarks ?? "", isActive: row.isActive }));
  const summaries = options.map((employee) => ({ employeeLabel: employee.label, workDays: workRows.filter((row) => row.employeeId === employee.id && row.isActive).length, teachingHours: facultyRows.filter((row) => row.employeeId === employee.id && row.isActive).reduce((sum, row) => sum + row.totalTeachingHours, 0) })).filter((summary) => summary.workDays > 0 || summary.teachingHours > 0);
  return <section className="flex flex-col gap-6"><PageTitle title="Schedules" description="Maintain staff work schedules and faculty teaching assignments." /><form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5"><NativeSelect name="employee" defaultValue={employeeId ?? ""} className="w-full"><NativeSelectOption value="">All employees</NativeSelectOption>{options.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect><NativeSelect name="department" defaultValue={departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect><NativeSelect name="type" defaultValue={type ?? ""} className="w-full"><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="FACULTY">Faculty</NativeSelectOption><NativeSelectOption value="STAFF">Staff</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption></NativeSelect><NativeSelect name="day" defaultValue={day ?? ""} className="w-full"><NativeSelectOption value="">All days</NativeSelectOption>{["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect><Button type="submit">Apply filters</Button></form><ScheduleManager employees={options} workSchedules={workRows} facultySchedules={facultyRows} summaries={summaries} /></section>;
}