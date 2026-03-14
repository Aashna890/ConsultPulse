/**
 * api.js
 * ──────
 * Replaces base44 SDK. All calls go to our FastAPI backend.
 * Set VITE_API_BASE_URL in .env (default: http://localhost:8000)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ─────────────────────────────────────────────
// Consultations
// ─────────────────────────────────────────────

export const consultationApi = {
  list: () => request("GET", "/consultations"),
  get: (id) => request("GET", `/consultations/${id}`),
  create: (data) => request("POST", "/consultations", data),
  update: (id, updates) => request("PATCH", `/consultations/${id}`, updates),
  filterByStatus: async (status) => {
    const all = await request("GET", "/consultations");
    if (status === "all") return all;
    return all.filter((c) => c.status === status);
  },
};

// ─────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────

export const commentApi = {
  list: (consultationId) =>
    request("GET", consultationId ? `/comments?consultation_id=${consultationId}` : "/comments"),
  create: (data) => request("POST", "/comments", data),
  analyseAll: (commentIds, consultationId) =>
    request("POST", "/comments/analyse", {
      comment_ids: commentIds,
      consultation_id: consultationId,
    }),
};

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

export const analyticsApi = {
  summary: (consultationId) =>
    request("GET", consultationId ? `/analytics/summary?consultation_id=${consultationId}` : "/analytics/summary"),
  modelStats: () => request("GET", "/model/stats"),
};