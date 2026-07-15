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
  UploadStageKey,
  UploadStageStatus,
  UploadStage,
} from "@/lib/types";
import { UPLOAD_STAGES } from "@/lib/types";
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
  chatSessions: ChatSession[];
  isLoadingDocuments: boolean;
  isInitialized: boolean;
  user: UserProfile | null;
}

const initialSession = createSession();

const initialState: AppState = {
  documents: [],
  uploadQueue: [],
  activeSession: initialSession,
  chatSessions: [initialSession],
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
      payload: { id: string; progress: number; status: UploadStatus };
    }
  | {
      type: "UPDATE_QUEUE_STAGES";
      payload: { id: string; stages: UploadStage[] };
    }
  | { type: "REMOVE_FROM_QUEUE"; payload: string }
  | { type: "CLEAR_QUEUE" }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "REPLACE_MESSAGE"; payload: ChatMessage }
  | { type: "NEW_SESSION"; payload: string }
  | { type: "SWITCH_SESSION"; payload: string }
  | { type: "DELETE_SESSION"; payload: string }
  | { type: "RENAME_SESSION"; payload: { id: string; title: string } }
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
      return { ...state, isInitialized: true, isLoadingDocuments: false };
    case "ADD_DOCUMENT":
      return { ...state, documents: [action.payload, ...state.documents] };
    case "REMOVE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.payload),
      };
    case "CLEAR_ALL_DOCUMENTS":
      return { ...state, documents: [] };

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
    case "UPDATE_QUEUE_STAGES":
      return {
        ...state,
        uploadQueue: state.uploadQueue.map((item) =>
          item.id === action.payload.id
            ? { ...item, stages: action.payload.stages }
            : item,
        ),
      };
    case "REMOVE_FROM_QUEUE":
      return {
        ...state,
        uploadQueue: state.uploadQueue.filter((q) => q.id !== action.payload),
      };
    case "CLEAR_QUEUE":
      return { ...state, uploadQueue: [] };

    case "ADD_MESSAGE":
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: [...state.activeSession.messages, action.payload],
        },
        chatSessions: state.chatSessions.map((s) =>
          s.id === state.activeSession.id
            ? { ...s, messages: [...s.messages, action.payload] }
            : s,
        ),
      };
    case "REPLACE_MESSAGE":
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          messages: state.activeSession.messages.map((m) =>
            m.id === action.payload.id ? action.payload : m,
          ),
        },
        chatSessions: state.chatSessions.map((s) =>
          s.id === state.activeSession.id
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === action.payload.id ? action.payload : m,
                ),
              }
            : s,
        ),
      };
    case "NEW_SESSION": {
      const newSession = createSession(action.payload);
      return {
        ...state,
        activeSession: newSession,
        chatSessions: [newSession, ...state.chatSessions].slice(0, 50),
      };
    }
    case "SWITCH_SESSION": {
      const session = state.chatSessions.find((s) => s.id === action.payload);
      if (!session) return state;
      return { ...state, activeSession: session };
    }
    case "DELETE_SESSION": {
      const remaining = state.chatSessions.filter(
        (s) => s.id !== action.payload,
      );
      const active =
        remaining.length > 0
          ? remaining[0].id === action.payload
            ? remaining[0]
            : state.activeSession.id === action.payload
              ? remaining[0]
              : state.activeSession
          : createSession();
      return {
        ...state,
        chatSessions: remaining.length > 0 ? remaining : [active],
        activeSession: active,
      };
    }
    case "RENAME_SESSION":
      return {
        ...state,
        chatSessions: state.chatSessions.map((s) =>
          s.id === action.payload.id
            ? { ...s, title: action.payload.title }
            : s,
        ),
        activeSession:
          state.activeSession.id === action.payload.id
            ? { ...state.activeSession, title: action.payload.title }
            : state.activeSession,
      };
    case "CLEAR_SESSION": {
      const fresh = createSession();
      return {
        ...state,
        activeSession: fresh,
        chatSessions: [fresh, ...state.chatSessions].slice(0, 50),
      };
    }
    case "SET_USER":
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  refreshDocuments: () => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  clearAllDocuments: () => Promise<void>;
  enqueueFiles: (files: File[]) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  sendMessage: (query: string) => Promise<void>;
  clearChat: () => void;
  startNewChat: (firstMessage?: string) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const login = useCallback(async (email: string) => {
    const userId = email.toLowerCase().trim();
    const localPart = userId.split("@")[0];
    const name =
      localPart
        .replace(/[0-9]/g, "")
        .split(/[._-]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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

    const userDocsKey = `docmind_documents_${userId}`;
    const storedDocs = localStorage.getItem(userDocsKey);
    if (storedDocs) {
      try {
        const parsed: Document[] = JSON.parse(storedDocs);
        dispatch({ type: "SET_DOCUMENTS", payload: parsed });
        import("@/lib/ragStore")
          .then(({ getChunkCount, addChunks }) => {
            import("@/lib/chunker").then(({ chunkText }) => {
              for (const doc of parsed) {
                if (doc.rawText && getChunkCount(doc.id, userId) === 0) {
                  const chunks = chunkText(
                    doc.rawText,
                    doc.id,
                    doc.name,
                    doc.category,
                  );
                  if (chunks.length > 0) addChunks(doc.id, chunks, userId);
                }
              }
            });
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    } else {
      dispatch({ type: "SET_DOCUMENTS", payload: [] });
    }

    // Load saved chat sessions
    const sessionsKey = `docmind_sessions_${userId}`;
    const storedSessions = localStorage.getItem(sessionsKey);
    if (storedSessions) {
      try {
        const sessions: ChatSession[] = JSON.parse(storedSessions);
        if (sessions.length > 0) {
          sessions.forEach((s, i) => {
            if (i === 0) dispatch({ type: "SWITCH_SESSION", payload: s.id });
          });
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("docmind_user");
    dispatch({ type: "SET_USER", payload: null });
    dispatch({ type: "SET_DOCUMENTS", payload: [] });
    dispatch({ type: "CLEAR_QUEUE" });
    dispatch({ type: "CLEAR_SESSION" });
  }, []);

  const refreshDocuments = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const docs = await documentService.getDocuments();
      dispatch({ type: "SET_DOCUMENTS", payload: docs });
    } finally {
      dispatch({ type: "SET_INITIALIZED" });
    }
  }, []);

  // Load user + docs + sessions on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("docmind_user");
    if (storedUser) {
      try {
        const user: UserProfile = JSON.parse(storedUser);
        dispatch({ type: "SET_USER", payload: user });

        const userId = user.email.toLowerCase().trim();

        // Load documents
        const storedDocs = localStorage.getItem(`docmind_documents_${userId}`);
        if (storedDocs) {
          try {
            const parsed: Document[] = JSON.parse(storedDocs);
            dispatch({ type: "SET_DOCUMENTS", payload: parsed });
            import("@/lib/ragStore")
              .then(({ getChunkCount, addChunks }) => {
                import("@/lib/chunker").then(({ chunkText }) => {
                  for (const doc of parsed) {
                    if (doc.rawText && getChunkCount(doc.id, userId) === 0) {
                      const chunks = chunkText(
                        doc.rawText,
                        doc.id,
                        doc.name,
                        doc.category,
                      );
                      if (chunks.length > 0) addChunks(doc.id, chunks, userId);
                    }
                  }
                });
              })
              .catch(() => {});
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
    dispatch({ type: "SET_INITIALIZED" });
  }, []);

  // Persist documents
  useEffect(() => {
    if (!state.user) return;
    const userId = state.user.email.toLowerCase().trim();
    localStorage.setItem(
      `docmind_documents_${userId}`,
      JSON.stringify(state.documents),
    );
  }, [state.documents, state.user]);

  // Persist chat sessions
  useEffect(() => {
    if (!state.user) return;
    const userId = state.user.email.toLowerCase().trim();
    localStorage.setItem(
      `docmind_sessions_${userId}`,
      JSON.stringify(state.chatSessions),
    );
  }, [state.chatSessions, state.user]);

  const removeDocument = useCallback(
    async (id: string) => {
      const userId = state.user?.email.toLowerCase().trim();
      await documentService.deleteDocument(id);
      dispatch({ type: "REMOVE_DOCUMENT", payload: id });
      import("@/lib/ragStore")
        .then(({ removeDocument: rc }) => rc(id, userId))
        .catch(() => {});
    },
    [state.user],
  );

  const clearAllDocuments = useCallback(async () => {
    const userId = state.user?.email.toLowerCase().trim();
    dispatch({ type: "CLEAR_ALL_DOCUMENTS" });
    import("@/lib/ragStore")
      .then(({ clearAllChunks }) => clearAllChunks(userId))
      .catch(() => {});
    if (userId) localStorage.setItem(`docmind_documents_${userId}`, "[]");
  }, [state.user]);

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const items: UploadQueueItem[] = files.map((file) => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        name: file.name,
        sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: "pending" as UploadStatus,
        progress: 0,
        stages: UPLOAD_STAGES.map((s) => ({ ...s })),
      }));

      dispatch({ type: "ADD_TO_QUEUE", payload: items });

      const userId = state.user?.email.toLowerCase().trim();

      items.forEach((item) => {
        // Capture a mutable stages array per item in closure
        // This avoids stale closure on state.uploadQueue entirely
        const itemStages = UPLOAD_STAGES.map((s) => ({ ...s }));

        simulateUploadProgress(
          item,
          (id, progress, status) =>
            dispatch({
              type: "UPDATE_QUEUE_ITEM",
              payload: { id, progress, status },
            }),
          (id, completedDoc) => {
            if (completedDoc)
              dispatch({ type: "ADD_DOCUMENT", payload: completedDoc });
            setTimeout(
              () => dispatch({ type: "REMOVE_FROM_QUEUE", payload: id }),
              3000,
            );
          },
          userId,
          (id, key, status) => {
            // Mutate closure-captured stages array, then dispatch snapshot
            const stageIdx = itemStages.findIndex((s) => s.key === key);
            if (stageIdx >= 0)
              itemStages[stageIdx] = { ...itemStages[stageIdx], status };
            dispatch({
              type: "UPDATE_QUEUE_STAGES",
              payload: { id, stages: [...itemStages] },
            });
          },
        );
      });
    },
    [state.user],
  );

  const removeFromQueue = useCallback(
    (id: string) => dispatch({ type: "REMOVE_FROM_QUEUE", payload: id }),
    [],
  );
  const clearQueue = useCallback(() => dispatch({ type: "CLEAR_QUEUE" }), []);

  const sendMessage = useCallback(
    async (query: string) => {
      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: query,
        timestamp: now,
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMsg });

      // Auto-title session from first message
      if (state.activeSession.messages.length === 0) {
        dispatch({
          type: "RENAME_SESSION",
          payload: { id: state.activeSession.id, title: query.slice(0, 45) },
        });
      }

      const streamingId = `msg-${Date.now()}-ai`;
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: streamingId,
          role: "assistant",
          content: "",
          timestamp: now,
          isStreaming: true,
        },
      });

      try {
        const { message } = await chatService.generateResponse(
          { query, sessionId: state.activeSession.id },
          state.documents,
          state.user?.email.toLowerCase().trim(),
          state.user?.name,
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
    [state.activeSession, state.documents, state.user],
  );

  const clearChat = useCallback(() => dispatch({ type: "CLEAR_SESSION" }), []);
  const startNewChat = useCallback(
    (firstMessage?: string) =>
      dispatch({ type: "NEW_SESSION", payload: firstMessage ?? "" }),
    [],
  );
  const switchSession = useCallback(
    (id: string) => dispatch({ type: "SWITCH_SESSION", payload: id }),
    [],
  );
  const deleteSession = useCallback(
    (id: string) => dispatch({ type: "DELETE_SESSION", payload: id }),
    [],
  );
  const renameSession = useCallback(
    (id: string, title: string) =>
      dispatch({ type: "RENAME_SESSION", payload: { id, title } }),
    [],
  );

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
        switchSession,
        deleteSession,
        renameSession,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

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
  const {
    state,
    sendMessage,
    clearChat,
    startNewChat,
    switchSession,
    deleteSession,
    renameSession,
  } = useApp();
  return {
    session: state.activeSession,
    sessions: state.chatSessions,
    messages: state.activeSession.messages,
    hasMessages: state.activeSession.messages.length > 0,
    sendMessage,
    clearChat,
    startNewChat,
    switchSession,
    deleteSession,
    renameSession,
  };
}

export function useUploadQueue() {
  const { state, enqueueFiles, removeFromQueue, clearQueue } = useApp();
  return {
    queue: state.uploadQueue,
    isEmpty: state.uploadQueue.length === 0,
    completedCount: state.uploadQueue.filter((q) => q.status === "completed")
      .length,
    totalCount: state.uploadQueue.length,
    enqueueFiles,
    removeFromQueue,
    clearQueue,
  };
}
