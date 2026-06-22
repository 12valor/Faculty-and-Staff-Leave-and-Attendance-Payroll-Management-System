import { z } from "zod";

export const payrollPeriodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).refine((value) => value.endDate >= value.startDate, { message: "End date cannot be before start date.", path: ["endDate"] });

export type PayrollPeriodValues = z.infer<typeof payrollPeriodSchema>;
