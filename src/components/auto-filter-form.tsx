"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useTransition } from "react";

type AutoFilterFormProps = {
  children: ReactNode;
  className?: string;
  searchDelay?: number;
};

export function AutoFilterForm({ children, className, searchDelay = 350 }: AutoFilterFormProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function applyFilters(form: HTMLFormElement) {
    if (timerRef.current) clearTimeout(timerRef.current);

    const params = new URLSearchParams();
    for (const [name, entry] of new FormData(form)) {
      if (typeof entry !== "string") continue;
      const value = entry.trim();
      if (value) params.append(name, value);
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(event.currentTarget);
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search")) return;
    applyFilters(event.currentTarget);
  }

  function handleInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || (target.type !== "text" && target.type !== "search")) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    const form = event.currentTarget;
    timerRef.current = setTimeout(() => applyFilters(form), searchDelay);
  }

  return (
    <form className={className} onChange={handleChange} onInput={handleInput} onSubmit={handleSubmit} aria-busy={isPending}>
      {children}
    </form>
  );
}