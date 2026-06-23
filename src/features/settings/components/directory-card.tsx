"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveDepartmentAction, savePositionAction, toggleDepartmentAction, togglePositionAction } from "@/features/settings/actions";

type DirectoryRow = { id: string; name: string; description: string | null; isActive: boolean };

export function DirectoryCard({ title, description, rows, kind }: { title: string; description: string; rows: DirectoryRow[]; kind: "department" | "position" }) {
  const saveAction = kind === "department" ? saveDepartmentAction : savePositionAction;
  const toggleAction = kind === "department" ? toggleDepartmentAction : togglePositionAction;

  async function handleSave(formData: FormData) {
    const result = await saveAction(formData);
    if (result && !result.ok) {
      toast.error(result.error);
    } else {
      toast.success(`${title.slice(0, -1)} saved.`);
    }
  }

  async function handleToggle(formData: FormData) {
    const result = await toggleAction(formData);
    if (result && !result.ok) {
      toast.error(result.error);
    }
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
