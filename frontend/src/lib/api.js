import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("productify-token");
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/**
 * Extracts a clear, descriptive reason from an error object (FastAPI/Axios/Network).
 *
 * @param {any} err - The caught error
 * @param {string} [fallback] - Action prefix or fallback message (e.g. "Failed to add game")
 * @returns {string} - Formatted error string with reason
 */
export function getErrorMessage(err, fallback = "Operation failed") {
  if (!err) return fallback;
  if (typeof err === "string") return fallback ? `${fallback} — ${err}` : err;

  const status = err.response?.status;
  const data = err.response?.data;
  let reason = "";

  if (data) {
    if (typeof data.detail === "string") {
      reason = data.detail;
    } else if (Array.isArray(data.detail)) {
      // Pydantic / FastAPI 422 validation errors
      reason = data.detail
        .map((d) => {
          const loc = Array.isArray(d.loc)
            ? d.loc.filter((x) => x !== "body" && x !== "__root__").join(".")
            : "";
          return loc ? `${loc}: ${d.msg}` : d.msg;
        })
        .join("; ");
    } else if (typeof data.detail === "object" && data.detail !== null) {
      reason = data.detail.message || data.detail.error || JSON.stringify(data.detail);
    } else if (typeof data.message === "string") {
      reason = data.message;
    } else if (typeof data.error === "string") {
      reason = data.error;
    }
  }

  // Handle standard HTTP status codes if no specific message
  if (!reason) {
    if (status === 400) reason = "Invalid request parameters (400 Bad Request)";
    else if (status === 401) reason = "Authentication required (401 Unauthorized)";
    else if (status === 403) reason = "Admin or seller permission required (403 Forbidden)";
    else if (status === 404) reason = "Endpoint or resource not found on backend (404 Not Found)";
    else if (status === 409) reason = "Conflict with existing resource (409 Conflict)";
    else if (status === 413) reason = "Payload or file too large (413)";
    else if (status === 422) reason = "Form input validation failed (422 Unprocessable)";
    else if (status === 500) reason = "Backend internal server error (500)";
    else if (status === 502) reason = "Backend server is booting or unreachable (502 Bad Gateway)";
    else if (status === 503) reason = "Backend service temporarily unavailable (503)";
    else if (status === 504) reason = "Backend request timed out (504 Gateway Timeout)";
    else if (status) reason = `Server returned HTTP ${status}`;
  }

  // Handle network / offline errors
  if (!reason) {
    if (err.message === "Network Error") {
      reason = "Network Error (cannot connect to backend API server)";
    } else if (err.code === "ECONNABORTED") {
      reason = "Request timed out";
    } else if (err.message) {
      reason = err.message;
    }
  }

  // Clarify bare "Not Found" messages
  if (status === 404 && (reason === "Not Found" || !reason)) {
    reason = "404 Not Found (API route or resource is not available on server)";
  }

  if (fallback) {
    if (!reason) return fallback;
    if (reason.toLowerCase().includes(fallback.toLowerCase())) return reason;
    return `${fallback} (Reason: ${reason})`;
  }

  return reason || "Unknown error";
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    err.reason = getErrorMessage(err, "");
    return Promise.reject(err);
  }
);

export const money = (n, ccy = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(Number(n || 0));

export default api;
