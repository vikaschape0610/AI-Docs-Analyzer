"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Upload,
  Files,
  Sparkles,
  MessageSquare,
  FileSearch,
  FolderOpen,
} from "lucide-react";

interface EmptyStateProps {
  className?: string;
}

// ─── Shared wrapper ───────────────────────────────────────────────────────
function EmptyWrapper({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      <div
        className={`w-16 h-16 rounded-3xl ${iconBg} border flex items-center justify-center mb-5`}
      >
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
        {description}
      </p>
      {action}
      {children}
    </motion.div>
  );
}

// ─── Workspace Empty ──────────────────────────────────────────────────────
// Shown on Workspace when no documents uploaded yet.
export function WorkspaceEmpty({ className }: EmptyStateProps) {
  return (
    <EmptyWrapper
      icon={Sparkles}
      iconColor="text-brand"
      iconBg="bg-brand/10 border-brand/20"
      title="Welcome to DocMind AI"
      description="Upload your documents and ask anything about them. I'll find the answers instantly."
      action={
        <Link
          href="/workspace/upload"
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-all glow-brand-sm shadow-md"
        >
          <Upload className="w-4 h-4" />
          Upload your first document
        </Link>
      }
    />
  );
}

// ─── Chat Empty ───────────────────────────────────────────────────────────
// Shown in the chat area before the first message is sent.
export function ChatEmpty({
  hasDocuments,
  onSuggest,
}: {
  hasDocuments: boolean;
  onSuggest?: (q: string) => void;
}) {
  const suggestions = hasDocuments
    ? [
        "What is my Aadhaar number?",
        "Summarize my resume",
        "When does my passport expire?",
        "What's my Semester 5 percentage?",
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center"
    >
      <div className="w-14 h-14 rounded-3xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-5">
        <Sparkles className="w-6 h-6 text-brand" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {hasDocuments
          ? "Ask anything about your documents"
          : "No documents yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
        {hasDocuments
          ? "Type a question below or choose a suggestion to get started."
          : "Upload your documents first and then ask me anything about them."}
      </p>

      {!hasDocuments && (
        <Link
          href="/workspace/upload"
          className="inline-flex items-center gap-2 text-sm text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-4 py-2 rounded-xl transition-all mb-6"
        >
          <Upload className="w-4 h-4" />
          Upload documents
        </Link>
      )}

      {suggestions.length > 0 && onSuggest && (
        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {suggestions.map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border/60 hover:border-brand/30 hover:text-brand px-3 py-1.5 rounded-full transition-all"
            >
              <Sparkles className="w-3 h-3" />
              {q}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Documents Empty ──────────────────────────────────────────────────────
export function DocumentsEmpty({ className }: EmptyStateProps) {
  return (
    <EmptyWrapper
      icon={Files}
      iconColor="text-brand"
      iconBg="bg-brand/10 border-brand/20"
      title="No documents yet"
      description="Upload your first document to start using AI-powered search and extraction."
      action={
        <Link
          href="/workspace/upload"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-4 py-2.5 rounded-xl transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload a document
        </Link>
      }
    />
  );
}

// ─── Documents Empty (filtered) ───────────────────────────────────────────
export function DocumentsFilterEmpty({ filter }: { filter: string }) {
  return (
    <EmptyWrapper
      icon={FileSearch}
      iconColor="text-muted-foreground"
      iconBg="bg-muted/40 border-border/40"
      title={`No ${filter} documents`}
      description={`You haven't uploaded any ${filter.toLowerCase()} documents yet. Upload one to see it here.`}
      action={
        <Link
          href="/workspace/upload"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground border border-border/60 hover:border-brand/30 hover:text-brand px-4 py-2 rounded-xl transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload {filter.toLowerCase()} document
        </Link>
      }
    />
  );
}

// ─── Upload Queue Empty ───────────────────────────────────────────────────
export function UploadQueueEmpty({ className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-8 text-muted-foreground"
    >
      <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">No files in queue. Drag files above to upload.</p>
    </motion.div>
  );
}

// ─── Document Detail Empty ────────────────────────────────────────────────
export function DocumentDetailEmpty({ className }: EmptyStateProps) {
  return (
    <EmptyWrapper
      icon={FileSearch}
      iconColor="text-muted-foreground"
      iconBg="bg-muted/40 border-border/40"
      title="Document not found"
      description="This document may have been deleted or the link is invalid."
      action={
        <Link
          href="/workspace/documents"
          className="inline-flex items-center gap-2 text-sm text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-4 py-2 rounded-xl transition-all"
        >
          <Files className="w-4 h-4" />
          Back to Documents
        </Link>
      }
    />
  );
}

// ─── Search No Results ────────────────────────────────────────────────────
export function SearchEmpty({ query }: { query: string }) {
  return (
    <EmptyWrapper
      icon={FileSearch}
      iconColor="text-muted-foreground"
      iconBg="bg-muted/40 border-border/40"
      title="No results"
      description={`No documents match "${query}". Try a different search term or upload relevant documents.`}
    />
  );
}

// ─── Chat No Documents ────────────────────────────────────────────────────
export function ChatNoDocuments({ className }: EmptyStateProps) {
  return (
    <EmptyWrapper
      icon={MessageSquare}
      iconColor="text-brand"
      iconBg="bg-brand/10 border-brand/20"
      title="No documents to search"
      description="Upload your documents first. Once uploaded, you can ask anything about them here."
      action={
        <Link
          href="/workspace/upload"
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-all glow-brand-sm"
        >
          <Upload className="w-4 h-4" />
          Upload documents
        </Link>
      }
    />
  );
}
