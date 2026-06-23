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

export function currentMonthRange(timeZone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthValue = String(month).padStart(2, "0");

  return {
    startDate: `${year}-${monthValue}-01`,
    endDate: `${year}-${monthValue}-${String(endDay).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "long",
      year: "numeric",
    }).format(new Date()),
  };
}
