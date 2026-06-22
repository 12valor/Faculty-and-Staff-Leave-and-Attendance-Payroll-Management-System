import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function SchedulesPage() {
  return <ModulePlaceholder {...moduleMetadata.schedules} />;
}
