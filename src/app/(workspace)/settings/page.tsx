import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function SettingsPage() {
  return <ModulePlaceholder {...moduleMetadata.settings} />;
}
