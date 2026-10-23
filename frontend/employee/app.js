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

// ================= Централизованный Auth Fetch (Bearer Token) =================
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    auth.clear();
    openAuthModal('Сессия истекла или требуется авторизация (401 Unauthorized)');
    throw new Error('401 Unauthorized: требуется авторизация');
  }

  return response;
}

function updateAuthUI() {
  const usernameEl = document.getElementById('auth-username');
  const roleBadgeEl = document.getElementById('auth-role-badge');
  const avatarEl = document.getElementById('auth-avatar');

  if (!auth.isAuthenticated()) {
    if (usernameEl) usernameEl.textContent = 'Не авторизован';
    if (roleBadgeEl) {
      roleBadgeEl.className = 'badge badge-gray';
      roleBadgeEl.textContent = 'Гость';
    }
    updateRoleTabsVisibility(null);
    return;
  }

  const role = auth.getRole();
  const login = auth.getLogin();
  const empId = auth.getEmployeeId();

  if (usernameEl) usernameEl.textContent = login;
  if (avatarEl) {
    avatarEl.textContent = role === 'ADMIN' ? '👑' : (role === 'HR' ? '💼' : (role === 'MANAGER' ? '📋' : '☕'));
  }
  if (roleBadgeEl) {
    roleBadgeEl.className = `badge ${getRoleBadgeClass(role)}`;
    let roleTitle = role;
    if (role === 'ADMIN') roleTitle = '👑 ADMIN (Супервайзер)';
    else if (role === 'HR') roleTitle = '💼 HR (Кадры)';
    else if (role === 'MANAGER') roleTitle = '📋 MANAGER (Управляющий)';
    else if (role === 'EMPLOYEE') roleTitle = `☕ EMPLOYEE (Сотрудник #${empId || '?'})`;
    roleBadgeEl.textContent = roleTitle;
  }

  updateRoleTabsVisibility(role);
}

// Состояние личного кабинета и панели управления
const state = {
  currentEmployeeId: localStorage.getItem('employee_current_id') || null,
  employees: [],
  currentEmployee: null,
  currentUserAccount: null,
  activeAttendanceRecord: null,
  todayShift: null,
  todayAbsence: null,
  myShifts: [],

  // Данные для роли Управляющего / HR
  companies: [],
  branches: [],
  positions: [],
  users: [],
  mgrSelectedBranchId: null,
  mgrSelectedScheduleId: null,
  mgrAttendancePage: 0,
  mgrAttendanceHasNext: false,
};

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

// ================= Toast Уведомления =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
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

// ================= Обработка Ошибок API =================
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

// ================= Живые часы =================
function startLiveClock() {
  const clockEl = document.getElementById('live-clock');
  const dateEl = document.getElementById('live-date');

  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('ru-RU');
    dateEl.textContent = now.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  update();
  setInterval(update, 1000);
}

// ================= Видимость вкладок по ролям =================
function updateRoleTabsVisibility(roleCode) {
  const isManager = (roleCode === 'MANAGER' || roleCode === 'ADMIN');
  const isHr = (roleCode === 'HR' || roleCode === 'ADMIN');
  const isAdmin = (roleCode === 'ADMIN');

  // Вкладки менеджера
  document.querySelectorAll('.role-tab-mgr').forEach(el => {
    el.style.display = isManager ? 'inline-flex' : 'none';
  });

  // Вкладки HR
  document.querySelectorAll('.role-tab-hr').forEach(el => {
    // Если вкладка имеет оба класса (например, team-requests), показываем если менеджер или HR
    const needsBoth = el.classList.contains('role-tab-mgr') && el.classList.contains('role-tab-hr');
    if (needsBoth) {
      el.style.display = (isManager || isHr) ? 'inline-flex' : 'none';
    } else {
      el.style.display = isHr ? 'inline-flex' : 'none';
    }
  });

  // Кнопка перехода в сервисную админку (доступна только системному ADMIN)
  const adminBtn = document.getElementById('btn-open-admin-portal');
  if (adminBtn) {
    adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  // Если текущая вкладка скрыта после переключения роли, возвращаемся на первую вкладку
  const currentActiveTab = document.querySelector('.tab-btn.active');
  if (currentActiveTab && currentActiveTab.style.display === 'none') {
    const defaultTab = document.querySelector('.tab-btn[data-tab="shifts"]');
    if (defaultTab) defaultTab.click();
  }
}

// ================= Навигация по табам =================
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const targetEl = document.getElementById(`tab-${target}`);
      if (targetEl) targetEl.classList.add('active');

      // Подгрузка данных в зависимости от вкладки
      if (target === 'shifts') loadMyShifts();
      if (target === 'attendance') loadMyAttendance();
      if (target === 'requests') loadMyRequests();
      if (target === 'absences') loadMyAbsences();
      if (target === 'profile') renderProfile();

      if (target === 'mgr-shifts') loadMgrShiftsSection();
      if (target === 'mgr-attendance') loadMgrAttendance(true);
      if (target === 'team-requests') loadTeamRequests();
      if (target === 'hr-employees') loadHrEmployees();
      if (target === 'hr-users') loadHrUsers();
      if (target === 'hr-org') loadHrOrg();
    });
  });
}

// ================= Модальные окна (<dialog>) =================
function initModals() {
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const dialog = btn.closest('dialog');
      if (dialog) dialog.close();
    });
  });

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

