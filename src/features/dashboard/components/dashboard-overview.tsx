import {
  CalendarCheck2,
  ClockAlert,
  PhilippinePeso,
  UsersRound,
} from "lucide-react";

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
import { PayrollDeductionsTable } from "@/features/dashboard/components/payroll-deductions-table";

const metrics = [
  {
    label: "Total employees",
    value: "150",
    detail: "112 faculty · 38 staff",
    icon: UsersRound,
  },
  {
    label: "Present today",
    value: "141",
    detail: "94% attendance rate",
    icon: CalendarCheck2,
  },
  {
    label: "Pending leave",
    value: "7",
    detail: "3 require review today",
    icon: ClockAlert,
  },
  {
    label: "Current deductions",
    value: "₱18,460",
    detail: "For the active payroll period",
    icon: PhilippinePeso,
  },
];

const leaveStatuses = [
  { label: "Approved", value: "18", variant: "secondary" as const },
  { label: "Pending review", value: "7", variant: "outline" as const },
  { label: "Needs documents", value: "3", variant: "destructive" as const },
];

export function DashboardOverview() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Institutional overview
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            A concise snapshot of workforce activity for June 23, 2026.
          </p>
        </div>
        <Badge variant="outline">Current payroll period · June 2026</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.label} className="shadow-sm">
              <CardHeader>
                <CardDescription>{metric.label}</CardDescription>
                <CardAction>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon aria-hidden="true" />
                  </div>
                </CardAction>
                <CardTitle className="font-mono text-2xl font-semibold">
                  {metric.value}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{metric.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Attendance trend</CardTitle>
            <CardDescription>
              Present and absent employees during the current work week.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceChart />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Leave status</CardTitle>
            <CardDescription>
              Applications currently moving through review.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {leaveStatuses.map((status) => (
              <div
                key={status.label}
                className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{status.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    June 2026
                  </p>
                </div>
                <Badge variant={status.variant}>{status.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Recent payroll deductions</CardTitle>
          <CardDescription>
            Static presentation data for the initial TanStack Table scaffold.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <PayrollDeductionsTable />
        </CardContent>
      </Card>
    </section>
  );
}
