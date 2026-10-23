#!/usr/bin/env bash

cd "$(dirname "$0")"

echo "   Остановка сервисов СУС (ЛР №3)..."

echo "[1/2] Остановка веб-серверов фронтенда (порты 3000 и 3001)..."
if [ -f .frontend.pid ]; then
    PID=$(cat .frontend.pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        echo "Фронтенд-сервер (PID: $PID) остановлен."
    fi
    rm -f .frontend.pid
else
    pkill -f "node frontend/server.js" 2>/dev/null && echo "Процессы фронтенда завершены."
fi

echo "[2/2] Остановка Docker контейнеров..."
docker compose down

echo ""
echo "ВСЕ СЕРВИСЫ УСПЕШНО ОСТАНОВЛЕНЫ!"
echo "Все данные в БД надёжно сохранены в томе postgres_data."

