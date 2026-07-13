// ─── DocMind AI — Shared TypeScript Interfaces ───────────────────────────
// These types define the data contracts between the UI and the backend.
// When the backend is ready, only the service layer needs to change —
// the UI components remain untouched because they consume these same types.

// ─── Document Type (fine-grained, drives extraction logic) ───────────────
export type DocumentType =
  | "aadhaar_card"
  | "pan_card"
  | "passport"
  | "student_id" // college / student identity card
  | "employee_id" // company / employee card
  | "resume" // resume / CV
  | "marksheet" // academic result / marksheet
  | "income_certificate" // income / salary certificate
  | "caste_certificate" // caste / domicile / OBC etc.
  | "bank_statement" // bank statement / passbook
  | "offer_letter" // offer letter / appointment / experience letter
  | "government_certificate" // other govt docs (bonafide, migration, etc.)
  | "generic"; // fallback

// ─── RAG Chunk ────────────────────────────────────────────────────────────
// Represents a single chunk of text from an extracted document.
// Stored in localStorage via ragStore and passed to /api/chat for retrieval.

export interface Chunk {
  id: string; // "<documentId>-chunk-<index>"
  documentId: string;
  documentName: string;
  documentType?: DocumentType; // for context-aware retrieval
  category: DocumentCategory;
  pageNum: number;
  chunkIndex: number;
  text: string;
  userId?: string; // owner — for per-user isolation
}

// ─── Document ─────────────────────────────────────────────────────────────

export type DocumentCategory =
  | "Identity"
  | "Academic"
  | "Financial"
  | "Career"
  | "Government"
  | "Medical"
  | "Other";

export type DocumentFileType = "pdf" | "image" | "docx" | "other";

export type UploadStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export interface Document {
  id: string;
  name: string;
  category: DocumentCategory;
  documentType?: DocumentType; // fine-grained type detected during extraction
  fileType: DocumentFileType;
  sizeBytes: number;
  sizeLabel: string;
  pages: number;
  uploadedAt: string; // ISO 8601
  uploadedAtLabel: string; // human-readable relative
  thumbnailColor: string; // gradient CSS classes
  thumbnailEmoji: string;
  tags: string[];
  summary?: string;
  extractedInfo?: ExtractedField[];
  aiSummary?: string;
  rawText?: string; // full extracted text — persisted for document-scoped chat
  userId?: string; // owner — for per-user isolation
}

export interface ExtractedField {
  label: string;
  value: string;
  fieldType: "text" | "number" | "date" | "id" | "address";
  confidence?: number; // 0–1, future backend field
}

export interface UploadQueueItem {
  id: string;
  file?: File; // undefined for mock items
  name: string;
  sizeLabel: string;
  status: UploadStatus;
  progress: number; // 0–100
  errorMessage?: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export type AIResponseType =
  | "greeting" // hello, hi, thank you
  | "document_qa" // question answered from documents
  | "document_list" // AI returns a list of matching documents
  | "no_documents" // user has no documents uploaded
  | "not_found" // answer not found in documents
  | "general"; // general AI response

export interface SourceCitation {
  documentId: string;
  documentName: string;
  category: DocumentCategory;
  page: number;
  excerpt: string;
}

export interface DocumentReference {
  documentId: string;
  documentName: string;
  category: DocumentCategory;
  sizeLabel: string;
  fileType: DocumentFileType;
  thumbnailEmoji: string;
  thumbnailColor: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO 8601
  responseType?: AIResponseType;
  sources?: SourceCitation[]; // for document_qa
  documents?: DocumentReference[]; // for document_list
  isStreaming?: boolean; // future: streaming support
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

// ─── Chat Service Request / Response ──────────────────────────────────────

export interface ExtractedFieldHit {
  fieldLabel: string;
  fieldValue: string;
  documentName: string;
  documentId: string;
  documentType?: DocumentType;
}

export interface ChatRequest {
  query: string;
  sessionId: string;
  documentIds?: string[]; // scope chat to specific docs
  chunks?: Chunk[]; // top-K retrieved chunks — passed by client to /api/chat
  extractedFieldHit?: ExtractedFieldHit; // direct field match — skip Groq
}

export interface ChatResponse {
  message: ChatMessage;
}

// ─── Upload ───────────────────────────────────────────────────────────────

export interface UploadResult {
  documentId: string;
  status: "queued" | "processing" | "completed" | "failed";
  message?: string;
}

// ─── App State ────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  plan: string;
}

export interface AppState {
  documents: Document[];
  uploadQueue: UploadQueueItem[];
  activeSession: ChatSession | null;
  isLoadingDocuments: boolean;
  isInitialized: boolean;
  user: UserProfile | null;
}

// ─── Category Config ──────────────────────────────────────────────────────

export interface CategoryConfig {
  label: DocumentCategory;
  color: string;
  bgClass: string;
  borderClass: string;
  emoji: string;
}

export const CATEGORY_CONFIG: Record<DocumentCategory, CategoryConfig> = {
  Identity: {
    label: "Identity",
    color: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/20",
    emoji: "🪪",
  },
  Academic: {
    label: "Academic",
    color: "text-green-400",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/20",
    emoji: "🎓",
  },
  Financial: {
    label: "Financial",
    color: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    emoji: "🏦",
  },
  Career: {
    label: "Career",
    color: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
    emoji: "💼",
  },
  Government: {
    label: "Government",
    color: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
    emoji: "🏛️",
  },
  Medical: {
    label: "Medical",
    color: "text-pink-400",
    bgClass: "bg-pink-500/10",
    borderClass: "border-pink-500/20",
    emoji: "🏥",
  },
  Other: {
    label: "Other",
    color: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/20",
    emoji: "📎",
  },
};
