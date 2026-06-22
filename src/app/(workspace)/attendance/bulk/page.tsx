import { PageTitle } from "@/components/page-title";
import { BulkAttendanceForm } from "@/features/attendance/components/bulk-attendance-form";
import { getPrisma } from "@/lib/prisma";

export default async function BulkAttendancePage() {
  const employees = await getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  return <section className="flex flex-col gap-6"><PageTitle title="Bulk Attendance Encoding" description="Encode multiple employees for one day. The entire batch rolls back if any selected row is invalid." /><BulkAttendanceForm employees={employees.map((employee) => ({ id: employee.id, label: `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}` }))} /></section>;
}