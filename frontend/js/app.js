requireAuth();

const content = document.getElementById('content');
const viewTitle = document.getElementById('view-title');
const navLinks = document.querySelectorAll('.nav-link[data-view]');

const TITLES = {
  dashboard: 'Dashboard', analytics: 'Analytics', books: 'Books', members: 'Members',
  loans: 'Loans', fines: 'Fines', reservations: 'Reservations', sql: 'SQL Explorer',
  erd: 'Entity Relationship Diagram', architecture: 'Big Data Architecture',
};

const STATUS_CLASS = {
  Borrowed: 'badge-borrowed', Returned: 'badge-returned', Overdue: 'badge-overdue', Lost: 'badge-lost',
  Unpaid: 'badge-unpaid', Paid: 'badge-paid', Waived: 'badge-waived',
  Pending: 'badge-pending', Fulfilled: 'badge-fulfilled', Cancelled: 'badge-cancelled', Expired: 'badge-expired',
};

let charts = {};
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

function badge(status) {
  if (!status) return '';
  const cls = STATUS_CLASS[status] || 'badge-lost';
  return `<span class="badge ${cls}">${status}</span>`;
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }
function fmtMoney(n) { return 'K' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

// ============================================================ user info / logout
(function initUser() {
  const account = getAccount();
  document.getElementById('user-name').textContent = account ? `${account.fullName} (${account.role || 'Staff'})` : '—';
  document.getElementById('logout-btn').addEventListener('click', logout);
})();

// ============================================================ ROUTER
function navigate() {
  const view = (location.hash || '#dashboard').slice(1);
  viewTitle.textContent = TITLES[view] || 'Dashboard';
  navLinks.forEach(a => a.classList.toggle('active', a.dataset.view === view));
  Object.keys(charts).forEach(destroyChart);
  const renderer = RENDERERS[view] || RENDERERS.dashboard;
  renderer();
}
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

// ============================================================ MOBILE NAV
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }
function openSidebar() { sidebar.classList.add('open'); backdrop.classList.add('open'); }
document.getElementById('menu-toggle').addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
backdrop.addEventListener('click', closeSidebar);
navLinks.forEach(a => a.addEventListener('click', closeSidebar));

// ============================================================ GROUP MODAL
const groupModal = document.getElementById('group-modal');
document.getElementById('group-nav-link').addEventListener('click', (e) => {
  e.preventDefault();
  closeSidebar();
  groupModal.hidden = false;
  document.getElementById('group-locked').hidden = false;
  document.getElementById('group-unlocked').hidden = true;
  document.getElementById('group-password').value = '';
  document.getElementById('group-error').hidden = true;
});
document.getElementById('group-cancel').addEventListener('click', () => groupModal.hidden = true);
document.getElementById('group-close').addEventListener('click', () => groupModal.hidden = true);
groupModal.addEventListener('click', (e) => { if (e.target === groupModal) groupModal.hidden = true; });
document.getElementById('group-submit').addEventListener('click', async () => {
  const errEl = document.getElementById('group-error');
  errEl.hidden = true;
  try {
    const res = await fetch(API_BASE + '/api/group/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('group-password').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Incorrect password.');
    document.getElementById('group-table').innerHTML = data.members.map(m => `
      <tr><td><strong>${esc(m.full_name)}</strong></td><td>${esc(m.student_id)}</td><td class="role">${esc(m.role || '')}</td></tr>
    `).join('');
    document.getElementById('group-locked').hidden = true;
    document.getElementById('group-unlocked').hidden = false;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});
document.getElementById('group-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('group-submit').click();
});

