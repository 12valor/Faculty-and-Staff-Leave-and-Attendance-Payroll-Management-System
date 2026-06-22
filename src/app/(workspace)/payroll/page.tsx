import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleMetadata } from "@/lib/navigation";

export default function PayrollPage() {
  return <ModulePlaceholder {...moduleMetadata.payroll} />;
}
