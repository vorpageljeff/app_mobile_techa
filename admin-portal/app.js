const API_BASE = "/api/v1";
const ADMIN_ALIAS_EMAIL = "admin@techa.com.py";
const TOKEN_KEY = "techa_admin_token";

const state = {
  token: sessionStorage.getItem(TOKEN_KEY),
  admin: null,
  stats: null,
  users: [],
  auditLogs: [],
  currentView: "dashboard",
};

const elements = {
  loginView: document.querySelector("#login-view"),
  appView: document.querySelector("#app-view"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  loginSubmit: document.querySelector("#login-submit"),
  loginError: document.querySelector("#login-error"),
  logoutButton: document.querySelector("#logout-button"),
  refreshButton: document.querySelector("#refresh-button"),
  apiStatus: document.querySelector("#api-status"),
  pageTitle: document.querySelector("#page-title"),
  userSearch: document.querySelector("#user-search"),
  usersTableBody: document.querySelector("#users-table-body"),
  usersEmpty: document.querySelector("#users-empty"),
  auditList: document.querySelector("#audit-list"),
  auditEmpty: document.querySelector("#audit-empty"),
  auditFilter: document.querySelector("#audit-filter"),
  passwordForm: document.querySelector("#password-form"),
  passwordError: document.querySelector("#password-error"),
  forcePasswordDialog: document.querySelector("#force-password-dialog"),
  forcePasswordForm: document.querySelector("#force-password-form"),
  forcePasswordError: document.querySelector("#force-password-error"),
  temporaryPasswordDialog: document.querySelector(
    "#temporary-password-dialog",
  ),
  temporaryPasswordUser: document.querySelector("#temporary-password-user"),
  temporaryPasswordValue: document.querySelector(
    "#temporary-password-value",
  ),
  copyTemporaryPassword: document.querySelector(
    "#copy-temporary-password",
  ),
  closeTemporaryPassword: document.querySelector(
    "#close-temporary-password",
  ),
  toastRegion: document.querySelector("#toast-region"),
};

const viewTitles = {
  dashboard: "Visão geral",
  users: "Usuários e planos",
  audit: "Auditoria",
  account: "Minha conta",
};

const actionLabels = {
  "admin.login": "Login administrativo",
  "admin.password_changed": "Senha administrativa alterada",
  "admin.bootstrap_created": "Administrador inicial criado",
  "user.plan_changed": "Plano de usuário alterado",
  "user.access_changed": "Acesso de usuário alterado",
  "user.password_reset": "Senha temporária gerada",
};

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && path !== "/auth/login") {
    logout("Sua sessão expirou. Entre novamente.");
    throw new Error("Sessão expirada.");
  }

  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeAdminLogin(value) {
  const normalized = value.trim().toLowerCase();
  return normalized === "admin" ? ADMIN_ALIAS_EMAIL : normalized;
}

function setButtonLoading(button, loading, loadingText = "Aguarde…") {
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent.trim();
  }
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.originalText;
}

function setApiStatus(status, label) {
  elements.apiStatus.className = `status-pill status-${status}`;
  elements.apiStatus.textContent = label;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast-error" : ""}`;
  toast.textContent = message;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, fallback = "Nunca") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function showLogin(message = "") {
  elements.loginView.hidden = false;
  elements.appView.hidden = true;
  elements.loginError.textContent = message;
  elements.loginPassword.value = "";
}

function showApp() {
  elements.loginView.hidden = true;
  elements.appView.hidden = false;
  document.querySelector("#sidebar-admin-name").textContent = state.admin.name;
  document.querySelector("#sidebar-admin-email").textContent = state.admin.email;
  document.querySelector("#account-name").textContent = state.admin.name;
  document.querySelector("#account-email").textContent = state.admin.email;
  document.querySelector("#account-last-login").textContent = formatDate(
    state.admin.last_login_at,
  );
}

function logout(message = "") {
  state.token = null;
  state.admin = null;
  state.stats = null;
  state.users = [];
  state.auditLogs = [];
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin(message);
}

