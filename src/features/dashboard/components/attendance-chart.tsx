"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const chartConfig = { present: { label: "Present", color: "var(--chart-1)" }, absent: { label: "Absent", color: "var(--chart-4)" } } satisfies ChartConfig;
export function AttendanceChart({ data }: { data: Array<{ day: string; present: number; absent: number }> }) {
  return <ChartContainer config={chartConfig} className="h-[260px] min-h-[260px] w-full"><AreaChart accessibilityLayer data={data}><defs><linearGradient id="present-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-present)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--color-present)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} /><YAxis tickLine={false} axisLine={false} width={34} /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="present" stroke="var(--color-present)" strokeWidth={3} fill="url(#present-fill)" /><Area type="monotone" dataKey="absent" stroke="var(--color-absent)" strokeWidth={2} fill="transparent" strokeDasharray="5 5" /></AreaChart></ChartContainer>;
}