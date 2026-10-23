const API_URL = 'http://localhost:8080/api';

// ================= JWT Авторизация и Управление Сессией (Лаб 3) =================
const AUTH_KEY = 'portal_jwt_auth';

const auth = {
  token: null,
  user: null, // { token, tokenType, expiresIn, login, role, employeeId, userId }

  init() {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      try {
        this.user = JSON.parse(saved);
        this.token = this.user.token;
      } catch (e) {
        this.clear();
      }
    }
  },

  isAuthenticated() {
    return !!this.token;
  },

  save(authData) {
    this.user = authData;
    this.token = authData.token;
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
    updateAuthUI();
  },

  clear() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_KEY);
    updateAuthUI();
  },

  async login(login, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    if (!res.ok) {
      let msg = 'Неверный логин или пароль';
      try {
        const body = await res.json();
        msg = body.message || body.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    this.save(data);
    return data;
  },

  getRole() {
    return this.user ? this.user.role : null;
  },

  getLogin() {
    return this.user ? this.user.login : 'Гость';
  },

  getEmployeeId() {
    return this.user ? this.user.employeeId : null;
  },

  decodeToken() {
    if (!this.token) return null;
    try {
      const parts = this.token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1]));
    } catch (e) {
      return null;
    }
  }
};

// Состояние приложения
const state = {
  companies: [],
  positions: [],
  branches: [],
  employees: [],
  users: [],
  selectedCompanyId: null,
  selectedBranchId: null,
  selectedScheduleId: null,
  attendancePage: 0,
  attendanceHasNext: false,
};

// ================= Toast Уведомления =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ================= Централизованный Auth Fetch (Bearer Token) =================
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await authFetch(url, { ...options, headers });

  if (response.status === 401) {
    auth.clear();
    openAuthModal('Сессия истекла или требуется авторизация (401 Unauthorized)');
    throw new Error('401 Unauthorized: требуется авторизация');
  }

  return response;
}

// ================= Обработка Ошибок API (RFC 7807) =================
async function handleApiResponse(response) {
  if (response.ok) {
    if (response.status === 204) return null;
    return await response.json();
  }

  let errorMsg = `Ошибка сервера (HTTP ${response.status})`;
  try {
    const errorBody = await response.json();
    if (errorBody.detail) {
      errorMsg = errorBody.detail;
    } else if (errorBody.message) {
      errorMsg = errorBody.message;
    }
  } catch (e) {}
  throw new Error(errorMsg);
}

// ================= Проверка связи с бэкендом =================
async function checkBackendStatus() {
  const badge = document.getElementById('backend-status');
  const text = document.getElementById('backend-status-text');

  try {
    const res = await fetch(`http://localhost:8080/v3/api-docs/employee-service`, { method: 'GET' });
    if (res.ok) {
      badge.className = 'status-badge online';
      text.textContent = 'API Онлайн (Port 8080)';
      return true;
    }
  } catch (err) {}
  badge.className = 'status-badge offline';
  text.textContent = 'API Офлайн (Запустите Spring Boot)';
  return false;
}

// ================= Обновление интерфейса авторизации =================
function updateAuthUI() {
  const usernameEl = document.getElementById('auth-username');
  const roleBadgeEl = document.getElementById('auth-role-badge');
  const addBtn = document.getElementById('btn-add-user');

  if (!auth.isAuthenticated()) {
    if (usernameEl) usernameEl.textContent = 'Не авторизован';
    if (roleBadgeEl) {
      roleBadgeEl.className = 'badge badge-gray';
      roleBadgeEl.textContent = 'Гость';
    }
    applyRolePermissions(null);
    return;
  }

  const role = auth.getRole();
  const login = auth.getLogin();

  if (usernameEl) usernameEl.textContent = login;
  if (roleBadgeEl) {
    roleBadgeEl.className = `badge ${getRoleBadgeClass(role)}`;
    let roleTitle = role;
    if (role === 'ADMIN') roleTitle = '👑 ADMIN (Супервайзер)';
    else if (role === 'HR') roleTitle = '💼 HR (Кадры)';
    else if (role === 'MANAGER') roleTitle = '📋 MANAGER (Управляющий)';
    else if (role === 'EMPLOYEE') roleTitle = '☕ EMPLOYEE (Сотрудник)';
    roleBadgeEl.textContent = roleTitle;
  }

  // Ограничение: пользователей может создавать только супервайзер (ADMIN)
  if (addBtn) {
    if (role === 'ADMIN') {
      addBtn.disabled = false;
      addBtn.style.opacity = '1';
      addBtn.title = 'Создать нового пользователя';
      addBtn.textContent = '+ Создать пользователя';
    } else {
      addBtn.disabled = true;
      addBtn.style.opacity = '0.5';
      addBtn.title = 'Создавать пользователей могут только супервайзеры (ADMIN)';
      addBtn.textContent = '🔒 Только супервайзер (ADMIN)';
    }
  }

  applyRolePermissions(role);
}

// ================= Разграничение видимости разделов по ролям =================
function applyRolePermissions(role) {
  const permissions = {
    ADMIN: ['dashboard', 'organization', 'employees', 'users', 'shifts', 'requests', 'attendance'],
    HR: ['dashboard', 'organization', 'employees', 'users', 'requests'],
    MANAGER: ['dashboard', 'employees', 'shifts', 'requests', 'attendance'],
    EMPLOYEE: ['dashboard', 'employees', 'users', 'requests']
  };

  const allowed = permissions[role] || ['dashboard'];
  const navItems = document.querySelectorAll('.nav-item');

  let activeVisible = false;
  navItems.forEach(item => {
    const sec = item.dataset.section;
    if (allowed.includes(sec)) {
      item.style.display = 'flex';
      if (item.classList.contains('active')) activeVisible = true;
    } else {
      item.style.display = 'none';
      if (item.classList.contains('active')) {
        item.classList.remove('active');
        const secEl = document.getElementById(`section-${sec}`);
        if (secEl) secEl.classList.remove('active');
      }
    }
  });

  if (!activeVisible) {
    const dashBtn = document.querySelector('.nav-item[data-section="dashboard"]');
    if (dashBtn) dashBtn.click();
  }
}

