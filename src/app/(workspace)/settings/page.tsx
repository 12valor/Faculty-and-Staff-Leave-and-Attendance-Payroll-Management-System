import Link from "next/link";
import BookOpenCheck from "@mui/icons-material/MenuBookRounded";

import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectoryCard } from "@/features/settings/components/directory-card";
import { PayrollRulesForm } from "@/features/settings/components/payroll-rules-form";
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
          <DirectoryCard title="Departments" description="Units used to classify employee records." rows={departments} kind="department" />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <DirectoryCard title="Positions" description="Institutional job titles assigned to employees." rows={positions} kind="position" />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll Rules</CardTitle><CardDescription>Defaults used by attendance deductions and future payroll generation.</CardDescription></CardHeader>
            <CardContent>
              <PayrollRulesForm rules={rules} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