// ============================================================ DASHBOARD
async function renderDashboard() {
  content.innerHTML = `<div class="stat-grid" id="stat-grid"></div>
    <div class="grid-2">
      <div class="panel"><div class="panel-title">Top 10 Most Borrowed Books</div>
        <div class="panel-sub">From live loan data</div>
        <div class="chart-box"><canvas id="c-top-books"></canvas></div></div>
      <div class="panel"><div class="panel-title">Catalogue by Genre</div>
        <div class="panel-sub">Share of titles per genre</div>
        <div class="chart-box"><canvas id="c-genre"></canvas></div></div>
    </div>
    <div class="panel"><div class="panel-title">Monthly Borrowing Trend</div>
      <div class="panel-sub">Jan 2024 &ndash; present</div>
      <div class="chart-box"><canvas id="c-trend"></canvas></div></div>`;

  const s = await api('/api/stats');
  const cards = [
    ['Total Books', s.total_books, `${s.total_copies} physical copies`, '#3b6ea5'],
    ['Active Members', s.active_members, `${s.total_loans} loans all-time`, '#c9973d'],
    ['Currently Borrowed', s.currently_borrowed, `${s.overdue_now} overdue right now`, s.overdue_now > 0 ? '#d9534f' : '#1f9d61'],
    ['Fines Outstanding', fmtMoney(s.fines_outstanding), `${fmtMoney(s.fines_collected)} collected`, '#d99a1f'],
    ['Collection Rate', s.collection_rate_pct + '%', 'of fines issued, paid', '#1f9d61'],
    ['Branches', s.branches, 'library locations', '#8592a6'],
  ];
  document.getElementById('stat-grid').innerHTML = cards.map(([label, val, sub, color]) => `
    <div class="stat-card" style="--accent:${color}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-sub">${sub}</div>
    </div>`).join('');
  attachTilt();

  const tb = await api('/api/charts/top-books');
  charts['top-books'] = new Chart(document.getElementById('c-top-books'), {
    type: 'bar',
    data: { labels: tb.labels, datasets: [{ data: tb.values, backgroundColor: '#3b6ea5', borderRadius: 5, maxBarThickness: 26 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } },
      scales: { x: { ticks: { precision: 0 }, grid: { color: '#eef1f5' } }, y: { grid: { display: false } } } }
  });

  const g = await api('/api/charts/genre-composition');
  const palette = ['#0f2942','#1c4166','#2c5c8a','#3b6ea5','#5a89ba','#79a3cc','#9bbedb','#bcd8ea','#d9c896','#c9973d','#a67725','#d99a1f','#e8c88a','#8592a6'];
  charts['genre'] = new Chart(document.getElementById('c-genre'), {
    type: 'doughnut',
    data: { labels: g.labels, datasets: [{ data: g.values, backgroundColor: palette, borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 10.5 } } } } }
  });

  const t = await api('/api/charts/monthly-trend');
  charts['trend'] = new Chart(document.getElementById('c-trend'), {
    type: 'line',
    data: { labels: t.labels, datasets: [{ data: t.values, borderColor: '#c9973d', backgroundColor: 'rgba(201,151,61,0.12)', fill: true, tension: 0.35, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxRotation: 60, minRotation: 60, font: { size: 10 } } }, y: { ticks: { precision: 0 }, grid: { color: '#eef1f5' } } } }
  });
}

