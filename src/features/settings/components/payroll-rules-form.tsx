"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePayrollRulesAction } from "@/features/settings/actions";

const SERVER_ACTION_ERROR = "The server connection was interrupted. Refresh the page and try again.";

type PayrollRules = {
  workingDaysPerMonth: number;
  standardWorkHoursPerDay: number;
  absencePenaltyAmount: number;
  regularTeachingLoadHours: number;
  overtimeMultiplier: number;
  automaticOvertimeBonus: number;
  facultyOverloadHourlyRate: number | null;
};

export function PayrollRulesForm({ rules }: { rules: PayrollRules }) {
  async function handleSave(formData: FormData) {
    try {
      const result = await savePayrollRulesAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payroll rules saved.");
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  return (
    <form action={handleSave} className="grid gap-4 md:grid-cols-2">
      <RuleInput name="workingDaysPerMonth" label="Working days per month" value={rules.workingDaysPerMonth} />
      <RuleInput name="standardWorkHoursPerDay" label="Standard work hours per day" value={rules.standardWorkHoursPerDay} />
      <label className="flex flex-col gap-2 text-sm font-medium">Late grace minutes (fixed)<Input name="lateGraceMinutes" type="number" value={15} readOnly aria-readonly="true" /><span className="text-xs font-normal text-muted-foreground">Attendance always uses a 15-minute grace period.</span></label>
      <RuleInput name="absencePenaltyAmount" label="Absence / 8-hour late penalty (PHP)" value={rules.absencePenaltyAmount} />
      <RuleInput name="regularTeachingLoadHours" label="Regular teaching load hours" value={rules.regularTeachingLoadHours} />
      <RuleInput name="overtimeMultiplier" label="Overtime multiplier" value={rules.overtimeMultiplier} />
      <RuleInput name="automaticOvertimeBonus" label="Automatic overtime bonus per day (PHP)" value={rules.automaticOvertimeBonus} />
      <RuleInput name="facultyOverloadHourlyRate" label="Faculty overload rate per hour" value={rules.facultyOverloadHourlyRate ?? ""} required={false} />
      {rules.facultyOverloadHourlyRate === null ? <p className="md:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Set the faculty overload hourly rate before viewing automatic payroll.</p> : null}
      <div className="md:col-span-2"><Button type="submit">Save payroll rules</Button></div>
    </form>
  );
}

function RuleInput({ name, label, value, required = true }: { name: string; label: string; value: number | string; required?: boolean }) {
  return <label className="flex flex-col gap-2 text-sm font-medium">{label}<Input key={`${name}:${value}`} name={name} type="number" step="0.01" min="0" defaultValue={value} required={required} /></label>;
}