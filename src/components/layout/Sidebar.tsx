"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Files,
  Upload,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";

// ─── Nav items ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/workspace", label: "Workspace", icon: LayoutDashboard, exact: true },
  { href: "/workspace/documents", label: "Documents", icon: Files, exact: false },
  { href: "/workspace/upload", label: "Upload", icon: Upload, exact: false },
  { href: "/workspace/settings", label: "Settings", icon: Settings, exact: false },
] as const;

interface SidebarProps {
  onCommandPalette: () => void;
}

// ─── Simple tooltip wrapper (no nested buttons) ───────────────────────────
// We avoid @base-ui TooltipTrigger here because it renders a <button>
// which causes invalid nesting when wrapping <Link> or other <button>.
function NavTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  if (!show) return <>{children}</>;

  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap pointer-events-none"
          >
            <div className="bg-popover border border-border/80 text-foreground text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
export function Sidebar({ onCommandPalette }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { state: { user }, logout } = useApp();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 z-20 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border min-h-[65px] shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/15 border border-brand/20 shrink-0">
          <Sparkles className="w-4 h-4 text-brand" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-semibold text-sm tracking-tight text-foreground whitespace-nowrap"
            >
              DocMind <span className="text-brand">AI</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Search / Command Palette trigger ─ rendered as a div, not a button */}
      <div className="px-3 pt-3 shrink-0">
        <NavTooltip label="Command Palette (⌘K)" show={collapsed}>
          <div
            role="button"
            tabIndex={0}
            onClick={onCommandPalette}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onCommandPalette()
            }
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground",
              "border border-border/50 bg-surface/30 hover:bg-surface hover:text-foreground",
              "transition-all duration-150 cursor-pointer select-none"
            )}
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between flex-1 overflow-hidden"
                >
                  <span className="whitespace-nowrap">Search…</span>
                  <kbd className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground/60">
                    ⌘K
                  </kbd>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </NavTooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <NavTooltip key={item.href} label={item.label} show={collapsed}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-brand/10 border border-brand/15"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className="w-4 h-4 shrink-0 relative z-10" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="relative z-10 whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </NavTooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand">
              {user ? user.avatar : "?"}
            </span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <p className="text-xs font-medium text-foreground truncate">
                  {user ? user.name : "Guest Session"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {user ? user.plan : "Temporary access"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout button */}
        {user && (
          <NavTooltip label="Logout" show={collapsed}>
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
                "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="whitespace-nowrap"
                  >
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </NavTooltip>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute -right-3 top-16 z-30",
          "w-6 h-6 rounded-full border border-border bg-surface",
          "flex items-center justify-center",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-150 shadow-sm hover:shadow"
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </motion.aside>
  );
}