// ============================================================ ANALYTICS (full versions)
async function renderAnalytics() {
  content.innerHTML = `
    <div class="grid-2-even">
      <div class="panel"><div class="panel-title">Top 10 Most Borrowed Books</div>
        <div class="chart-box tall"><canvas id="a-top-books"></canvas></div></div>
      <div class="panel"><div class="panel-title">Catalogue Composition by Genre</div>
        <div class="chart-box tall"><canvas id="a-genre"></canvas></div></div>
    </div>
    <div class="panel"><div class="panel-title">Monthly Borrowing Trend</div>
      <div class="chart-box"><canvas id="a-trend"></canvas></div></div>
    <div class="panel"><div class="panel-title">Branch Activity: Loans vs. Fines Collected</div>
      <div class="chart-box"><canvas id="a-branch"></canvas></div></div>`;
  attachTilt();

  const tb = await api('/api/charts/top-books');
  charts['a-top-books'] = new Chart(document.getElementById('a-top-books'), {
    type: 'bar',
    data: { labels: tb.labels, datasets: [{ data: tb.values, backgroundColor: '#3b6ea5', borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } }
  });

  const g = await api('/api/charts/genre-composition');
  const palette = ['#0f2942','#1c4166','#2c5c8a','#3b6ea5','#5a89ba','#79a3cc','#9bbedb','#bcd8ea','#d9c896','#c9973d','#a67725','#d99a1f','#e8c88a','#8592a6'];
  charts['a-genre'] = new Chart(document.getElementById('a-genre'), {
    type: 'pie',
    data: { labels: g.labels, datasets: [{ data: g.values, backgroundColor: palette, borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 10.5 } } } } }
  });

  const t = await api('/api/charts/monthly-trend');
  charts['a-trend'] = new Chart(document.getElementById('a-trend'), {
    type: 'line',
    data: { labels: t.labels, datasets: [{ data: t.values, borderColor: '#c9973d', backgroundColor: 'rgba(201,151,61,0.12)', fill: true, tension: 0.35, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } } }
  });

  const b = await api('/api/charts/branch-activity');
  charts['a-branch'] = new Chart(document.getElementById('a-branch'), {
    data: { labels: b.labels, datasets: [
      { type: 'bar', label: 'Total loans', data: b.loans, backgroundColor: '#3b6ea5', borderRadius: 6, yAxisID: 'y' },
      { type: 'line', label: 'Fines collected (K)', data: b.fines, borderColor: '#c9973d', backgroundColor: '#c9973d', tension: 0.3, yAxisID: 'y1' },
    ]},
    options: { scales: {
      y: { position: 'left', title: { display: true, text: 'Loans' } },
      y1: { position: 'right', title: { display: true, text: 'Fines (K)' }, grid: { drawOnChartArea: false } },
    }}
  });
}

