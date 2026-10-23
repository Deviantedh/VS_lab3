-- ===================================================================
-- seed_data.sql
-- Демонстрационные данные для Системы управления сотрудниками
-- ===================================================================

-- Очистка таблиц перед заполнением (с сохранением структуры и Flyway)
TRUNCATE TABLE 
    shift_employee_logs,
    shift_employees,
    attendance_records,
    employee_absences,
    requests,
    shifts,
    schedules,
    employee_assignments,
    users,
    employees,
    positions,
    branches,
    companies
RESTART IDENTITY CASCADE;

-- 1. Компании
INSERT INTO companies (name, created_at, updated_at) VALUES
    ('ITMO Coffee Group', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Северная Пальмира Ритейл', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. Филиалы
INSERT INTO branches (company_id, name, address, phone, is_active, created_at, updated_at) VALUES
    (1, 'Флагман на Кронверкском', 'Кронверкский пр., д. 49, лит. А', '+7 (812) 111-22-33', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, 'Точка на Ломоносова', 'ул. Ломоносова, д. 9', '+7 (812) 222-33-44', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, 'Кофейня на Грибоедова', 'наб. канала Грибоедова, д. 30', '+7 (812) 333-44-55', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 'Супермаркет на Биржевой', 'Биржевая линия, д. 14', '+7 (812) 444-55-66', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Должности
INSERT INTO positions (title, created_at, updated_at) VALUES
    ('Управляющий филиалом', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Старший бариста', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Бариста', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Кассир-администратор', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('HR-специалист', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. Сотрудники
INSERT INTO employees (name, phone, birth_date, hire_date, status, created_at, updated_at) VALUES
    ('Смирнов Алексей Викторович', '+79991112233', '1995-04-12', '2023-01-10', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Иванов Дмитрий Сергеевич', '+79992223344', '1998-08-23', '2023-03-15', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Карамышева Анастасия Павловна', '+79993334455', '2001-11-05', '2023-06-01', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Кузнецова Екатерина Олеговна', '+79994445566', '2000-02-18', '2023-09-01', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Соколов Максим Андреевич', '+79995556677', '1997-07-29', '2024-01-15', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Морозова Ольга Дмитриевна', '+79996667788', '1996-12-04', '2022-11-20', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Петров Иван Николаевич', '+79997778899', '1999-05-14', '2024-02-01', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 5. Учетные записи пользователей (users)
INSERT INTO users (employee_id, role_id, login, password_hash, is_active, created_at, updated_at) VALUES
    (1, 0, 'admin', '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (6, 1, 'hr_morozova', '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (5, 2, 'manager_sokolov', '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 3, 'barista_dmitry', '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 3, 'barista_anastasia', '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 6. Назначения сотрудников на точки и должности (employee_assignments)
INSERT INTO employee_assignments (employee_id, branch_id, position_id, started_at, is_primary, created_at) VALUES
    (1, 1, 1, '2023-01-10', TRUE, CURRENT_TIMESTAMP),
    (2, 1, 2, '2023-03-15', TRUE, CURRENT_TIMESTAMP),
    (3, 1, 3, '2023-06-01', TRUE, CURRENT_TIMESTAMP),
    (4, 2, 3, '2023-09-01', TRUE, CURRENT_TIMESTAMP),
    (5, 2, 1, '2024-01-15', TRUE, CURRENT_TIMESTAMP),
    (6, 1, 5, '2022-11-20', TRUE, CURRENT_TIMESTAMP),
    (7, 3, 4, '2024-02-01', TRUE, CURRENT_TIMESTAMP);

-- 7. Расписания по филиалам (schedules)
INSERT INTO schedules (branch_id, date_from, date_to, created_by, created_at, updated_at) VALUES
    (1, '2026-10-01', '2026-10-31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, '2026-10-01', '2026-10-31', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 8. Плановые смены (shifts)
INSERT INTO shifts (schedule_id, date, time_from, time_to, break_minutes, created_at, updated_at) VALUES
    (1, CURRENT_DATE, '08:00:00', '16:00:00', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, CURRENT_DATE, '16:00:00', '23:00:00', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, CURRENT_DATE + INTERVAL '1 day', '08:00:00', '16:00:00', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, CURRENT_DATE + INTERVAL '1 day', '16:00:00', '23:00:00', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, CURRENT_DATE, '09:00:00', '18:00:00', 45, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 9. Назначение сотрудников на смены (shift_employees)
INSERT INTO shift_employees (shift_id, employee_id) VALUES
    (1, 2),
    (1, 3),
    (2, 2),
    (3, 3),
    (5, 4);

-- 10. Аудит-лог изменений состава смен (shift_employee_logs)
INSERT INTO shift_employee_logs (shift_id, employee_id, action, created_by, created_at) VALUES
    (1, 2, 'ASSIGNED', 1, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (1, 3, 'ASSIGNED', 1, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (2, 2, 'ASSIGNED', 1, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (5, 4, 'ASSIGNED', 5, CURRENT_TIMESTAMP - INTERVAL '1 day');

-- 11. Записи явки / факт (attendance_records)
INSERT INTO attendance_records (employee_id, shift_id, planned_start, planned_end, actual_start, actual_end, break_minutes, late_minutes, overtime_minutes, comment, created_at, updated_at) VALUES
    (2, 1, CURRENT_DATE + TIME '08:00:00', CURRENT_DATE + TIME '16:00:00', CURRENT_DATE + TIME '08:05:00', CURRENT_DATE + TIME '16:00:00', 30, 5, 0, 'Небольшое опоздание из-за пробок', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 1, CURRENT_DATE + TIME '08:00:00', CURRENT_DATE + TIME '16:00:00', CURRENT_DATE + TIME '07:55:00', CURRENT_DATE + TIME '16:30:00', 30, 0, 30, 'Задержалась для передачи смены', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (4, 5, CURRENT_DATE + TIME '09:00:00', CURRENT_DATE + TIME '18:00:00', CURRENT_DATE + TIME '09:00:00', NULL, 0, 0, 0, 'Смена в процессе выполнения', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 12. Универсальные заявки (requests)
INSERT INTO requests (employee_id, type, status, request_data, processed_by, processed_at, resolution_comment, created_at, updated_at) VALUES
    (2, 'VACATION', 'APPROVED', '{"dateFrom": "2026-10-20", "dateTo": "2026-10-27"}'::jsonb, 6, CURRENT_TIMESTAMP - INTERVAL '2 days', 'Одобрено HR Морозовой О.Д.', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP),
    (4, 'DAY_OFF', 'PENDING', '{"date": "2026-10-15", "reason": "Семейные обстоятельства"}'::jsonb, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (7, 'CERTIFICATE', 'APPROVED', '{"certificateType": "2-NDFL", "purpose": "В банк"}'::jsonb, 6, CURRENT_TIMESTAMP - INTERVAL '1 day', 'Справка 2-НДФЛ подготовлена', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP);

-- 13. Зафиксированные отсутствия (employee_absences)
INSERT INTO employee_absences (employee_id, request_id, type, date_from, date_to, comment, created_at) VALUES
    (2, 1, 'VACATION', '2026-10-20', '2026-10-27', 'Плановый ежегодный оплачиваемый отпуск', CURRENT_TIMESTAMP);
