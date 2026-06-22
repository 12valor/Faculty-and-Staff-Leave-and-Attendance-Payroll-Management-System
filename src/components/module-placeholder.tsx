import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import type { SvgIconComponent } from "@mui/icons-material";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = { title: string; description: string; icon: SvgIconComponent };

export function ModulePlaceholder({ title, description, icon: Icon }: ModulePlaceholderProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="border-b pb-5">
        <Badge variant="secondary">Module scaffold</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] md:text-[1.75rem]">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Card className="min-h-80">
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary"><Icon aria-hidden="true" /></div>
          <CardTitle className="mt-4">Ready for implementation</CardTitle>
          <CardDescription>The route, application shell, navigation state, and feature boundary are prepared.</CardDescription>
        </CardHeader>
        <CardContent><div className="flex items-center gap-2 text-sm font-semibold text-primary"><span>Business workflows will be added in the next phase</span><ArrowForwardRoundedIcon aria-hidden="true" fontSize="small" /></div></CardContent>
      </Card>
    </section>
  );
}
