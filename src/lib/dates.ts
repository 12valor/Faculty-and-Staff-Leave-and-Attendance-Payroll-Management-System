import type { DayOfWeek } from "@/generated/prisma/client";

const dayNames: DayOfWeek[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export function getDayOfWeek(date: string) {
  return dayNames[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function inclusiveDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function weekBounds(date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  const day = current.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + offset);
  const start = current.toISOString().slice(0, 10);
  current.setUTCDate(current.getUTCDate() + 6);
  return { start, end: current.toISOString().slice(0, 10) };
}
