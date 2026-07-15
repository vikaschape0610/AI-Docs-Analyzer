"use client";

import { useCallback, useRef } from "react";
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
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadQueue } from "@/contexts/AppContext";
import type {
  UploadQueueItem,
  UploadStatus,
  UploadStageStatus,
} from "@/lib/types";
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
    label: "Processing",
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

// ─── Stage indicator ──────────────────────────────────────────────────────
function StageIcon({ status }: { status: UploadStageStatus }) {
  if (status === "done")
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  if (status === "running")
    return <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />;
  if (status === "error")
    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />;
}

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
      className="bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {item.name}
            </p>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {item.sizeLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                cfg.bg,
                cfg.color,
              )}
            >
              <Icon className={cn("w-3 h-3", cfg.spin && "animate-spin")} />
              {cfg.label}
            </div>
            {item.status !== "pending" && item.progress > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {item.progress}%
              </span>
            )}
          </div>
        </div>
        {(item.status === "pending" ||
          item.status === "failed" ||
          item.status === "completed") && (
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {item.status !== "pending" && item.status !== "failed" && (
        <div className="px-4 pb-1">
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                item.status === "completed" ? "bg-green-400" : "bg-brand",
              )}
            />
          </div>
        </div>
      )}

      {/* Live pipeline stages */}
      {item.stages &&
        (item.status === "processing" || item.status === "completed") && (
          <div className="px-4 pb-3 pt-2 grid grid-cols-2 gap-1">
            {item.stages.map((stage) => (
              <div key={stage.key} className="flex items-center gap-1.5">
                <StageIcon status={stage.status} />
                <span
                  className={cn(
                    "text-[10px]",
                    stage.status === "done"
                      ? "text-green-400"
                      : stage.status === "running"
                        ? "text-brand"
                        : stage.status === "error"
                          ? "text-red-400"
                          : "text-muted-foreground/50",
                  )}
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        )}
    </motion.div>
  );
}

// ─── Upload Page ──────────────────────────────────────────────────────────
export default function UploadPage() {
  const { queue, isEmpty, enqueueFiles, removeFromQueue, clearQueue } =
    useUploadQueue();
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) enqueueFiles(accepted);
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
    multiple: true,
  });

  const activeCount = queue.filter(
    (q) => q.status === "uploading" || q.status === "processing",
  ).length;
  const completedCount = queue.filter((q) => q.status === "completed").length;

  return (
    <div className="min-h-full px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">
          Upload Documents
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Supports PDF, images (JPG, PNG), and Word documents up to 50 MB
        </p>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-brand bg-brand/5 scale-[1.01]"
              : "border-border/60 hover:border-brand/40 hover:bg-brand/2",
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={
                isDragActive
                  ? { scale: 1.1, rotate: 5 }
                  : { scale: 1, rotate: 0 }
              }
              className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center"
            >
              <CloudUpload className="w-8 h-8 text-brand" />
            </motion.div>
            <div>
              <p className="text-base font-medium text-foreground mb-1">
                {isDragActive
                  ? "Drop files here"
                  : "Drag & drop files or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF · JPG · PNG · DOCX · Up to 50 MB
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 bg-brand text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Sparkles className="w-4 h-4" /> Choose Files
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
            onChange={(e) => {
              if (e.target.files) {
                enqueueFiles(Array.from(e.target.files));
                e.target.value = "";
              }
            }}
          />
        </div>
      </motion.div>

      {/* Queue */}
      {!isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Upload Queue
              </h2>
              {activeCount > 0 && (
                <p className="text-xs text-brand mt-0.5">
                  Processing {activeCount} file{activeCount !== 1 ? "s" : ""}…
                </p>
              )}
              {activeCount === 0 && completedCount > 0 && (
                <p className="text-xs text-green-400 mt-0.5">
                  {completedCount} file{completedCount !== 1 ? "s" : ""} ready
                </p>
              )}
            </div>
            {queue.every(
              (q) => q.status === "completed" || q.status === "failed",
            ) && (
              <button
                onClick={clearQueue}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 hover:border-border transition-all"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {queue.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onRemove={removeFromQueue}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12"
        >
          <UploadQueueEmpty />
        </motion.div>
      )}
    </div>
  );
}
