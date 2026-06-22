import { z } from "zod";

export const employeeSchema = z.object({
  id: z.string().optional(),
  employeeNumber: z.string().trim().min(1).max(30),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1).max(80),
  suffix: z.string().trim().max(20).optional(),
  employeeType: z.enum(["FACULTY", "STAFF", "FACULTY_WITH_STAFF_WORK"]),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  monthlySalary: z.number().min(0),
  serviceStartDate: z.iso.date(),
  serviceEndDate: z.union([z.iso.date(), z.literal("")]).optional(),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  remarks: z.string().trim().max(500).optional(),
}).refine((value) => !value.serviceEndDate || value.serviceEndDate >= value.serviceStartDate, {
  message: "Service end date cannot be before the start date.",
  path: ["serviceEndDate"],
});

export type EmployeeValues = z.infer<typeof employeeSchema>;
