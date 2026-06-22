import { z } from "zod";

export const leaveAllocationInputSchema = z.object({
  date: z.iso.date(),
  dayValue: z.union([z.literal(0.5), z.literal(1)]),
});

export const leaveRecordSchema = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  leaveType: z.enum(["VACATION", "SICK", "LEAVE_WITHOUT_PAY", "OTHER"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  otherIsPaid: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  remarks: z.string().trim().max(500).optional(),
  allocations: z.array(leaveAllocationInputSchema).min(1, "Select at least one scheduled leave date."),
}).refine((value) => value.endDate >= value.startDate, { message: "End date cannot be before start date.", path: ["endDate"] });

export const leaveCreditPeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export type LeaveRecordValues = z.infer<typeof leaveRecordSchema>;
