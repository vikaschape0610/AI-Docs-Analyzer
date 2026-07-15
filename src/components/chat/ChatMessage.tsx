"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  CheckCheck,
  ExternalLink,
  FileText,
  AlertCircle,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChatMessage,
  SourceCitation,
  DocumentReference,
} from "@/lib/types";
import { CATEGORY_CONFIG } from "@/lib/types";

// ─── Inline markdown bold/code renderer ──────────────────────────────────
function RenderContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <span key={li}>
            {parts.map((part, i) => {
              if (part.startsWith("**") && part.endsWith("**"))
                return (
                  <strong key={i} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </strong>
                );
              if (part.startsWith("`") && part.endsWith("`"))
                return (
                  <code
                    key={i}
                    className="font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded text-[0.9em]"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              return <span key={i}>{part}</span>;
            })}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

// ─── Confidence Badge ─────────────────────────────────────────────────────
function ConfidenceBadge({
  confidence,
}: {
  confidence: "high" | "medium" | "low";
}) {
  if (confidence === "high")
    return (
      <span className="flex items-center gap-1 text-[10px] text-green-400">
        <ShieldCheck className="w-3 h-3" /> Verified
      </span>
    );
  if (confidence === "medium")
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <AlertTriangle className="w-3 h-3" /> Partial
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-400">
      <Info className="w-3 h-3" /> Low confidence
    </span>
  );
}

// ─── Source Citation Card ─────────────────────────────────────────────────
export function SourceCard({ source }: { source: SourceCitation }) {
  const config = CATEGORY_CONFIG[source.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-start gap-3 p-3 rounded-xl border bg-surface/50 border-border/50 hover:bg-surface hover:border-brand/20 transition-all duration-150"
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
          config.bgClass,
          config.borderClass,
        )}
      >
        <span className="text-base">{config.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-medium text-foreground truncate">
            {source.documentName}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            Page {source.page}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {source.excerpt}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Link
          href={`/workspace/documents/${source.documentId}`}
          className="p-1.5 rounded-lg hover:bg-brand/10 text-muted-foreground hover:text-brand transition-colors"
          title="Open document"
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Document Result Card ─────────────────────────────────────────────────
export function DocumentResultCard({ doc }: { doc: DocumentReference }) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl border bg-card border-border/60 hover:border-brand/25 transition-all duration-150 group"
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-xl",
          config.bgClass,
          config.borderClass,
        )}
      >
        {doc.thumbnailEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {doc.documentName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-medium", config.color)}>
            {doc.category}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground">
            {doc.sizeLabel}
          </span>
        </div>
      </div>
      <Link
        href={`/workspace/documents/${doc.documentId}`}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-brand/10 text-muted-foreground hover:text-brand transition-all"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  );
}

// ─── Chat Message Item ────────────────────────────────────────────────────
export function ChatMessageItem({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="max-w-[80%] bg-brand/15 border border-brand/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-foreground leading-relaxed"
        >
          <RenderContent text={message.content} />
        </motion.div>
      </div>
    );
  }

  if (message.isStreaming && !message.content) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
        </div>
        <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 border border-border/50">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Determine response type styling
  const isError =
    message.responseType === "doc_not_found" ||
    message.responseType === "field_not_found" ||
    message.responseType === "not_found";
  const isNoDoc = message.responseType === "no_documents";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex items-start gap-3 group"
    >
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border",
          isError
            ? "bg-amber-500/10 border-amber-500/20"
            : isNoDoc
              ? "bg-muted/40 border-border/60"
              : "bg-brand/15 border-brand/25",
        )}
      >
        {isError ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        ) : isNoDoc ? (
          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-brand" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm px-4 py-3 border text-sm leading-relaxed",
            isError
              ? "bg-amber-500/5 border-amber-500/15 text-foreground"
              : isNoDoc
                ? "bg-card border-border/50 text-foreground"
                : "bg-card border-border/50 text-foreground",
          )}
        >
          <RenderContent text={message.content} />
        </div>

        {/* Confidence + copy */}
        <div className="flex items-center gap-3 px-1">
          {message.confidence && (
            <ConfidenceBadge confidence={message.confidence} />
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 ml-auto"
          >
            {copied ? (
              <CheckCheck className="w-3 h-3 text-brand" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">
              Sources
            </p>
            {message.sources.map((s, i) => (
              <SourceCard key={i} source={s} />
            ))}
          </div>
        )}

        {/* Document references */}
        {message.documents && message.documents.length > 0 && (
          <div className="space-y-2">
            {message.documents.map((d) => (
              <DocumentResultCard key={d.documentId} doc={d} />
            ))}
          </div>
        )}

        {/* Upload CTA for no-documents state */}
        {isNoDoc && (
          <Link
            href="/workspace/upload"
            className="inline-flex items-center gap-1.5 text-xs text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-3 py-1.5 rounded-xl transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload a document
          </Link>
        )}
      </div>
    </motion.div>
  );
}
