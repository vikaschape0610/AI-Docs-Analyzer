"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Share2,
  Sparkles,
  Copy,
  CheckCheck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { chatService } from "@/lib/services";
import { CATEGORY_CONFIG } from "@/lib/types";
import type { ChatMessage, Document } from "@/lib/types";
import { DocumentDetailEmpty } from "@/components/empty-states";

const TABS = ["Preview", "Extracted Info", "AI Summary", "Chat"] as const;
type Tab = (typeof TABS)[number];

// ─── Extracted Info Tab ───────────────────────────────────────────────────
function ExtractedInfoTab({ doc }: { doc: Document }) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!doc.extractedInfo?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          Extraction in progress
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          AI is extracting key information from this document. This may take a
          moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-brand/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Extracted Information
        </p>
        <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
          AI Extracted
        </span>
      </div>
      {doc.extractedInfo.map((field, i) => (
        <motion.div
          key={field.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="group flex items-start justify-between gap-3 bg-card rounded-xl border border-border/50 px-4 py-3 hover:border-border transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {field.label}
            </p>
            <p
              className={cn(
                "text-sm text-foreground font-medium",
                field.fieldType === "id" &&
                  "font-mono tracking-wider text-brand",
              )}
            >
              {field.value}
            </p>
            {field.confidence !== undefined && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {Math.round(field.confidence * 100)}% confidence
              </p>
            )}
          </div>
          <button
            onClick={() => handleCopy(field.value, field.label)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            {copied === field.label ? (
              <CheckCheck className="w-3.5 h-3.5 text-brand" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ─── AI Summary Tab ───────────────────────────────────────────────────────
function AISummaryTab({ doc }: { doc: Document }) {
  const [copied, setCopied] = useState(false);

  if (!doc.aiSummary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          Summary not yet generated
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          The AI summary will appear here once this document has been fully
          processed.
        </p>
        <button className="mt-4 flex items-center gap-1.5 text-xs text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-3 py-1.5 rounded-xl transition-all">
          <Sparkles className="w-3.5 h-3.5" />
          Generate Summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-brand/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground">AI Summary</p>
      </div>
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <p className="text-sm text-foreground leading-relaxed">
          {doc.aiSummary}
        </p>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
          <button
            onClick={() => {
              navigator.clipboard.writeText(doc.aiSummary!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <CheckCheck className="w-3 h-3 text-brand" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="text-muted-foreground/30">·</span>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors">
            <RotateCcw className="w-3 h-3" />
            Regenerate
          </button>
        </div>
      </div>
      {doc.tags.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {doc.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 bg-muted/40 border border-border/40 rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document Chat Tab ────────────────────────────────────────────────────
function DocumentChatTab({ doc }: { doc: Document }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Scope to this document only
      const { message } = await chatService.generateResponse(
        { query: q, sessionId: "doc-chat", documentIds: [doc.id] },
        [doc],
      );
      setMessages((p) => [...p, { ...message, id: `msg-${Date.now()}-ai` }]);
    } catch (err) {
      console.error("[DocumentChat] Error:", err);
      setMessages((p) => [
        ...p,
        {
          id: `msg-${Date.now()}-err`,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[360px]">
      {/* Messages */}
      <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Ask about this document
            </p>
            <p className="text-xs text-muted-foreground">
              Chat scoped to <span className="text-brand">{doc.name}</span>
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Sparkles className="w-3 h-3 text-brand" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-brand/15 border border-brand/20 text-foreground rounded-tr-sm"
                    : "bg-card border border-border/50 text-foreground rounded-tl-sm",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-brand" />
            </div>
            <div className="bg-card rounded-2xl px-4 py-2.5 border border-border/50">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 bg-card border border-border/60 rounded-xl px-3 py-2.5 focus-within:border-brand/40 transition-colors shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Ask about ${doc.name}…`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
            input.trim() && !isTyping
              ? "bg-brand text-white hover:bg-brand/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {isTyping ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Document Detail Page ─────────────────────────────────────────────────
export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("Extracted Info");
  const [doc, setDoc] = useState<Document | null | undefined>(undefined);

  // Find doc from context (avoids extra async call)
  useEffect(() => {
    if (!state.isInitialized) return;
    const found = state.documents.find((d) => d.id === id) ?? null;
    setDoc(found);
  }, [id, state.documents, state.isInitialized]);

  // Loading
  if (doc === undefined) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </div>
    );
  }

  // Not found
  if (doc === null) {
    return <DocumentDetailEmpty />;
  }

  const config = CATEGORY_CONFIG[doc.category];

  return (
    <div className="flex flex-col min-h-full">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10"
      >
        <Link
          href="/workspace/documents"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-lg shrink-0">{doc.thumbnailEmoji}</span>
          <h1 className="text-sm font-semibold text-foreground truncate">
            {doc.name}
          </h1>
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0",
              config.bgClass,
              config.borderClass,
              config.color,
            )}
          >
            {doc.category}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground hidden sm:block shrink-0">
          {doc.uploadedAtLabel} · {doc.sizeLabel}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              // Download rawText as .txt if available, otherwise show name
              const content = doc.rawText ?? doc.name;
              const blob = new Blob([content], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = doc.name.replace(/\.[^/.]+$/, "") + "_extracted.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 hover:border-border transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Download</span>
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: doc.name, text: doc.aiSummary ?? doc.name }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="flex items-center gap-1.5 text-xs bg-brand/15 text-brand border border-brand/25 hover:bg-brand/20 px-3 py-1.5 rounded-lg transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Share</span>
          </button>
        </div>
      </motion.div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Visual Preview */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex flex-col w-[42%] border-r border-border/50 bg-surface/20"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <span className="text-xs font-medium text-foreground">Preview</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                1 / {doc.pages}
              </span>
              <div className="flex items-center gap-0.5">
                <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-[260px]">
              {/* Document visual */}
              <div
                className={cn(
                  "w-full aspect-[3/4] rounded-2xl bg-gradient-to-br flex flex-col items-center justify-center border border-white/5 shadow-xl relative overflow-hidden",
                  doc.thumbnailColor,
                )}
              >
                <span className="text-7xl mb-3 animate-float">
                  {doc.thumbnailEmoji}
                </span>
                <span className="text-xs font-medium text-white/70 text-center px-4 truncate max-w-full">
                  {doc.name}
                </span>
                <span className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                  {doc.fileType} · {doc.pages}p
                </span>
                {/* Scanning line */}
                <div
                  className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  style={{ animation: "scan-line 4s linear infinite" }}
                />
              </div>

              {/* Metadata grid */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "File", value: doc.fileType.toUpperCase() },
                  { label: "Size", value: doc.sizeLabel },
                  { label: "Pages", value: String(doc.pages) },
                  { label: "Uploaded", value: doc.uploadedAtLabel },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-card rounded-xl px-3 py-2.5 border border-border/40"
                  >
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {item.label}
                    </p>
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right: Tab panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col flex-1 min-w-0"
        >
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-6 border-b border-border/50">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative px-3 py-3.5 text-xs font-medium transition-colors",
                  tab === t
                    ? "text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
                {tab === t && (
                  <motion.div
                    layoutId="doc-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "Preview" && (
                <div className="flex items-center justify-center py-12 lg:hidden">
                  <div
                    className={cn(
                      "w-48 h-64 rounded-2xl bg-gradient-to-br flex flex-col items-center justify-center border border-white/5 shadow-xl",
                      doc.thumbnailColor,
                    )}
                  >
                    <span className="text-6xl mb-3 animate-float">
                      {doc.thumbnailEmoji}
                    </span>
                    <span className="text-xs text-white/70 text-center px-3 truncate max-w-full">
                      {doc.name}
                    </span>
                  </div>
                </div>
              )}
              {tab === "Extracted Info" && <ExtractedInfoTab doc={doc} />}
              {tab === "AI Summary" && <AISummaryTab doc={doc} />}
              {tab === "Chat" && <DocumentChatTab doc={doc} />}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
