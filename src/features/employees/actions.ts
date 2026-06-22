"use server";

import { revalidatePath } from "next/cache";

import { employeeSchema, type EmployeeValues } from "@/features/employees/schemas/employee-schema";
import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { getPrisma } from "@/lib/prisma";

export async function saveEmployeeAction(values: EmployeeValues) {
  const admin = await requireCurrentAdmin();
  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid employee data." };
  const { id, monthlySalary, middleName, suffix, remarks, serviceEndDate, ...rest } = parsed.data;
  try {
    if (id) {
      const before = await getPrisma().employee.findUniqueOrThrow({ where: { id } });
      const employee = await getPrisma().employee.update({ where: { id }, data: { ...rest, monthlySalary, middleName: middleName || null, suffix: suffix || null, serviceEndDate: serviceEndDate || null, remarks: remarks || null } });
      await createAuditLog({ adminId: admin.id, action: "EMPLOYEE_UPDATED", entityType: "EMPLOYEE", entityId: id, summary: `Employee ${employee.employeeNumber} was updated.`, metadata: { before, after: employee } });
    } else {
      const employee = await getPrisma().employee.create({ data: { ...rest, monthlySalary, middleName: middleName || null, suffix: suffix || null, serviceEndDate: serviceEndDate || null, remarks: remarks || null, leaveBalance: { create: {} } } });
      await createAuditLog({ adminId: admin.id, action: "EMPLOYEE_CREATED", entityType: "EMPLOYEE", entityId: employee.id, summary: `Employee ${employee.employeeNumber} was created.` });
    }
    revalidatePath("/employees");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message.includes("Unique constraint") ? "Employee number already exists." : "Unable to save employee." };
  }
}

export async function setEmployeeStatusAction(id: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  const admin = await requireCurrentAdmin();
  const employee = await getPrisma().employee.update({ where: { id }, data: { employmentStatus: status } });
  await createAuditLog({ adminId: admin.id, action: status === "ARCHIVED" ? "EMPLOYEE_ARCHIVED" : "EMPLOYEE_STATUS_CHANGED", entityType: "EMPLOYEE", entityId: id, summary: `Employee ${employee.employeeNumber} status changed to ${status}.` });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return { ok: true };
}
