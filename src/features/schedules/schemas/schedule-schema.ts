import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");
export const workScheduleSchema = z.object({ id: z.string().optional(), employeeId: z.string().min(1), dayOfWeek: z.enum(["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]), expectedTimeIn: time, expectedTimeOut: time, breakMinutes: z.number().int().min(0).max(480), requiredHours: z.number().positive().max(24) });
export const facultyScheduleSchema = z.object({ id: z.string().optional(), employeeId: z.string().min(1), subjectOrClass: z.string().trim().min(1).max(150), dayOfWeek: z.enum(["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]), startTime: time, endTime: time, roomOrSection: z.string().trim().max(100).optional(), remarks: z.string().trim().max(500).optional() });
export type WorkScheduleValues = z.infer<typeof workScheduleSchema>;
export type FacultyScheduleValues = z.infer<typeof facultyScheduleSchema>;