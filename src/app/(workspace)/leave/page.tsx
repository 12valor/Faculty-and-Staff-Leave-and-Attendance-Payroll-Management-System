import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function LeavePage() {
  return <ModulePlaceholder {...moduleMetadata.leave} />;
}
