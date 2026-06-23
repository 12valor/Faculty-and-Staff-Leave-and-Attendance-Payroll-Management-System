import Link from "next/link";
import { notFound } from "next/navigation";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Payslip } from "@/features/payroll/components/payslip";
import { PrintPayslipButton } from "@/features/payroll/components/print-payslip-button";
import { buildLivePayroll } from "@/features/payroll/lib/live-payroll";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { currentMonthRange } from "@/lib/dates";

export const metadata = { title: "Employee Payroll" };
export const dynamic = "force-dynamic";

export default async function EmployeePayrollPage({ params }: PageProps<"/payroll/[employeeId]">) {
  const [{ employeeId }, admin] = await Promise.all([params, requireCurrentAdmin()]);
  const period = currentMonthRange();
  let payroll;

  try {
    payroll = await buildLivePayroll(employeeId, period);
  } catch (error) {
    if (error instanceof Error && error.message === "FACULTY_OVERLOAD_RATE_REQUIRED") {
      return (
        <Card className="mx-auto max-w-2xl">
          <CardHeader><CardTitle>Payroll setup required</CardTitle><CardDescription>The faculty overload hourly rate must be configured before a full payslip can be calculated.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3"><Button nativeButton={false} render={<Link href="/settings" />}>Open Payroll Settings</Button><Button nativeButton={false} render={<Link href="/payroll" />} variant="outline">Back to Payroll</Button></CardContent>
        </Card>
      );
    }
    throw error;
  }

  if (!payroll) notFound();

  return (
    <section className="flex flex-col gap-5">
      <div data-print-hidden="true" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Button nativeButton={false} render={<Link href="/payroll" />} variant="outline"><ArrowBackRoundedIcon data-icon="inline-start" />Back to Payroll</Button>
        <PrintPayslipButton />
      </div>
      <Payslip payroll={payroll} preparedBy={admin.username} />
    </section>
  );
}
