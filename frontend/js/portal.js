requireAuth();

const account = getAccount();
if (account && account.accountType === "staff") window.location.href = "/dashboard.html";

document.getElementById("logout-btn").addEventListener("click", logout);

if (new URLSearchParams(location.search).get("welcome")) {
  document.getElementById("welcome-note").hidden = false;
}

function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function fmtMoney(n) { return "K" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const STATUS_CLASS = {
  Borrowed: "badge-borrowed", Returned: "badge-returned", Overdue: "badge-overdue", Lost: "badge-lost",
  Unpaid: "badge-unpaid", Paid: "badge-paid", Waived: "badge-waived",
};
function badge(status) { return status ? `<span class="badge ${STATUS_CLASS[status] || "badge-lost"}">${status}</span>` : ""; }

// ============================================================ membership card
(async function loadMe() {
  const me = await api("/api/auth/me");
  document.getElementById("mc-name").textContent = me.full_name;
  document.getElementById("mc-number").textContent = me.membership_number;
  document.getElementById("mc-type").textContent = me.membership_type;
  document.getElementById("mc-branch").textContent = me.branch_name;
  document.getElementById("mc-since").textContent = fmtDate(me.join_date);

  const card = document.getElementById("membership-card");
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg)`;
  });
  card.addEventListener("mouseleave", () => { card.style.transform = "perspective(900px) rotateX(0) rotateY(0)"; });
})();

// ============================================================ my loans / fines
(async function loadLoans() {
  const rows = await api("/api/my/loans");
  document.getElementById("tbody-loans").innerHTML = rows.length
    ? rows.map(r => `<tr><td>${esc(r.book)}</td><td>${fmtDate(r.loan_date)}</td><td>${fmtDate(r.due_date)}</td><td>${badge(r.status)}</td></tr>`).join("")
    : `<tr class="loading-row"><td colspan="4">You haven't borrowed anything yet.</td></tr>`;
})();

(async function loadFines() {
  const rows = await api("/api/my/fines");
  document.getElementById("tbody-fines").innerHTML = rows.length
    ? rows.map(r => `<tr><td>${esc(r.book)}</td><td>${fmtMoney(r.amount)}</td><td>${esc(r.reason)}</td><td>${badge(r.status)}</td></tr>`).join("")
    : `<tr class="loading-row"><td colspan="4">No fines on your account.</td></tr>`;
})();

// ============================================================ catalogue browse
let page = 1;
async function loadBooks() {
  const q = encodeURIComponent(document.getElementById("books-q").value);
  const genre = encodeURIComponent(document.getElementById("books-genre").value);
  const data = await api(`/api/books?q=${q}&genre=${genre}&page=${page}`);
  document.getElementById("tbody-books").innerHTML = data.rows.length
    ? data.rows.map(r => `<tr><td><strong>${esc(r.title)}</strong></td><td>${esc(r.author)}</td><td>${esc(r.genre)}</td>
        <td>${esc(r.branch)}</td><td>${r.available_copies} / ${r.total_copies}</td></tr>`).join("")
    : `<tr class="loading-row"><td colspan="5">No books found.</td></tr>`;
  const totalPages = Math.max(1, Math.ceil(data.total / data.per_page));
  document.getElementById("pag-books").innerHTML = `
    <button class="btn" id="prev-books" ${page <= 1 ? "disabled" : ""}>&larr; Prev</button>
    <span>Page ${page} of ${totalPages} &middot; ${data.total} total</span>
    <button class="btn" id="next-books" ${page >= totalPages ? "disabled" : ""}>Next &rarr;</button>`;
  document.getElementById("prev-books")?.addEventListener("click", () => { page--; loadBooks(); });
  document.getElementById("next-books")?.addEventListener("click", () => { page++; loadBooks(); });
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

api("/api/genres").then(genres => {
  document.getElementById("books-genre").innerHTML += genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
});
document.getElementById("books-q").addEventListener("input", debounce(() => { page = 1; loadBooks(); }, 300));
document.getElementById("books-genre").addEventListener("change", () => { page = 1; loadBooks(); });
loadBooks();
