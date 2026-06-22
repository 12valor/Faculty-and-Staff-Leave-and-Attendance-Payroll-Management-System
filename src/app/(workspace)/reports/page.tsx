import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function ReportsPage() {
  return <ModulePlaceholder {...moduleMetadata.reports} />;
}
