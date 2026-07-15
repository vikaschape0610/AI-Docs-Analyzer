// ─── DocMind AI — Shared TypeScript Interfaces ───────────────────────────

export type DocumentType =
  | "aadhaar_card"
  | "pan_card"
  | "passport"
  | "student_id"
  | "employee_id"
  | "resume"
  | "marksheet"
  | "income_certificate"
  | "caste_certificate"
  | "bank_statement"
  | "offer_letter"
  | "driving_licence"
  | "voter_id"
  | "birth_certificate"
  | "government_certificate"
  | "generic";

// ─── Upload Pipeline Stages ───────────────────────────────────────────────
export type UploadStageKey =
  | "upload"
  | "ocr"
  | "classify"
  | "extract"
  | "validate"
  | "chunk"
  | "index";

export type UploadStageStatus = "pending" | "running" | "done" | "error";

export interface UploadStage {
  key: UploadStageKey;
  label: string;
  status: UploadStageStatus;
}

// ─── RAG Chunk ────────────────────────────────────────────────────────────
export interface Chunk {
  id: string;
  documentId: string;
  documentName: string;
  documentType?: DocumentType;
  category: DocumentCategory;
  pageNum: number;
  chunkIndex: number;
  text: string;
  userId?: string;
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
  documentType?: DocumentType;
  fileType: DocumentFileType;
  sizeBytes: number;
  sizeLabel: string;
  pages: number;
  uploadedAt: string;
  uploadedAtLabel: string;
  thumbnailColor: string;
  thumbnailEmoji: string;
  tags: string[];
  summary?: string;
  extractedInfo?: ExtractedField[];
  aiSummary?: string;
  rawText?: string;
  userId?: string;
}

export interface ExtractedField {
  label: string;
  value: string;
  fieldType: "text" | "number" | "date" | "id" | "address" | "url";
  confidence?: number; // 0–1
  page?: number; // source page
  source?: "ai" | "regex" | "vision";
}

export interface UploadQueueItem {
  id: string;
  file?: File;
  name: string;
  sizeLabel: string;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
  stages?: UploadStage[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system";

export type AIResponseType =
  | "greeting"
  | "document_qa"
  | "document_list"
  | "no_documents"
  | "not_found"
  | "doc_not_found"
  | "field_not_found"
  | "general";

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
  timestamp: string;
  responseType?: AIResponseType;
  sources?: SourceCitation[];
  documents?: DocumentReference[];
  isStreaming?: boolean;
  confidence?: "high" | "medium" | "low";
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

// ─── Reasoning pipeline types ─────────────────────────────────────────────
export interface ExtractedFieldHit {
  fieldLabel: string;
  fieldValue: string;
  documentName: string;
  documentId: string;
  documentType?: DocumentType;
  confidence?: number;
  page?: number;
  source?: string;
}

export interface QueryIntent {
  type: "field_lookup" | "summary" | "list_docs" | "comparison" | "general";
  targetDocType?: DocumentType;
  targetField?: string;
  normalizedQuery: string;
}

export interface ChatRequest {
  query: string;
  sessionId: string;
  documentIds?: string[];
  chunks?: Chunk[];
  extractedFieldHit?: ExtractedFieldHit;
  queryIntent?: QueryIntent;
  structuredDocs?: {
    documentName: string;
    documentType?: string;
    fields: ExtractedField[];
  }[];
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
  activeSession: ChatSession;
  chatSessions: ChatSession[];
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

// Upload pipeline stage definitions (ordered)
export const UPLOAD_STAGES: UploadStage[] = [
  { key: "upload", label: "File uploaded", status: "pending" },
  { key: "ocr", label: "OCR / text extraction", status: "pending" },
  { key: "classify", label: "Document classified", status: "pending" },
  { key: "extract", label: "Metadata extracted", status: "pending" },
  { key: "validate", label: "Fields validated", status: "pending" },
  { key: "chunk", label: "Semantic chunking", status: "pending" },
  { key: "index", label: "Indexed successfully", status: "pending" },
];
