"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DirectoryRow = { id: string; name: string; description: string | null; isActive: boolean };
type DirectoryAction = "save" | "toggle";
type DirectoryResult = { ok: true } | { ok: false; error: string };

const SERVER_ACTION_ERROR = "The server connection was interrupted. Refresh the page and try again.";

export function DirectoryCard({ title, description, rows, kind }: { title: string; description: string; rows: DirectoryRow[]; kind: "department" | "position" }) {
  const router = useRouter();

  async function submitDirectory(formData: FormData, action: DirectoryAction) {
    const body = new FormData();
    formData.forEach((value, key) => body.append(key, value));
    body.set("kind", kind);
    body.set("action", action);

    try {
      const response = await fetch("/api/settings/directory", {
        method: "POST",
        body,
      });
      const result = await response.json() as DirectoryResult;

      if (!response.ok || !result.ok) {
        toast.error(result.ok ? SERVER_ACTION_ERROR : result.error);
        return;
      }

      if (action === "save") {
        toast.success(`${title.slice(0, -1)} saved.`);
      }
      router.refresh();
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    }
  }

  async function handleSave(formData: FormData) {
    await submitDirectory(formData, "save");
  }

  async function handleToggle(formData: FormData) {
    await submitDirectory(formData, "toggle");
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form action={handleSave} className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
          <Input name="name" placeholder={`${title.slice(0, -1)} name`} required />
          <Input name="description" placeholder="Description (optional)" />
          <Button type="submit">Add</Button>
        </form>
        <div className="flex flex-col gap-3">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No records yet.</p> : rows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-center">
              <form action={handleSave} className="contents">
                <input type="hidden" name="id" value={row.id} />
                <Input name="name" defaultValue={row.name} required />
                <Input name="description" defaultValue={row.description ?? ""} />
                <Button type="submit" variant="outline">Save</Button>
              </form>
              <form action={handleToggle}>
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
