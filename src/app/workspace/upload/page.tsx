"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  CloudUpload,
  X,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadQueue } from "@/contexts/AppContext";
import type { UploadQueueItem, UploadStatus } from "@/lib/types";
import { UploadQueueEmpty } from "@/components/empty-states";

// ─── Status config ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  UploadStatus,
  {
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
    spin?: boolean;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    icon: Clock,
  },
  uploading: {
    label: "Uploading",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    icon: Loader2,
    spin: true,
  },
  processing: {
    label: "Processing AI",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    icon: Sparkles,
    spin: true,
  },
  completed: {
    label: "Complete",
    color: "text-green-400",
    bg: "bg-green-500/10",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10",
    icon: AlertCircle,
  },
};

// ─── Queue Item Row ───────────────────────────────────────────────────────
function QueueRow({
  item,
  onRemove,
}: {
  item: UploadQueueItem;
  onRemove: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-3"
    >
      {/* File icon */}
      <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-brand" />
      </div>

      {/* Info + progress */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {item.name}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {item.sizeLabel}
          </span>
        </div>

        {/* Progress bar */}
        {item.status !== "pending" && item.status !== "failed" && (
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                item.status === "completed"
                  ? "bg-green-500"
                  : item.status === "processing"
                    ? "bg-amber-500"
                    : "bg-brand",
              )}
            />
          </div>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md",
              cfg.bg,
              cfg.color,
            )}
          >
            <Icon className={cn("w-3 h-3", cfg.spin && "animate-spin")} />
            {cfg.label}
          </span>
          {item.status !== "pending" &&
            item.status !== "failed" &&
            item.status !== "completed" && (
              <span className="text-[10px] text-muted-foreground">
                {item.progress}%
              </span>
            )}
          {item.errorMessage && (
            <span className="text-[10px] text-red-400">
              {item.errorMessage}
            </span>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Upload Page ──────────────────────────────────────────────────────────
export default function UploadPage() {
  const {
    queue,
    isEmpty,
    completedCount,
    totalCount,
    enqueueFiles,
    removeFromQueue,
    clearQueue,
  } = useUploadQueue();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) enqueueFiles(acceptedFiles);
    },
    [enqueueFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const allComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="min-h-full px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">
          Upload Documents
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload any document and let AI handle the rest — extraction,
          summarization, and indexing.
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 group",
            isDragActive
              ? "border-brand bg-brand/5 scale-[1.01]"
              : "border-border/60 hover:border-brand/40 hover:bg-brand/5",
          )}
        >
          <input {...getInputProps()} />

          {/* Animated upload icon */}
          <motion.div
            animate={isDragActive ? { scale: 1.15, y: -8 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex justify-center mb-6"
          >
            <div
              className={cn(
                "w-20 h-20 rounded-3xl border flex items-center justify-center transition-all duration-200",
                isDragActive
                  ? "bg-brand/20 border-brand/40 glow-brand"
                  : "bg-brand/10 border-brand/20 group-hover:bg-brand/15",
              )}
            >
              <CloudUpload
                className={cn(
                  "w-9 h-9 transition-colors",
                  isDragActive
                    ? "text-brand"
                    : "text-brand/70 group-hover:text-brand",
                )}
              />
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {isDragActive ? (
              <motion.p
                key="drop"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-lg font-semibold text-brand"
              >
                Drop your files here!
              </motion.p>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <p className="text-base font-semibold text-foreground">
                  Drag &amp; drop your files here
                </p>
                <p className="text-sm text-muted-foreground">or</p>
                <button className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-all shadow-sm glow-brand-sm">
                  Choose Files
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-4 text-xs text-muted-foreground/50">
            Supports PDF, DOCX, JPG, PNG · Max 50 MB per file
          </p>

          {/* AI Pipeline steps */}
          <div className="mt-8 pt-6 border-t border-border/40 grid grid-cols-3 sm:grid-cols-5 gap-3">
            {["Extract Text", "OCR", "Categorize", "Summarize", "Index"].map(
              (step, i) => (
                <div key={step} className="flex flex-col items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[10px] font-bold text-brand">
                    {i + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center">
                    {step}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </motion.div>

      {/* Upload Queue */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-foreground">
              Upload Queue
            </h2>
            {totalCount > 0 && (
              <span className="text-[11px] bg-brand/15 text-brand px-2 py-0.5 rounded-full">
                {completedCount}/{totalCount} done
              </span>
            )}
          </div>
          {!isEmpty && (
            <button
              onClick={clearQueue}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {isEmpty ? (
          <UploadQueueEmpty />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {queue.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onRemove={removeFromQueue}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* All complete banner */}
        <AnimatePresence>
          {allComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">
                  All uploads complete!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your documents are indexed and ready for AI search.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