// ================= Навигация по табам =================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const titleEl = document.getElementById('current-page-title');
  const subtitleEl = document.getElementById('current-page-subtitle');

  const titles = {
    dashboard: { title: 'Сводка системы', subtitle: 'Общий обзор состояния компаний и сотрудников' },
    organization: { title: 'Структура организации', subtitle: 'Управление компаниями, филиалами и должностями' },
    employees: { title: 'Кадровый состав', subtitle: 'Список сотрудников, учетные записи и назначения' },
    users: { title: 'Пользователи и Доступ', subtitle: 'Управление учетными записями и системными ролями (0..3)' },
    shifts: { title: 'Графики и Смены', subtitle: 'Планирование смен, назначение персонала и аудит-лог' },
    requests: { title: 'Заявки на согласование', subtitle: 'Отпуска, отгулы и больничные сотрудников' },
    attendance: { title: 'Табель рабочего времени', subtitle: 'Сравнение плановых и фактических явок (Slice)' }
  };

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.section;
      document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
      const targetSec = document.getElementById(`section-${target}`);
      if (targetSec) targetSec.classList.add('active');

      if (titles[target]) {
        titleEl.textContent = titles[target].title;
        subtitleEl.textContent = titles[target].subtitle;
      }

      // Подгрузка при переходе
      if (target === 'organization') loadOrganizationData();
      if (target === 'employees') loadEmployees();
      if (target === 'users') loadUsers();
      if (target === 'shifts') loadShiftsSection();
      if (target === 'requests') loadRequests();
      if (target === 'attendance') loadAttendance(true);
    });
  });
}

// ================= Модальные окна (<dialog>) =================
function initModals() {
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dialog = btn.closest('dialog');
      if (dialog) dialog.close();
    });
  });

  // Закрытие при клике по бэкдропу
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) dialog.close();
    });
  });
}

// ================= 1. СВОДКА (DASHBOARD) =================
async function loadDashboardStats() {
  try {
    const [companies, employees, requestsRes] = await Promise.all([
      authFetch(`${API_URL}/companies`).then(handleApiResponse),
      authFetch(`${API_URL}/employees`).then(handleApiResponse),
      authFetch(`${API_URL}/requests?status=PENDING`).then(handleApiResponse)
    ]);

    state.companies = Array.isArray(companies) ? companies : (companies.content || []);
    state.employees = Array.isArray(employees) ? employees : (employees.content || []);

    const pendingCount = Array.isArray(requestsRes)
      ? requestsRes.length
      : (requestsRes.totalElements ?? (requestsRes.content ? requestsRes.content.length : 0));

    document.getElementById('stat-companies-count').textContent = state.companies.length;
    document.getElementById('stat-employees-count').textContent = state.employees.length;
    document.getElementById('stat-requests-count').textContent = pendingCount;

    // Считаем филиалы суммарно
    let branchTotal = 0;
    for (const c of state.companies) {
      try {
        const branches = await authFetch(`${API_URL}/branches/company/${c.id}`).then(handleApiResponse);
        branchTotal += Array.isArray(branches) ? branches.length : 0;
      } catch (e) {}
    }
    document.getElementById('stat-branches-count').textContent = branchTotal;
  } catch (err) {
    console.error('Ошибка загрузки статистики:', err);
  }
}

// ================= 2. ОРГАНИЗАЦИЯ =================
async function loadOrganizationData() {
  await Promise.all([loadCompanies(), loadPositions()]);
}

