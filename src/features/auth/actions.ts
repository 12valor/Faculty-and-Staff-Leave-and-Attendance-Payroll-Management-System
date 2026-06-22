"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";

import { loginSchema, type LoginValues } from "@/features/auth/schemas/login-schema";
import { createAuditLog } from "@/lib/audit";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { createAdminSession, deleteAdminSession } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

export type LoginResult = { error?: string };

export async function loginAction(values: LoginValues): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: "Enter a valid username and password." };

  const admin = await getPrisma().adminUser.findUnique({
    where: { username: parsed.data.username.trim() },
  });
  if (!admin || !admin.isActive || !(await compare(parsed.data.password, admin.passwordHash))) {
    return { error: "Invalid username or password." };
  }

  await getPrisma().adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  await createAuditLog({
    adminId: admin.id,
    action: "ADMIN_LOGIN",
    entityType: "ADMIN_USER",
    entityId: admin.id,
    summary: `Admin ${admin.username} logged in.`,
  });
  await createAdminSession(admin.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  const admin = await getCurrentAdmin();
  if (admin) {
    await createAuditLog({
      adminId: admin.id,
      action: "ADMIN_LOGOUT",
      entityType: "ADMIN_USER",
      entityId: admin.id,
      summary: `Admin ${admin.username} logged out.`,
    });
  }
  await deleteAdminSession();
  redirect("/login");
}