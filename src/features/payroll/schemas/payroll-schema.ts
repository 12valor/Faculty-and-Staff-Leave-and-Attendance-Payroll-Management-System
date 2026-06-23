import { z } from "zod";

export const payrollPeriodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).refine((value) => value.endDate >= value.startDate, { message: "End date cannot be before start date.", path: ["endDate"] });

export const manualPayrollSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee selection is required."),
  startDate: z.iso.date({ error: "Start date is required." }),
  endDate: z.iso.date({ error: "End date is required." }),
  label: z.string().trim().max(100, "Pay period label must be 100 characters or fewer.").optional(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

export type PayrollPeriodValues = z.infer<typeof payrollPeriodSchema>;
export type ManualPayrollValues = z.infer<typeof manualPayrollSchema>;
