"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
};

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1.5">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              mobile ? "text-base" : null,
            )}
          >
            <Icon aria-hidden="true" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const currentPage =
    navigationItems.find((item) => item.href === pathname)?.title ??
    "Faculty & Staff";

  return (
    <div className="min-h-screen bg-background">
      <aside
        data-print-hidden="true"
        className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar lg:flex"
      >
        <div className="flex h-20 items-center border-b px-5">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Workspace
          </p>
          <Navigation />
        </div>
        <div className="border-t p-4">
          <div className="rounded-xl bg-secondary p-3">
            <p className="text-xs font-semibold text-secondary-foreground">
              Local database
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Records stay on this computer through SQLite.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header
          data-print-hidden="true"
          className="sticky top-0 z-40 flex h-20 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:px-8"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Open navigation"
                    className="lg:hidden"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader className="border-b">
                  <SheetTitle>
                    <BrandMark />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate between management modules.
                  </SheetDescription>
                </SheetHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  <Navigation mobile />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">
                Faculty and Staff Management
              </p>
              <h1 className="truncate text-lg font-semibold md:text-xl">
                {currentPage}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-11 gap-2 px-2"
                    aria-label="Open account menu"
                  />
                }
              >
                <Avatar>
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium">Administrator</span>
                  <span className="block text-xs text-muted-foreground">
                    Local account
                  </span>
                </span>
                <ChevronDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Local preferences</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