// ============================================================ GENERIC TABLE VIEW HELPERS
let tablePage = 1;
async function loadTable(view, url, columns, rowFn) {
  const tbody = document.getElementById('tbody-' + view);
  tbody.innerHTML = `<tr class="loading-row"><td colspan="${columns}">Loading…</td></tr>`;
  const data = await api(url);
  if (!data.rows.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="${columns}">No results.</td></tr>`;
  } else {
    tbody.innerHTML = data.rows.map(rowFn).join('');
  }
  const totalPages = Math.max(1, Math.ceil(data.total / data.per_page));
  const pag = document.getElementById('pag-' + view);
  if (pag) {
    pag.innerHTML = `
      <button class="btn" id="prev-${view}" ${data.page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
      <span>Page ${data.page} of ${totalPages} &middot; ${data.total} total</span>
      <button class="btn" id="next-${view}" ${data.page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>`;
    document.getElementById('prev-' + view)?.addEventListener('click', () => { tablePage--; loaders[view](); });
    document.getElementById('next-' + view)?.addEventListener('click', () => { tablePage++; loaders[view](); });
  }
}
const loaders = {};

// ============================================================ BOOKS
async function renderBooks() {
  tablePage = 1;
  content.innerHTML = `
    <div class="panel">
      <div class="controls-row">
        <input class="input" id="books-q" placeholder="Search title or author…">
        <select class="select" id="books-genre"><option value="">All genres</option></select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Title</th><th>Author</th><th>Genre</th><th>Branch</th><th>Year</th><th>Copies</th><th>Price</th></tr></thead>
        <tbody id="tbody-books"></tbody>
      </table></div>
      <div class="pagination" id="pag-books"></div>
    </div>`;

  const genres = await api('/api/genres');
  document.getElementById('books-genre').innerHTML += genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');

  loaders.books = () => {
    const q = encodeURIComponent(document.getElementById('books-q').value);
    const genre = encodeURIComponent(document.getElementById('books-genre').value);
    loadTable('books', `/api/books?q=${q}&genre=${genre}&page=${tablePage}`, 7, r => `
      <tr><td><strong>${esc(r.title)}</strong></td><td>${esc(r.author)}</td><td>${esc(r.genre)}</td>
      <td>${esc(r.branch)}</td><td>${r.publication_year}</td>
      <td>${r.available_copies} / ${r.total_copies}</td><td>${fmtMoney(r.price)}</td></tr>`);
  };
  document.getElementById('books-q').addEventListener('input', debounce(() => { tablePage = 1; loaders.books(); }, 300));
  document.getElementById('books-genre').addEventListener('change', () => { tablePage = 1; loaders.books(); });
  loaders.books();
}

// ============================================================ MEMBERS
async function renderMembers() {
  tablePage = 1;
  content.innerHTML = `
    <div class="panel">
      <div class="controls-row"><input class="input" id="members-q" placeholder="Search name or email…"></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Home Branch</th><th>Joined</th><th>Total Loans</th><th>Status</th></tr></thead>
        <tbody id="tbody-members"></tbody>
      </table></div>
      <div class="pagination" id="pag-members"></div>
    </div>`;
  loaders.members = () => {
    const q = encodeURIComponent(document.getElementById('members-q').value);
    loadTable('members', `/api/members?q=${q}&page=${tablePage}`, 7, r => `
      <tr><td><strong>${esc(r.full_name)}</strong></td><td>${esc(r.email)}</td><td>${esc(r.membership_type)}</td>
      <td>${esc(r.home_branch)}</td><td>${fmtDate(r.join_date)}</td><td>${r.total_loans}</td>
      <td>${r.is_active ? '<span class="badge badge-returned">Active</span>' : '<span class="badge badge-lost">Inactive</span>'}</td></tr>`);
  };
  document.getElementById('members-q').addEventListener('input', debounce(() => { tablePage = 1; loaders.members(); }, 300));
  loaders.members();
}

// ============================================================ LOANS
async function renderLoans() {
  tablePage = 1;
  content.innerHTML = `
    <div class="panel">
      <div class="controls-row">
        <select class="select" id="loans-status">
          <option value="">All statuses</option>
          <option>Borrowed</option><option>Returned</option><option>Overdue</option><option>Lost</option>
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Member</th><th>Book</th><th>Branch</th><th>Loan Date</th><th>Due Date</th><th>Return Date</th><th>Status</th></tr></thead>
        <tbody id="tbody-loans"></tbody>
      </table></div>
      <div class="pagination" id="pag-loans"></div>
    </div>`;
  loaders.loans = () => {
    const status = encodeURIComponent(document.getElementById('loans-status').value);
    loadTable('loans', `/api/loans?status=${status}&page=${tablePage}`, 7, r => `
      <tr><td>${esc(r.member)}</td><td>${esc(r.book)}</td><td>${esc(r.branch)}</td>
      <td>${fmtDate(r.loan_date)}</td><td>${fmtDate(r.due_date)}</td><td>${fmtDate(r.return_date)}</td>
      <td>${badge(r.status)}</td></tr>`);
  };
  document.getElementById('loans-status').addEventListener('change', () => { tablePage = 1; loaders.loans(); });
  loaders.loans();
}

// ============================================================ FINES
async function renderFines() {
  tablePage = 1;
  content.innerHTML = `
    <div class="panel">
      <div class="controls-row">
        <select class="select" id="fines-status">
          <option value="">All statuses</option>
          <option>Unpaid</option><option>Paid</option><option>Waived</option>
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Member</th><th>Book</th><th>Amount</th><th>Reason</th><th>Issued</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody id="tbody-fines"></tbody>
      </table></div>
      <div class="pagination" id="pag-fines"></div>
    </div>`;
  loaders.fines = () => {
    const status = encodeURIComponent(document.getElementById('fines-status').value);
    loadTable('fines', `/api/fines?status=${status}&page=${tablePage}`, 7, r => `
      <tr><td>${esc(r.member)}</td><td>${esc(r.book)}</td><td>${fmtMoney(r.amount)}</td><td>${esc(r.reason)}</td>
      <td>${fmtDate(r.issued_date)}</td><td>${fmtDate(r.paid_date)}</td><td>${badge(r.status)}</td></tr>`);
  };
  document.getElementById('fines-status').addEventListener('change', () => { tablePage = 1; loaders.fines(); });
  loaders.fines();
}

// ============================================================ RESERVATIONS
async function renderReservations() {
  tablePage = 1;
  content.innerHTML = `
    <div class="panel">
      <div class="controls-row">
        <select class="select" id="res-status">
          <option value="">All statuses</option>
          <option>Pending</option><option>Fulfilled</option><option>Cancelled</option><option>Expired</option>
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Member</th><th>Book</th><th>Reserved On</th><th>Status</th></tr></thead>
        <tbody id="tbody-reservations"></tbody>
      </table></div>
      <div class="pagination" id="pag-reservations"></div>
    </div>`;
  loaders.reservations = () => {
    const status = encodeURIComponent(document.getElementById('res-status').value);
    loadTable('reservations', `/api/reservations?status=${status}&page=${tablePage}`, 4, r => `
      <tr><td>${esc(r.member)}</td><td>${esc(r.book)}</td><td>${fmtDate(r.reservation_date)}</td><td>${badge(r.status)}</td></tr>`);
  };
  document.getElementById('res-status').addEventListener('change', () => { tablePage = 1; loaders.reservations(); });
  loaders.reservations();
}

// ============================================================ SQL EXPLORER
async function renderSql() {
  content.innerHTML = `<div class="sql-layout">
    <div class="panel" style="padding:14px;"><div class="query-list" id="query-list"></div></div>
    <div id="sql-result"><div class="panel"><div class="empty-note">Pick a query on the left to run it live.</div></div></div>
  </div>`;
  const list = await api('/api/queries');
  document.getElementById('query-list').innerHTML = list.map(q => `
    <div class="query-item" data-id="${q.id}">
      <div class="query-item-num">Q${q.id}</div>
      <div class="query-item-title">${esc(q.title)}</div>
      <div class="query-item-concepts">${esc(q.concepts)}</div>
    </div>`).join('');
  document.querySelectorAll('.query-item').forEach(el => {
    el.addEventListener('click', () => runQuery(parseInt(el.dataset.id)));
  });
  runQuery(1);
}

async function runQuery(id) {
  document.querySelectorAll('.query-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.id) === id));
  const resultBox = document.getElementById('sql-result');
  resultBox.innerHTML = `<div class="panel"><div class="empty-note">Running query…</div></div>`;
  const data = await api('/api/queries/' + id);
  const rowsHtml = data.rows.length
    ? data.rows.map(r => `<tr>${data.columns.map(c => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')
    : `<tr class="loading-row"><td colspan="${data.columns.length}">No rows returned.</td></tr>`;
  resultBox.innerHTML = `
    <div class="panel">
      <div class="panel-title">Q${data.id}. ${esc(data.title)}</div>
      <div class="panel-sub">${esc(data.concepts)}</div>
      <pre class="sql-block">${esc(data.sql)}</pre>
      <div class="table-wrap"><table class="data-table">
        <thead><tr>${data.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
      <div class="pagination"><span>${data.rows.length} row(s) returned, live from PostgreSQL</span></div>
    </div>`;
}

// ============================================================ ERD / ARCHITECTURE
function renderErd() {
  content.innerHTML = `<div class="diagram-frame">
    <img src="/img/library_erd_full.png" alt="Entity Relationship Diagram">
  </div>`;
}
function renderArchitecture() {
  content.innerHTML = `<div class="diagram-frame">
    <img src="/img/big_data_architecture_full.png" alt="Big Data Architecture Diagram">
  </div>`;
}

// ============================================================ util
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const RENDERERS = {
  dashboard: renderDashboard, analytics: renderAnalytics, books: renderBooks, members: renderMembers,
  loans: renderLoans, fines: renderFines, reservations: renderReservations, sql: renderSql,
  erd: renderErd, architecture: renderArchitecture,
};