async function authenticate() {
  if (!state.token) {
    showLogin();
    return;
  }

  try {
    const user = await api("/auth/me");
    if (user.plan !== "admin") {
      logout("Esta conta não possui acesso administrativo.");
      return;
    }
    state.admin = user;
    showApp();
    await refreshCurrentView();
    if (user.must_change_password) {
      elements.forcePasswordDialog.showModal();
    }
  } catch (error) {
    logout(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginError.textContent = "";
  setButtonLoading(elements.loginSubmit, true, "Autenticando…");

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: normalizeAdminLogin(elements.loginEmail.value),
        password: elements.loginPassword.value,
      }),
    });
    state.token = result.access_token;
    sessionStorage.setItem(TOKEN_KEY, state.token);

    const user = await api("/auth/me");
    if (user.plan !== "admin") {
      throw new Error("Esta conta não possui acesso administrativo.");
    }

    state.admin = user;
    showApp();
    await refreshCurrentView();
    if (user.must_change_password) {
      document.querySelector("#force-current-password").value =
        elements.loginPassword.value;
      elements.forcePasswordDialog.showModal();
    }
  } catch (error) {
    logout(error.message);
  } finally {
    setButtonLoading(elements.loginSubmit, false);
  }
}

async function loadDashboard() {
  setApiStatus("loading", "Atualizando");
  try {
    const [stats, users] = await Promise.all([
      api("/admin/stats"),
      api("/admin/users"),
    ]);
    state.stats = stats;
    state.users = users;

    try {
      state.auditLogs = await api("/admin/audit-logs?limit=100");
    } catch (error) {
      state.auditLogs = [];
      if (!error.message.includes("404")) {
        showToast(error.message, "error");
      }
    }

    renderStats();
    renderUsers();
    renderAudit();
    setApiStatus("online", "API conectada");
  } catch (error) {
    setApiStatus("offline", "Falha na API");
    showToast(error.message, "error");
    throw error;
  }
}