// ================= Загрузка списка сотрудников =================
async function loadEmployeesList() {
  try {
    const res = await authFetch(`${API_URL}/employees?size=50`).then(handleApiResponse);
    const employees = Array.isArray(res) ? res : (res.content || []);
    state.employees = employees;

    const select = document.getElementById('current-user-select');
    if (select) {
      select.innerHTML = "";
      employees.forEach(emp => {
        const opt = document.createElement("option");
        opt.value = emp.id;
        opt.textContent = `${emp.name} (${emp.status})`;
        select.appendChild(opt);
      });
      if (state.currentEmployeeId && employees.some(e => e.id == state.currentEmployeeId)) {
        select.value = state.currentEmployeeId;
      }
    }

    if (!state.currentEmployeeId && auth.getEmployeeId()) {
      state.currentEmployeeId = auth.getEmployeeId();
    } else if (!state.currentEmployeeId && employees.length > 0) {
      state.currentEmployeeId = employees[0].id;
    }

    if (state.currentEmployeeId) {
      state.currentEmployee = employees.find(e => e.id == state.currentEmployeeId);
      localStorage.setItem("employee_current_id", state.currentEmployeeId);
    }

    await onEmployeeChanged(state.currentEmployeeId);
  } catch (err) {
    showToast("Статус API: " + err.message, "info");
  }
}

async function loadUserAccountForCurrentEmployee() {
  const roleBadge = document.getElementById('current-user-role-badge');
  if (!roleBadge) return;
  const role = auth.getRole() || 'EMPLOYEE';
  roleBadge.textContent = `${role}`;
  roleBadge.className = `badge ${getRoleBadgeClass(role)}`;
  updateRoleTabsVisibility(role);
}

