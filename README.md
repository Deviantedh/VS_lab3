# REST API Системы управления сотрудниками (Микросервисы + JWT Безопасность)

> Распределённый бэкенд на **Spring Boot 4.1.1 / Spring Cloud 2025.1.3 / Spring Security 6 / Java 21 LTS**, реализующий микросервисную архитектуру с аутентификацией по стандарту **JWT Bearer**, ролевой моделью (**RBAC**), изоляцией пользовательских данных, хэшированием паролей **BCrypt**, Service Discovery, Config Server, API Gateway и реактивным стеком.
> 
> **Лабораторная работа №3** по дисциплине «Высокопроизводительные системы».

---

## 📌 Содержание
1. [Архитектура системы и безопасность](#-архитектура-системы-и-безопасность)
2. [Обзор модулей и сервисов](#-обзор-модулей-и-сервисов)
3. [Реализация требований ТЗ Лабораторной №3](#-реализация-требований-тз-лабораторной-3)
4. [Клиентские интерфейсы (Frontend)](#-клиентские-интерфейсы-frontend)
5. [Интерактивная документация (Swagger UI)](#-интерактивная-документация-swagger-ui)
6. [Быстрый старт и запуск](#-быстрый-старт-и-запуск)
7. [Тестирование и покрытие кода](#-тестирование-и-покрытие-кода)

---

## 🏛 Архитектура системы и безопасность

```
                              [ Клиент / Frontend / Swagger UI ]
                                              │ :8080
                                              │ (Authorization: Bearer <JWT>)
                                              ▼
                                   ┌──────────────────────┐
                                   │   Gateway Service    │
                                   │(Spring Cloud Gateway)│
                                   └──────────┬───────────┘
                                              │ (lb:// routes)
               ┌──────────────────────────────┼──────────────────────────────┐
               │ :8081                        │ :8082                        │ :8083
               ▼                              ▼                              ▼
    ┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
    │   Employee Service   │◄──────┤  Attendance Service  │       │   Schedule Service   │
    │ (Spring Security JWT │ Feign │   (Reactor + R2DBC)  │       │ (Reactor + JPA + CB) │
    │  + JPA + BCrypt)     │  + CB └──────────┬───────────┘       └──────────┬───────────┘
    └──────────┬───────────┘                  │                              │
               │                              ▼                              ▼
               ▼                   [ PostgreSQL (R2DBC) ]         [ PostgreSQL (JPA) ]
     [ PostgreSQL (JPA) ]
               ▲                              ▲                              ▲
               └──────────────────────────────┼──────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
             ┌─────────────────┐                             ┌─────────────────┐
             │Discovery Service│                             │ Config Service  │
             │ (Eureka Server) │                             │ (Config Server) │
             │      :8761      │                             │      :8888      │
             └─────────────────┘                             └─────────────────┘
```

---

## 📦 Обзор модулей и сервисов

| Модуль | Порт | Стек / Технологии | Назначение |
| :--- | :---: | :--- | :--- |
| **`common-dto`** | — | Jackson, Jakarta Validation, Swagger Annotations | Библиотека DTO, `AuthDto` (логин/ответ с токеном), `UserDto`, Enums (`RoleCode`, `EmployeeStatus`, `RequestType`) и `SliceResponse`. |
| **`discovery-service`** | `8761` | Netflix Eureka Server, Spring Boot Actuator | Service Discovery: единый реестр адресов и инстансов микросервисов. |
| **`config-service`** | `8888` | Spring Cloud Config Server, Native Profile | Централизованное хранилище конфигураций (`config-repo/`) для всех сервисов. |
| **`gateway-service`** | `8080` | Spring Cloud Gateway (MVC), Springdoc OpenAPI | Единая точка входа в систему, маршрутизация запросов к микросервисам по Eureka-именам (`lb://`), проброс CORS и агрегация Swagger UI. |
| **`employee-service`** | `8081` | **Spring Security, JJWT, BCrypt, Spring Data JPA, Flyway** | Ядро безопасности и оргструктуры: аутентификация (`POST /api/auth/login`), профиль (`GET /api/auth/me`), RBAC контроль доступа, хэширование паролей, компании, филиалы, должности, сотрудники и учетные записи. |
| **`attendance-service`** | `8082` | Spring WebFlux, Reactor, Spring Data R2DBC, PostgreSQL R2DBC | Учет фактического рабочего времени: фиксация явок (`Check-In` / `Check-Out`), реактивная лента посещений. |
| **`schedule-service`** | `8083` | Spring WebFlux, Reactor, Spring Data JPA, OpenFeign, Resilience4j | Управление расписаниями и сменами: мосты `boundedElastic()`, вызовы `EmployeeClient` с Circuit Breaker. |

---

## 🛡️ Реализация требований ТЗ Лабораторной №3

1. **Авторизация Spring Security + JWT:**
   - Подключены `spring-boot-starter-security` и библиотека `jjwt` (0.12.6).
   - Настроен [`SecurityConfig`](employee-service/src/main/java/portal/employee/security/SecurityConfig.java) со `STATELESS`-сессиями.
   - Фильтр [`JwtAuthenticationFilter`](employee-service/src/main/java/portal/employee/security/JwtAuthenticationFilter.java) перехватывает хедер `Authorization: Bearer <token>`, валидирует подпись HMAC-SHA256 через [`JwtService`](employee-service/src/main/java/portal/employee/security/JwtService.java) и устанавливает контекст аутентификации [`UserPrincipal`](employee-service/src/main/java/portal/employee/security/UserPrincipal.java).
   - Эндпоинт получения токена: `POST /api/auth/login` в [`AuthController`](employee-service/src/main/java/portal/employee/controller/AuthController.java).

2. **Ролевая модель (RBAC):**
   - 4 системные роли:
     * `ADMIN (0)` — супервайзер / системный администратор;
     * `HR (1)` — специалист по персоналу;
     * `MANAGER (2)` — управляющий филиалом;
     * `EMPLOYEE (3)` — линейный персонал.
   - Разграничение прав на уровне `SecurityFilterChain` и аннотаций `@PreAuthorize`:
     * Управление справочниками: `ADMIN`, `HR`, `MANAGER`;
     * Прием, увольнение и редактирование сотрудников: только `ADMIN` и `HR`;
     * Назначение на смены и филиалы: `ADMIN`, `HR`, `MANAGER`;
     * Создание учетных записей: **только супервайзер (`ADMIN`)**.

3. **Логика методов зависит от текущего пользователя (Изоляция данных):**
   - **`GET /api/users`**: `ADMIN` и `HR` видят всех пользователей; `EMPLOYEE` видит **только свой профиль**.
   - **`GET /api/users/{id}`** и **`GET /api/users/by-login/{login}`**: сотрудник получает `403 Forbidden` при попытке открыть чужой аккаунт.
   - **`GET /api/employees/{id}`** и **`GET /api/employees/{id}/assignments`**: линейный сотрудник (`EMPLOYEE`) видит исключительно свои данные и свои смены. Доступ к чужим записям пресекается с кодом `403 Forbidden`.

4. **Защита паролей (сокрытие из ответов):**
   - В `UserDto.Request` поле `password` помечено `@JsonProperty(access = Access.WRITE_ONLY)`.
   - В `UserDto.Response` полей пароля нет вовсе — пароли не утекают в HTTP-ответах.

5. **Все пароли хранятся в хэшированном виде:**
   - Используется `BCryptPasswordEncoder`.
   - В `UserService` пароли хэшируются при создании и обновлении: `passwordEncoder.encode(...)`.
   - В миграции Flyway `V3__set_default_passwords.sql` и `seed_data.sql` дефолтные пароли сохранены в виде BCrypt-хэшей.

6. **Создание пользователей разрешено только супервайзерам:**
   - В `SecurityConfig`: `.requestMatchers(HttpMethod.POST, "/api/users").hasRole("ADMIN")`.
   - В `UserController`: `@PostMapping @PreAuthorize("hasRole('ADMIN')")`.

---

## 💻 Клиентские интерфейсы (Frontend)

Для удобной демонстрации и тестирования всех сценариев реализованы два веб-интерфейса на чистом JavaScript/HTML5:

* **Панель управления (Admin / HR / Manager):** [http://localhost:3000](http://localhost:3000)
* **Кабинет сотрудника (Employee Self-Service):** [http://localhost:3001](http://localhost:3001)

### Демонстрационные аккаунты (1-клик вход):
| Логин | Пароль | Роль | Описание для защиты |
| :--- | :---: | :---: | :--- |
| **`admin`** | `admin123` | `ADMIN` (Супервайзер) | Полный доступ, создание и удаление учетных записей пользователей |
| **`hr_morozova`** | `password123` | `HR` (Кадры) | Управление сотрудниками, согласование отпусков |
| **`manager_sokolov`** | `password123` | `MANAGER` (Управляющий) | Планирование расписаний, смен и табель явок |
| **`barista_dmitry`** | `password123` | `EMPLOYEE` | Линейный бариста (ID #2): просмотр личных смен, отметка явок |
| **`barista_anastasia`** | `password123` | `EMPLOYEE` | Линейный бариста (ID #3): отпуска, подача заявок |

В обоих интерфейсах встроены:
* **Инспектор JWT токена:** позволяет скопировать Bearer-токен и просмотреть расшифрованные клеймы (`sub`, `role`, `employeeId`, `exp`).
* **Кнопка проверки изоляции данных:** отправляет запрос к чужому сотруднику ID #1 и наглядно демонстрирует ответ `403 Forbidden` для роли `EMPLOYEE`.

---

## 📖 Интерактивная документация (Swagger UI)

* **Единый Swagger UI:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
* В правом верхнем углу доступна кнопка **Authorize** для ввода Bearer JWT токена.
* В выпадающем списке доступно переключение между микросервисами:
  * **Employee Service** (`/v3/api-docs/employee-service`)
  * **Attendance Service (R2DBC)** (`/v3/api-docs/attendance-service`)
  * **Schedule Service (WebFlux + JPA)** (`/v3/api-docs/schedule-service`)

---

## 🚀 Быстрый старт и запуск

### 1. Поднятие базы данных (для локального запуска из IDE):
```bash
docker compose up -d postgres
```

### 2. Запуск всей системы в Docker Compose:
```bash
docker compose up --build
```

### 3. Запуск фронтенд-интерфейсов:
```bash
node frontend/server.js
```
Интерфейсы откроются на `http://localhost:3000` и `http://localhost:3001`.

### 4. Остановка системы:
```bash
docker compose down
```

---

## 🧪 Тестирование и покрытие кода

Все тесты запускаются через Maven Wrapper:

```bash
# Быстрый прогон тестов во всех микросервисах
./mvnw test

# Запуск тестов со сбором JaCoCo покрытия
./run-tests-with-coverage.sh
```

В `employee-service` написан полный сьют тестов безопасности:
* `SecurityIntegrationTest`: проверка сквозной аутентификации, 401 Unauthorized без токена, 403 Forbidden при нехватке прав, изоляции данных;
* `JwtServiceTest`, `JwtAuthenticationFilterTest`, `UserPrincipalTest`, `SecurityConfigTest`;
* `AuthControllerTest`, `AuthServiceTest`, `UserControllerTest`, `EmployeeControllerTest`.

