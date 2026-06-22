import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function EmployeesPage() {
  return <ModulePlaceholder {...moduleMetadata.employees} />;
}