async function loadCompanies() {
  const tbody = document.getElementById('companies-table-body');
  const select = document.getElementById('branch-company-select');
  const modalSelect = document.getElementById('modal-branch-company-select');

  try {
    const companies = await authFetch(`${API_URL}/companies`).then(handleApiResponse);
    state.companies = companies;

    tbody.innerHTML = '';
    select.innerHTML = '<option value="">Выберите компанию...</option>';
    modalSelect.innerHTML = '<option value="">Выберите компанию...</option>';

    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Компаний пока нет</td></tr>';
      return;
    }

    companies.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${c.id}</strong></td>
        <td>${escapeHtml(c.name)}</td>
        <td>
          <button class="btn btn-danger btn-sm" data-id="${c.id}" onclick="deleteCompany(${c.id})">Удалить</button>
        </td>
      `;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
      modalSelect.appendChild(opt.cloneNode(true));
    });

    if (state.selectedCompanyId) {
      select.value = state.selectedCompanyId;
      loadBranchesForCompany(state.selectedCompanyId);
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadPositions() {
  const tbody = document.getElementById('positions-table-body');
  try {
    const positions = await authFetch(`${API_URL}/positions`).then(handleApiResponse);
    state.positions = positions;

    tbody.innerHTML = '';
    if (positions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Должностей пока нет</td></tr>';
      return;
    }

    positions.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${p.id}</strong></td>
        <td>${escapeHtml(p.title)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deletePosition(${p.id})">Удалить</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadBranchesForCompany(companyId) {
  const tbody = document.getElementById('branches-table-body');
  if (!companyId) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Выберите компанию для просмотра филиалов</td></tr>';
    return;
  }

  try {
    const branches = await authFetch(`${API_URL}/branches/company/${companyId}`).then(handleApiResponse);
    state.branches = branches;

    tbody.innerHTML = '';
    if (branches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">У этой компании нет филиалов</td></tr>';
      return;
    }

    branches.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${b.id}</strong></td>
        <td>${escapeHtml(b.name)}</td>
        <td>${escapeHtml(b.address)}</td>
        <td>${escapeHtml(b.phone || '—')}</td>
        <td><span class="badge ${b.isActive ? 'badge-green' : 'badge-red'}">${b.isActive ? 'Активен' : 'Закрыт'}</span></td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteBranch(${b.id})">Удалить</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Вспомогательный класс для бейджей ролей
function getRoleBadgeClass(roleCode) {
  switch (roleCode) {
    case 'ADMIN': return 'badge-red';
    case 'HR': return 'badge-green';
    case 'MANAGER': return 'badge-yellow';
    case 'EMPLOYEE':
    default: return 'badge-blue';
  }
}

// ================= 3. СОТРУДНИКИ =================
async function loadEmployees() {
  const tbody = document.getElementById('employees-table-body');
  try {
    const [empRes, usersRes] = await Promise.all([
      authFetch(`${API_URL}/employees?size=50`).then(handleApiResponse),
      authFetch(`${API_URL}/users`).then(handleApiResponse).catch(() => [])
    ]);

    const employees = Array.isArray(empRes) ? empRes : (empRes.content || []);
    state.employees = employees;
    state.users = Array.isArray(usersRes) ? usersRes : [];

    const userByEmpId = {};
    state.users.forEach(u => {
      if (u.employeeId) userByEmpId[u.employeeId] = u;
    });

    tbody.innerHTML = '';
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Сотрудников пока нет</td></tr>';
      return;
    }

    // Загружаем назначения параллельно
    const assignmentsMap = {};
    await Promise.all(employees.map(async emp => {
      try {
        const assigns = await authFetch(`${API_URL}/employees/${emp.id}/assignments`).then(handleApiResponse);
        assignmentsMap[emp.id] = assigns || [];
      } catch (e) {
        assignmentsMap[emp.id] = [];
      }
    }));

    const isManagerOnly = state.currentRole === 'MANAGER';

    employees.forEach(emp => {
      const tr = document.createElement('tr');
      const empAssignments = assignmentsMap[emp.id] || [];
      const assignmentsHtml = (empAssignments.length > 0)
        ? empAssignments.map(a => `
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>${escapeHtml(a.branchName)}</strong> — ${escapeHtml(a.positionTitle)}
              ${a.isPrimary ? '<span class="badge badge-blue">Основная</span>' : '<span class="badge badge-gray">Совмещение</span>'}
            </div>
          `).join('')
        : '<span style="color: var(--text-muted); font-size: 12px;">Не назначен</span>';

      const assignBtnHtml = (!isManagerOnly && emp.status !== 'DISMISSED') ? `
        <button class="btn btn-secondary btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; display: block;"
                onclick="openAssignEmployeeModal(${emp.id})">+ Назначить ставку</button>
      ` : '';

      let statusBadge = 'badge-green';
      if (emp.status === 'ON_LEAVE') statusBadge = 'badge-yellow';
      if (emp.status === 'DISMISSED') statusBadge = 'badge-red';

      const user = userByEmpId[emp.id];
      const roleHtml = user ? `
        <div style="font-size: 12px;">
          <span class="badge ${getRoleBadgeClass(user.roleCode)}" style="font-weight: 600;">${user.roleCode} (Роль ${user.roleId})</span>
          <div style="color: var(--text-muted); margin-top: 3px;">Логин: <code>${escapeHtml(user.login)}</code></div>
          ${!isManagerOnly ? `
            <button class="btn btn-secondary btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px;"
                    onclick="openEditUserRoleModal(${user.id})">Изменить роль</button>
          ` : ''}
        </div>
      ` : `
        <div>
          <span style="color: var(--text-muted); font-size: 12px;">Нет аккаунта</span>
          ${!isManagerOnly ? `
            <button class="btn btn-secondary btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; display: block;"
                    onclick="openCreateUserForEmployeeModal(${emp.id})">+ Назначить роль</button>
          ` : ''}
        </div>
      `;

      let actionsHtml = '';
      if (!isManagerOnly) {
        actionsHtml = `
          <div style="display: flex; gap: 6px;">
            ${emp.status !== 'DISMISSED'
              ? `<button class="btn btn-secondary btn-sm" onclick="dismissEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Уволить</button>`
              : `<button class="btn btn-primary btn-sm" onclick="rehireEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Принять на работу</button>`}
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Удалить</button>
          </div>
        `;
      } else {
        actionsHtml = '<span style="font-size: 12px; color: var(--text-muted);">Только просмотр</span>';
      }

      tr.innerHTML = `
        <td><strong>#${emp.id}</strong></td>
        <td><strong>${escapeHtml(emp.name)}</strong></td>
        <td>${escapeHtml(emp.phone)}</td>
        <td>${emp.hireDate || '—'}</td>
        <td><span class="badge ${statusBadge}">${emp.status}</span></td>
        <td>${roleHtml}</td>
        <td>${assignmentsHtml}${assignBtnHtml}</td>
        <td>${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= ПОЛЬЗОВАТЕЛИ И СИСТЕМНЫЕ РОЛИ =================
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    const users = await authFetch(`${API_URL}/users`).then(handleApiResponse);
    state.users = Array.isArray(users) ? users : [];
    tbody.innerHTML = '';

    if (state.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Пользователей пока нет</td></tr>';
      return;
    }

    state.users.forEach(u => {
      const tr = document.createElement('tr');
      const empLabel = u.employeeName
        ? `<strong>${escapeHtml(u.employeeName)}</strong> (ID #${u.employeeId})`
        : '<span style="color: var(--text-muted);">Без привязки (Системный аккаунт)</span>';

      tr.innerHTML = `
        <td><strong>#${u.id}</strong></td>
        <td><code>${escapeHtml(u.login)}</code></td>
        <td><span class="badge badge-gray" title="Пароли захэшированы алгоритмом BCrypt и никогда не отдаются в ответах API">🔒 BCrypt (скрыт)</span></td>
        <td>${empLabel}</td>
        <td>
          <span class="badge ${getRoleBadgeClass(u.roleCode)}" style="font-weight: 600;">
            ${u.roleName || u.roleCode} (Роль ${u.roleId})
          </span>
        </td>
        <td>
          <span class="badge ${u.isActive ? 'badge-green' : 'badge-red'}">
            ${u.isActive ? 'Активен' : 'Заблокирован'}
          </span>
        </td>
        <td>${formatDateTime(u.createdAt)}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${auth.getRole() === "ADMIN" 
              ? `<button class="btn btn-secondary btn-sm" onclick="openEditUserRoleModal(${u.id})">Изменить роль</button>
                 <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escapeHtml(u.login)}')">Удалить</button>`
              : `<span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">🔒 Только ADMIN</span>`
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function openAddUserModal() {
  if (auth.getRole() !== "ADMIN") {
    showToast("Создавать пользователей может только супервайзер с ролью ADMIN", "danger");
    return;
  }
  const modal = document.getElementById('modal-user');
  const pwdInput = document.getElementById('user-password');
  if (pwdInput) pwdInput.value = "1234";
  document.getElementById('modal-user-title').textContent = 'Создать нового пользователя';
  document.getElementById('user-id').value = '';
  document.getElementById('user-login').value = '';
  document.getElementById('user-login').disabled = false;
  document.getElementById('user-role-select').value = '3';

  const empSelect = document.getElementById('user-employee-id');
  empSelect.innerHTML = '<option value="">Без привязки (Системный аккаунт)</option>';
  (state.employees || []).forEach(e => {
    empSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.name)} (ID #${e.id})</option>`;
  });
  empSelect.value = '';
  empSelect.disabled = false;

  modal.showModal();
}

function openCreateUserForEmployeeModal(employeeId) {
  const modal = document.getElementById('modal-user');
  const emp = (state.employees || []).find(e => e.id === Number(employeeId));
  const empName = emp ? emp.name : '#' + employeeId;
  document.getElementById('modal-user-title').textContent = `Выдать доступ сотруднику: ${empName}`;
  document.getElementById('user-id').value = '';
  
  let suggestedLogin = '';
  if (emp) {
    suggestedLogin = emp.name.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  document.getElementById('user-login').value = suggestedLogin || 'user_' + employeeId;
  document.getElementById('user-login').disabled = false;
  document.getElementById('user-role-select').value = '3';

  const empSelect = document.getElementById('user-employee-id');
  empSelect.innerHTML = '';
  (state.employees || []).forEach(e => {
    empSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.name)} (ID #${e.id})</option>`;
  });
  empSelect.value = String(employeeId);
  empSelect.disabled = false;

  modal.showModal();
}

function openEditUserRoleModal(userId) {
  const user = (state.users || []).find(u => u.id === Number(userId));
  if (!user) return;

  const modal = document.getElementById('modal-user');
  document.getElementById('modal-user-title').textContent = `Изменить роль пользователя: ${user.login}`;
  document.getElementById('user-id').value = user.id;
  document.getElementById('user-login').value = user.login;
  document.getElementById('user-login').disabled = false;
  document.getElementById('user-role-select').value = String(user.roleId);

  const empSelect = document.getElementById('user-employee-id');
  empSelect.innerHTML = '<option value="">Без привязки (Системный аккаунт)</option>';
  (state.employees || []).forEach(e => {
    empSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.name)} (ID #${e.id})</option>`;
  });
  empSelect.value = user.employeeId ? String(user.employeeId) : '';
  empSelect.disabled = false;

  modal.showModal();
}

async function deleteUser(id, login) {
  if (auth.getRole() !== "ADMIN") {
    showToast("Удалять пользователей может только супервайзер (ADMIN)", "danger");
    return;
  }
  const label = login ? ` (${login})` : '';
  if (!confirm(`Удалить учетную запись пользователя #${id}${label}?`)) return;

  try {
    await authFetch(`${API_URL}/users/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Учетная запись пользователя удалена', 'info');
    loadUsers();
    loadEmployees();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 4. СМЕНЫ И ГРАФИКИ =================
async function loadShiftsSection() {
  const branchSelect = document.getElementById('schedule-branch-select');
  const scheduleSelect = document.getElementById('schedule-list-select');

  // Загружаем все филиалы
  const allBranches = [];
  for (const c of state.companies) {
    const bList = await authFetch(`${API_URL}/branches/company/${c.id}`).then(handleApiResponse);
    allBranches.push(...bList);
  }
  state.allBranches = allBranches;

  branchSelect.innerHTML = '<option value="">Выберите филиал...</option>';
  allBranches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.name} (${b.address})`;
    branchSelect.appendChild(opt);
  });

  if (state.selectedBranchId) {
    branchSelect.value = state.selectedBranchId;
    loadSchedulesForBranch(state.selectedBranchId);
  }
}

async function loadSchedulesForBranch(branchId) {
  const scheduleSelect = document.getElementById('schedule-list-select');
  scheduleSelect.innerHTML = '<option value="">Выберите график...</option>';

  if (!branchId) return;

  try {
    const schedules = await authFetch(`${API_URL}/schedules/branch/${branchId}`).then(handleApiResponse);
    schedules.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `График #${s.id} (${s.dateFrom} — ${s.dateTo})`;
      scheduleSelect.appendChild(opt);
    });

    if (schedules.length > 0) {
      scheduleSelect.value = schedules[0].id;
      state.selectedScheduleId = schedules[0].id;
      loadShiftsForSchedule(schedules[0].id);
    } else {
      document.getElementById('shifts-list-container').innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 20px;">
          У этого филиала пока нет графиков. Нажмите «+ Создать график».
        </p>
      `;
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadShiftsForSchedule(scheduleId) {
  const container = document.getElementById('shifts-list-container');
  if (!scheduleId) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Выберите график для отображения смен.</p>';
    return;
  }

  try {
    const res = await authFetch(`${API_URL}/shifts/schedule/${scheduleId}?page=0&size=50`);
    const totalCount = res.headers.get('X-Total-Count');
    const shifts = await handleApiResponse(res);

    container.innerHTML = '';
    if (shifts.length === 0) {
      container.innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 20px;">
          В этом графике ещё нет смен. Нажмите «+ Добавить смену».
        </p>
      `;
      return;
    }

    const headerNote = document.createElement('div');
    headerNote.style.marginBottom = '12px';
    headerNote.innerHTML = `<span class="badge badge-blue">Всего смен в графике: ${totalCount || shifts.length}</span>`;
    container.appendChild(headerNote);

    shifts.forEach(shift => {
      const card = document.createElement('div');
      card.className = 'shift-card';

      const employeesList = (shift.assignedEmployees && shift.assignedEmployees.length > 0)
        ? shift.assignedEmployees.map(e => `
            <span class="badge badge-green" style="display: inline-flex; align-items: center; gap: 4px;">
              ${escapeHtml(e.name)}
              <button style="border: none; background: none; color: #b91c1c; cursor: pointer; font-weight: bold; margin-left: 2px;"
                      onclick="removeEmployeeFromShift(${shift.id}, ${e.id})">✕</button>
            </span>
          `).join('')
        : '<span style="color: var(--text-muted); font-size: 13px;">Никто не назначен</span>';

      card.innerHTML = `
        <div class="shift-info">
          <div class="shift-time">${shift.date} • ${shift.timeFrom.substring(0, 5)} — ${shift.timeTo.substring(0, 5)}</div>
          <div class="shift-meta">Перерыв: ${shift.breakMinutes} мин. | Смена #${shift.id}</div>
          <div class="shift-employees-list">${employeesList}</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-secondary btn-sm" onclick="openShiftLogsModal(${shift.id})">Аудит</button>
          <button class="btn btn-primary btn-sm" onclick="openAssignShiftModal(${shift.id}, '${shift.date}', '${shift.timeFrom.substring(0, 5)}-${shift.timeTo.substring(0, 5)}')">+ Сотрудник</button>
          <button class="btn btn-danger btn-sm" onclick="deleteShift(${shift.id})">Удалить</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 5. ЗАЯВКИ =================
async function loadRequests() {
  const tbody = document.getElementById('requests-table-body');
  const filter = document.getElementById('filter-request-status').value;
  let url = `${API_URL}/requests`;
  if (filter) url += `?status=${filter}`;

  try {
    const res = await authFetch(url).then(handleApiResponse);
    const requests = Array.isArray(res) ? res : (res.content || []);
    tbody.innerHTML = '';

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Заявок с выбранным фильтром нет</td></tr>';
      return;
    }

    requests.forEach(req => {
      let datesStr = '—';
      try {
        const data = JSON.parse(req.requestData);
        datesStr = `${data.dateFrom || ''} — ${data.dateTo || ''}`;
      } catch (e) {
        datesStr = req.requestData;
      }

      let badgeClass = 'badge-yellow';
      if (req.status === 'APPROVED') badgeClass = 'badge-green';
      if (req.status === 'REJECTED') badgeClass = 'badge-red';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${req.id}</strong></td>
        <td><strong>${escapeHtml(req.employeeName)}</strong></td>
        <td><span class="badge badge-blue">${req.type}</span></td>
        <td>${datesStr}</td>
        <td><span class="badge ${badgeClass}">${req.status}</span></td>
        <td>${escapeHtml(req.resolutionComment || '—')}</td>
        <td>
          ${req.status === 'PENDING' ? `
            <button class="btn btn-primary btn-sm" onclick="openProcessRequestModal(${req.id}, '${escapeHtml(req.employeeName)}', '${req.type}', '${datesStr}')">Рассмотреть</button>
          ` : '<span style="color: var(--text-muted); font-size: 12px;">Завершена</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 6. ТАБЕЛЬ (SLICE / БЕСКОНЕЧНАЯ ПРОКРУТКА) =================
async function loadAttendance(reset = false) {
  const tbody = document.getElementById('attendance-table-body');
  const btnMore = document.getElementById('btn-load-more-attendance');

  if (reset) {
    state.attendancePage = 0;
    tbody.innerHTML = '';
  }

  try {
    const res = await authFetch(`${API_URL}/attendance?page=${state.attendancePage}&size=10`).then(handleApiResponse);
    const content = res.content || [];
    state.attendanceHasNext = res.hasNext;

    if (reset && content.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Записей явок пока нет</td></tr>';
      btnMore.style.display = 'none';
      return;
    }

    content.forEach(r => {
      const tr = document.createElement('tr');
      const plannedStart = formatDateTime(r.plannedStart);
      const plannedEnd = formatDateTime(r.plannedEnd);
      const actualStart = r.actualStart ? formatDateTime(r.actualStart) : '<span style="color: var(--warning);">Не зафиксирован</span>';
      const actualEnd = r.actualEnd ? formatDateTime(r.actualEnd) : '<span style="color: var(--text-muted);">В процессе</span>';

      tr.innerHTML = `
        <td><strong>#${r.id}</strong></td>
        <td><strong>${escapeHtml(r.employeeName)}</strong></td>
        <td>${plannedStart}</td>
        <td>${plannedEnd}</td>
        <td>${actualStart}</td>
        <td>${actualEnd}</td>
        <td>${r.breakMinutes} мин.</td>
        <td>${escapeHtml(r.comment || '—')}</td>
      `;
      tbody.appendChild(tr);
    });

    btnMore.style.display = state.attendanceHasNext ? 'inline-block' : 'none';
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= ОПЕРАЦИИ БИЗНЕС-ЛОГИКИ =================

// Создание компании
document.getElementById('form-company').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('company-name').value.trim();
  try {
    await authFetch(`${API_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(handleApiResponse);

    showToast('Компания успешно создана!', 'success');
    document.getElementById('modal-company').close();
    document.getElementById('form-company').reset();
    loadCompanies();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Создание филиала
document.getElementById('form-branch').addEventListener('submit', async (e) => {
  e.preventDefault();
  const companyId = document.getElementById('modal-branch-company-select').value;
  const name = document.getElementById('branch-name').value.trim();
  const address = document.getElementById('branch-address').value.trim();
  const phone = document.getElementById('branch-phone').value.trim();

  try {
    await authFetch(`${API_URL}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: Number(companyId), name, address, phone, isActive: true })
    }).then(handleApiResponse);

    showToast('Филиал успешно добавлен!', 'success');
    document.getElementById('modal-branch').close();
    document.getElementById('form-branch').reset();
    if (state.selectedCompanyId == companyId) {
      loadBranchesForCompany(companyId);
    }
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Создание должности
document.getElementById('form-position').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('position-title').value.trim();
  try {
    await authFetch(`${API_URL}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }).then(handleApiResponse);

    showToast('Должность добавлена в справочник!', 'success');
    document.getElementById('modal-position').close();
    document.getElementById('form-position').reset();
    loadPositions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Создание сотрудника
document.getElementById('form-employee').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('emp-name').value.trim();
  let phone = document.getElementById('emp-phone').value.trim();
  
  // Очистка от пробелов, скобок и дефисов: "+7 (999) 123-45-67" -> "+79991234567"
  phone = phone.replace(/[\s\(\)\-]/g, '');
  if (!phone.startsWith('+')) {
    if (phone.startsWith('8')) {
      phone = '+7' + phone.substring(1);
    } else if (phone.startsWith('7')) {
      phone = '+' + phone;
    } else {
      phone = '+7' + phone;
    }
  }

  const birthDate = document.getElementById('emp-birth').value || null;
  const hireDate = document.getElementById('emp-hire').value || new Date().toISOString().substring(0, 10);

  try {
    const newEmp = await authFetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, birthDate, hireDate, status: 'ACTIVE' })
    }).then(handleApiResponse);

    showToast(`Сотрудник "${name}" успешно зарегистрирован!`, 'success');

    // Проверяем создание учетной записи
    const createUserCheck = document.getElementById('emp-create-user-check').checked;
    if (createUserCheck && newEmp && newEmp.id) {
      const login = document.getElementById('emp-user-login').value.trim();
      const roleId = Number(document.getElementById('emp-user-role').value);
      if (login) {
        try {
          await authFetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: newEmp.id,
              roleId,
              login
            })
          }).then(handleApiResponse);
          showToast(`Учетная запись (${login}) с ролью ${roleId} успешно создана!`, 'success');
        } catch (userErr) {
          showToast(`Сотрудник создан, но не удалось создать пользователя: ${userErr.message}`, 'warning');
        }
      }
    }

    document.getElementById('modal-employee').close();
    document.getElementById('form-employee').reset();
    document.getElementById('emp-user-fields').style.display = 'none';
    document.getElementById('emp-hire').value = new Date().toISOString().substring(0, 10);
    loadEmployees();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Привязка сотрудника к филиалу и должности
