"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandMark } from "@/components/brand-mark";
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
import { logoutAction } from "@/features/auth/actions";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  admin: { id: string; username: string; lastLoginAt: Date | null };
};

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1.5">
      {navigationItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-transparent",
              isActive
                ? "bg-sidebar-accent font-semibold text-primary shadow-[inset_0_0_0_1px_rgb(200_16_46/0.04)] before:bg-primary"
                : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
              mobile ? "text-[0.95rem]" : null,
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-current",
              )}
            >
              <Icon aria-hidden="true" fontSize="small" />
            </span>
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, admin }: AppShellProps) {
  const pathname = usePathname();
  const currentPage =
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.title ?? "Faculty & Staff";

  return (
    <div className="min-h-screen bg-background">
      <aside
        data-print-hidden="true"
        className="fixed inset-y-0 left-0 hidden w-[17rem] flex-col border-r bg-sidebar shadow-[4px_0_24px_rgb(15_23_42/0.035)] lg:flex"
      >
        <div className="flex h-24 items-center border-b px-5">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto px-3.5 py-6">
          <p className="mb-3 px-3.5 text-[0.66rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Workspace
          </p>
          <Navigation />
        </div>
        <div className="border-t p-4">
          <div className="rounded-xl border border-primary/10 bg-secondary/65 p-3.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_rgb(200_16_46/0.1)]" />
              <p className="text-xs font-semibold text-secondary-foreground">
                Local database
              </p>
            </div>
            <p className="mt-2 text-[0.7rem] leading-5 text-muted-foreground">
              Records stay securely on this computer through SQLite.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
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
                <MenuRoundedIcon />
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] p-0">
                <SheetHeader className="border-b px-5 py-5">
                  <SheetTitle>
                    <BrandMark />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate between management modules.
                  </SheetDescription>
                </SheetHeader>
                <div className="overflow-y-auto px-3.5 py-5">
                  <p className="mb-3 px-3.5 text-[0.66rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                    Workspace
                  </p>
                  <Navigation mobile />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-[0.68rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Faculty and Staff Management
              </p>
              <h1 className="truncate text-lg font-bold tracking-[-0.02em] md:text-xl">
                {currentPage}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <NotificationsNoneRoundedIcon />
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
                <Avatar className="ring-2 ring-primary/10">
                  <AvatarFallback className="bg-secondary font-semibold text-primary">
                    AD
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium">
                    {admin.username}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Local account
                  </span>
                </span>
                <ExpandMoreRoundedIcon aria-hidden="true" fontSize="small" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>My account</DropdownMenuLabel>
                  <DropdownMenuItem>Single administrator</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => logoutAction()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8 lg:p-9">
          {children}
        </main>
      </div>
    </div>
  );
}
