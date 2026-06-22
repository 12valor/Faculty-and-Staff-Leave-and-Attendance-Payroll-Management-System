import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MoreTimeRoundedIcon from "@mui/icons-material/MoreTimeRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import type { SvgIconComponent } from "@mui/icons-material";

export type NavigationItem = {
  title: string;
  href: string;
  icon: SvgIconComponent;
};

export const navigationItems: NavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: DashboardRoundedIcon },
  { title: "Employees", href: "/employees", icon: GroupsRoundedIcon },
  { title: "Attendance", href: "/attendance", icon: FactCheckRoundedIcon },
  { title: "Leave", href: "/leave", icon: EventAvailableRoundedIcon },
  { title: "Schedules", href: "/schedules", icon: CalendarMonthRoundedIcon },
  { title: "Payroll", href: "/payroll", icon: PaymentsRoundedIcon },
  { title: "Overtime and Overload", href: "/overtime-overload", icon: MoreTimeRoundedIcon },
  { title: "Reports", href: "/reports", icon: AssessmentRoundedIcon },
  { title: "Settings", href: "/settings", icon: SettingsRoundedIcon },
];

export const moduleMetadata = {
  employees: { title: "Employees", description: "Maintain faculty and staff profiles, employment details, and status records.", icon: GroupsRoundedIcon },
  attendance: { title: "Attendance", description: "Review daily time records, absences, late arrivals, and attendance summaries.", icon: FactCheckRoundedIcon },
  leave: { title: "Leave", description: "Prepare leave applications, balances, approvals, and CSC credit references.", icon: EventAvailableRoundedIcon },
  schedules: { title: "Schedules", description: "Organize work schedules, class assignments, and institutional calendars.", icon: CalendarMonthRoundedIcon },
  payroll: { title: "Payroll", description: "Prepare payroll periods, deductions, and printable local payroll records.", icon: PaymentsRoundedIcon },
  overtimeOverload: { title: "Overtime and Overload", description: "Track approved overtime hours and faculty overload assignments.", icon: MoreTimeRoundedIcon },
  reports: { title: "Reports", description: "Generate review-ready attendance, leave, payroll, and management reports.", icon: AssessmentRoundedIcon },
  settings: { title: "Settings", description: "Configure institutional details, local preferences, and system defaults.", icon: SettingsRoundedIcon },
} as const;
