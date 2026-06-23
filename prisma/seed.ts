import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";

import { CscTimeUnit, PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function decimal(value: string) {
  return value.replace(",", ".");
}

async function readCsv(fileName: string) {
  const filePath = path.join(process.cwd(), "data", fileName);
  const content = await readFile(filePath, "utf8");
  return content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

async function seedAdmin() {
  const existing = await prisma.adminUser.findUnique({ where: { username: "admin" } });
  if (existing) return existing;

  return prisma.adminUser.create({
    data: {
      username: "admin",
      passwordHash: await hash("admin123", 12),
    },
  });
}

async function seedSettings() {
  const settings = [
    ["workingDaysPerMonth", "22", "number", "Working days used for monthly salary calculations."],
    ["standardWorkHoursPerDay", "8", "number", "Standard working hours in one day."],
    ["lateGraceMinutes", "15", "number", "Fixed grace period before late minutes are counted."],
    ["regularTeachingLoadHours", "18", "number", "Regular weekly faculty teaching load."],
    ["overtimeMultiplier", "1.25", "number", "Multiplier applied to the calculated hourly rate for approved overtime."],
  ] as const;

  for (const [key, value, valueType, description] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value, valueType, description },
    });
  }
}

async function seedMonthlyCredits() {
  const rows = (await readCsv("csc_monthly_leave_credits.csv")).slice(1);
  for (const row of rows) {
    const numberOfMonths = Number(row[0]);
    const data = {
      numberOfMonths,
      vacationLeaveEarned: decimal(row[1]),
      sickLeaveEarned: decimal(row[2]),
    };
    await prisma.cscMonthlyLeaveCredit.upsert({
      where: { numberOfMonths },
      update: data,
      create: data,
    });
  }
}

async function seedDailyCredits() {
  const rows = (await readCsv("csc_daily_leave_credits.csv")).slice(1);
  for (const row of rows) {
    const numberOfDays = Number(row[0]);
    const data = {
      numberOfDays,
      vacationLeaveEarned: decimal(row[1]),
      sickLeaveEarned: decimal(row[2]),
    };
    await prisma.cscDailyLeaveCredit.upsert({
      where: { numberOfDays },
      update: data,
      create: data,
    });
  }
}

async function seedLwopCredits() {
  const rows = (await readCsv("csc_lwop_leave_credits.csv")).slice(1);
  for (const row of rows) {
    const data = {
      daysPresent: decimal(row[0]),
      daysOnLwop: decimal(row[1]),
      leaveCreditsEarned: decimal(row[2]),
    };
    await prisma.cscLwopLeaveCredit.upsert({
      where: {
        daysPresent_daysOnLwop: {
          daysPresent: decimal(row[0]),
          daysOnLwop: decimal(row[1]),
        },
      },
      update: data,
      create: data,
    });
  }
}

async function seedTimeConversions() {
  const rows = (await readCsv("csc_time_conversions.csv")).slice(1);
  let unit: "HOUR" | "MINUTE" = CscTimeUnit.HOUR;

  for (const row of rows) {
    if (row[0].toUpperCase() === "MINUTES") {
      unit = CscTimeUnit.MINUTE;
      continue;
    }

    const value = Number(row[0]);
    if (!Number.isFinite(value)) continue;

    const data = {
      unit,
      value,
      equivalentDay: decimal(row[1]),
    };
    await prisma.cscTimeConversion.upsert({
      where: { unit_value: { unit, value } },
      update: data,
      create: data,
    });
  }
}

async function main() {
  const admin = await seedAdmin();
  await seedSettings();
  await seedMonthlyCredits();
  await seedDailyCredits();
  await seedLwopCredits();
  await seedTimeConversions();

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "CSC_TABLES_SEEDED",
      entityType: "SYSTEM",
      summary: "CSC computation tables were seeded from local CSV sources.",
      metadata: JSON.stringify({ source: "data/*.csv" }),
    },
  });

  const counts = await Promise.all([
    prisma.cscMonthlyLeaveCredit.count(),
    prisma.cscDailyLeaveCredit.count(),
    prisma.cscLwopLeaveCredit.count(),
    prisma.cscTimeConversion.count(),
  ]);

  console.log({ admin: admin.username, monthly: counts[0], daily: counts[1], lwop: counts[2], time: counts[3] });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
