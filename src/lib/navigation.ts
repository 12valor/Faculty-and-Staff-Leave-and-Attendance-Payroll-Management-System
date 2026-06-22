import {
  Banknote,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardClock,
  Gauge,
  Settings,
  TimerReset,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: Gauge },
  { title: "Employees", href: "/employees", icon: UsersRound },
  { title: "Attendance", href: "/attendance", icon: ClipboardClock },
  { title: "Leave", href: "/leave", icon: CalendarDays },
  { title: "Schedules", href: "/schedules", icon: CalendarClock },
  { title: "Payroll", href: "/payroll", icon: Banknote },
  {
    title: "Overtime and Overload",
    href: "/overtime-overload",
    icon: TimerReset,
  },
  { title: "Reports", href: "/reports", icon: ChartNoAxesCombined },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const moduleMetadata = {
  employees: {
    title: "Employees",
    description:
      "Maintain faculty and staff profiles, employment details, and status records.",
    icon: UsersRound,
  },
  attendance: {
    title: "Attendance",
    description:
      "Review daily time records, absences, late arrivals, and attendance summaries.",
    icon: UserRoundCheck,
  },
  leave: {
    title: "Leave",
    description:
      "Prepare leave applications, balances, approvals, and CSC credit references.",
    icon: CalendarDays,
  },
  schedules: {
    title: "Schedules",
    description:
      "Organize work schedules, class assignments, and institutional calendars.",
    icon: CalendarClock,
  },
  payroll: {
    title: "Payroll",
    description:
      "Prepare payroll periods, deductions, and printable local payroll records.",
    icon: Banknote,
  },
  overtimeOverload: {
    title: "Overtime and Overload",
    description:
      "Track approved overtime hours and faculty overload assignments.",
    icon: TimerReset,
  },
  reports: {
    title: "Reports",
    description:
      "Generate review-ready attendance, leave, payroll, and management reports.",
    icon: ChartNoAxesCombined,
  },
  settings: {
    title: "Settings",
    description:
      "Configure institutional details, local preferences, and system defaults.",
    icon: Settings,
  },
} as const;
