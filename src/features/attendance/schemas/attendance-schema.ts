import { z } from "zod";

const optionalTime = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]).optional();
export const attendanceEntrySchema = z.object({
  id: z.string().optional(), employeeId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timeIn: optionalTime, timeOut: optionalTime,
  statusOverride: z.enum(["PRESENT","LATE","ABSENT","ON_LEAVE","UNDERTIME","INCOMPLETE","LATE_UNDERTIME","NO_SCHEDULE"]).optional().or(z.literal("")),
  overrideReason: z.string().trim().max(300).optional(), remarks: z.string().trim().max(500).optional(),
}).superRefine((value, context) => { if (value.statusOverride && !value.overrideReason) context.addIssue({ code: "custom", path: ["overrideReason"], message: "An override reason is required." }); });
export const bulkAttendanceSchema = z.object({ rows: z.array(attendanceEntrySchema).min(1) });
export type AttendanceEntryValues = z.infer<typeof attendanceEntrySchema>;
export type BulkAttendanceValues = z.infer<typeof bulkAttendanceSchema>;
