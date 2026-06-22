import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireCurrentAdmin();
  return <AppShell admin={admin}>{children}</AppShell>;
}