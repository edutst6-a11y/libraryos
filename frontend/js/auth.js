// If already logged in, skip straight to the right dashboard.
(function redirectIfLoggedIn() {
  const account = getAccount();
  if (getToken() && account) {
    window.location.href = account.accountType === "staff" ? "/dashboard.html" : "/portal.html";
  }
})();

// ============================================================ tabs
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    document.getElementById("login-form").hidden = !isLogin;
    document.getElementById("register-form").hidden = isLogin;
  });
});

// ============================================================ populate branches
fetch(API_BASE + "/api/branches").then(r => r.json()).then(branches => {
  const sel = document.getElementById("reg-branch");
  sel.innerHTML = branches.map(b => `<option value="${b.branch_id}">${b.branch_name} &mdash; ${b.city}</option>`).join("");
}).catch(() => {});

// ============================================================ login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  errEl.hidden = true;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      }),
    });
    setToken(data.token);
    setAccount({ accountType: data.accountType, fullName: data.fullName, role: data.role });
    window.location.href = data.accountType === "staff" ? "/dashboard.html" : "/portal.html";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
  }
});

// ============================================================ register
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  errEl.hidden = true;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: document.getElementById("reg-name").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-password").value,
        membershipType: document.getElementById("reg-type").value,
        homeBranchId: parseInt(document.getElementById("reg-branch").value, 10),
      }),
    });
    setToken(data.token);
    setAccount({ accountType: "member", fullName: data.membership.full_name });
    window.location.href = "/portal.html?welcome=1";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
  }
});

// ============================================================ group modal
const groupModal = document.getElementById("group-modal");
document.getElementById("group-link").addEventListener("click", () => {
  groupModal.hidden = false;
  document.getElementById("group-locked").hidden = false;
  document.getElementById("group-unlocked").hidden = true;
  document.getElementById("group-password").value = "";
  document.getElementById("group-error").hidden = true;
});
document.getElementById("group-cancel").addEventListener("click", () => groupModal.hidden = true);
document.getElementById("group-close").addEventListener("click", () => groupModal.hidden = true);
groupModal.addEventListener("click", (e) => { if (e.target === groupModal) groupModal.hidden = true; });

let groupAdminToken = null;

function renderGroupTable(members) {
  document.getElementById("group-table").innerHTML = members.map(m => `
    <tr><td><strong>${m.full_name}</strong></td><td>${m.student_id}</td><td class="role">${m.role || ""}</td></tr>
  `).join("");
}

document.getElementById("group-submit").addEventListener("click", async () => {
  const errEl = document.getElementById("group-error");
  errEl.hidden = true;
  try {
    const res = await fetch(API_BASE + "/api/group/unlock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("group-password").value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Incorrect password.");
    groupAdminToken = data.token;
    renderGroupTable(data.members);
    document.getElementById("group-locked").hidden = true;
    document.getElementById("group-unlocked").hidden = false;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});
document.getElementById("group-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("group-submit").click();
});

document.getElementById("group-add-submit").addEventListener("click", async () => {
  const errEl = document.getElementById("group-add-error");
  errEl.hidden = true;
  const nameEl = document.getElementById("group-add-name");
  const sidEl = document.getElementById("group-add-sid");
  const roleEl = document.getElementById("group-add-role");
  try {
    const res = await fetch(API_BASE + "/api/group/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + groupAdminToken },
      body: JSON.stringify({ fullName: nameEl.value, studentId: sidEl.value, role: roleEl.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add member.");
    renderGroupTable(data.members);
    nameEl.value = ""; sidEl.value = ""; roleEl.value = "";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});