document.getElementById('form-assign-employee').addEventListener('submit', async (e) => {
  e.preventDefault();
  const employeeId = document.getElementById('assign-emp-id').value;
  const branchId = document.getElementById('assign-branch-id').value;
  const positionId = document.getElementById('assign-pos-id').value;
  const startedAt = document.getElementById('assign-started-at').value;
  const isPrimary = document.getElementById('assign-is-primary').checked;

  try {
    await authFetch(`${API_URL}/employees/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: Number(employeeId),
        branchId: Number(branchId),
        positionId: Number(positionId),
        startedAt,
        isPrimary
      })
    }).then(handleApiResponse);

    showToast('Ставка сотрудника успешно привязана!', 'success');
    document.getElementById('modal-assign-employee').close();
    loadEmployees();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Создание графика
document.getElementById('form-schedule').addEventListener('submit', async (e) => {
  e.preventDefault();
  const branchId = document.getElementById('sched-branch-id').value;
  const dateFrom = document.getElementById('sched-date-from').value;
  const dateTo = document.getElementById('sched-date-to').value;

  try {
    const created = await authFetch(`${API_URL}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: Number(branchId), dateFrom, dateTo })
    }).then(handleApiResponse);

    showToast('График успешно создан!', 'success');
    document.getElementById('modal-schedule').close();
    loadSchedulesForBranch(branchId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Создание смены
document.getElementById('form-shift').addEventListener('submit', async (e) => {
  e.preventDefault();
  const scheduleId = state.selectedScheduleId;
  const date = document.getElementById('shift-date').value;
  const timeFrom = document.getElementById('shift-time-from').value + ':00';
  const timeTo = document.getElementById('shift-time-to').value + ':00';
  const breakMinutes = Number(document.getElementById('shift-break').value) || 0;

  try {
    await authFetch(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: Number(scheduleId),
        date,
        timeFrom,
        timeTo,
        breakMinutes
      })
    }).then(handleApiResponse);

    showToast('Смена успешно добавлена в расписание!', 'success');
    document.getElementById('modal-shift').close();
    loadShiftsForSchedule(scheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Назначение сотрудника на смену (Транзакционный сценарий)
document.getElementById('form-assign-shift').addEventListener('submit', async (e) => {
  e.preventDefault();
  const shiftId = document.getElementById('assign-shift-id').value;
  const employeeId = document.getElementById('shift-assign-emp-id').value;

  try {
    await authFetch(`${API_URL}/shifts/${shiftId}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: Number(employeeId) })
    }).then(handleApiResponse);

    showToast('Сотрудник назначен на смену (записано в аудит-лог)!', 'success');
    document.getElementById('modal-assign-shift').close();
    loadShiftsForSchedule(state.selectedScheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Снятие сотрудника со смены
async function removeEmployeeFromShift(shiftId, employeeId, empName) {
  const emp = state.employees.find(e => e.id === Number(employeeId));
  const name = empName || (emp ? emp.name : `ID #${employeeId}`);
  if (!confirm(`Снять сотрудника "${name}" с этой смены?`)) return;

  try {
    await authFetch(`${API_URL}/shifts/${shiftId}/employees/${employeeId}`, {
      method: 'DELETE'
    }).then(handleApiResponse);

    showToast(`Сотрудник "${name}" снят со смены`, 'info');
    loadShiftsForSchedule(state.selectedScheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Просмотр аудит-лога смены
async function openShiftLogsModal(shiftId) {
  const dialog = document.getElementById('modal-shift-logs');
  const tbody = document.getElementById('shift-logs-table-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Загрузка истории...</td></tr>';
  dialog.showModal();

  try {
    const logs = await authFetch(`${API_URL}/shifts/${shiftId}/logs`).then(handleApiResponse);
    tbody.innerHTML = '';
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Записей в аудит-логе пока нет</td></tr>';
      return;
    }

    logs.forEach(l => {
      const tr = document.createElement('tr');
      const actionBadge = l.action === 'ASSIGNED' 
        ? '<span class="badge badge-green">Назначен (ASSIGNED)</span>' 
        : '<span class="badge badge-red">Снят (REMOVED)</span>';

      tr.innerHTML = `
        <td>${formatDateTime(l.createdAt)}</td>
        <td><strong>${escapeHtml(l.employeeName)}</strong></td>
        <td>${actionBadge}</td>
        <td>${escapeHtml(l.createdByName || 'Система')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Рассмотрение заявки на отпуск (Транзакционный сценарий)
function openProcessRequestModal(requestId, empName, type, dates) {
  document.getElementById('process-request-id').value = requestId;
  document.getElementById('process-request-info').innerHTML = `
    Заявка <strong>#${requestId}</strong>: <strong>${escapeHtml(empName)}</strong><br>
    Тип: <span class="badge badge-blue">${type}</span><br>
    Период: <strong>${dates}</strong>
  `;
  document.getElementById('modal-process-request').showModal();
}

document.getElementById('form-process-request').addEventListener('submit', async (e) => {
  e.preventDefault();
  const requestId = document.getElementById('process-request-id').value;
  const status = document.getElementById('process-decision').value;
  const resolutionComment = document.getElementById('process-comment').value.trim();

  try {
    await authFetch(`${API_URL}/requests/${requestId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolutionComment })
    }).then(handleApiResponse);

    if (status === 'APPROVED') {
      showToast('Заявка ОДОБРЕНА! Отпуск создан, конфликтующие смены автоматически отвязаны.', 'success');
    } else {
      showToast('Заявка ОТКЛОНЕНА.', 'info');
    }

    document.getElementById('modal-process-request').close();
    document.getElementById('form-process-request').reset();
    loadRequests();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Открытие модалки назначения сотрудника на смену
function openAssignShiftModal(shiftId, date, time) {
  document.getElementById('assign-shift-id').value = shiftId;
  document.getElementById('assign-shift-details').textContent = `Смена #${shiftId} на ${date} (${time})`;

  const select = document.getElementById('shift-assign-emp-id');
  select.innerHTML = '<option value="">Выберите сотрудника...</option>';
  state.employees.filter(e => e.status !== 'DISMISSED').forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.name} (${e.phone})`;
    select.appendChild(opt);
  });

  document.getElementById('modal-assign-shift').showModal();
}

// Удаление сущностей
async function deleteCompany(id) {
  if (!confirm(`Удалить компанию #${id}? Все связанные филиалы будут удалены.`)) return;
  try {
    await authFetch(`${API_URL}/companies/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Компания удалена', 'info');
    loadCompanies();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deletePosition(id) {
  if (!confirm(`Удалить должность #${id}?`)) return;
  try {
    await authFetch(`${API_URL}/positions/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Должность удалена', 'info');
    loadPositions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteBranch(id) {
  if (!confirm(`Удалить филиал #${id}?`)) return;
  try {
    await authFetch(`${API_URL}/branches/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Филиал удален', 'info');
    loadBranchesForCompany(state.selectedCompanyId);
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteEmployee(id, name) {
  const emp = state.employees.find(e => e.id === Number(id));
  const empName = name || (emp ? emp.name : '');
  const label = empName ? ` (${empName})` : '';
  if (!confirm(`Полностью удалить сотрудника #${id}${label} из базы данных?`)) return;
  try {
    await authFetch(`${API_URL}/employees/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Сотрудник успешно удален из базы данных', 'info');
    loadEmployees();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function dismissEmployee(id, name) {
  const emp = state.employees.find(e => e.id === Number(id));
  const empName = name || (emp ? emp.name : '');
  const label = empName ? ` (${empName})` : '';
  if (!confirm(`Уволить сотрудника #${id}${label}? Статус будет переведён в DISMISSED.`)) return;
  try {
    await authFetch(`${API_URL}/employees/${id}/dismiss`, { method: 'POST' }).then(handleApiResponse);
    showToast(`Сотрудник #${id} уволен (DISMISSED)`, 'warning');
    loadEmployees();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function rehireEmployee(id, name) {
  const emp = state.employees.find(e => e.id === Number(id));
  const empName = name || (emp ? emp.name : '');
  const label = empName ? ` (${empName})` : '';
  if (!confirm(`Принять сотрудника #${id}${label} обратно на работу? Статус будет изменен на ACTIVE.`)) return;
  try {
    await authFetch(`${API_URL}/employees/${id}/rehire`, { method: 'POST' }).then(handleApiResponse);
    showToast(`Сотрудник #${id}${label} принят обратно на работу`, 'success');
    loadEmployees();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function openAssignEmployeeModal(preselectedEmpId = null) {
  const empSelect = document.getElementById('assign-emp-id');
  const branchSelect = document.getElementById('assign-branch-id');
  const posSelect = document.getElementById('assign-pos-id');

  // Load employees if empty
  if (!state.employees || state.employees.length === 0) {
    const empRes = await authFetch(`${API_URL}/employees?size=50`).then(handleApiResponse).catch(() => []);
    state.employees = Array.isArray(empRes) ? empRes : (empRes.content || []);
  }

  // Load companies & branches and positions if empty
  if (!state.allBranches || state.allBranches.length === 0 || !state.positions || state.positions.length === 0) {
    try {
      const [companies, positions] = await Promise.all([
        authFetch(`${API_URL}/companies`).then(handleApiResponse).catch(() => []),
        authFetch(`${API_URL}/positions`).then(handleApiResponse).catch(() => [])
      ]);
      state.positions = Array.isArray(positions) ? positions : (positions.content || []);
      state.companies = Array.isArray(companies) ? companies : (companies.content || []);

      const branches = [];
      for (const c of state.companies) {
        try {
          const bList = await authFetch(`${API_URL}/branches/company/${c.id}`).then(handleApiResponse);
          if (Array.isArray(bList)) branches.push(...bList);
        } catch (e) {}
      }
      state.allBranches = branches;
    } catch (err) {
      console.error('Ошибка загрузки филиалов и должностей:', err);
    }
  }

  // Populate empSelect
  empSelect.innerHTML = '<option value="">Выберите сотрудника...</option>';
  state.employees.forEach(e => {
    const isSelected = preselectedEmpId && e.id === Number(preselectedEmpId);
    empSelect.innerHTML += `<option value="${e.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(e.name)} (ID #${e.id})</option>`;
  });
  if (preselectedEmpId) {
    empSelect.value = String(preselectedEmpId);
  }

  // Populate branchSelect
  branchSelect.innerHTML = '<option value="">Выберите филиал...</option>';
  if (!state.allBranches || state.allBranches.length === 0) {
    branchSelect.innerHTML += '<option value="" disabled>Филиалы не найдены (создайте филиал в Структуре)</option>';
  } else {
    state.allBranches.forEach(b => {
      branchSelect.innerHTML += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
    });
  }

  // Populate posSelect
  posSelect.innerHTML = '<option value="">Выберите должность...</option>';
  if (!state.positions || state.positions.length === 0) {
    posSelect.innerHTML += '<option value="" disabled>Должности не найдены (создайте должность в Структуре)</option>';
  } else {
    state.positions.forEach(p => {
      posSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.title)}</option>`;
    });
  }

  document.getElementById('assign-started-at').value = new Date().toISOString().substring(0, 10);
  document.getElementById('modal-assign-employee').showModal();
}

async function deleteShift(id) {
  if (!confirm(`Удалить смену #${id}?`)) return;
  try {
    await authFetch(`${API_URL}/shifts/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Смена удалена из расписания', 'info');
    loadShiftsForSchedule(state.selectedScheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Вспомогательные функции
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

// ================= Инициализация =================
window.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initModals();

  // Быстрые кнопки на дашборде
  document.getElementById('btn-quick-add-company').addEventListener('click', () => {
    document.getElementById('modal-company').showModal();
  });
  document.getElementById('btn-add-company').addEventListener('click', () => {
    document.getElementById('modal-company').showModal();
  });

  document.getElementById('btn-quick-add-branch').addEventListener('click', () => {
    document.getElementById('modal-branch').showModal();
  });
  document.getElementById('btn-add-branch').addEventListener('click', () => {
    document.getElementById('modal-branch').showModal();
  });

  document.getElementById('btn-add-position').addEventListener('click', () => {
    document.getElementById('modal-position').showModal();
  });

  document.getElementById('btn-quick-add-employee').addEventListener('click', () => {
    document.getElementById('emp-hire').value = new Date().toISOString().substring(0, 10);
    document.getElementById('modal-employee').showModal();
  });
  document.getElementById('btn-add-employee').addEventListener('click', () => {
    document.getElementById('emp-hire').value = new Date().toISOString().substring(0, 10);
    document.getElementById('modal-employee').showModal();
  });

  document.getElementById('btn-assign-employee-branch').addEventListener('click', () => {
    openAssignEmployeeModal();
  });

  document.getElementById('btn-create-schedule').addEventListener('click', () => {
    const branchSelect = document.getElementById('sched-branch-id');
    branchSelect.innerHTML = '<option value="">Выберите филиал...</option>';
    (state.allBranches || []).forEach(b => {
      branchSelect.innerHTML += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
    });
    if (state.selectedBranchId) branchSelect.value = state.selectedBranchId;
    document.getElementById('modal-schedule').showModal();
  });

  document.getElementById('btn-create-shift').addEventListener('click', () => {
    if (!state.selectedScheduleId) {
      showToast('Сначала выберите график филиала!', 'warning');
      return;
    }
    document.getElementById('shift-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('modal-shift').showModal();
  });

  document.getElementById('btn-refresh-all').addEventListener('click', () => {
    loadDashboardStats();
    showToast('Данные обновлены', 'info');
  });

  // Фильтры и селекторы
  document.getElementById('branch-company-select').addEventListener('change', (e) => {
    state.selectedCompanyId = e.target.value;
    loadBranchesForCompany(e.target.value);
  });

  document.getElementById('schedule-branch-select').addEventListener('change', (e) => {
    state.selectedBranchId = e.target.value;
    loadSchedulesForBranch(e.target.value);
  });

  document.getElementById('schedule-list-select').addEventListener('change', (e) => {
    state.selectedScheduleId = e.target.value;
    loadShiftsForSchedule(e.target.value);
  });

  document.getElementById('filter-request-status').addEventListener('change', () => {
    loadRequests();
  });

  document.getElementById('btn-load-more-attendance').addEventListener('click', () => {
    state.attendancePage++;
    loadAttendance(false);
  });

  // Переключение создания пользователя в форме сотрудника
  document.getElementById('emp-create-user-check').addEventListener('change', (e) => {
    const fields = document.getElementById('emp-user-fields');
    fields.style.display = e.target.checked ? 'flex' : 'none';
    if (e.target.checked) {
      const name = document.getElementById('emp-name').value.trim();
      if (name && !document.getElementById('emp-user-login').value) {
        document.getElementById('emp-user-login').value = name.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      }
    }
  });

  // Кнопка создания пользователя
  document.getElementById('btn-add-user').addEventListener('click', () => {
    openAddUserModal();
  });

  // Отправка формы пользователя (создание или обновление роли)
  document.getElementById('form-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (auth.getRole() !== 'ADMIN') {
      showToast('Создавать и изменять пользователей может только супервайзер (ADMIN)', 'danger');
      return;
    }
    const userId = document.getElementById('user-id').value;
    const login = document.getElementById('user-login').value.trim();
    const roleId = Number(document.getElementById('user-role-select').value);
    const empVal = document.getElementById('user-employee-id').value;
    const employeeId = empVal ? Number(empVal) : null;
    const password = (document.getElementById('user-password')?.value || "").trim();

    const body = { login, roleId, employeeId };
    if (password) {
      body.password = password;
    } else if (!userId) {
      body.password = "1234";
    }

    try {
      if (userId) {
        await authFetch(`${API_URL}/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        }).then(handleApiResponse);
        showToast(`Пользователь "${login}" и роль обновлены`, 'success');
      } else {
        await authFetch(`${API_URL}/users`, {
          method: 'POST',
          body: JSON.stringify(body)
        }).then(handleApiResponse);
        showToast(`Пользователь "${login}" успешно создан супервайзером`, 'success');
      }

      document.getElementById('modal-user').close();
      loadUsers();
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // JWT Инспектор
  document.getElementById('btn-inspect-jwt')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-jwt-inspector');
    const rawEl = document.getElementById('jwt-raw-token');
    const bodyEl = document.getElementById('jwt-claims-body');
    if (!auth.isAuthenticated()) {
      showToast('Сначала необходимо авторизоваться', 'warning');
      openAuthModal();
      return;
    }
    rawEl.value = auth.token;
    const claims = auth.decodeToken();
    bodyEl.innerHTML = "";
    if (claims) {
      const items = [
        { claim: "sub", val: claims.sub, desc: "Логин субъекта токена (Subject)" },
        { claim: "role", val: claims.role, desc: "Системная роль пользователя (Authority)" },
        { claim: "employeeId", val: claims.employeeId ?? "null", desc: "ID привязанного сотрудника" },
        { claim: "userId", val: claims.userId ?? "null", desc: "ID учетной записи пользователя" },
        { claim: "iat", val: claims.iat ? new Date(claims.iat * 1000).toLocaleString() : "-", desc: "Время выдачи токена (Issued At)" },
        { claim: "exp", val: claims.exp ? new Date(claims.exp * 1000).toLocaleString() : "-", desc: "Срок действия токена (Expiration Time)" }
      ];
      items.forEach(it => {
        bodyEl.innerHTML += `<tr><td><code>${it.claim}</code></td><td><strong>${it.val}</strong></td><td style="color:var(--text-muted)">${it.desc}</td></tr>`;
      });
    }
    modal.showModal();
  });

  // Копирование JWT токена
  document.getElementById('btn-copy-jwt')?.addEventListener('click', () => {
    const rawEl = document.getElementById('jwt-raw-token');
    navigator.clipboard.writeText(rawEl.value).then(() => {
      showToast('JWT токен скопирован в буфер обмена!', 'success');
    }).catch(() => {
      rawEl.select();
      document.execCommand('copy');
      showToast('JWT токен скопирован!', 'success');
    });
  });

  // Выпадающее меню быстрой смены роли
  const btnQuickSwitch = document.getElementById('btn-quick-switch');
  const quickMenu = document.getElementById('quick-switch-menu');
  if (btnQuickSwitch && quickMenu) {
    btnQuickSwitch.addEventListener('click', (e) => {
      e.stopPropagation();
      quickMenu.style.display = quickMenu.style.display === 'none' ? 'flex' : 'none';
    });

    document.addEventListener('click', () => {
      quickMenu.style.display = 'none';
    });
  }

  // Обработчики кнопок быстрого входа
  document.querySelectorAll('.demo-quick-login, .demo-login-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const login = btn.dataset.login;
      const pass = btn.dataset.pass;
      try {
        await auth.login(login, pass);
        if (quickMenu) quickMenu.style.display = 'none';
        document.getElementById('modal-auth')?.close();
        showToast(`Вы успешно вошли как ${login} (${auth.getRole()})`, 'success');
        loadDashboardStats();
        loadEmployees();
        loadUsers();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  });

  // Форма ручного логина
  document.getElementById('form-auth-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = document.getElementById('auth-input-login').value.trim();
    const pass = document.getElementById('auth-input-password').value;
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) errEl.style.display = 'none';

    try {
      await auth.login(login, pass);
      document.getElementById('modal-auth')?.close();
      showToast(`Вы успешно вошли как ${login} (${auth.getRole()})`, 'success');
      loadDashboardStats();
      loadEmployees();
      loadUsers();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    }
  });

  // Кнопка Выйти
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    auth.clear();
    showToast('Вы вышли из системы', 'info');
    openAuthModal();
  });

  // Тест изоляции данных (Требование ЛР3)
  document.getElementById('btn-test-data-isolation')?.addEventListener('click', async () => {
    const resEl = document.getElementById('data-isolation-result');
    if (!resEl) return;
    resEl.textContent = "Выполняется запрос к чужим данным (GET /api/employees/1)...";
    resEl.className = "isolation-result-text";

    try {
      const res = await authFetch(`${API_URL}/employees/1`);
      if (res.ok) {
        const data = await res.json();
        resEl.textContent = `✅ 200 OK: Доступ разрешен (Роль ${auth.getRole()} имеет доступ к сотруднику: ${data.name})`;
        resEl.className = "isolation-result-text success";
      } else if (res.status === 403) {
        resEl.textContent = `⛔ 403 Forbidden: Spring Security успешно запретил доступ! "Сотрудник имеет доступ только к собственной информации"`;
        resEl.className = "isolation-result-text denied";
      } else {
        resEl.textContent = `Ответ сервера: HTTP ${res.status}`;
      }
    } catch (err) {
      resEl.textContent = `⛔ Изоляция активна: ${err.message}`;
      resEl.className = "isolation-result-text denied";
    }
  });

  // Инициализация авторизации
  auth.init();
  if (!auth.isAuthenticated()) {
    // Для максимального удобства при открытии: пробуем автовход под admin
    try {
      await auth.login("admin", "1234");
    } catch (e) {
      openAuthModal();
    }
  } else {
    updateAuthUI();
  }

  // Запуск
  await checkBackendStatus();
  await loadDashboardStats();
  setInterval(checkBackendStatus, 10000);
});

function openAuthModal(notice = "") {
  const modal = document.getElementById('modal-auth');
  if (!modal) return;
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) {
    if (notice) {
      errEl.textContent = notice;
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  }
  if (!modal.open) {
    modal.showModal();
  }
}
