import "server-only";

import { getCurrentAdmin } from "@/lib/auth/current-admin";

export const SESSION_EXPIRED_ERROR = "Your session expired. Please sign in again.";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
export type CurrentAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>;

export async function getActionAdmin(): Promise<ActionResult<{ admin: CurrentAdmin }>> {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return { ok: false, error: SESSION_EXPIRED_ERROR };
    return { ok: true, admin };
  } catch {
    return { ok: false, error: SESSION_EXPIRED_ERROR };
  }
}

export function actionError(error: unknown, fallback: string) {
  return { ok: false, error: error instanceof Error && error.message ? error.message : fallback };
}
