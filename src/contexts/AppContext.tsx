"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Document,
  UploadQueueItem,
  ChatSession,
  ChatMessage,
  UploadStatus,
  UserProfile,
} from "@/lib/types";
import {
  documentService,
  simulateUploadProgress,
  chatService,
  createSession,
} from "@/lib/services";

// ─── State ────────────────────────────────────────────────────────────────

interface AppState {
  documents: Document[];
  uploadQueue: UploadQueueItem[];
  activeSession: ChatSession;
  isLoadingDocuments: boolean;
  isInitialized: boolean;
  user: UserProfile | null;
}

const initialSession = createSession();

const initialState: AppState = {
  documents: [],
  uploadQueue: [],
  activeSession: initialSession,
  isLoadingDocuments: true,
  isInitialized: false,
  user: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_DOCUMENTS"; payload: Document[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_INITIALIZED" }
  | { type: "ADD_DOCUMENT"; payload: Document }
  | { type: "REMOVE_DOCUMENT"; payload: string }
  | { type: "ADD_TO_QUEUE"; payload: UploadQueueItem[] }
  | {
      type: "UPDATE_QUEUE_ITEM";
      payload: {
        id: string;
        progress: number;
        status: UploadStatus;
      };
    }
  | { type: "REMOVE_FROM_QUEUE"; payload: string }
  | { type: "CLEAR_QUEUE" }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | {
      type: "SET_MESSAGE_STREAMING";
      payload: {
        id: string;
        isStreaming: boolean;
      };
    }
  | {
      type: "REPLACE_MESSAGE";
      payload: ChatMessage;
    }
  | { type: "NEW_SESSION"; payload: string }
  | { type: "CLEAR_SESSION" }
  | { type: "SET_USER"; payload: UserProfile | null }
  | { type: "CLEAR_ALL_DOCUMENTS" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_DOCUMENTS":
      return { ...state, documents: action.payload };

    case "SET_LOADING":
      return { ...state, isLoadingDocuments: action.payload };

    case "SET_INITIALIZED":
      return {
        ...state,
        isInitialized: true,
        isLoadingDocuments: false,
      };

    case "ADD_DOCUMENT":
      return {
        ...state,
        documents: [action.payload, ...state.documents],
      };

    case "REMOVE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.payload),
      };

    case "CLEAR_ALL_DOCUMENTS":
      return {
        ...state,
        documents: [],
      };

    case "ADD_TO_QUEUE":
      return {
        ...state,
        uploadQueue: [...state.uploadQueue, ...action.payload],
      };

    case "UPDATE_QUEUE_ITEM":
      return {
        ...state,
        uploadQueue: state.uploadQueue.map((item) =>
          item.id === action.payload.id
            ? {
                ...item,
                progress: action.payload.progress,
                status: action.payload.status,
              }
            : item,
        ),
      };

    case "REMOVE_FROM_QUEUE":
      return {
        ...state,
        uploadQueue: state.uploadQueue.filter((q) => q.id !== action.payload),
      };

    case "CLEAR_QUEUE":
      return {
        ...state,
        uploadQueue: [],
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: [...state.activeSession.messages, action.payload],
        },
      };

    case "REPLACE_MESSAGE":
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: state.activeSession.messages.map((msg) =>
            msg.id === action.payload.id ? action.payload : msg,
          ),
        },
      };

    case "NEW_SESSION":
      return {
        ...state,
        activeSession: createSession(action.payload),
      };

    case "CLEAR_SESSION":
      return {
        ...state,
        activeSession: createSession(),
      };

    case "SET_USER":
      return {
        ...state,
        user: action.payload,
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  // Documents
  refreshDocuments: () => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  clearAllDocuments: () => Promise<void>;
  // Upload
  enqueueFiles: (files: File[]) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  // Chat
  sendMessage: (query: string) => Promise<void>;
  clearChat: () => void;
  startNewChat: (firstMessage?: string) => void;
  // Auth
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("docmind_user");
    if (storedUser) {
      try {
        dispatch({ type: "SET_USER", payload: JSON.parse(storedUser) });
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }
  }, []);

  const login = useCallback(async (email: string) => {
    const userId = email.toLowerCase().trim();
    const localPart = userId.split("@")[0];
    const name = localPart
      .replace(/[0-9]/g, "")
      .split(/[._-]/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") || "User";

    const user: UserProfile = {
      name,
      email: userId,
      avatar: name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      plan: "Free Plan",
    };

    localStorage.setItem("docmind_user", JSON.stringify(user));
    dispatch({ type: "SET_USER", payload: user });

    // Load this user's documents from their scoped key
    const userDocsKey = `docmind_documents_${userId}`;
    const storedDocs = localStorage.getItem(userDocsKey);
    if (storedDocs) {
      try {
        const parsed: Document[] = JSON.parse(storedDocs);
        dispatch({ type: "SET_DOCUMENTS", payload: parsed });
        // Re-hydrate user's chunks
        import("@/lib/ragStore").then(({ getChunkCount, addChunks }) => {
          import("@/lib/chunker").then(({ chunkText }) => {
            for (const doc of parsed) {
              if (doc.rawText && getChunkCount(doc.id, userId) === 0) {
                const chunks = chunkText(doc.rawText, doc.id, doc.name, doc.category);
                if (chunks.length > 0) addChunks(doc.id, chunks, userId);
              }
            }
          });
        }).catch(() => {/* non-critical */});
      } catch {
        /* ignore parse errors */
      }
    } else {
      dispatch({ type: "SET_DOCUMENTS", payload: [] });
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("docmind_user");
    // Clear in-memory state — persisted docs stay in localStorage for re-login
    dispatch({ type: "SET_USER", payload: null });
    dispatch({ type: "SET_DOCUMENTS", payload: [] });
    dispatch({ type: "CLEAR_QUEUE" });
    dispatch({ type: "CLEAR_SESSION" });
  }, []);

  // Load documents on mount
  const refreshDocuments = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const docs = await documentService.getDocuments();
      dispatch({ type: "SET_DOCUMENTS", payload: docs });
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      dispatch({ type: "SET_INITIALIZED" });
    }
  }, []);

  // Load user + their documents on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("docmind_user");
    if (storedUser) {
      try {
        const user: UserProfile = JSON.parse(storedUser);
        dispatch({ type: "SET_USER", payload: user });

        // Load that user's scoped documents
        const userId = user.email.toLowerCase().trim();
        const userDocsKey = `docmind_documents_${userId}`;
        const storedDocs = localStorage.getItem(userDocsKey);
        if (storedDocs) {
          try {
            const parsed: Document[] = JSON.parse(storedDocs);
            dispatch({ type: "SET_DOCUMENTS", payload: parsed });
            // Re-hydrate user-scoped chunks
            import("@/lib/ragStore").then(({ getChunkCount, addChunks }) => {
              import("@/lib/chunker").then(({ chunkText }) => {
                for (const doc of parsed) {
                  if (doc.rawText && getChunkCount(doc.id, userId) === 0) {
                    const chunks = chunkText(doc.rawText, doc.id, doc.name, doc.category);
                    if (chunks.length > 0) addChunks(doc.id, chunks, userId);
                  }
                }
              });
            }).catch(() => {/* non-critical */});
          } catch {
            /* ignore parse errors */
          }
        }
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }
    dispatch({ type: "SET_INITIALIZED" });
  }, []);

  // Persist documents to user-scoped key whenever they change
  useEffect(() => {
    if (!state.user) return; // don't overwrite if not logged in
    const userId = state.user.email.toLowerCase().trim();
    localStorage.setItem(`docmind_documents_${userId}`, JSON.stringify(state.documents));
  }, [state.documents, state.user]);

  // Remove document + clean up its chunks from ragStore
  const removeDocument = useCallback(async (id: string) => {
    const userId = state.user?.email.toLowerCase().trim();
    await documentService.deleteDocument(id);
    dispatch({ type: "REMOVE_DOCUMENT", payload: id });
    import("@/lib/ragStore").then(({ removeDocument: removeChunks }) => {
      removeChunks(id, userId);
    }).catch(() => {/* non-critical */});
  }, [state.user]);

  // Clear all documents + their chunks for this user
  const clearAllDocuments = useCallback(async () => {
    const userId = state.user?.email.toLowerCase().trim();
    dispatch({ type: "CLEAR_ALL_DOCUMENTS" });
    import("@/lib/ragStore").then(({ clearAllChunks }) => {
      clearAllChunks(userId);
    }).catch(() => {/* non-critical */});
    if (userId) {
      localStorage.setItem(`docmind_documents_${userId}`, "[]");
    }
  }, [state.user]);

  // Enqueue files for upload and start simulation
  const enqueueFiles = useCallback((files: File[]) => {
    const items: UploadQueueItem[] = files.map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: "pending",
      progress: 0,
    }));

    dispatch({ type: "ADD_TO_QUEUE", payload: items });

    const userId = state.user?.email.toLowerCase().trim();

    // Kick off simulated upload for each item
    items.forEach((item) => {
      simulateUploadProgress(
        item,
        (id, progress, status) => {
          dispatch({
            type: "UPDATE_QUEUE_ITEM",
            payload: { id, progress, status },
          });
        },
        (id, completedDoc) => {
          if (completedDoc) {
            dispatch({
              type: "ADD_DOCUMENT",
              payload: completedDoc,
            });
          }
          dispatch({ type: "REMOVE_FROM_QUEUE", payload: id });
        },
        userId,
      );
    });
  }, [state.user]);

  const removeFromQueue = useCallback((id: string) => {
    dispatch({ type: "REMOVE_FROM_QUEUE", payload: id });
  }, []);

  const clearQueue = useCallback(() => {
    dispatch({ type: "CLEAR_QUEUE" });
  }, []);

  // Send a chat message and get AI response
  const sendMessage = useCallback(
    async (query: string) => {
      const now = new Date().toISOString();

      // 1. Add user message immediately
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: query,
        timestamp: now,
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      // 2. Add a streaming placeholder for the AI response
      const streamingId = `msg-${Date.now()}-ai`;
      const streamingMessage: ChatMessage = {
        id: streamingId,
        role: "assistant",
        content: "",
        timestamp: now,
        isStreaming: true,
      };
      dispatch({ type: "ADD_MESSAGE", payload: streamingMessage });

      try {
        // 3. Get AI response from service (pass userId for scoped retrieval)
        const { message } = await chatService.generateResponse(
          {
            query,
            sessionId: state.activeSession.id,
          },
          state.documents,
          state.user?.email.toLowerCase().trim(),
        );

        dispatch({
          type: "REPLACE_MESSAGE",
          payload: { ...message, id: streamingId, isStreaming: false },
        });
      } catch (err) {
        console.error("Chat error:", err);
        dispatch({
          type: "REPLACE_MESSAGE",
          payload: {
            id: streamingId,
            role: "assistant",
            content: "Something went wrong. Please try again.",
            timestamp: new Date().toISOString(),
            isStreaming: false,
          },
        });
      }
    },
    [state.activeSession.id, state.documents, state.user],
  );

  const clearChat = useCallback(() => {
    dispatch({ type: "CLEAR_SESSION" });
  }, []);

  const startNewChat = useCallback((firstMessage?: string) => {
    dispatch({ type: "NEW_SESSION", payload: firstMessage ?? "" });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        refreshDocuments,
        removeDocument,
        clearAllDocuments,
        enqueueFiles,
        removeFromQueue,
        clearQueue,
        sendMessage,
        clearChat,
        startNewChat,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within <AppProvider>");
  }
  return ctx;
}

// ─── Convenience selectors ────────────────────────────────────────────────

export function useDocuments() {
  const { state } = useApp();
  return {
    documents: state.documents,
    isLoading: state.isLoadingDocuments,
    isInitialized: state.isInitialized,
    hasDocuments: state.documents.length > 0,
    count: state.documents.length,
  };
}

export function useChat() {
  const { state, sendMessage, clearChat, startNewChat } = useApp();
  return {
    session: state.activeSession,
    messages: state.activeSession.messages,
    hasMessages: state.activeSession.messages.length > 0,
    sendMessage,
    clearChat,
    startNewChat,
  };
}

export function useUploadQueue() {
  const { state, enqueueFiles, removeFromQueue, clearQueue } = useApp();
  const completedCount = state.uploadQueue.filter(
    (q) => q.status === "completed",
  ).length;
  return {
    queue: state.uploadQueue,
    isEmpty: state.uploadQueue.length === 0,
    completedCount,
    totalCount: state.uploadQueue.length,
    enqueueFiles,
    removeFromQueue,
    clearQueue,
  };
}
