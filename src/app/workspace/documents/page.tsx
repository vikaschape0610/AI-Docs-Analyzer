"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Grid2X2, List, Search, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/contexts/AppContext";
import { CATEGORY_CONFIG } from "@/lib/types";
import type { Document, DocumentCategory } from "@/lib/types";
import {
  DocumentsEmpty,
  DocumentsFilterEmpty,
  SearchEmpty,
} from "@/components/empty-states";

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Identity", value: "Identity" },
  { label: "Academic", value: "Academic" },
  { label: "Financial", value: "Financial" },
  { label: "Career", value: "Career" },
  { label: "Government", value: "Government" },
  { label: "Medical", value: "Medical" },
];

// ─── Grid Card ────────────────────────────────────────────────────────────
function DocumentGridCard({ doc, index }: { doc: Document; index: number }) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
    >
      <Link href={`/workspace/documents/${doc.id}`}>
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="group bg-card border border-border/60 rounded-2xl p-4 cursor-pointer hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 transition-all duration-200"
        >
          {/* Thumbnail */}
          <div
            className={cn(
              "w-full h-28 rounded-xl bg-gradient-to-br mb-4 flex flex-col items-center justify-center relative overflow-hidden",
              doc.thumbnailColor
            )}
          >
            <span className="text-4xl mb-1">{doc.thumbnailEmoji}</span>
            <span className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
              {doc.fileType}
            </span>
            <div className="absolute inset-0 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Info */}
          <p className="text-sm font-medium text-foreground truncate mb-2" title={doc.name}>
            {doc.name}
          </p>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                config.bgClass,
                config.borderClass,
                config.color
              )}
            >
              {doc.category}
            </span>
            <span className="text-[10px] text-muted-foreground">{doc.uploadedAtLabel}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{doc.sizeLabel}</span>
            <span>
              {doc.pages} {doc.pages === 1 ? "page" : "pages"}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────
function DocumentListRow({ doc, index }: { doc: Document; index: number }) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.035 }}
    >
      <Link href={`/workspace/documents/${doc.id}`}>
        <motion.div
          whileHover={{ x: 3 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/40 hover:border-brand/25 bg-card hover:bg-card/80 transition-all cursor-pointer"
        >
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border",
              config.bgClass,
              config.borderClass
            )}
          >
            {doc.thumbnailEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[10px] font-medium", config.color)}>
                {doc.category}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground">{doc.sizeLabel}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground">{doc.pages}p</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            {doc.uploadedAtLabel}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-brand transition-colors shrink-0" />
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── Documents Page ───────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { documents, isLoading, isInitialized, hasDocuments, count } = useDocuments();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = documents.filter((doc) => {
    const matchCat = filter === "all" || doc.category === filter;
    const matchSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.category.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-full px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLoading
            ? "Loading your documents…"
            : hasDocuments
            ? `${count} document${count !== 1 ? "s" : ""} · AI-indexed and searchable`
            : "No documents yet"}
        </p>
      </motion.div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {isInitialized && !hasDocuments && <DocumentsEmpty />}

      {/* Documents exist — show controls + list */}
      {isInitialized && hasDocuments && (
        <>
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-brand/40 transition-colors"
              />
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1 bg-muted/40 border border-border/40 rounded-xl p-1">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    view === v
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "grid" ? (
                    <Grid2X2 className="w-4 h-4" />
                  ) : (
                    <List className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-6"
          >
            {FILTERS.map((f) => {
              const cnt =
                f.value === "all"
                  ? documents.length
                  : documents.filter((d) => d.category === f.value).length;
              if (cnt === 0 && f.value !== "all") return null;
              const catConfig =
                f.value !== "all"
                  ? CATEGORY_CONFIG[f.value as DocumentCategory]
                  : null;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-all",
                    filter === f.value
                      ? "bg-brand/15 border-brand/30 text-brand"
                      : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {catConfig && <span>{catConfig.emoji}</span>}
                  {f.label}
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px]",
                      filter === f.value
                        ? "bg-brand/20 text-brand"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {cnt}
                  </span>
                </button>
              );
            })}
          </motion.div>

          {/* No results */}
          {filtered.length === 0 && search && <SearchEmpty query={search} />}
          {filtered.length === 0 && !search && filter !== "all" && (
            <DocumentsFilterEmpty filter={filter} />
          )}

          {/* Grid */}
          {filtered.length > 0 && view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((doc, i) => (
                <DocumentGridCard key={doc.id} doc={doc} index={i} />
              ))}
            </div>
          )}

          {/* List */}
          {filtered.length > 0 && view === "list" && (
            <div className="space-y-2 max-w-3xl">
              {filtered.map((doc, i) => (
                <DocumentListRow key={doc.id} doc={doc} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
