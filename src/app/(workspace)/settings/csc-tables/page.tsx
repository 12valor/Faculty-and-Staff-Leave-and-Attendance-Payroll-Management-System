import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPrisma } from "@/lib/prisma";

export default async function CscTablesPage() {
  const [monthly, daily, lwop, time] = await Promise.all([
    getPrisma().cscMonthlyLeaveCredit.findMany({ orderBy: { numberOfMonths: "asc" } }),
    getPrisma().cscDailyLeaveCredit.findMany({ orderBy: { numberOfDays: "asc" } }),
    getPrisma().cscLwopLeaveCredit.findMany({ orderBy: { daysPresent: "desc" } }),
    getPrisma().cscTimeConversion.findMany({ orderBy: [{ unit: "asc" }, { value: "asc" }] }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="CSC Computation Tables" description="Official view-only reference values imported from the local CSV source files." />
      <Tabs defaultValue="monthly">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="monthly">Monthly Leave Credits</TabsTrigger>
          <TabsTrigger value="daily">Daily Leave Credits</TabsTrigger>
          <TabsTrigger value="lwop">LWOP Leave Credits</TabsTrigger>
          <TabsTrigger value="time">Time Conversion</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly" className="mt-4"><CscCard title="Monthly Leave Credits" source="data/csc_monthly_leave_credits.csv" count={monthly.length} headers={["Months", "Vacation earned", "Sick earned"]} rows={monthly.map((row) => [row.numberOfMonths, row.vacationLeaveEarned.toString(), row.sickLeaveEarned.toString()])} /></TabsContent>
        <TabsContent value="daily" className="mt-4"><CscCard title="Daily Leave Credits" source="data/csc_daily_leave_credits.csv" count={daily.length} headers={["Days", "Vacation earned", "Sick earned"]} rows={daily.map((row) => [row.numberOfDays, row.vacationLeaveEarned.toString(), row.sickLeaveEarned.toString()])} /></TabsContent>
        <TabsContent value="lwop" className="mt-4"><CscCard title="LWOP Leave Credits" source="data/csc_lwop_leave_credits.csv" count={lwop.length} headers={["Days present", "Days on LWOP", "Credits earned"]} rows={lwop.map((row) => [row.daysPresent.toString(), row.daysOnLwop.toString(), row.leaveCreditsEarned.toString()])} /></TabsContent>
        <TabsContent value="time" className="mt-4"><CscCard title="Time Conversion" source="data/csc_time_conversions.csv" count={time.length} headers={["Unit", "Value", "Equivalent day"]} rows={time.map((row) => [row.unit, row.value, row.equivalentDay.toString()])} /></TabsContent>
      </Tabs>
    </section>
  );
}

function CscCard({ title, source, count, headers, rows }: { title: string; source: string; count: number; headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">Source: {source}</CardDescription></div>
          <Badge variant="secondary">{count} rows · View only</Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{row.map((value, cell) => <TableCell key={cell} className="font-mono">{value}</TableCell>)}</TableRow>)}</TableBody></Table>
      </CardContent>
    </Card>
  );
}