async function onEmployeeChanged(employeeId) {
  state.currentEmployeeId = employeeId ? Number(employeeId) : (auth.getEmployeeId() || 2);
  localStorage.setItem('employee_current_id', state.currentEmployeeId);
  state.currentEmployee = state.employees.find(e => e.id == state.currentEmployeeId);

  await loadUserAccountForCurrentEmployee();

  const activeTab = document.querySelector('.tab-btn.active');
  const target = activeTab ? activeTab.dataset.tab : 'shifts';

  if (target === 'shifts') loadMyShifts();
  if (target === 'attendance') loadMyAttendance();
  if (target === 'requests') loadMyRequests();
  if (target === 'absences') loadMyAbsences();
  if (target === 'profile') renderProfile();
  if (target === 'mgr-shifts') loadMgrShiftsSection();
  if (target === 'mgr-attendance') loadMgrAttendance(true);
  if (target === 'team-requests') loadTeamRequests();
  if (target === 'hr-employees') loadHrEmployees();
  if (target === 'hr-users') loadHrUsers();
  if (target === 'hr-org') loadHrOrg();
}
// ================= 1. ЛИЧНЫЕ СМЕНЫ СОТРУДНИКА =================
async function loadMyShifts() {
  const container = document.getElementById('my-shifts-container');
  if (!state.currentEmployeeId) return;

  container.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1 / -1;">Загрузка расписания...</p>';

  try {
    const companies = await authFetch(`${API_URL}/companies`).then(handleApiResponse);
    const myShifts = [];

    for (const c of companies) {
      const branches = await authFetch(`${API_URL}/branches/company/${c.id}`).then(handleApiResponse);
      for (const b of branches) {
        const schedules = await authFetch(`${API_URL}/schedules/branch/${b.id}`).then(handleApiResponse);
        for (const s of schedules) {
          const shifts = await authFetch(`${API_URL}/shifts/schedule/${s.id}?page=0&size=50`).then(handleApiResponse);
          for (const shift of shifts) {
            if (shift.assignedEmployees && shift.assignedEmployees.some(e => e.id === state.currentEmployeeId)) {
              myShifts.push({ ...shift, branchName: b.name });
            }
          }
        }
      }
    }

    myShifts.sort((a, b) => a.date.localeCompare(b.date));
    state.myShifts = myShifts;

    container.innerHTML = '';
    if (myShifts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 30px; background: #fff; border-radius: var(--radius); border: 1px solid var(--border);">
          <p style="font-size: 16px; font-weight: 600; color: var(--text-muted);">
            У вас пока нет назначенных смен
          </p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            Обратитесь к управляющему для распределения в график смен.
          </p>
        </div>
      `;
      return;
    }

    myShifts.forEach(shift => {
      const tile = document.createElement('div');
      tile.className = 'shift-tile';
      tile.innerHTML = `
        <div class="shift-tile-date">${shift.date}</div>
        <div class="shift-tile-time">${shift.timeFrom.substring(0, 5)} — ${shift.timeTo.substring(0, 5)}</div>
        <div class="shift-tile-meta">Филиал: <strong>${escapeHtml(shift.branchName)}</strong></div>
        <div class="shift-tile-meta">Обед: ${shift.breakMinutes} минут • Смена #${shift.id}</div>
      `;
      container.appendChild(tile);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 2. ОТМЕТКА ЯВОК (CHECK-IN / OUT) =================
async function loadMyAttendance() {
  const tbody = document.getElementById('my-attendance-table-body');
  const statusText = document.getElementById('attendance-status-text');
  const banner = document.getElementById('shift-today-banner');
  const info = document.getElementById('shift-today-info');
  const btnClockIn = document.getElementById('btn-clock-in');
  const btnClockOut = document.getElementById('btn-clock-out');

  if (!state.currentEmployeeId) return;

  const todayStr = formatLocalDate(new Date());

  // 1. Проверяем статус сотрудника (уволен?)
  if (state.currentEmployee && state.currentEmployee.status === 'DISMISSED') {
    if (banner) {
      banner.style.borderColor = 'var(--danger)';
      banner.style.background = 'var(--danger-light)';
    }
    if (info) info.innerHTML = `<strong>Сотрудник уволен (DISMISSED):</strong> Доступ к отметкам явок заблокирован.`;
    statusText.textContent = 'Статус: Доступ заблокирован';
    btnClockIn.disabled = true;
    btnClockIn.style.opacity = '0.4';
    btnClockOut.disabled = true;
    btnClockOut.style.opacity = '0.4';
    return;
  }

  // 2. Проверяем утверждённые отсутствия на сегодня
  let activeAbsence = null;
  try {
    const absences = await authFetch(`${API_URL}/absences/employee/${state.currentEmployeeId}`).then(handleApiResponse);
    activeAbsence = (absences || []).find(a => todayStr >= a.dateFrom && todayStr <= a.dateTo);
  } catch (e) {}

  state.todayAbsence = activeAbsence;
  if (activeAbsence) {
    if (banner) {
      banner.style.borderColor = 'var(--warning)';
      banner.style.background = 'var(--warning-light)';
    }
    if (info) info.innerHTML = `<strong>Период отсутствия (${activeAbsence.type}):</strong> Вы освобождены от смен с ${activeAbsence.dateFrom} по ${activeAbsence.dateTo}. Фиксация явок заблокирована.`;
    statusText.textContent = `Статус: В отпуске / на больничном (${activeAbsence.type})`;
    btnClockIn.disabled = true;
    btnClockIn.style.opacity = '0.4';
    btnClockOut.disabled = true;
    btnClockOut.style.opacity = '0.4';
    return;
  }

  // 3. Проверяем, есть ли запланированная смена на сегодня
  const todayShift = (state.myShifts || []).find(s => s.date === todayStr);
  state.todayShift = todayShift;

  if (banner && info) {
    if (todayShift) {
      banner.style.borderColor = 'var(--primary)';
      banner.style.background = 'var(--primary-light)';
      info.innerHTML = `
        <strong>План на сегодня (${todayStr}):</strong> Смена с ${todayShift.timeFrom.substring(0, 5)} до ${todayShift.timeTo.substring(0, 5)}
        в филиале <strong>${escapeHtml(todayShift.branchName)}</strong> (Обед: ${todayShift.breakMinutes} мин., Смена #${todayShift.id}).
      `;
    } else {
      banner.style.borderColor = 'var(--border)';
      banner.style.background = '#ffffff';
      info.innerHTML = `
        <strong>Внимание:</strong> На сегодня (${todayStr}) у вас нет запланированной смены в расписании.
        При отметке будет зафиксирован <span class="badge badge-yellow">Внеплановый выход</span>.
      `;
    }
  }

  // 4. Загружаем историю явок и проверяем открытую смену
  try {
    const res = await authFetch(`${API_URL}/attendance/employee/${state.currentEmployeeId}`).then(handleApiResponse);
    const records = Array.isArray(res) ? res : (res.content || []);
    tbody.innerHTML = '';

    const openRecord = records.find(r => r.actualStart && !r.actualEnd);
    state.activeAttendanceRecord = openRecord;

    if (openRecord) {
      statusText.innerHTML = `Вы находитесь на смене с ${formatTime(openRecord.actualStart)}`;
      btnClockIn.disabled = true;
      btnClockIn.style.opacity = '0.5';
      btnClockOut.disabled = false;
      btnClockOut.style.opacity = '1';
    } else {
      statusText.innerHTML = todayShift ? 'Статус: Готов к началу плановой смены' : 'Статус: Готов к фиксации смены';
      btnClockIn.disabled = false;
      btnClockIn.style.opacity = '1';
      btnClockOut.disabled = true;
      btnClockOut.style.opacity = '0.5';
    }

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Записей явок пока нет</td></tr>';
      return;
    }

    records.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${r.id}</strong></td>
        <td>${formatDateTime(r.plannedStart)}</td>
        <td>${formatDateTime(r.plannedEnd)}</td>
        <td>${r.actualStart ? formatDateTime(r.actualStart) : '<span style="color: var(--warning);">Не зафиксирован</span>'}</td>
        <td>${r.actualEnd ? formatDateTime(r.actualEnd) : '<span class="badge badge-green">На смене</span>'}</td>
        <td>${r.breakMinutes} мин.</td>
        <td>${escapeHtml(r.comment || '—')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Кнопка: Начать смену (Check-in)
document.getElementById('btn-clock-in').addEventListener('click', async () => {
  if (!state.currentEmployeeId) return;

  if (state.currentEmployee && state.currentEmployee.status === 'DISMISSED') {
    showToast('Сотрудник уволен и не может фиксировать явку!', 'danger');
    return;
  }
  if (state.todayAbsence) {
    showToast(`Вы находитесь в отпуске/на больничном (${state.todayAbsence.type})!`, 'danger');
    return;
  }

  const shift = state.todayShift;
  const shiftId = shift ? shift.id : null;
  const comment = shift
    ? `Приход на плановую смену #${shift.id}`
    : 'Внеплановый выход через Личный кабинет';

  try {
    await authFetch(`${API_URL}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: state.currentEmployeeId,
        shiftId: shiftId,
        comment: comment
      })
    }).then(handleApiResponse);

    showToast('Смена успешно начата! Check-in зафиксирован.', 'success');
    loadMyAttendance();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// Кнопка: Завершить смену (Check-out)
document.getElementById('btn-clock-out').addEventListener('click', async () => {
  if (!state.activeAttendanceRecord) {
    showToast('У вас нет активной открытой смены!', 'warning');
    return;
  }

  const comment = prompt('Комментарий к смене (необязательно):', 'Смена завершена без происшествий');

  try {
    await authFetch(`${API_URL}/attendance/${state.activeAttendanceRecord.id}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        breakMinutes: 30,
        comment: comment || 'Смена завершена'
      })
    }).then(handleApiResponse);

    showToast('Смена завершена! Фактическое время ухода зафиксировано.', 'info');
    loadMyAttendance();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// ================= 3. МОИ ЗАЯВКИ (ОТПУСК/БОЛЬНИЧНЫЙ) =================
async function loadMyRequests() {
  const tbody = document.getElementById('my-requests-table-body');
  if (!state.currentEmployeeId) return;

  try {
    const res = await authFetch(`${API_URL}/requests/employee/${state.currentEmployeeId}`).then(handleApiResponse);
    const requests = Array.isArray(res) ? res : (res.content || []);
    tbody.innerHTML = '';

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Вы пока не подавали заявок</td></tr>';
      return;
    }

    requests.forEach(req => {
      let datesStr = '—';
      try {
        const data = JSON.parse(req.requestData);
        datesStr = `${data.dateFrom} — ${data.dateTo}`;
      } catch (e) {
        datesStr = req.requestData;
      }

      let badgeClass = 'badge-yellow';
      if (req.status === 'APPROVED') badgeClass = 'badge-green';
      if (req.status === 'REJECTED') badgeClass = 'badge-red';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${req.id}</strong></td>
        <td><span class="badge badge-blue">${req.type}</span></td>
        <td>${datesStr}</td>
        <td><span class="badge ${badgeClass}">${req.status}</span></td>
        <td>${escapeHtml(req.resolutionComment || 'Ожидает рассмотрения')}</td>
        <td>${formatDateTime(req.createdAt)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Отправка личной заявки
document.getElementById('form-submit-request').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentEmployeeId) return;

  const type = document.getElementById('req-type').value;
  const dateFrom = document.getElementById('req-date-from').value;
  const dateTo = document.getElementById('req-date-to').value;
  const comment = document.getElementById('req-comment').value.trim();

  if (dateFrom > dateTo) {
    showToast('Дата начала не может быть позже даты окончания!', 'danger');
    return;
  }

  const requestData = JSON.stringify({ dateFrom, dateTo, comment });

  try {
    await authFetch(`${API_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: state.currentEmployeeId,
        type,
        requestData
      })
    }).then(handleApiResponse);

    showToast('Заявка успешно отправлена на согласование!', 'success');
    document.getElementById('form-submit-request').reset();
    loadMyRequests();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

// ================= 4. МОИ ОТСУТСТВИЯ =================
async function loadMyAbsences() {
  const tbody = document.getElementById('my-absences-table-body');
  if (!state.currentEmployeeId) return;

  try {
    const absences = await authFetch(`${API_URL}/absences/employee/${state.currentEmployeeId}`).then(handleApiResponse);
    tbody.innerHTML = '';

    if (!absences || absences.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">У вас нет зафиксированных периодов отсутствия</td></tr>';
      return;
    }

    absences.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${a.id}</strong></td>
        <td><span class="badge badge-blue">${a.type}</span></td>
        <td><strong>${a.dateFrom}</strong></td>
        <td><strong>${a.dateTo}</strong></td>
        <td>${escapeHtml(a.comment || 'Согласовано')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 5. МОЙ ПРОФИЛЬ =================
async function renderProfile() {
  const el = document.getElementById('profile-details');
  const emp = state.currentEmployee;
  if (!emp) {
    el.innerHTML = 'Сотрудник не выбран';
    return;
  }

  let assignments = [];
  try {
    assignments = await authFetch(`${API_URL}/employees/${emp.id}/assignments`).then(handleApiResponse);
  } catch (e) {}

  const assignmentsHtml = (assignments && assignments.length > 0)
    ? assignments.map(a => `
        <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); margin-top: 8px;">
          Филиал: <strong>${escapeHtml(a.branchName)}</strong><br>
          Должность: <strong>${escapeHtml(a.positionTitle)}</strong><br>
          Работает с: ${a.startedAt} (${a.isPrimary ? 'Основная ставка' : 'Совместительство'})
        </div>
      `).join('')
    : '<div style="color: var(--text-muted); margin-top: 4px;">Нет активных назначений на филиалы</div>';

  const user = state.currentUserAccount;
  const userHtml = user ? `
    <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); margin-top: 8px;">
      Логин: <code>${escapeHtml(user.login)}</code><br>
      Роль в системе: <span class="badge ${getRoleBadgeClass(user.roleCode)}" style="font-weight: 600;">${user.roleName || user.roleCode} (Уровень: ${user.roleId})</span><br>
      Статус учетной записи: <span class="badge ${user.isActive ? 'badge-green' : 'badge-red'}">${user.isActive ? 'Активен' : 'Заблокирован'}</span>
    </div>
  ` : '<div style="color: var(--text-muted); margin-top: 4px;">Учётная запись не создана (обратитесь к администратору или HR)</div>';

  el.innerHTML = `
    <p><strong>ФИО:</strong> ${escapeHtml(emp.name)}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(emp.phone)}</p>
    <p><strong>Дата рождения:</strong> ${emp.birthDate || 'Не указана'}</p>
    <p><strong>Дата приема на работу:</strong> ${emp.hireDate || '—'}</p>
    <p><strong>Текущий статус:</strong> <span class="badge badge-green">${emp.status}</span></p>
    <div style="margin-top: 14px;">
      <strong>Мои ставки и должности:</strong>
      ${assignmentsHtml}
    </div>
    <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px;">
      <strong>Учётная запись и права доступа:</strong>
      ${userHtml}
    </div>
  `;
}

// ================= 6. УПРАВЛЕНИЕ: ГРАФИКИ И СМЕНЫ (MANAGER/ADMIN) =================
async function loadMgrShiftsSection() {
  const branchSelect = document.getElementById('mgr-branch-select');
  const scheduleSelect = document.getElementById('mgr-schedule-select');

  try {
    const companies = await authFetch(`${API_URL}/companies`).then(handleApiResponse);
    state.companies = companies || [];
    const allBranches = [];
    for (const c of companies) {
      const bList = await authFetch(`${API_URL}/branches/company/${c.id}`).then(handleApiResponse);
      allBranches.push(...(bList || []));
    }
    state.branches = allBranches;

    branchSelect.innerHTML = '<option value="">Выберите филиал...</option>';
    allBranches.forEach(b => {
      branchSelect.innerHTML += `<option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.address)})</option>`;
    });

    if (state.mgrSelectedBranchId) {
      branchSelect.value = state.mgrSelectedBranchId;
      loadMgrSchedulesForBranch(state.mgrSelectedBranchId);
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadMgrSchedulesForBranch(branchId) {
  const scheduleSelect = document.getElementById('mgr-schedule-select');
  scheduleSelect.innerHTML = '<option value="">Выберите график...</option>';
  if (!branchId) return;

  try {
    const schedules = await authFetch(`${API_URL}/schedules/branch/${branchId}`).then(handleApiResponse);
    (schedules || []).forEach(s => {
      scheduleSelect.innerHTML += `<option value="${s.id}">График #${s.id} (${s.dateFrom} — ${s.dateTo})</option>`;
    });

    if (schedules && schedules.length > 0) {
      scheduleSelect.value = schedules[0].id;
      state.mgrSelectedScheduleId = schedules[0].id;
      loadMgrShiftsForSchedule(schedules[0].id);
    } else {
      document.getElementById('mgr-shifts-container').innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 24px;">
          У этого филиала пока нет графиков. Нажмите «+ Создать график».
        </p>
      `;
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadMgrShiftsForSchedule(scheduleId) {
  const container = document.getElementById('mgr-shifts-container');
  if (!scheduleId) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Выберите график для отображения смен.</p>';
    return;
  }

  try {
    const res = await authFetch(`${API_URL}/shifts/schedule/${scheduleId}?page=0&size=50`);
    const totalCount = res.headers.get('X-Total-Count');
    const shifts = await handleApiResponse(res);

    container.innerHTML = '';
    if (!shifts || shifts.length === 0) {
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

function openAssignShiftModal(shiftId, shiftDate, shiftTime) {
  document.getElementById('assign-shift-id').value = shiftId;
  document.getElementById('assign-shift-details').textContent = `Смена #${shiftId} на ${shiftDate} (${shiftTime})`;

  const empSelect = document.getElementById('shift-assign-emp-id');
  empSelect.innerHTML = '<option value="">Выберите сотрудника...</option>';
  state.employees.filter(e => e.status !== 'DISMISSED').forEach(e => {
    empSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.name)}</option>`;
  });

  document.getElementById('modal-assign-shift').showModal();
}

async function removeEmployeeFromShift(shiftId, employeeId) {
  if (!confirm(`Снять сотрудника с этой смены?`)) return;
  try {
    await authFetch(`${API_URL}/shifts/${shiftId}/employees/${employeeId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorEmployeeId: state.currentEmployeeId })
    }).then(handleApiResponse);

    showToast('Сотрудник снят со смены', 'info');
    loadMgrShiftsForSchedule(state.mgrSelectedScheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteShift(shiftId) {
  if (!confirm(`Удалить смену #${shiftId}?`)) return;
  try {
    await authFetch(`${API_URL}/shifts/${shiftId}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Смена удалена из графика', 'info');
    loadMgrShiftsForSchedule(state.mgrSelectedScheduleId);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function openShiftLogsModal(shiftId) {
  const tbody = document.getElementById('shift-logs-table-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Загрузка...</td></tr>';
  document.getElementById('modal-shift-logs').showModal();

  try {
    const logs = await authFetch(`${API_URL}/shifts/${shiftId}/logs`).then(handleApiResponse);
    tbody.innerHTML = '';
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Журнал пуст</td></tr>';
      return;
    }
    logs.forEach(l => {
      const tr = document.createElement('tr');
      const actionBadge = (l.action === 'ASSIGNED')
        ? '<span class="badge badge-green">Назначен</span>'
        : '<span class="badge badge-red">Снят</span>';
      tr.innerHTML = `
        <td>${formatDateTime(l.timestamp)}</td>
        <td><strong>${escapeHtml(l.employeeName)}</strong></td>
        <td>${actionBadge}</td>
        <td>${escapeHtml(l.actorName || 'Система')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 7. УПРАВЛЕНИЕ: ТАБЕЛЬ ЯВОК (SLICE) =================
async function loadMgrAttendance(reset = false) {
  const tbody = document.getElementById('mgr-attendance-table-body');
  const btnMore = document.getElementById('btn-mgr-load-more-attendance');

  if (reset) {
    state.mgrAttendancePage = 0;
    tbody.innerHTML = '';
  }

  try {
    const res = await authFetch(`${API_URL}/attendance?page=${state.mgrAttendancePage}&size=10`).then(handleApiResponse);
    const content = res.content || [];
    state.mgrAttendanceHasNext = res.hasNext;

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

    btnMore.style.display = state.mgrAttendanceHasNext ? 'inline-block' : 'none';
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 8. СОГЛАСОВАНИЕ ЗАЯВОК (MANAGER / HR) =================
async function loadTeamRequests() {
  const tbody = document.getElementById('team-requests-table-body');
  const statusFilter = document.getElementById('team-requests-filter').value;
  const url = statusFilter ? `${API_URL}/requests?status=${statusFilter}` : `${API_URL}/requests`;

  try {
    const res = await authFetch(url).then(handleApiResponse);
    const requests = Array.isArray(res) ? res : (res.content || []);
    tbody.innerHTML = '';

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Заявок нет</td></tr>';
      return;
    }

    requests.forEach(req => {
      let datesStr = '—';
      try {
        const d = JSON.parse(req.requestData);
        datesStr = `${d.dateFrom} — ${d.dateTo}`;
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
        <td>${escapeHtml(req.resolutionComment || 'Ожидает решения')}</td>
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

function openProcessRequestModal(id, empName, type, dates) {
  document.getElementById('process-request-id').value = id;
  document.getElementById('process-request-info').innerHTML = `
    Сотрудник: <strong>${empName}</strong><br>
    Тип: <strong>${type}</strong> | Период: <strong>${dates}</strong>
  `;
  document.getElementById('process-comment').value = '';
  document.getElementById('modal-process-request').showModal();
}

// ================= 9. КАДРОВЫЙ СОСТАВ (HR / ADMIN) =================
async function loadHrEmployees() {
  const tbody = document.getElementById('hr-employees-table-body');
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

    const assignmentsMap = {};
    await Promise.all(employees.map(async emp => {
      try {
        const assigns = await authFetch(`${API_URL}/employees/${emp.id}/assignments`).then(handleApiResponse);
        assignmentsMap[emp.id] = assigns || [];
      } catch (e) {
        assignmentsMap[emp.id] = [];
      }
    }));

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

      const assignBtnHtml = emp.status !== 'DISMISSED' ? `
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
          <button class="btn btn-secondary btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px;"
                  onclick="openEditUserRoleModal(${user.id})">Изменить роль</button>
        </div>
      ` : `
        <div>
          <span style="color: var(--text-muted); font-size: 12px;">Нет аккаунта</span>
          <button class="btn btn-secondary btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; display: block;"
                  onclick="openCreateUserForEmployeeModal(${emp.id})">+ Назначить роль</button>
        </div>
      `;

      tr.innerHTML = `
        <td><strong>#${emp.id}</strong></td>
        <td><strong>${escapeHtml(emp.name)}</strong></td>
        <td>${escapeHtml(emp.phone)}</td>
        <td>${emp.hireDate || '—'}</td>
        <td><span class="badge ${statusBadge}">${emp.status}</span></td>
        <td>${roleHtml}</td>
        <td>${assignmentsHtml}${assignBtnHtml}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${emp.status !== 'DISMISSED'
              ? `<button class="btn btn-secondary btn-sm" onclick="dismissEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Уволить</button>`
              : `<button class="btn btn-primary btn-sm" onclick="rehireEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Принять на работу</button>`}
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id}, '${escapeHtml(emp.name)}')">Удалить</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
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
    showToast(`Сотрудник #${id}${label} уволен (DISMISSED)`, 'warning');
    loadHrEmployees();
    loadEmployeesList();
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
    loadHrEmployees();
    loadEmployeesList();
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
  if (!state.branches || state.branches.length === 0 || !state.positions || state.positions.length === 0) {
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
      state.branches = branches;
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
  if (!state.branches || state.branches.length === 0) {
    branchSelect.innerHTML += '<option value="" disabled>Филиалы не найдены (создайте филиал в Структуре)</option>';
  } else {
    state.branches.forEach(b => {
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

async function deleteEmployee(id, name) {
  if (!confirm(`Полностью удалить сотрудника #${id} (${name}) из базы данных?`)) return;
  try {
    await authFetch(`${API_URL}/employees/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Сотрудник удален из базы данных', 'info');
    loadHrEmployees();
    loadEmployeesList();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 10. ПОЛЬЗОВАТЕЛИ И РОЛИ (HR / ADMIN) =================
async function loadHrUsers() {
  const tbody = document.getElementById('hr-users-table-body');
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
        : '<span style="color: var(--text-muted);">Без привязки (Системный)</span>';

      tr.innerHTML = `
        <td><strong>#${u.id}</strong></td>
        <td><code>${escapeHtml(u.login)}</code></td>
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
            <button class="btn btn-secondary btn-sm" onclick="openEditUserRoleModal(${u.id})">Изменить роль</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escapeHtml(u.login)}')">Удалить</button>
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
  const modal = document.getElementById('modal-user');
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
  modal.showModal();
}

async function deleteUser(id, login) {
  if (!confirm(`Удалить учетную запись пользователя #${id} (${login})?`)) return;
  try {
    await authFetch(`${API_URL}/users/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Учетная запись пользователя удалена', 'info');
    loadHrUsers();
    loadHrEmployees();
    loadUserAccountForCurrentEmployee();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= 11. СТРУКТУРА ОРГАНИЗАЦИИ (HR / ADMIN) =================
async function loadHrOrg() {
  loadHrCompanies();
  loadHrPositions();

  const compSelect = document.getElementById('hr-branch-company-select');
  try {
    const companies = await authFetch(`${API_URL}/companies`).then(handleApiResponse);
    compSelect.innerHTML = '<option value="">Выберите компанию...</option>';
    (companies || []).forEach(c => {
      compSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    if (companies && companies.length > 0) {
      compSelect.value = companies[0].id;
      loadHrBranchesForCompany(companies[0].id);
    }
  } catch (e) {}
}

async function loadHrCompanies() {
  const tbody = document.getElementById('hr-companies-table-body');
  try {
    const res = await authFetch(`${API_URL}/companies`).then(handleApiResponse);
    const companies = Array.isArray(res) ? res : (res.content || []);
    tbody.innerHTML = '';
    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Компаний пока нет</td></tr>';
      return;
    }
    companies.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${c.id}</strong></td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteCompany(${c.id})">Удалить</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadHrPositions() {
  const tbody = document.getElementById('hr-positions-table-body');
  try {
    const positions = await authFetch(`${API_URL}/positions`).then(handleApiResponse);
    state.positions = positions || [];
    tbody.innerHTML = '';
    if (positions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Должностей пока нет</td></tr>';
      return;
    }
    positions.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${p.id}</strong></td>
        <td><strong>${escapeHtml(p.title)}</strong></td>
        <td><button class="btn btn-danger btn-sm" onclick="deletePosition(${p.id})">Удалить</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadHrBranchesForCompany(companyId) {
  const tbody = document.getElementById('hr-branches-table-body');
  if (!companyId) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Выберите компанию</td></tr>';
    return;
  }
  try {
    const branches = await authFetch(`${API_URL}/branches/company/${companyId}`).then(handleApiResponse);
    tbody.innerHTML = '';
    if (!branches || branches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Филиалов пока нет</td></tr>';
      return;
    }
    branches.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${b.id}</strong></td>
        <td><strong>${escapeHtml(b.name)}</strong></td>
        <td>${escapeHtml(b.address)}</td>
        <td>${escapeHtml(b.phone || '—')}</td>
        <td><span class="badge ${b.isActive ? 'badge-green' : 'badge-red'}">${b.isActive ? 'Работает' : 'Закрыт'}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteBranch(${b.id})">Удалить</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteCompany(id) {
  if (!confirm(`Удалить компанию #${id}? Все связанные филиалы также будут удалены.`)) return;
  try {
    await authFetch(`${API_URL}/companies/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Компания удалена', 'info');
    loadHrOrg();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deletePosition(id) {
  if (!confirm(`Удалить должность #${id}?`)) return;
  try {
    await authFetch(`${API_URL}/positions/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Должность удалена', 'info');
    loadHrPositions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteBranch(id) {
  if (!confirm(`Удалить филиал #${id}?`)) return;
  try {
    await authFetch(`${API_URL}/branches/${id}`, { method: 'DELETE' }).then(handleApiResponse);
    showToast('Филиал удален', 'info');
    const compSelect = document.getElementById('hr-branch-company-select');
    loadHrBranchesForCompany(compSelect.value);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ================= ФОРМЫ И МОДАЛЬНЫЕ ОБРАБОТЧИКИ =================
function initManagementFormListeners() {
  // Переключение создания учетной записи в форме нового сотрудника
  const createUserCheck = document.getElementById('emp-create-user-check');
  if (createUserCheck) {
    createUserCheck.addEventListener('change', (e) => {
      const fields = document.getElementById('emp-user-fields');
      fields.style.display = e.target.checked ? 'flex' : 'none';
      if (e.target.checked) {
        const name = document.getElementById('emp-name').value.trim();
        if (name && !document.getElementById('emp-user-login').value) {
          document.getElementById('emp-user-login').value = name.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        }
      }
    });
  }

  // Создание сотрудника
  document.getElementById('form-employee').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('emp-name').value.trim();
    let phone = document.getElementById('emp-phone').value.trim();
    phone = phone.replace(/[\s\(\)\-]/g, '');
    if (!phone.startsWith('+')) {
      if (phone.startsWith('8')) phone = '+7' + phone.substring(1);
      else phone = '+7' + phone;
    }
    const birthDate = document.getElementById('emp-birth').value || null;
    const hireDate = document.getElementById('emp-hire').value || new Date().toISOString().substring(0, 10);

    try {
      const newEmp = await authFetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, birthDate, hireDate, status: 'ACTIVE' })
      }).then(handleApiResponse);

      showToast(`Сотрудник "${name}" зарегистрирован!`, 'success');

      // Создание учетной записи если отмечено
      const makeUser = document.getElementById('emp-create-user-check').checked;
      if (makeUser && newEmp && newEmp.id) {
        const login = document.getElementById('emp-user-login').value.trim();
        const roleId = Number(document.getElementById('emp-user-role').value);
        if (login) {
          try {
            await authFetch(`${API_URL}/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employeeId: newEmp.id, roleId, login })
            }).then(handleApiResponse);
            showToast(`Учетная запись (${login}) создана`, 'success');
          } catch (uErr) {
            showToast(`Сотрудник создан, но ошибка аккаунта: ${uErr.message}`, 'warning');
          }
        }
      }

      document.getElementById('modal-employee').close();
      document.getElementById('form-employee').reset();
      document.getElementById('emp-user-fields').style.display = 'none';
      loadHrEmployees();
      loadEmployeesList();
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

      showToast('Сотрудник привязан к ставке!', 'success');
      document.getElementById('modal-assign-employee').close();
      loadHrEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Создание / Обновление пользователя
  document.getElementById('form-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('user-id').value;
    const login = document.getElementById('user-login').value.trim();
    const roleId = Number(document.getElementById('user-role-select').value);
    const empVal = document.getElementById('user-employee-id').value;
    const employeeId = empVal ? Number(empVal) : null;

    try {
      if (userId) {
        await authFetch(`${API_URL}/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, roleId, employeeId })
        }).then(handleApiResponse);
        showToast(`Пользователь "${login}" обновлен`, 'success');
      } else {
        await authFetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, roleId, employeeId })
        }).then(handleApiResponse);
        showToast(`Пользователь "${login}" создан`, 'success');
      }

      document.getElementById('modal-user').close();
      loadHrUsers();
      loadHrEmployees();
      loadUserAccountForCurrentEmployee();
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

    if (dateFrom > dateTo) {
      showToast('Дата начала графика не может быть позже окончания!', 'danger');
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: Number(branchId), dateFrom, dateTo })
      }).then(handleApiResponse);

      showToast(`График #${res.id} создан!`, 'success');
      document.getElementById('modal-schedule').close();
      loadMgrSchedulesForBranch(branchId);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Создание смены
  document.getElementById('form-shift').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.mgrSelectedScheduleId) return;

    const date = document.getElementById('shift-date').value;
    const timeFrom = document.getElementById('shift-time-from').value + ':00';
    const timeTo = document.getElementById('shift-time-to').value + ':00';
    const breakMinutes = Number(document.getElementById('shift-break').value) || 0;

    try {
      await authFetch(`${API_URL}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: state.mgrSelectedScheduleId,
          date,
          timeFrom,
          timeTo,
          breakMinutes
        })
      }).then(handleApiResponse);

      showToast('Смена успешно создана!', 'success');
      document.getElementById('modal-shift').close();
      loadMgrShiftsForSchedule(state.mgrSelectedScheduleId);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Назначение сотрудника на смену
  document.getElementById('form-assign-shift').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shiftId = document.getElementById('assign-shift-id').value;
    const employeeId = document.getElementById('shift-assign-emp-id').value;

    try {
      await authFetch(`${API_URL}/shifts/${shiftId}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: Number(employeeId),
          actorEmployeeId: state.currentEmployeeId
        })
      }).then(handleApiResponse);

      showToast('Сотрудник назначен на смену!', 'success');
      document.getElementById('modal-assign-shift').close();
      loadMgrShiftsForSchedule(state.mgrSelectedScheduleId);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Резолюция по заявке сотрудника
  document.getElementById('form-process-request').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('process-request-id').value;
    const status = document.getElementById('process-decision').value;
    const comment = document.getElementById('process-comment').value.trim();

    try {
      await authFetch(`${API_URL}/requests/${id}/resolution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolverEmployeeId: state.currentEmployeeId,
          status,
          resolutionComment: comment || (status === 'APPROVED' ? 'Одобрено' : 'Отклонено')
        })
      }).then(handleApiResponse);

      showToast(status === 'APPROVED' ? 'Заявка одобрена!' : 'Заявка отклонена', 'info');
      document.getElementById('modal-process-request').close();
      loadTeamRequests();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

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
      showToast('Компания создана', 'success');
      document.getElementById('modal-company').close();
      document.getElementById('form-company').reset();
      loadHrCompanies();
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
      showToast('Должность создана', 'success');
      document.getElementById('modal-position').close();
      document.getElementById('form-position').reset();
      loadHrPositions();
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
      showToast('Филиал создан', 'success');
      document.getElementById('modal-branch').close();
      document.getElementById('form-branch').reset();
      const compSelect = document.getElementById('hr-branch-company-select');
      if (compSelect.value == companyId) {
        loadHrBranchesForCompany(companyId);
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Кнопки открытия модалок
  document.getElementById('btn-hr-add-emp').addEventListener('click', () => {
    document.getElementById('emp-hire').value = new Date().toISOString().substring(0, 10);
    document.getElementById('modal-employee').showModal();
  });

  document.getElementById('btn-hr-assign-emp').addEventListener('click', () => {
    openAssignEmployeeModal();
  });

  document.getElementById('btn-hr-add-user').addEventListener('click', () => {
    openAddUserModal();
  });

  document.getElementById('btn-hr-add-company').addEventListener('click', () => {
    document.getElementById('modal-company').showModal();
  });

  document.getElementById('btn-hr-add-position').addEventListener('click', () => {
    document.getElementById('modal-position').showModal();
  });

  document.getElementById('btn-hr-add-branch').addEventListener('click', () => {
    const compSelect = document.getElementById('modal-branch-company-select');
    compSelect.innerHTML = '<option value="">Выберите компанию...</option>';
    (state.companies || []).forEach(c => {
      compSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    document.getElementById('modal-branch').showModal();
  });

  document.getElementById('hr-branch-company-select').addEventListener('change', (e) => {
    loadHrBranchesForCompany(e.target.value);
  });

  document.getElementById('btn-mgr-create-sched').addEventListener('click', () => {
    const branchSelect = document.getElementById('sched-branch-id');
    branchSelect.innerHTML = '<option value="">Выберите филиал...</option>';
    (state.branches || []).forEach(b => {
      branchSelect.innerHTML += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
    });
    if (state.mgrSelectedBranchId) branchSelect.value = state.mgrSelectedBranchId;
    document.getElementById('modal-schedule').showModal();
  });

  document.getElementById('btn-mgr-create-shift').addEventListener('click', () => {
    if (!state.mgrSelectedScheduleId) {
      showToast('Сначала выберите график филиала!', 'warning');
      return;
    }
    document.getElementById('shift-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('modal-shift').showModal();
  });

  document.getElementById('mgr-branch-select').addEventListener('change', (e) => {
    state.mgrSelectedBranchId = e.target.value;
    loadMgrSchedulesForBranch(e.target.value);
  });

  document.getElementById('mgr-schedule-select').addEventListener('change', (e) => {
    state.mgrSelectedScheduleId = e.target.value;
    loadMgrShiftsForSchedule(e.target.value);
  });

  document.getElementById('team-requests-filter').addEventListener('change', () => {
    loadTeamRequests();
  });

  document.getElementById('btn-mgr-load-more-attendance').addEventListener('click', () => {
    state.mgrAttendancePage++;
    loadMgrAttendance(false);
  });
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

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoString;
  }
}

// ================= Инициализация =================
window.addEventListener('DOMContentLoaded', async () => {
  startLiveClock();
  initTabs();
  initModals();
  initManagementFormListeners();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const df = document.getElementById('req-date-from');
  const dt = document.getElementById('req-date-to');
  if (df) df.value = formatLocalDate(tomorrow);
  if (dt) dt.value = formatLocalDate(nextWeek);

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
        { claim: "sub", val: claims.sub, desc: "Логин пользователя" },
        { claim: "role", val: claims.role, desc: "Системная роль (Authority)" },
        { claim: "employeeId", val: claims.employeeId ?? "null", desc: "ID привязанного сотрудника" },
        { claim: "userId", val: claims.userId ?? "null", desc: "ID учетной записи" },
        { claim: "iat", val: claims.iat ? new Date(claims.iat * 1000).toLocaleString() : "-", desc: "Время выдачи токена" },
        { claim: "exp", val: claims.exp ? new Date(claims.exp * 1000).toLocaleString() : "-", desc: "Срок действия токена" }
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
        state.currentEmployeeId = auth.getEmployeeId() || 2;
        await onEmployeeChanged(state.currentEmployeeId);
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
      state.currentEmployeeId = auth.getEmployeeId() || 2;
      await onEmployeeChanged(state.currentEmployeeId);
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
    showToast('Вы вышли из учетной записи', 'info');
    openAuthModal();
  });

  // Тест изоляции данных (Требование ЛР3)
  document.getElementById('btn-test-data-isolation')?.addEventListener('click', async () => {
    const resEl = document.getElementById('data-isolation-result');
    if (!resEl) return;
    resEl.textContent = "Выполняется запрос к чужому сотруднику ID=1 (GET /api/employees/1)...";
    resEl.className = "isolation-result-text";

    try {
      const res = await authFetch(`${API_URL}/employees/1`);
      if (res.ok) {
        const data = await res.json();
        resEl.textContent = `✅ 200 OK: Доступ разрешен (Роль ${auth.getRole()} имеет доступ к сотруднику ${data.name})`;
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
    // Автоматический вход под barista_dmitry при первом открытии кабинета сотрудника
    try {
      await auth.login("barista_dmitry", "password123");
    } catch (e) {
      openAuthModal();
    }
  } else {
    updateAuthUI();
  }

  state.currentEmployeeId = auth.getEmployeeId() || 2;
  await loadEmployeesList();
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
