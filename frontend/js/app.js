requireAuth();

const content = document.getElementById('content');
const viewTitle = document.getElementById('view-title');
const navLinks = document.querySelectorAll('.nav-link[data-view]');

const TITLES = {
  dashboard: 'Dashboard', analytics: 'Analytics', books: 'Books', members: 'Members',
  loans: 'Loans', fines: 'Fines', reservations: 'Reservations', overview: 'Assignment Overview',
  problem: 'Problem & Objectives', schema: 'Database Design', sql: 'Data Population & SQL Queries',
  erd: 'Entity Relationship Diagram', architecture: 'Big Data Architecture & Discussion',
  visualisations: 'Data Visualisations', findings: 'Findings & Recommendations',
  slides: 'Presentation Slides', report: 'Project Report',
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

// ============================================================ user info / logout / role switch
(function initUser() {
  const account = getAccount();
  document.getElementById('user-name').textContent = account ? `${account.fullName} (${account.role || 'Staff'})` : '—';
  document.getElementById('logout-btn').addEventListener('click', logout);

  const roleSelect = document.getElementById('role-switcher');
  if (account && account.role) roleSelect.value = account.role;
  roleSelect.addEventListener('change', async () => {
    const role = roleSelect.value;
    try {
      await api('/api/auth/role', { method: 'PATCH', body: JSON.stringify({ role }) });
      const updated = getAccount();
      updated.role = role;
      setAccount(updated);
      document.getElementById('user-name').textContent = `${updated.fullName} (${role})`;
    } catch (err) {
      roleSelect.value = account.role || 'Librarian';
      alert('Could not switch role: ' + err.message);
    }
  });
})();

// ============================================================ ROUTER
let activeTesseract = null;
async function navigate() {
  const view = (location.hash || '#dashboard').slice(1);
  viewTitle.textContent = TITLES[view] || 'Dashboard';
  navLinks.forEach(a => a.classList.toggle('active', a.dataset.view === view));
  Object.keys(charts).forEach(destroyChart);
  if (activeTesseract) { activeTesseract.stop(); activeTesseract = null; }
  content.classList.remove('view-enter');
  const renderer = RENDERERS[view] || RENDERERS.dashboard;
  await renderer();
  attachTilt();
  void content.offsetWidth; // restart the entrance animation on every navigation
  content.classList.add('view-enter');
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
let groupAdminToken = null;
function renderGroupTable(members) {
  document.getElementById('group-table').innerHTML = members.map(m => `
    <tr><td><strong>${esc(m.full_name)}</strong></td><td>${esc(m.student_id)}</td><td class="role">${esc(m.role || '')}</td></tr>
  `).join('');
}
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
    groupAdminToken = data.token;
    renderGroupTable(data.members);
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
document.getElementById('group-add-submit').addEventListener('click', async () => {
  const errEl = document.getElementById('group-add-error');
  errEl.hidden = true;
  const nameEl = document.getElementById('group-add-name');
  const sidEl = document.getElementById('group-add-sid');
  const roleEl = document.getElementById('group-add-role');
  try {
    const res = await fetch(API_BASE + '/api/group/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groupAdminToken },
      body: JSON.stringify({ fullName: nameEl.value, studentId: sidEl.value, role: roleEl.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add member.');
    renderGroupTable(data.members);
    nameEl.value = ''; sidEl.value = ''; roleEl.value = '';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
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

// ============================================================ BIG DATA PROJECT: shared shell
async function bdpByline() {
  try {
    const members = await fetch(API_BASE + '/api/group/members').then(r => r.json());
    if (!members.length) return '';
    return members.map(m => `<span class="bdp-chip">${esc(m.full_name)}${m.role ? ' &middot; ' + esc(m.role) : ''}</span>`).join('');
  } catch { return ''; }
}

async function bdpMount({ title, sub, badgeLabel, badgeText, bodyHtml, accent = true }) {
  const byline = await bdpByline();
  content.innerHTML = `
    <div class="bdp-shell">
      ${byline ? `<div class="bdp-byline"><span style="opacity:.7;">Prepared by</span>${byline}</div>` : ''}
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:18px; flex-wrap:wrap;">
        <div style="flex:1; min-width:260px;">
          ${badgeLabel ? `<div class="bdp-badge"><div class="bdp-badge-label">${esc(badgeLabel)}</div><div class="bdp-badge-text">${badgeText}</div></div>` : ''}
          <h2 class="bdp-title">${esc(title)}</h2>
          <p class="bdp-sub">${sub}</p>
        </div>
        ${accent ? `<div style="width:110px; height:110px; flex-shrink:0;"><canvas id="bdp-accent" class="bdp-accent-canvas"></canvas></div>` : ''}
      </div>
      ${bodyHtml}
      <div class="bdp-footer">Developed by T. Nenzou and company &middot; University of Lusaka &middot; Big Data Mid-Semester Project</div>
    </div>`;
  if (accent) {
    const { initTesseract } = await import('/js/tesseract.js');
    activeTesseract = initTesseract('bdp-accent', { fill: true });
  }
}

// ============================================================ ASSIGNMENT OVERVIEW
async function renderOverview() {
  const requirements = [
    ['1. Problem Identification', 'Organisation, problem, why a database is needed, data generated, decision-making', '#problem'],
    ['2. Database Design', '10 related tables, PKs, FKs, constraints, realistic data, ERD', '#schema'],
    ['3. Data Population', 'At least 100 records across major transactional tables (996 seeded)', '#sql'],
    ['4. SQL Queries and Analysis', 'At least 15 queries covering every SQL concept taught (20 delivered)', '#sql'],
    ['5. Big Data Architecture', 'Architecture for millions/billions of records, technology purposes explained', '#architecture'],
    ['6. Data Visualisation', 'At least 3 visualisations, each with an explanation', '#visualisations'],
    ['7. Big Data Discussion', 'Limitations, why Big Data is needed, storage, processing, decision-making', '#architecture'],
  ];
  const deliverables = [
    ['1. Project Report', 'Full 32-page written report, all 16 required sections', '#report'],
    ['2. SQL Database / SQL Script', 'Schema, seed data and query scripts, downloadable', '#schema'],
    ['3. Entity Relationship Diagram', 'Full 10-table ERD with cardinalities', '#erd'],
    ['4. Big Data Architecture Diagram', 'End-to-end pipeline diagram', '#architecture'],
    ['5. Data Visualisations', 'Four charts built from our own query results', '#visualisations'],
    ['6. Presentation Slides', 'In-app slide deck covering the whole project', '#slides'],
    ['7. Practical Demonstration', 'This entire live, deployed system is the demonstration', '#dashboard'],
  ];
  const item = ([t, s, href]) => `
    <li onclick="location.hash='${href}'"><span class="bdp-check">&#10003;</span>
      <div><div class="bdp-item-title">${t}</div><div class="bdp-item-sub">${s}</div></div>
    </li>`;
  await bdpMount({
    title: 'Assignment Overview',
    sub: 'Every requirement and deliverable from the Big Data &mdash; Mid-Semester Project brief, and exactly where each one is answered in this system. Click any item to jump straight there.',
    badgeLabel: 'Application Area',
    badgeText: 'Application Area 10 &mdash; Library Management and Usage Analytics',
    bodyHtml: `
      <div class="bdp-panel"><h3>Project Requirements (Sections 1&ndash;7 of the brief)</h3>
        <ul class="bdp-checklist">${requirements.map(item).join('')}</ul></div>
      <div class="bdp-panel"><h3>Project Deliverables</h3>
        <ul class="bdp-checklist">${deliverables.map(item).join('')}</ul></div>`,
  });
}

// ============================================================ PROBLEM & OBJECTIVES
async function renderProblem() {
  await bdpMount({
    title: 'Problem Identification',
    sub: 'Requirement 1 of the assignment brief, in full.',
    badgeLabel: 'Answers assignment requirement',
    badgeText: '1. Problem Identification &mdash; Report &sect;1 Introduction, &sect;2 Problem Statement, &sect;3 Objectives, &sect;4 Organisation Description',
    bodyHtml: `
      <div class="bdp-panel"><h3>The organisation</h3>
        <p>We modelled a four-branch public library network &mdash; Central Library, Northmead Branch, Kitwe Branch, and Ndola Branch &mdash; each with its own staff and its own local share of the book catalogue, but all sharing one member base.</p></div>
      <div class="bdp-panel"><h3>The problem being addressed</h3>
        <p>A library generates far more data than it gets credit for: every checkout, every return, every reservation, every fine, across every branch. Run on paper or a spreadsheet, none of that data is actually usable &mdash; nobody can quickly answer "which books are most popular," "which branch is busiest," or "who still owes us money."</p></div>
      <div class="bdp-panel"><h3>Why the organisation requires a database system</h3>
        <p>It needs a proper database to run day-to-day circulation on, and a way to turn the data that database accumulates into answers the library can actually act on &mdash; which titles to buy more copies of, which branches need more staff, and how much revenue is sitting uncollected in unpaid fines.</p></div>
      <div class="bdp-panel"><h3>What type of data the organisation generates</h3>
        <p>Two categories: relatively stable <span class="mono">reference data</span> (authors, publishers, genres, branches, staff, the book catalogue) that changes slowly, and fast-growing <span class="mono">transactional data</span> (loans, fines, reservations) that accumulates every single day the library operates &mdash; the category that eventually forces the Big Data conversation.</p></div>
      <div class="bdp-panel"><h3>Project objectives</h3><ul>
        <li>Design a normalised relational database that reflects how a real library actually operates.</li>
        <li>Populate it with a realistic volume of data with believable patterns, not uniform noise.</li>
        <li>Write SQL queries that answer real operational and management questions, covering every SQL concept taught.</li>
        <li>Design an Entity Relationship Diagram that documents the schema clearly.</li>
        <li>Propose a Big Data architecture for when the library's data grows from thousands to millions or billions of records.</li>
        <li>Turn our own query results into visualisations that communicate something real.</li>
        <li>Pull it all together into findings and recommendations grounded in the data we generated.</li>
      </ul></div>`,
  });
}

// ============================================================ DATABASE SCHEMA
async function renderSchema() {
  await bdpMount({
    title: 'Database Design',
    sub: 'The full CREATE SCHEMA / CREATE TABLE / index SQL, live and reviewable.',
    badgeLabel: 'Answers assignment requirement',
    badgeText: '2. Database Design &mdash; 10 related tables (well past the minimum of 6), PKs, FKs, constraints, realistic data &mdash; Report &sect;5 Database Design, &sect;7 SQL Table Creation',
    bodyHtml: `
      <div class="bdp-panel"><h3>10 tables, split reference / transactional</h3>
        <p>Every table has a proper primary key, every relationship is enforced with a foreign key, and CHECK constraints cover every fixed-value column plus logical rules like <span class="mono">available_copies &lt;= total_copies</span> and <span class="mono">due_date &gt;= loan_date</span>. Every foreign key and the date columns on <span class="mono">loans</span> are indexed.</p></div>
      <div class="doc-header" style="margin-top:4px;">
        <div class="doc-sub" style="color:#a9bcd4;">Full schema, straight from <span class="mono" style="color:#f4e7c9;">sql/01_schema.sql</span></div>
        <a class="download-btn" href="/downloads/01_schema.sql" download>&#11015; Download schema.sql</a>
      </div>
      <div class="bdp-panel" style="padding:12px;"><pre class="sql-block" id="schema-block" style="margin:0;">Loading&hellip;</pre></div>`,
  });
  const res = await fetch('/downloads/01_schema.sql');
  document.getElementById('schema-block').textContent = await res.text();
}

// ============================================================ SQL QUERIES & DATA POPULATION
async function renderSql() {
  await bdpMount({
    title: 'Data Population &amp; SQL Queries',
    sub: 'Requirements 3 and 4 of the brief, live against PostgreSQL &mdash; not screenshots.',
    badgeLabel: 'Answers assignment requirements',
    badgeText: '3. Data Population (100+ records required &mdash; 996 seeded) &amp; 4. SQL Queries and Analysis (15+ required &mdash; 20 delivered, covering SELECT, WHERE, ORDER BY, aggregates, GROUP BY, HAVING, JOIN, and subqueries) &mdash; Report &sect;8, &sect;9, &sect;10',
    accent: false,
    bodyHtml: `
      <div class="bdp-panel">
        <h3>Data population &mdash; 996 rows across 10 tables</h3>
        <div class="table-wrap"><table class="data-table" style="color:#d5e0ee;">
          <thead><tr><th>Table</th><th>Rows</th><th>Table</th><th>Rows</th></tr></thead>
          <tbody>
            <tr><td>branches</td><td>4</td><td>members</td><td>130</td></tr>
            <tr><td>staff</td><td>14</td><td><b>loans</b></td><td><b>460</b></td></tr>
            <tr><td>authors</td><td>41</td><td>fines</td><td>98</td></tr>
            <tr><td>publishers</td><td>15</td><td>reservations</td><td>70</td></tr>
            <tr><td>genres</td><td>14</td><td><b>Total</b></td><td><b>996</b></td></tr>
            <tr><td>books</td><td>150</td><td></td><td></td></tr>
          </tbody>
        </table></div>
        <p style="margin-top:10px;">Generated deterministically (fixed random seed) by <span class="mono">scripts/generate_seed_data.py</span>, which writes plain SQL <span class="mono">INSERT</span> statements &mdash; the seed data is still fully reviewable SQL, not a hidden script.</p>
      </div>
      <div class="doc-header" style="margin-top:4px;">
        <div class="doc-sub" style="color:#a9bcd4;">All 20 queries, run live &mdash; pick one on the left</div>
        <a class="download-btn" href="/downloads/03_queries.sql" download>&#11015; Download queries.sql</a>
      </div>
      <div class="sql-layout">
        <div class="panel" style="padding:14px;"><div class="query-list" id="query-list"></div></div>
        <div id="sql-result"><div class="panel"><div class="empty-note">Pick a query on the left to run it live.</div></div></div>
      </div>`,
  });
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

// ============================================================ ER DIAGRAM
async function renderErd() {
  await bdpMount({
    title: 'Entity Relationship Diagram',
    sub: '10-table schema — branches, staff, authors, publishers, genres, books, members, loans, fines, reservations — with every primary key, foreign key, and cardinality.',
    badgeLabel: 'Answers assignment requirement',
    badgeText: '2. Database Design (ERD) &amp; Deliverable 3: Entity Relationship Diagram &mdash; Report &sect;6',
    accent: false,
    bodyHtml: `
      <div class="doc-header">
        <div class="doc-sub" style="color:#a9bcd4;"></div>
        <a class="download-btn" href="/img/library_erd_full.png" download="library_erd.png">&#11015; Download PNG</a>
      </div>
      <div class="diagram-frame">
        <img src="/img/library_erd_full.png" alt="Entity Relationship Diagram">
      </div>`,
  });
}

// ============================================================ BIG DATA ARCHITECTURE
async function renderArchitecture() {
  const tech = [
    ['Kafka', 'Captures every loan, return, reservation and fine event in real time, the moment it happens at any branch, rather than waiting for a nightly batch job to notice it.'],
    ['Batch extraction', 'A scheduled, Sqoop-style pull that copies the full operational database (or just what changed) out of PostgreSQL on a regular schedule, so the Big Data side always has a current copy.'],
    ['Data Lake (Hadoop/HDFS)', 'Cheap, distributed storage that keeps every raw event and export exactly as it arrived, forever if needed &mdash; spreading storage and read/write load across many machines instead of one server.'],
    ['Data Warehouse (Hive)', 'A curated, cleaned-up copy of the raw data, organised into fact/dimension tables analysts actually want to query, with a SQL-like interface over data stored across the Hadoop cluster.'],
    ['Spark (batch)', 'Does the heavy lifting of cleaning, joining and aggregating raw data from the lake into the warehouse, distributed across many machines so it stays fast as volume grows.'],
    ['Spark Streaming', 'Processes the Kafka event stream continuously, so figures like "how many books are checked out right now" stay live rather than being a day old.'],
  ];
  const discussion = [
    ['What happens when the database grows to millions or billions of records?', 'Queries that are instant today get progressively slower as tables grow into the millions, because a single PostgreSQL instance has to scan, join and sort all of it on one machine. Indexes help but don\'t remove the ceiling &mdash; eventually working data no longer fits in memory and every query starts hitting disk. Backups go from a five-minute job to one that can take hours.'],
    ['What limitations might the traditional SQL database face?', 'Vertical scaling limits (a single server can only be made so big), write contention across branches, analytical queries competing with operational ones, and a rigid schema that assumes the data shape is known upfront.'],
    ['Why would Big Data technologies be required?', 'Because the problem stops being "how do we query this" and becomes "how do we even store and move this." Hadoop and Spark spread both storage and computation across many machines &mdash; adding another node is far more realistic than continuing to buy bigger single servers.'],
    ['How could the organisation store large volumes of data?', 'By moving raw historical data into an HDFS data lake, which spreads storage across many machines and tolerates individual disk failures without losing data, while PostgreSQL stays in place for day-to-day circulation.'],
    ['How could the data be processed efficiently?', 'By splitting processing into two lanes, both on Spark: batch processing for large historical aggregations that don\'t need to be instant, and stream processing (Spark Streaming on Kafka) for anything that needs to be current right now.'],
    ['How could the resulting information support decision-making?', 'The same way our own four charts already do at small scale &mdash; just running continuously and at the network\'s full size. Management gets always-current dashboards instead of a manual report someone has to remember to run.'],
  ];
  await bdpMount({
    title: 'Big Data Architecture &amp; Discussion',
    sub: 'How this system would need to evolve once the library\'s data grows from thousands of records to millions or billions.',
    badgeLabel: 'Answers assignment requirements',
    badgeText: '5. Big Data Architecture &amp; 7. Big Data Discussion &mdash; Report &sect;11 Big Data Architecture, &sect;12 Big Data Scalability',
    accent: false,
    bodyHtml: `
      <div class="doc-header">
        <div class="doc-sub" style="color:#a9bcd4;">The existing SQL database becomes one input into a larger pipeline rather than being replaced outright.</div>
        <a class="download-btn" href="/img/big_data_architecture_full.png" download="big_data_architecture.png">&#11015; Download PNG</a>
      </div>
      <div class="diagram-frame">
        <img src="/img/big_data_architecture_full.png" alt="Big Data Architecture Diagram">
      </div>
      <div class="bdp-panel" style="margin-top:16px;"><h3>Purpose of each technology</h3>
        ${tech.map(([n, d]) => `<p style="margin-bottom:10px;"><b style="color:#f4e7c9;">${n}</b> &mdash; ${d}</p>`).join('')}
      </div>
      <div class="bdp-panel"><h3>Big Data discussion</h3>
        ${discussion.map(([q, a]) => `<div style="margin-bottom:14px;"><b style="color:#f4e7c9;">${q}</b><p style="margin-top:4px;">${a}</p></div>`).join('')}
      </div>`,
  });
}

// ============================================================ DATA VISUALISATIONS
async function renderVisualisations() {
  await bdpMount({
    title: 'Data Visualisations',
    sub: 'All four charts below are built directly from our own live query results using Chart.js, not typed-in numbers.',
    badgeLabel: 'Answers assignment requirement',
    badgeText: '6. Data Visualisation &mdash; at least 3 required, 4 delivered, each with an explanation &mdash; Report &sect;13',
    accent: false,
    bodyHtml: `
      <div class="bdp-panel"><h3>1. Top 10 Most Borrowed Books (from Q9)</h3>
        <div class="chart-box tall"><canvas id="v-top-books"></canvas></div>
        <p style="margin-top:10px;">Makes the popularity skew visible &mdash; there's a real drop-off between the most-borrowed title and the rest of the pack. If the library only had budget to reorder a handful of extra copies, this chart alone tells you where to start.</p></div>
      <div class="bdp-panel"><h3>2. Catalogue Composition by Genre (from Q5)</h3>
        <div class="chart-box tall"><canvas id="v-genre"></canvas></div>
        <p style="margin-top:10px;">Fantasy and Children's together make up over a quarter of the catalogue, while Self-Help and Education barely register &mdash; useful because it shows the catalogue's shape doesn't match circulation's shape.</p></div>
      <div class="bdp-panel"><h3>3. Monthly Borrowing Trend (from Q15)</h3>
        <div class="chart-box"><canvas id="v-trend"></canvas></div>
        <p style="margin-top:10px;">Borrowing holds a fairly steady rhythm across most of the period, with a visible pickup in the most recent months &mdash; partly a real trend, partly a reflection of our own data generation deliberately boosting recent activity.</p></div>
      <div class="bdp-panel"><h3>4. Branch Activity: Loans vs. Fines Collected (from Q3 and Q14)</h3>
        <div class="chart-box"><canvas id="v-branch"></canvas></div>
        <p style="margin-top:10px;">The bars (loan volume) and the line (fines collected) don't move together across branches &mdash; a gap a results table alone doesn't make nearly as obvious.</p></div>`,
  });

  const gridColor = 'rgba(255,255,255,0.08)';
  const tickColor = '#a9bcd4';

  const tb = await api('/api/charts/top-books');
  charts['v-top-books'] = new Chart(document.getElementById('v-top-books'), {
    type: 'bar',
    data: { labels: tb.labels, datasets: [{ data: tb.values, backgroundColor: '#e8c88a', borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } },
      scales: { x: { ticks: { precision: 0, color: tickColor }, grid: { color: gridColor } }, y: { ticks: { color: tickColor }, grid: { color: gridColor } } } }
  });

  const g = await api('/api/charts/genre-composition');
  const palette = ['#e8c88a','#c9973d','#a67725','#7fc8f0','#3b6ea5','#2c5c8a','#1c4166','#d99a1f','#f4e7c9','#5a89ba','#79a3cc','#9bbedb','#bcd8ea','#8592a6'];
  charts['v-genre'] = new Chart(document.getElementById('v-genre'), {
    type: 'pie',
    data: { labels: g.labels, datasets: [{ data: g.values, backgroundColor: palette, borderColor: '#0f2942', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 10.5 }, color: tickColor } } } }
  });

  const t = await api('/api/charts/monthly-trend');
  charts['v-trend'] = new Chart(document.getElementById('v-trend'), {
    type: 'line',
    data: { labels: t.labels, datasets: [{ data: t.values, borderColor: '#e8c88a', backgroundColor: 'rgba(232,200,138,0.15)', fill: true, tension: 0.35, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: tickColor }, grid: { color: gridColor } }, y: { ticks: { color: tickColor }, grid: { color: gridColor } } } }
  });

  const b = await api('/api/charts/branch-activity');
  charts['v-branch'] = new Chart(document.getElementById('v-branch'), {
    data: { labels: b.labels, datasets: [
      { type: 'bar', label: 'Total loans', data: b.loans, backgroundColor: '#3b6ea5', borderRadius: 6, yAxisID: 'y' },
      { type: 'line', label: 'Fines collected (K)', data: b.fines, borderColor: '#e8c88a', backgroundColor: '#e8c88a', tension: 0.3, yAxisID: 'y1' },
    ]},
    options: { plugins: { legend: { labels: { color: tickColor } } }, scales: {
      y: { position: 'left', title: { display: true, text: 'Loans', color: tickColor }, ticks: { color: tickColor }, grid: { color: gridColor } },
      y1: { position: 'right', title: { display: true, text: 'Fines (K)', color: tickColor }, ticks: { color: tickColor }, grid: { drawOnChartArea: false } },
      x: { ticks: { color: tickColor }, grid: { color: gridColor } },
    }}
  });
}

// ============================================================ FINDINGS, RECOMMENDATIONS & CONCLUSION
async function renderFindings() {
  const findings = [
    ['Borrowing is concentrated, not evenly spread.', 'A small number of titles account for a disproportionate share of loans (Q9).'],
    ['Fine collection is genuinely weak.', 'Only 28.9% of issued fine value has actually been collected (Q17) &mdash; K1,290 sitting uncollected against K524 actually recovered.'],
    ['Branch behaviour differs in ways that don\'t track loan volume alone.', 'Kitwe processes the second-most loans but collects the least in fines of any branch (Q3, Q14).'],
    ['A small number of members are already testing the limits of a fair-use policy.', '8 members currently hold 2+ books simultaneously, one holding 4 (Q18).'],
    ['The catalogue\'s shape and circulation\'s shape don\'t match.', 'The busiest single title comes from a genre that makes up less than a tenth of the catalogue (Q20 vs. Q5).'],
    ['A handful of members and books show zero engagement.', 'Two members have never borrowed anything since joining; a number of older titles have never been borrowed at all (Q11, Q12).'],
  ];
  const recs = [
    'Actively chase unpaid fines, or reconsider the fine policy entirely &mdash; a 28.9% collection rate deserves a deliberate decision, not silence.',
    'Buy more copies of the small set of consistently high-demand titles identified in Q9/Q20, rather than spreading acquisitions evenly.',
    'Look specifically at why Kitwe\'s fine collection lags its loan volume &mdash; better member behaviour worth learning from, or a process gap worth fixing.',
    'Decide on, and actually enforce, a maximum concurrent-loan limit &mdash; Q18 already identifies who is over any reasonable threshold.',
    'Follow up with members who registered but never borrowed anything.',
    'Start the move toward the Big Data architecture before it becomes urgent &mdash; begin exporting operational data into a data lake early.',
  ];
  await bdpMount({
    title: 'Findings, Recommendations &amp; Conclusion',
    sub: 'What we actually found in our own data, and what we\'d recommend doing about it.',
    badgeLabel: 'Report sections',
    badgeText: '&sect;14 Findings, &sect;15 Recommendations, &sect;16 Conclusion',
    accent: false,
    bodyHtml: `
      <div class="bdp-panel"><h3>Findings</h3><ol>${findings.map(([t, d]) => `<li style="margin-bottom:8px;"><b style="color:#f4e7c9;">${t}</b> ${d}</li>`).join('')}</ol></div>
      <div class="bdp-panel"><h3>Recommendations</h3><ol>${recs.map(r => `<li style="margin-bottom:8px;">${r}</li>`).join('')}</ol></div>
      <div class="bdp-panel"><h3>Conclusion</h3>
        <p>We set out to build a SQL-based analytics system for a library, and ended up with something that actually behaves like one: a proper normalised schema, realistic data with real patterns in it, 20 working queries that answer real questions rather than textbook ones, a documented path to Big Data if the library ever needs it, and visualisations and findings that came directly out of our own results rather than being written first and matched to numbers after.</p></div>`,
  });
}

// ============================================================ PRESENTATION SLIDES
async function renderSlides() {
  const slides = [
    { n: 1, h: 'Library Management &amp; Usage Analytics', body: `<p style="font-size:16px;">A SQL-Based Big Data Analytics System<br>Big Data &mdash; Mid-Semester Project<br>University of Lusaka</p>` },
    { n: 2, h: 'The Problem', body: `<p>A four-branch library network generates transactional data every day &mdash; loans, returns, fines, reservations &mdash; but run on paper or a spreadsheet, none of it is usable for real decisions.</p>` },
    { n: 3, h: 'Objectives', body: `<ul><li>Normalised relational database reflecting real library operations</li><li>Realistic, patterned data &mdash; not uniform noise</li><li>20 SQL queries covering every concept taught</li><li>An ERD and a Big Data architecture for future scale</li><li>Visualisations and findings grounded in our own data</li></ul>` },
    { n: 4, h: 'Database Design', body: `<p>10 related tables &mdash; branches, staff, authors, publishers, genres, books, members, loans, fines, reservations &mdash; every relationship enforced with foreign keys, CHECK constraints on every fixed-value column, indexes on every foreign key.</p>` },
    { n: 5, h: 'Entity Relationship Diagram', body: `<p>See the ER Diagram page for the full 10-table diagram with cardinalities.</p>` },
    { n: 6, h: 'Data &amp; Queries', body: `<p>996 seeded rows across 10 tables (460 loans alone). 20 SQL queries covering SELECT, WHERE, ORDER BY, aggregate functions, GROUP BY, HAVING, JOIN, and subqueries &mdash; all answering real operational questions.</p>` },
    { n: 7, h: 'Big Data Architecture', body: `<p>Kafka for real-time events, batch extraction into an HDFS data lake, Spark for both batch and streaming processing, and a Hive data warehouse for curated analytics &mdash; a path from thousands of records today to billions tomorrow.</p>` },
    { n: 8, h: 'Data Visualisations', body: `<p>Four charts built directly from our own query results: top borrowed books, catalogue composition by genre, monthly borrowing trend, and branch activity (loans vs. fines).</p>` },
    { n: 9, h: 'Key Findings', body: `<ul><li>Borrowing is concentrated on a few titles</li><li>Only 28.9% of issued fines get collected</li><li>Kitwe: high loans, low fine collection</li><li>Catalogue shape doesn't match circulation shape</li></ul>` },
    { n: 10, h: 'Thank You', body: `<p style="font-size:16px;">Developed by T. Nenzou and company<br>University of Lusaka &mdash; Big Data Mid-Semester Project</p>` },
  ];
  await bdpMount({
    title: 'Presentation Slides',
    sub: 'An in-app slide deck covering the whole project, start to finish.',
    badgeLabel: 'Answers assignment deliverable',
    badgeText: '6. Presentation Slides',
    accent: false,
    bodyHtml: slides.map(s => `
      <div class="bdp-slide"><div class="bdp-slide-num">Slide ${s.n} / ${slides.length}</div>
        <h2>${s.h}</h2>${s.body}
      </div>`).join(''),
  });
}

// ============================================================ PROJECT REPORT
async function renderReport() {
  await bdpMount({
    title: 'Project Report',
    sub: 'The full written project report — problem statement, methodology, architecture, findings, and reflections. All 16 required sections, in order.',
    badgeLabel: 'Answers assignment deliverable',
    badgeText: '1. Project Report',
    accent: false,
    bodyHtml: `
      <div class="doc-header">
        <div class="doc-sub" style="color:#a9bcd4;"></div>
        <a class="download-btn" href="/downloads/Library_Analytics_Project_Report.pdf" download>&#11015; Download PDF</a>
      </div>
      <div class="bdp-panel" style="padding:12px;">
        <iframe class="pdf-frame" src="/downloads/Library_Analytics_Project_Report.pdf" title="Project Report" style="border:none; border-radius:8px;"></iframe>
      </div>`,
  });
}

// ============================================================ util
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const RENDERERS = {
  dashboard: renderDashboard, analytics: renderAnalytics, books: renderBooks, members: renderMembers,
  loans: renderLoans, fines: renderFines, reservations: renderReservations, overview: renderOverview,
  problem: renderProblem, schema: renderSchema, sql: renderSql, erd: renderErd,
  architecture: renderArchitecture, visualisations: renderVisualisations, findings: renderFindings,
  slides: renderSlides, report: renderReport,
};
