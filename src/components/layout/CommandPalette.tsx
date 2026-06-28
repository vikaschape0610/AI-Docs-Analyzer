"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Files,
  Upload,
  Settings,
  Sparkles,
  FileText,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/contexts/AppContext";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  shortcut?: string;
};

const STATIC_ITEMS: CommandItem[] = [
  { id: "ws", label: "Go to Workspace", icon: LayoutDashboard, action: "/workspace" },
  { id: "docs", label: "Browse Documents", icon: Files, action: "/workspace/documents" },
  {
    id: "upload",
    label: "Upload Documents",
    icon: Upload,
    action: "/workspace/upload",
    shortcut: "U",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    action: "/workspace/settings",
  },
  {
    id: "ask-1",
    label: "Ask: What is in my documents?",
    description: "AI Search",
    icon: Sparkles,
    action: "/workspace",
  },
  {
    id: "ask-2",
    label: "Ask: Summarize my latest document",
    description: "AI Search",
    icon: Sparkles,
    action: "/workspace",
  },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { documents } = useDocuments();

  // Build dynamic doc items from context (no hardcoded data)
  const docItems: CommandItem[] = documents.map((doc) => ({
    id: `doc-${doc.id}`,
    label: doc.name,
    description: doc.category,
    icon: FileText,
    action: `/workspace/documents/${doc.id}`,
  }));

  const allItems = [...STATIC_ITEMS, ...docItems];

  const filtered = query
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleSelect = (action: string) => {
    onClose();
    router.push(action);
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && filtered[selected]) {
        handleSelect(filtered[selected].action);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, selected, filtered]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-[560px] pointer-events-auto"
            >
              <div className="rounded-2xl border border-border/50 bg-popover shadow-2xl overflow-hidden">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search documents, navigate, ask anything…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <kbd className="hidden sm:flex px-2 py-1 bg-muted/50 rounded text-[10px] font-mono text-muted-foreground/60">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[360px] overflow-y-auto py-2">
                  {filtered.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No results for &ldquo;{query}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <>
                      {!query && (
                        <p className="px-4 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                          Quick Actions
                        </p>
                      )}
                      {filtered.map((item, idx) => {
                        const Icon = item.icon;
                        const active = idx === selected;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item.action)}
                            onMouseEnter={() => setSelected(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                              active
                                ? "bg-brand/10 text-brand"
                                : "text-foreground hover:bg-muted/30"
                            )}
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                                active ? "bg-brand/20" : "bg-muted/50"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {item.shortcut && (
                              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono text-muted-foreground/60 shrink-0">
                                {item.shortcut}
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/50 bg-muted/10">
                  <span className="text-[10px] text-muted-foreground/50">
                    ↑↓ navigate
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    ↵ open
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    ESC close
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
