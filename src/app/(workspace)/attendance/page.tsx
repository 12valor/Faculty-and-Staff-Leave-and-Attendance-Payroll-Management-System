import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function AttendancePage() {
  return <ModulePlaceholder {...moduleMetadata.attendance} />;
}
