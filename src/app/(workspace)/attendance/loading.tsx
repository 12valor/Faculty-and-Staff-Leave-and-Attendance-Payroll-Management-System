import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceLoading() {
  return <section className="flex flex-col gap-6"><Skeleton className="h-12 w-72" /><Skeleton className="h-10 w-64" /><Skeleton className="h-24 w-full" /><div className="flex flex-col gap-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div></section>;
}
