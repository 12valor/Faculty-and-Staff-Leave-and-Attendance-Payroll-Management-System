import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/current-admin";

export default async function Home() {
  redirect((await getCurrentAdmin()) ? "/dashboard" : "/login");
}