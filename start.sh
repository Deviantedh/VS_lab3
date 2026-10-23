#!/usr/bin/env bash

# Переходим в директорию скрипта (корень проекта lab3)
cd "$(dirname "$0")"

# Отключаем строгую проверку прав файловой системы Buildx для путей с кириллицей
export BUILDX_BAKE_ENTITLEMENTS_FS=0


echo "   Запуск микросервисов СУС WFM (ЛР №3, Spring Boot 3)..."


# Проверка Docker
if ! docker info >/dev/null 2>&1; then
    echo "ВНИМАНИЕ: Docker не запущен! Пожалуйста, запустите Docker Desktop и повторите попытку."
    exit 1
fi

# Запуск Docker Compose (PostgreSQL, Eureka, Config, Gateway, Микросервисы)
echo "[1/2] Запуск контейнеров Docker (PostgreSQL 16 + Eureka + Gateway + 3 сервиса)..."
docker compose up -d "$@"

# Запуск Frontend-сервера (Порты 3000 и 3001)
echo "[2/2] Запуск фронтенд-серверов..."
if [ -f .frontend.pid ] && kill -0 "$(cat .frontend.pid)" 2>/dev/null; then
    echo "Фронтенд-сервер уже запущен (PID: $(cat .frontend.pid))."
else
    node frontend/server.js > .frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > .frontend.pid
    echo "Фронтенд успешно запущен в фоне (PID: $FRONTEND_PID)."
fi

echo ""

echo "ВСЕ СЕРВИСЫ ЛР №3 УСПЕШНО ЗАПУЩЕНЫ!"

echo "Панель Администратора (Admin / HR / Manager): http://localhost:3000"
echo "Кабинет Сотрудника (Employee Self-Service):  http://localhost:3001"
echo "API Gateway (REST API & JWT Auth):          http://localhost:8080/api"
echo "Swagger UI Документация API:                http://localhost:8080/swagger-ui.html"
echo "Eureka Discovery Dashboard:                 http://localhost:8761"
echo "Config Server:                              http://localhost:8888"
echo "PostgreSQL База данных:                     localhost:5432 (portal_db)"
echo "--------------------------------------------------------"
echo "ТЕСТОВЫЕ АККАУНТЫ (пароль для ВСЕХ: 1234):"
echo "   - admin            (Супервайзер / ADMIN)"
echo "   - hr_morozova      (Специалист по кадрам / HR)"
echo "   - manager_sokolov  (Управляющий филиалом / MANAGER)"
echo "   - barista_dmitry   (Бариста / EMPLOYEE #2)"
echo "   - barista_anastasia(Бариста / EMPLOYEE #3)"
echo "--------------------------------------------------------"
echo "Для остановки сервисов выполните: ./stop.sh"

