import { z } from "zod";

export const dayValues = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");
const workingDays = z.array(z.enum(dayValues)).min(1, "Select at least one working day.").refine((days) => new Set(days).size === days.length, "Working days cannot contain duplicates.");
const effectiveFrom = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid effective date.");

export const workScheduleSchema = z.object({
  id: z.string().optional(),
  scheduleGroupId: z.string().optional(),
  employeeId: z.string().min(1),
  workingDays,
  effectiveFrom,
  expectedTimeIn: time,
  expectedTimeOut: time,
  breakMinutes: z.number().int().min(0).max(480),
  requiredHours: z.number().positive().max(24),
});

export const facultyScheduleSchema = z.object({
  id: z.string().optional(),
  scheduleGroupId: z.string().optional(),
  employeeId: z.string().min(1),
  subjectOrClass: z.string().trim().min(1).max(150),
  workingDays,
  effectiveFrom,
  startTime: time,
  endTime: time,
  roomOrSection: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export type WorkScheduleValues = z.infer<typeof workScheduleSchema>;
export type FacultyScheduleValues = z.infer<typeof facultyScheduleSchema>;
