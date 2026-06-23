import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScheduleManager, type FacultyRow, type WorkRow } from "@/features/schedules/components/schedule-manager";
import type { DayOfWeek, EmployeeType, Prisma } from "@/generated/prisma/client";
import { todayInTimeZone } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function SchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const employeeId = value(params.employee);
  const day = value(params.day) as DayOfWeek | undefined;
  const type = value(params.type) as EmployeeType | undefined;
  const departmentId = value(params.department);
  const [employees, departments, workSchedules, facultySchedules] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { department: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().workSchedule.findMany({ where: { employeeId, employee: { employeeType: type, departmentId } }, include: { employee: true }, orderBy: [{ effectiveFrom: "desc" }, { expectedTimeIn: "asc" }] }),
    getPrisma().facultySchedule.findMany({ where: { employeeId, employee: { employeeType: type, departmentId } }, include: { employee: true }, orderBy: [{ effectiveFrom: "desc" }, { startTime: "asc" }] }),
  ]);
  const options = employees.map((employee) => ({ id: employee.id, label: `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}`, employeeType: employee.employeeType }));
  const workRows = groupWorkRows(workSchedules).filter((row) => !day || row.workingDays.includes(day));
  const facultyRows = groupFacultyRows(facultySchedules).filter((row) => !day || row.workingDays.includes(day));
  const today = todayInTimeZone();
  const summaries = options.map((employee) => ({
    employeeLabel: employee.label,
    workDays: workRows.filter((row) => row.employeeId === employee.id && current(row, today)).reduce((sum, row) => sum + row.workingDays.length, 0),
    teachingHours: facultyRows.filter((row) => row.employeeId === employee.id && current(row, today)).reduce((sum, row) => sum + row.totalTeachingHours * row.workingDays.length, 0),
  })).filter((summary) => summary.workDays > 0 || summary.teachingHours > 0);
  return <section className="flex flex-col gap-6"><PageTitle title="Schedules" description="Maintain effective-dated staff work patterns and faculty teaching assignments." /><form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5"><NativeSelect name="employee" defaultValue={employeeId ?? ""} className="w-full"><NativeSelectOption value="">All employees</NativeSelectOption>{options.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect><NativeSelect name="department" defaultValue={departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect><NativeSelect name="type" defaultValue={type ?? ""} className="w-full"><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="FACULTY">Faculty</NativeSelectOption><NativeSelectOption value="STAFF">Staff</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption></NativeSelect><NativeSelect name="day" defaultValue={day ?? ""} className="w-full"><NativeSelectOption value="">All days</NativeSelectOption>{["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect><Button type="submit">Apply filters</Button></form><ScheduleManager employees={options} workSchedules={workRows} facultySchedules={facultyRows} summaries={summaries} /></section>;
}

type WorkScheduleWithEmployee = Prisma.WorkScheduleGetPayload<{ include: { employee: true } }>;
type FacultyScheduleWithEmployee = Prisma.FacultyScheduleGetPayload<{ include: { employee: true } }>;

function groupWorkRows(rows: WorkScheduleWithEmployee[]): WorkRow[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(row.scheduleGroupId, [...(groups.get(row.scheduleGroupId) ?? []), row]);
  return [...groups.values()].map((group) => { const row = group[0]; return { scheduleGroupId: row.scheduleGroupId, employeeId: row.employeeId, employeeLabel: `${row.employee.employeeNumber} · ${row.employee.lastName}, ${row.employee.firstName}`, workingDays: group.map((item) => item.dayOfWeek), expectedTimeIn: row.expectedTimeIn, expectedTimeOut: row.expectedTimeOut, breakMinutes: row.breakMinutes, requiredHours: Number(row.requiredHours), effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, isActive: group.some((item) => item.isActive) }; });
}

function groupFacultyRows(rows: FacultyScheduleWithEmployee[]): FacultyRow[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(row.scheduleGroupId, [...(groups.get(row.scheduleGroupId) ?? []), row]);
  return [...groups.values()].map((group) => { const row = group[0]; return { scheduleGroupId: row.scheduleGroupId, employeeId: row.employeeId, employeeLabel: `${row.employee.employeeNumber} · ${row.employee.lastName}, ${row.employee.firstName}`, subjectOrClass: row.subjectOrClass, workingDays: group.map((item) => item.dayOfWeek), startTime: row.startTime, endTime: row.endTime, totalTeachingHours: Number(row.totalTeachingHours), roomOrSection: row.roomOrSection ?? "", remarks: row.remarks ?? "", effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, isActive: group.some((item) => item.isActive) }; });
}

function current(row: { isActive: boolean; effectiveFrom: string; effectiveTo: string | null }, today: string) { return row.isActive && row.effectiveFrom <= today && (!row.effectiveTo || row.effectiveTo >= today); }
function value(input: string | string[] | undefined) { return typeof input === "string" && input ? input : undefined; }
