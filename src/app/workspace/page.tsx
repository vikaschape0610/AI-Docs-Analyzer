"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Send,
  Sparkles,
  ChevronRight,
  Plus,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments, useChat, useApp } from "@/contexts/AppContext";
import { CATEGORY_CONFIG } from "@/lib/types";
import type { Document } from "@/lib/types";
import { ChatMessageItem } from "@/components/chat/ChatMessage";
import { WorkspaceEmpty, ChatEmpty } from "@/components/empty-states";

// ─── Suggested questions (generic — no personal data) ─────────────────────
const GENERIC_SUGGESTIONS = [
  "What is in my uploaded documents?",
  "Summarize my most recent document",
  "Find my identity documents",
  "What financial documents do I have?",
];

// ─── Animated placeholder questions ──────────────────────────────────────
const PLACEHOLDER_QUESTIONS = [
  "What is my Aadhaar number?",
  "Summarize my resume...",
  "When does my passport expire?",
  "What is my Semester 5 percentage?",
  "Find documents with my address...",
];

// ─── Recent Document Card ─────────────────────────────────────────────────
function RecentDocCard({ doc }: { doc: Document }) {
  const config = CATEGORY_CONFIG[doc.category];
  return (
    <Link href={`/workspace/documents/${doc.id}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="group relative bg-card border border-border/60 rounded-2xl p-4 cursor-pointer hover:border-brand/30 transition-colors duration-200 min-w-[160px] w-[160px] shrink-0"
      >
        <div
          className={cn(
            "w-full h-20 rounded-xl bg-gradient-to-br mb-3 flex items-center justify-center",
            doc.thumbnailColor
          )}
        >
          <span className="text-3xl">{doc.thumbnailEmoji}</span>
        </div>
        <p className="text-xs font-medium text-foreground truncate" title={doc.name}>
          {doc.name}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
              config.bgClass,
              config.borderClass,
              config.color
            )}
          >
            {doc.category}
          </span>
          <span className="text-[10px] text-muted-foreground">{doc.uploadedAtLabel}</span>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Search / Chat Input Bar ──────────────────────────────────────────────
function ChatInputBar({
  value,
  onChange,
  onSend,
  isTyping,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isTyping: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative group">
      {!compact && (
        <div className="absolute inset-0 rounded-2xl bg-brand/5 blur-xl group-focus-within:bg-brand/10 transition-all duration-300 pointer-events-none" />
      )}
      <div
        className={cn(
          "relative flex items-end gap-3 bg-card border border-border/60 group-focus-within:border-brand/40 transition-all duration-200",
          compact ? "rounded-2xl px-4 py-3" : "rounded-2xl px-4 py-3.5 shadow-lg"
        )}
      >
        <Sparkles className="w-4 h-4 text-brand mb-0.5 shrink-0" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={placeholder ?? "Ask anything about your documents..."}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed min-h-[24px] max-h-[120px]"
          style={{ height: "24px" }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "24px";
            t.style.height = t.scrollHeight + "px";
          }}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || isTyping}
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
            value.trim() && !isTyping
              ? "bg-brand text-white hover:bg-brand/90 glow-brand-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
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

// ─── Main Workspace Page ──────────────────────────────────────────────────
export default function WorkspacePage() {
  const { documents, hasDocuments, isLoading } = useDocuments();
  const { messages, hasMessages, sendMessage, clearChat } = useChat();
  const { state } = useApp();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // De-duplicate messages by id (keep last occurrence)
  const dedupedMessages = messages.reduce<typeof messages>((acc, msg) => {
    const existingIdx = acc.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      acc[existingIdx] = msg; // replace with latest
    } else {
      acc.push(msg);
    }
    return acc;
  }, []);

  const isAIThinking = dedupedMessages.some((m) => m.isStreaming);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dedupedMessages]);

  // Cycle placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_QUESTIONS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isAIThinking) return;

    setInput("");
    setChatStarted(true);
    setIsTyping(true);

    await sendMessage(q);
    setIsTyping(false);
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Hero / Search view ─────────────────────────────────────────────────
  if (!chatStarted) {
    return (
      <div className="flex flex-col items-center justify-start min-h-full px-6 py-14 mesh-bg">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-2">
            {greeting} 👋
          </h1>
          <p className="text-muted-foreground text-base">
            Ask anything about your documents
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-2xl"
        >
          {/* Animated placeholder text above bar */}
          {!input && (
            <div className="h-5 mb-2 text-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={placeholderIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs text-muted-foreground/50 italic"
                >
                  Try: &ldquo;{PLACEHOLDER_QUESTIONS[placeholderIdx]}&rdquo;
                </motion.p>
              </AnimatePresence>
            </div>
          )}

          <ChatInputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isTyping={isAIThinking}
          />

          {/* Suggestion chips — only if docs exist */}
          {hasDocuments && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-2 mt-4 justify-center"
            >
              {GENERIC_SUGGESTIONS.map((q, i) => (
                <motion.button
                  key={q}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  onClick={() => handleSend(q)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border/60 hover:border-brand/30 hover:text-brand px-3 py-1.5 rounded-full transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  {q}
                </motion.button>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Content: either empty state or recent docs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-2xl mt-12"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
            </div>
          ) : !hasDocuments ? (
            <WorkspaceEmpty />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-foreground">
                  Recent Documents
                </h2>
                <Link
                  href="/workspace/documents"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand transition-colors"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                {documents.slice(0, 5).map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.07 }}
                  >
                    <RecentDocCard doc={doc} />
                  </motion.div>
                ))}
                <Link href="/workspace/upload">
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="flex flex-col items-center justify-center w-[160px] h-[152px] rounded-2xl border border-dashed border-border/60 hover:border-brand/40 text-muted-foreground hover:text-brand cursor-pointer transition-all shrink-0"
                  >
                    <Plus className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Upload</span>
                  </motion.div>
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Active Chat view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">DocMind AI</p>
            <p className="text-[11px] text-muted-foreground">
              {hasDocuments
                ? `Searching ${documents.length} document${documents.length !== 1 ? "s" : ""}`
                : "No documents uploaded"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            clearChat();
            setChatStarted(false);
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 mesh-bg">
        {dedupedMessages.length === 0 ? (
          <ChatEmpty
            hasDocuments={hasDocuments}
            onSuggest={(q) => handleSend(q)}
          />
        ) : (
          dedupedMessages.map((msg) => (
            <ChatMessageItem key={`${msg.id}-${msg.isStreaming}`} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="max-w-3xl mx-auto">
          <ChatInputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isTyping={isAIThinking}
            compact
          />
          <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
            DocMind AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
