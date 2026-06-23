"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { manualPayrollSchema, type ManualPayrollValues } from "@/features/payroll/schemas/payroll-schema";

type EmployeeOption = {
  id: string;
  employeeNumber: string;
  fullName: string;
  department: string;
  position: string;
};

export function ManualPayrollForm({
  employees,
  defaultStartDate,
  defaultEndDate,
}: {
  employees: EmployeeOption[];
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const router = useRouter();
  const form = useForm<ManualPayrollValues>({
    resolver: zodResolver(manualPayrollSchema),
    defaultValues: {
      employeeId: "",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      label: "Custom Payroll",
    },
  });

  function submit(values: ManualPayrollValues) {
    const query = new URLSearchParams({
      mode: "manual",
      startDate: values.startDate,
      endDate: values.endDate,
    });
    if (values.label?.trim()) query.set("label", values.label.trim());
    router.push(`/payroll/${values.employeeId}?${query.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Payroll / Custom Payroll</CardTitle>
        <CardDescription>
          Use manual payroll to generate payroll for any employee and selected date range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" data-invalid={Boolean(form.formState.errors.employeeId)}>
              <FieldLabel htmlFor="manual-payroll-employee">Employee</FieldLabel>
              <NativeSelect
                id="manual-payroll-employee"
                className="w-full"
                aria-invalid={Boolean(form.formState.errors.employeeId)}
                {...form.register("employeeId")}
              >
                <NativeSelectOption value="">Select an active employee</NativeSelectOption>
                {employees.map((employee) => (
                  <NativeSelectOption key={employee.id} value={employee.id}>
                    {employee.employeeNumber} — {employee.fullName} ({employee.department} · {employee.position})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{form.formState.errors.employeeId?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.startDate)}>
              <FieldLabel htmlFor="manual-payroll-start">Start date</FieldLabel>
              <Input
                id="manual-payroll-start"
                type="date"
                aria-invalid={Boolean(form.formState.errors.startDate)}
                {...form.register("startDate")}
              />
              <FieldError>{form.formState.errors.startDate?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.endDate)}>
              <FieldLabel htmlFor="manual-payroll-end">End date</FieldLabel>
              <Input
                id="manual-payroll-end"
                type="date"
                aria-invalid={Boolean(form.formState.errors.endDate)}
                {...form.register("endDate")}
              />
              <FieldError>{form.formState.errors.endDate?.message}</FieldError>
            </Field>
            <Field className="md:col-span-2" data-invalid={Boolean(form.formState.errors.label)}>
              <FieldLabel htmlFor="manual-payroll-label">Pay period label</FieldLabel>
              <Input
                id="manual-payroll-label"
                placeholder="Custom Payroll"
                aria-invalid={Boolean(form.formState.errors.label)}
                {...form.register("label")}
              />
              <FieldDescription>Optional label shown on the payroll preview, printout, and export.</FieldDescription>
              <FieldError>{form.formState.errors.label?.message}</FieldError>
            </Field>
          </FieldGroup>
          {!employees.length ? (
            <p className="text-sm text-muted-foreground">No active employees are available for manual payroll.</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!employees.length || form.formState.isSubmitting}>
              <PaymentsRoundedIcon data-icon="inline-start" />
              Generate Custom Payroll
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
