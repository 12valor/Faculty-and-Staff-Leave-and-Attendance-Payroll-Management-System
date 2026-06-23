"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  absent: { label: "Absent", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function AttendanceChart({
  data,
}: {
  data: Array<{ day: string; present: number; absent: number }>;
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[300px] min-h-[300px] w-full"
      initialDimension={{ width: 760, height: 300 }}
    >
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
        />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="present"
          stroke="var(--color-present)"
          strokeWidth={2.5}
          fill="var(--color-present)"
          fillOpacity={0.1}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="absent"
          stroke="var(--color-absent)"
          strokeWidth={2}
          fill="transparent"
          strokeDasharray="5 5"
        />
      </AreaChart>
    </ChartContainer>
  );
}
