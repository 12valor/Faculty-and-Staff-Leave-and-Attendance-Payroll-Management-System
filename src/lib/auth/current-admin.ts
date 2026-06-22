import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { readAdminSession } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

export const getCurrentAdmin = cache(async () => {
  const session = await readAdminSession();
  if (!session) return null;

  return getPrisma().adminUser.findFirst({
    where: { id: session.adminId, isActive: true },
    select: { id: true, username: true, lastLoginAt: true },
  });
});

export async function requireCurrentAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}