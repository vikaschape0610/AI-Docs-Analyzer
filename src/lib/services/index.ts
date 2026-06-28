// ─── Services Index ───────────────────────────────────────────────────────
// Single import point for all services.
// BACKEND INTEGRATION: Swap mock implementations here without touching UI.

export { documentService, simulateUploadProgress } from "./documentService";
export { chatService, createSession } from "./chatService";
