import Link from "next/link";
import BookOpenCheck from "@mui/icons-material/MenuBookRounded";

import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveDepartmentAction, savePayrollRulesAction, savePositionAction, toggleDepartmentAction, togglePositionAction } from "@/features/settings/actions";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";

export default async function SettingsPage() {
  const [departments, positions, rules] = await Promise.all([
    getPrisma().department.findMany({ orderBy: { name: "asc" } }),
    getPrisma().position.findMany({ orderBy: { name: "asc" } }),
    getPayrollRules(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="Settings" description="Maintain institutional reference records and payroll computation defaults." actions={<Button nativeButton={false} render={<Link href="/settings/csc-tables" />} variant="outline"><BookOpenCheck data-icon="inline-start" />CSC Tables</Button>} />
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DirectoryCard title="Departments" description="Units used to classify employee records." rows={departments} saveAction={saveDepartmentAction} toggleAction={toggleDepartmentAction} />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <DirectoryCard title="Positions" description="Institutional job titles assigned to employees." rows={positions} saveAction={savePositionAction} toggleAction={togglePositionAction} />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll Rules</CardTitle><CardDescription>Defaults used by attendance deductions and future payroll generation.</CardDescription></CardHeader>
            <CardContent>
              <form action={savePayrollRulesAction} className="grid gap-4 md:grid-cols-2">
                <RuleInput name="workingDaysPerMonth" label="Working days per month" value={rules.workingDaysPerMonth} />
                <RuleInput name="standardWorkHoursPerDay" label="Standard work hours per day" value={rules.standardWorkHoursPerDay} />
                <RuleInput name="lateGraceMinutes" label="Late grace minutes" value={rules.lateGraceMinutes} />
                <RuleInput name="regularTeachingLoadHours" label="Regular teaching load hours" value={rules.regularTeachingLoadHours} />
                <RuleInput name="overtimeMultiplier" label="Overtime multiplier" value={rules.overtimeMultiplier} />
                <RuleInput name="facultyOverloadHourlyRate" label="Faculty overload rate per hour" value={rules.facultyOverloadHourlyRate ?? ""} required={false} />
                {rules.facultyOverloadHourlyRate === null ? <p className="md:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Set the faculty overload hourly rate before viewing automatic payroll.</p> : null}
                <div className="md:col-span-2"><Button type="submit">Save payroll rules</Button></div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function RuleInput({ name, label, value, required = true }: { name: string; label: string; value: number | string; required?: boolean }) {
  return <label className="flex flex-col gap-2 text-sm font-medium">{label}<Input name={name} type="number" step="0.01" min="0" defaultValue={value} required={required} /></label>;
}

type DirectoryRow = { id: string; name: string; description: string | null; isActive: boolean };
function DirectoryCard({ title, description, rows, saveAction, toggleAction }: { title: string; description: string; rows: DirectoryRow[]; saveAction: (formData: FormData) => Promise<void>; toggleAction: (formData: FormData) => Promise<void> }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form action={saveAction} className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <Input name="name" placeholder={`${title.slice(0, -1)} name`} required />
          <Input name="description" placeholder="Description (optional)" />
          <Button type="submit">Add</Button>
        </form>
        <div className="flex flex-col gap-3">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No records yet.</p> : rows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-center">
              <form action={saveAction} className="contents">
                <input type="hidden" name="id" value={row.id} />
                <Input name="name" defaultValue={row.name} required />
                <Input name="description" defaultValue={row.description ?? ""} />
                <Button type="submit" variant="outline">Save</Button>
              </form>
              <form action={toggleAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" variant={row.isActive ? "destructive" : "secondary"}>{row.isActive ? "Deactivate" : "Reactivate"}</Button>
              </form>
              <Badge variant={row.isActive ? "secondary" : "outline"} className="md:col-start-1">{row.isActive ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
