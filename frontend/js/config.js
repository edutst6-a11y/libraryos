// Auto-selects the API base URL by hostname: local dev talks to the local
// Flask server, anything else (Vercel, etc.) talks to the deployed Render API.
const API_BASE = (() => {
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "http://localhost:5055";
  return "https://libraryos-api.onrender.com";
})();

function getToken() { return localStorage.getItem("lo_token"); }
function setToken(t) { localStorage.setItem("lo_token", t); }
function clearToken() { localStorage.removeItem("lo_token"); localStorage.removeItem("lo_account"); }
function getAccount() { try { return JSON.parse(localStorage.getItem("lo_account") || "null"); } catch { return null; } }
function setAccount(a) { localStorage.setItem("lo_account", JSON.stringify(a)); }

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    clearToken();
    window.location.href = "/index.html";
    throw new Error("Not authenticated");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function requireAuth() {
  if (!getToken()) window.location.href = "/index.html";
}
function logout() { clearToken(); window.location.href = "/index.html"; }
