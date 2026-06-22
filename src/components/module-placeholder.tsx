import { ArrowRight, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <Badge variant="secondary">Module scaffold</Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          {description}
        </p>
      </div>

      <Card className="min-h-80 border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Icon aria-hidden="true" />
          </div>
          <CardTitle className="mt-4">Ready for implementation</CardTitle>
          <CardDescription>
            The route, application shell, navigation state, and feature boundary
            are prepared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <span>Business workflows will be added in the next phase</span>
            <ArrowRight aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
