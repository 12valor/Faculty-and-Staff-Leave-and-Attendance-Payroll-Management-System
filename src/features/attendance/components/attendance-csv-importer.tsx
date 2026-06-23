"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importAttendanceAction, type CsvAttendanceRow } from "@/features/attendance/actions";

const headers = ["employeeNumber","date","timeIn","timeOut","status","remarks"];
const SERVER_ACTION_ERROR = "The server connection was interrupted. Refresh the page and try again.";
function parseLine(line: string) { const values: string[] = []; let value = ""; let quoted = false; for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { values.push(value.trim()); value = ""; } else value += character; } values.push(value.trim()); return values; }
export function AttendanceCsvImporter() {
  const router = useRouter(); const [rows, setRows] = useState<CsvAttendanceRow[]>([]); const [errors, setErrors] = useState<string[]>([]); const [loading, setLoading] = useState(false);
  async function load(file?: File) { if (!file) return; const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); const parsedHeaders = parseLine(lines[0] ?? ""); if (parsedHeaders.join(",") !== headers.join(",")) { setRows([]); setErrors([`Headers must be exactly: ${headers.join(", ")}`]); return; } const nextRows = lines.slice(1).map((line) => { const cells = parseLine(line); return { employeeNumber: cells[0] ?? "", date: cells[1] ?? "", timeIn: cells[2] ?? "", timeOut: cells[3] ?? "", status: cells[4] ?? "", remarks: cells[5] ?? "" }; }); const nextErrors: string[] = []; const statuses = new Set(["PRESENT","LATE","ABSENT","ON_LEAVE","UNDERTIME"]); nextRows.forEach((row, index) => { if (!row.employeeNumber) nextErrors.push(`Row ${index + 2}: employeeNumber is required.`); if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) nextErrors.push(`Row ${index + 2}: date must use YYYY-MM-DD.`); if (row.timeIn && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.timeIn)) nextErrors.push(`Row ${index + 2}: invalid timeIn.`); if (row.timeOut && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.timeOut)) nextErrors.push(`Row ${index + 2}: invalid timeOut.`); if (!statuses.has(row.status)) nextErrors.push(`Row ${index + 2}: invalid status.`); }); setRows(nextRows); setErrors(nextErrors); }
  async function submit() {
    setLoading(true);
    try {
      const result = await importAttendanceAction(rows);
      if (!result.ok) return toast.error(result.error);
      toast.success(`${result.count} records imported.`);
      router.push("/attendance");
    } catch {
      toast.error(SERVER_ACTION_ERROR);
    } finally {
      setLoading(false);
    }
  }
  return <div className="flex flex-col gap-6"><Card><CardHeader><CardTitle>Choose CSV file</CardTitle><CardDescription>Required headers: {headers.join(", ")}. Existing employee/date records reject the entire import.</CardDescription></CardHeader><CardContent><Input type="file" accept=".csv,text/csv" onChange={(event) => load(event.target.files?.[0])} /></CardContent></Card>{errors.length ? <Card><CardHeader><CardTitle>Validation errors</CardTitle></CardHeader><CardContent><ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive">{errors.map((error) => <li key={error}>{error}</li>)}</ul></CardContent></Card> : null}{rows.length ? <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Import preview</CardTitle><CardDescription>Review all rows before committing.</CardDescription></div><Badge variant={errors.length ? "destructive" : "secondary"}>{rows.length} rows</Badge></div></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{headers.map((header) => <TableCell key={header}>{row[header as keyof CsvAttendanceRow]}</TableCell>)}</TableRow>)}</TableBody></Table><Button className="mt-4" disabled={Boolean(errors.length) || loading} onClick={submit}>{loading ? "Importing…" : "Import all rows"}</Button></CardContent></Card> : null}</div>;
}