"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Grid2X2,
  List,
  Search,
  Loader2,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments, useApp } from "@/contexts/AppContext";
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
function DocumentGridCard({
  doc,
  index,
  selected,
  onSelect,
  onDelete,
  selectMode,
}: {
  doc: Document;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  selectMode: boolean;
}) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      className="relative group"
    >
      {/* Select checkbox */}
      {selectMode && (
        <button
          onClick={() => onSelect(doc.id)}
          className="absolute top-3 left-3 z-10 p-0.5 rounded-md bg-background/80 border border-border/60 hover:border-brand/40 transition-colors"
        >
          {selected ? (
            <CheckSquare className="w-4 h-4 text-brand" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      )}
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete(doc.id);
        }}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-background/80 border border-border/60 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:border-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
        title="Delete document"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      <Link href={`/workspace/documents/${doc.id}`}>
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "bg-card border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-brand/5",
            selected
              ? "border-brand/40 bg-brand/5"
              : "border-border/60 hover:border-brand/30",
          )}
        >
          <div
            className={cn(
              "w-full h-28 rounded-xl bg-gradient-to-br mb-4 flex flex-col items-center justify-center",
              doc.thumbnailColor,
            )}
          >
            <span className="text-4xl mb-1">{doc.thumbnailEmoji}</span>
            <span className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
              {doc.fileType}
            </span>
          </div>
          <p
            className="text-sm font-medium text-foreground truncate mb-2"
            title={doc.name}
          >
            {doc.name}
          </p>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                config.bgClass,
                config.borderClass,
                config.color,
              )}
            >
              {doc.category}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {doc.uploadedAtLabel}
            </span>
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
function DocumentListRow({
  doc,
  index,
  selected,
  onSelect,
  onDelete,
  selectMode,
}: {
  doc: Document;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  selectMode: boolean;
}) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.035 }}
      className="group"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card transition-all",
          selected
            ? "border-brand/40 bg-brand/5"
            : "border-border/40 hover:border-brand/25 hover:bg-card/80",
        )}
      >
        {selectMode && (
          <button onClick={() => onSelect(doc.id)}>
            {selected ? (
              <CheckSquare className="w-4 h-4 text-brand shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </button>
        )}
        <Link
          href={`/workspace/documents/${doc.id}`}
          className="flex items-center gap-4 flex-1 min-w-0"
        >
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border",
              config.bgClass,
              config.borderClass,
            )}
          >
            {doc.thumbnailEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {doc.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[10px] font-medium", config.color)}>
                {doc.category}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground">
                {doc.sizeLabel}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground">
                {doc.pages}p
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            {doc.uploadedAtLabel}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-brand transition-colors shrink-0" />
        </Link>
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Documents Page ───────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { documents, isLoading, isInitialized, hasDocuments, count } =
    useDocuments();
  const { removeDocument } = useApp();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = documents.filter((doc) => {
    const matchCat = filter === "all" || doc.category === filter;
    const matchSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.category.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    await removeDocument(id);
  };

  const handleDeleteSelected = async () => {
    if (
      !window.confirm(
        `Delete ${selected.size} selected document(s)? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    for (const id of selected) await removeDocument(id);
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);
  };

  return (
    <div className="min-h-full px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLoading
            ? "Loading…"
            : hasDocuments
              ? `${count} document${count !== 1 ? "s" : ""} · AI-indexed and searchable`
              : "No documents yet"}
        </p>
      </motion.div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}
      {isInitialized && !hasDocuments && <DocumentsEmpty />}

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
            <div className="flex items-center gap-2 ml-auto">
              {/* Select mode toggle */}
              <button
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelected(new Set());
                }}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-xl border transition-all",
                  selectMode
                    ? "bg-brand/10 border-brand/30 text-brand"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
              {/* Delete selected */}
              <AnimatePresence>
                {selectMode && selected.size > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-all"
                  >
                    {deleting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete {selected.size}
                  </motion.button>
                )}
              </AnimatePresence>
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-muted/40 border border-border/40 rounded-xl p-1">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      view === v
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
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
            </div>
          </motion.div>

          {/* Category filter */}
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
                      : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {catConfig && <span>{catConfig.emoji}</span>}
                  {f.label}
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px]",
                      filter === f.value
                        ? "bg-brand/20 text-brand"
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {cnt}
                  </span>
                </button>
              );
            })}
          </motion.div>

          {filtered.length === 0 && search && <SearchEmpty query={search} />}
          {filtered.length === 0 && !search && filter !== "all" && (
            <DocumentsFilterEmpty filter={filter} />
          )}

          {filtered.length > 0 && view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((doc, i) => (
                <DocumentGridCard
                  key={doc.id}
                  doc={doc}
                  index={i}
                  selected={selected.has(doc.id)}
                  onSelect={toggleSelect}
                  onDelete={handleDelete}
                  selectMode={selectMode}
                />
              ))}
            </div>
          )}

          {filtered.length > 0 && view === "list" && (
            <div className="space-y-2 max-w-3xl">
              {filtered.map((doc, i) => (
                <DocumentListRow
                  key={doc.id}
                  doc={doc}
                  index={i}
                  selected={selected.has(doc.id)}
                  onSelect={toggleSelect}
                  onDelete={handleDelete}
                  selectMode={selectMode}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