function renderStats() {
  if (!state.stats) return;
  const { stats } = state;
  document.querySelector("#stat-users").textContent = stats.users_total;
  document.querySelector("#stat-farms").textContent = stats.farms_total;
  document.querySelector("#stat-fields").textContent = stats.fields_total;
  document.querySelector("#stat-analyses").textContent = stats.analyses_total;
  document.querySelector("#stat-anomalies").textContent = stats.active_anomalies;
  document.querySelector("#stat-users-detail").textContent =
    `${stats.users_by_plan.admin || 0} admin · ${stats.users_by_plan.pro || 0} pro`;
  document.querySelector("#stat-anomalies-detail").textContent =
    `${stats.anomalies_total} anomalias no histórico`;

  const plans = [
    ["free", "Free"],
    ["pro", "Pro"],
    ["admin", "Admin"],
  ];
  const max = Math.max(
    1,
    ...plans.map(([key]) => stats.users_by_plan[key] || 0),
  );
  document.querySelector("#plan-distribution").innerHTML = plans
    .map(([key, label]) => {
      const count = stats.users_by_plan[key] || 0;
      const width = Math.max(count ? 8 : 0, (count / max) * 100);
      return `
        <div class="plan-row">
          <span>${label}</span>
          <div class="plan-bar"><span style="width:${width}%"></span></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");

  const recent = state.auditLogs.slice(0, 5);
  document.querySelector("#recent-audit").innerHTML =
    recent.length > 0
      ? recent.map(renderActivityItem).join("")
      : '<p class="empty-state">Nenhuma atividade administrativa registrada.</p>';
}

function renderActivityItem(log) {
  return `
    <div class="activity-item">
      <span class="activity-dot" aria-hidden="true"></span>
      <div class="activity-copy">
        <strong>${escapeHtml(actionLabels[log.action] || log.action)}</strong>
        <span>${escapeHtml(log.actor_email)}</span>
      </div>
      <time>${escapeHtml(formatDate(log.created_at))}</time>
    </div>
  `;
}

function renderUsers() {
  const query = elements.userSearch.value.trim().toLowerCase();
  const users = state.users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(query),
  );

  elements.usersEmpty.hidden = users.length > 0;
  elements.usersTableBody.innerHTML = users
    .map((user) => {
      const isSelf = user.id === state.admin.id;
      return `
        <tr>
          <td>
            <div class="user-cell">
              <strong>${escapeHtml(user.name)}</strong>
              <span>
                ${escapeHtml(user.email)}${isSelf ? " · você" : ""}
                ${user.must_change_password ? " · troca de senha pendente" : ""}
              </span>
            </div>
          </td>
          <td>
            <select
              class="plan-select"
              data-plan-user="${escapeHtml(user.id)}"
              data-current-plan="${escapeHtml(user.plan)}"
              ${isSelf ? "disabled" : ""}
              aria-label="Plano de ${escapeHtml(user.name)}"
            >
              ${["free", "pro", "admin"]
                .map(
                  (plan) =>
                    `<option value="${plan}" ${user.plan === plan ? "selected" : ""}>${plan.toUpperCase()}</option>`,
                )
                .join("")}
            </select>
          </td>
          <td>
            <span class="badge ${user.is_active ? "badge-active" : "badge-blocked"}">
              ${user.is_active ? "Ativo" : "Bloqueado"}
            </span>
          </td>
          <td>
            <div class="structure-cell">
              <strong>${user.farms_count} fazenda(s)</strong><br />
              <span>${user.fields_count} talhão(ões)</span>
            </div>
          </td>
          <td>${escapeHtml(formatDate(user.last_login_at))}</td>
          <td>
            <div class="actions">
              <button
                class="icon-button"
                data-reset-password-user="${escapeHtml(user.id)}"
                data-user-name="${escapeHtml(user.name)}"
                data-user-email="${escapeHtml(user.email)}"
                ${isSelf ? "disabled" : ""}
                type="button"
              >
                Nova senha
              </button>
              <button
                class="icon-button ${user.is_active ? "icon-button-danger" : ""}"
                data-toggle-user="${escapeHtml(user.id)}"
                data-user-name="${escapeHtml(user.name)}"
                data-is-active="${user.is_active}"
                ${isSelf ? "disabled" : ""}
                type="button"
              >
                ${user.is_active ? "Bloquear" : "Ativar"}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAudit() {
  const action = elements.auditFilter.value;
  const logs = action
    ? state.auditLogs.filter((log) => log.action === action)
    : state.auditLogs;

  elements.auditEmpty.hidden = logs.length > 0;
  elements.auditList.innerHTML = logs
    .map((log) => {
      const details = Object.entries(log.details || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ");
      return `
        <div class="audit-item">
          <span class="activity-dot" aria-hidden="true"></span>
          <div class="audit-copy">
            <strong>${escapeHtml(actionLabels[log.action] || log.action)}</strong>
            <span>
              ${escapeHtml(log.actor_email)}
              ${details ? ` · ${escapeHtml(details)}` : ""}
              ${log.ip_address ? ` · IP ${escapeHtml(log.ip_address)}` : ""}
            </span>
          </div>
          <time>${escapeHtml(formatDate(log.created_at))}</time>
        </div>
      `;
    })
    .join("");
}

async function changeUserPlan(select) {
  const userId = select.dataset.planUser;
  const previousPlan = select.dataset.currentPlan;
  const nextPlan = select.value;
  if (nextPlan === previousPlan) return;

  select.disabled = true;
  try {
    const updated = await api(`/admin/users/${userId}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan: nextPlan }),
    });
    state.users = state.users.map((user) =>
      user.id === updated.id ? updated : user,
    );
    showToast(`Plano alterado para ${nextPlan.toUpperCase()}.`);
    await loadDashboard();
  } catch (error) {
    select.value = previousPlan;
    showToast(error.message, "error");
  } finally {
    select.disabled = false;
  }
}

async function toggleUserAccess(button) {
  const userId = button.dataset.toggleUser;
  const name = button.dataset.userName;
  const isActive = button.dataset.isActive === "true";
  const verb = isActive ? "bloquear" : "ativar";
  if (!window.confirm(`Deseja ${verb} o acesso de ${name}?`)) return;

  button.disabled = true;
  try {
    await api(`/admin/users/${userId}/active`, { method: "PATCH" });
    showToast(`Acesso de ${name} atualizado.`);
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function resetUserPassword(button) {
  const userId = button.dataset.resetPasswordUser;
  const name = button.dataset.userName;
  const email = button.dataset.userEmail;
  const confirmed = window.confirm(
    `Gerar uma nova senha temporária para ${name}? A senha atual deixará de funcionar.`,
  );
  if (!confirmed) return;

  setButtonLoading(button, true, "Gerando…");
  try {
    const result = await api(`/admin/users/${userId}/reset-password`, {
      method: "POST",
    });
    elements.temporaryPasswordUser.textContent = `${name} · ${email}`;
    elements.temporaryPasswordValue.value = result.temporary_password;
    elements.temporaryPasswordDialog.showModal();
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function copyTemporaryPassword() {
  const password = elements.temporaryPasswordValue.value;
  try {
    await navigator.clipboard.writeText(password);
    showToast("Senha temporária copiada.");
  } catch {
    elements.temporaryPasswordValue.select();
    document.execCommand("copy");
    showToast("Senha temporária copiada.");
  }
}

function closeTemporaryPasswordDialog() {
  elements.temporaryPasswordDialog.close();
  elements.temporaryPasswordValue.value = "";
  elements.temporaryPasswordUser.textContent = "";
}

function validatePasswordFields(current, next, confirmation) {
  if (!current || !next || !confirmation) {
    throw new Error("Preencha todos os campos.");
  }
  if (next.length < 12) {
    throw new Error("A nova senha deve ter pelo menos 12 caracteres.");
  }
  if (next !== confirmation) {
    throw new Error("A confirmação da nova senha não confere.");
  }
  if (current === next) {
    throw new Error("A nova senha deve ser diferente da atual.");
  }
}

async function submitPasswordChange({
  form,
  currentInput,
  nextInput,
  confirmInput,
  errorElement,
  forced = false,
}) {
  const button = form.querySelector('button[type="submit"]');
  errorElement.textContent = "";
  try {
    validatePasswordFields(
      currentInput.value,
      nextInput.value,
      confirmInput.value,
    );
    setButtonLoading(button, true, "Salvando…");
    await api("/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({
        current_password: currentInput.value,
        new_password: nextInput.value,
      }),
    });
    form.reset();
    state.admin.must_change_password = false;
    if (forced) elements.forcePasswordDialog.close();
    showToast("Senha alterada com sucesso.");
    await loadDashboard();
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    setButtonLoading(button, false);
  }
}

function setView(view) {
  state.currentView = view;
  elements.pageTitle.textContent = viewTitles[view];
  document.querySelectorAll(".panel-view").forEach((panel) => {
    panel.hidden = panel.id !== `${view}-panel`;
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
}

async function refreshCurrentView() {
  setButtonLoading(elements.refreshButton, true, "Atualizando…");
  try {
    await loadDashboard();
  } finally {
    setButtonLoading(elements.refreshButton, false);
  }
}

elements.loginForm.addEventListener("submit", handleLogin);
elements.logoutButton.addEventListener("click", () => logout());
elements.refreshButton.addEventListener("click", refreshCurrentView);
elements.userSearch.addEventListener("input", renderUsers);
elements.auditFilter.addEventListener("change", renderAudit);

document.addEventListener("click", (event) => {
  const navigation = event.target.closest("[data-view], [data-view-link]");
  if (navigation) {
    setView(navigation.dataset.view || navigation.dataset.viewLink);
  }

  const toggleButton = event.target.closest("[data-toggle-user]");
  if (toggleButton) toggleUserAccess(toggleButton);

  const resetPasswordButton = event.target.closest(
    "[data-reset-password-user]",
  );
  if (resetPasswordButton) resetUserPassword(resetPasswordButton);
});

document.addEventListener("change", (event) => {
  const planSelect = event.target.closest("[data-plan-user]");
  if (planSelect) changeUserPlan(planSelect);
});

elements.passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPasswordChange({
    form: elements.passwordForm,
    currentInput: document.querySelector("#current-password"),
    nextInput: document.querySelector("#new-password"),
    confirmInput: document.querySelector("#confirm-password"),
    errorElement: elements.passwordError,
  });
});

elements.forcePasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPasswordChange({
    form: elements.forcePasswordForm,
    currentInput: document.querySelector("#force-current-password"),
    nextInput: document.querySelector("#force-new-password"),
    confirmInput: document.querySelector("#force-confirm-password"),
    errorElement: elements.forcePasswordError,
    forced: true,
  });
});

elements.forcePasswordDialog.addEventListener("cancel", (event) => {
  if (state.admin?.must_change_password) event.preventDefault();
});

elements.copyTemporaryPassword.addEventListener(
  "click",
  copyTemporaryPassword,
);
elements.closeTemporaryPassword.addEventListener(
  "click",
  closeTemporaryPasswordDialog,
);
elements.temporaryPasswordDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeTemporaryPasswordDialog();
});

authenticate();
