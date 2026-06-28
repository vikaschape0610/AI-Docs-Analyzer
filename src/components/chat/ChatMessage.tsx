"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  CheckCheck,
  ExternalLink,
  Download,
  FileText,
  AlertCircle,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, SourceCitation, DocumentReference } from "@/lib/types";
import { CATEGORY_CONFIG } from "@/lib/types";

// ─── Inline markdown bold/code renderer ──────────────────────────────────
function RenderContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded text-[0.9em]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Source Citation Card ─────────────────────────────────────────────────
export function SourceCard({ source }: { source: SourceCitation }) {
  const config = CATEGORY_CONFIG[source.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-xl border cursor-pointer",
        "bg-surface/50 border-border/50 hover:bg-surface hover:border-brand/20",
        "transition-all duration-150"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
          config.bgClass,
          config.borderClass
        )}
      >
        <span className="text-base">{config.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-medium text-foreground truncate">{source.documentName}</p>
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

// ─── Document Result Card (when AI returns a document reference) ──────────
export function DocumentResultCard({ doc }: { doc: DocumentReference }) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        "bg-card border-border/60 hover:border-brand/25",
        "transition-all duration-150 group"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-xl",
          doc.thumbnailColor.split(" ")[0],
          config.bgClass,
          config.borderClass
        )}
      >
        {doc.thumbnailEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.documentName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-medium", config.color)}>
            {doc.category}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[10px] text-muted-foreground">{doc.sizeLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/workspace/documents/${doc.documentId}`}
          className="flex items-center gap-1 text-[11px] text-brand bg-brand/10 border border-brand/20 hover:bg-brand/15 px-2.5 py-1.5 rounded-lg transition-all"
        >
          <FileText className="w-3 h-3" />
          Open
        </Link>
        <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-brand" />
      </div>
      <div className="bg-surface rounded-2xl rounded-tl-sm px-4 py-3 border border-border/40">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── User Message ─────────────────────────────────────────────────────────
export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] bg-brand/15 border border-brand/20 text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
        {message.content}
      </div>
    </motion.div>
  );
}

// ─── AI Message ───────────────────────────────────────────────────────────
export function AIMessage({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNoDocuments = message.responseType === "no_documents";
  const isNotFound = message.responseType === "not_found";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex items-start gap-3"
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-brand" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Answer bubble */}
        {message.isStreaming ? (
          <TypingIndicator />
        ) : (
          <div
            className={cn(
              "rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed",
              isNoDocuments || isNotFound
                ? "bg-surface/50 border border-border/40 text-muted-foreground"
                : "bg-surface border border-border/40 text-foreground"
            )}
          >
            {/* Icon for special states */}
            {isNoDocuments && (
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-brand shrink-0" />
                <span className="text-xs font-medium text-brand">No documents yet</span>
              </div>
            )}
            {isNotFound && (
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-amber-400">Not found</span>
              </div>
            )}

            {/* Main text — render with inline markdown */}
            <div className="whitespace-pre-line">
              <RenderContent text={message.content} />
            </div>

            {/* Upload CTA for no-documents state */}
            {isNoDocuments && (
              <Link
                href="/workspace/upload"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-3 py-1.5 rounded-xl transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload your first document
              </Link>
            )}
          </div>
        )}

        {/* Sources */}
        {!message.isStreaming && message.sources && message.sources.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest pl-1">
              Sources
            </p>
            {message.sources.map((src) => (
              <SourceCard key={`${src.documentId}-${src.page}`} source={src} />
            ))}
          </div>
        )}

        {/* Document results */}
        {!message.isStreaming && message.documents && message.documents.length > 0 && (
          <div className="space-y-2">
            {message.documents.map((doc) => (
              <DocumentResultCard key={doc.documentId} doc={doc} />
            ))}
          </div>
        )}

        {/* Footer actions */}
        {!message.isStreaming && message.content && (
          <div className="flex items-center gap-3 pl-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <CheckCheck className="w-3 h-3 text-brand" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="text-muted-foreground/25">·</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Message Router ───────────────────────────────────────────────────────
// Renders the correct message component based on role.
// Deduplicates by id — if the same id appears twice, render the last one.
export function ChatMessageItem({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.isStreaming) return <TypingIndicator />;
  return <AIMessage message={message} />;
}

