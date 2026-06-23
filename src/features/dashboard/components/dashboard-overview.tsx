import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AttendanceChart } from "@/features/dashboard/components/attendance-chart";
import {
  PayrollDeductionsTable,
  type DeductionRow,
} from "@/features/dashboard/components/payroll-deductions-table";

type DashboardData = {
  totalEmployees: number;
  facultyCount: number;
  staffCount: number;
  presentToday: number;
  attendanceRate: number;
  pendingLeave: number;
  deductionTotal: number;
  periodLabel: string;
  leaveStatuses: Array<{
    label: string;
    value: number;
    variant: "success" | "warning" | "destructive";
  }>;
  trend: Array<{ day: string; present: number; absent: number }>;
  deductions: DeductionRow[];
  today: string;
};

export function DashboardOverview({ data }: { data: DashboardData }) {
  const metrics = [
    {
      label: "Total employees",
      value: String(data.totalEmployees),
      detail: `${data.facultyCount} faculty · ${data.staffCount} staff`,
      icon: GroupsRoundedIcon,
    },
    {
      label: "Present today",
      value: String(data.presentToday),
      detail: `${data.attendanceRate}% attendance rate`,
      icon: EventAvailableRoundedIcon,
    },
    {
      label: "Pending leave",
      value: String(data.pendingLeave),
      detail: "Applications awaiting review",
      icon: AccessTimeFilledRoundedIcon,
    },
    {
      label: "Current deductions",
      value: `₱${data.deductionTotal.toLocaleString(undefined, {
        minimumFractionDigits: 2,
      })}`,
      detail: "Recorded attendance deductions",
      icon: PaymentsRoundedIcon,
    },
  ];
  const leaveTotal = data.leaveStatuses.reduce(
    (total, status) => total + status.value,
    0,
  );

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.03em] md:text-[1.75rem]">
            Institutional overview
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Live workforce activity for {data.today}.
          </p>
        </div>
        <Badge variant="outline" className="normal-case tracking-normal">
          {data.periodLabel}
        </Badge>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.label}
                className="flex min-h-36 flex-col justify-between gap-6 border-b p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(3)]:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0 xl:[&:nth-child(2)]:border-r xl:[&:nth-child(3)]:border-r"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                    <Icon aria-hidden="true" fontSize="small" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-[-0.035em] tabular-nums">
                    {metric.value}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.7fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Attendance trend</CardTitle>
            <CardDescription>
              Present and absent records over the last five days.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">{data.attendanceRate}% today</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={data.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Leave status</CardTitle>
            <CardDescription>
              Applications currently in the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="pb-5">
              <p className="text-3xl font-bold tracking-[-0.04em] tabular-nums">
                {leaveTotal}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total leave applications
              </p>
            </div>
            <div className="flex flex-col border-t">
              {data.leaveStatuses.map((status) => (
                <div
                  key={status.label}
                  className="flex min-h-14 items-center justify-between gap-4 border-b last:border-b-0"
                >
                  <p className="text-sm font-medium">{status.label}</p>
                  <Badge variant={status.variant}>{status.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Recent attendance deductions</CardTitle>
          <CardDescription>
            Latest computed deductions from encoded attendance.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              {data.deductions.length} recent records
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <PayrollDeductionsTable records={data.deductions} />
        </CardContent>
      </Card>
    </section>
  );
}
