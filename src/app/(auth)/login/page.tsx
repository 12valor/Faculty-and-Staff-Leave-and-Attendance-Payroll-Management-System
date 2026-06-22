import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

export const metadata: Metadata = {
  title: "Login",
};

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:44px_44px]" />
        <BrandMark className="relative [&_p]:text-primary-foreground" />
        <div className="relative max-w-xl">
          <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <ShieldCheck aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Faculty and staff records, managed locally.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-primary-foreground/80">
            A focused workspace for leave, attendance, schedules, payroll
            deductions, overtime, overload, and institutional reporting.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/70">
          Local-first system · SQLite database · Browser-based access
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md border-border shadow-lg shadow-primary/5">
          <CardHeader className="gap-2">
            <BrandMark className="mb-5 lg:hidden" />
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to open the faculty and staff management workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
