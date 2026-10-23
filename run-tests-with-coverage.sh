#!/bin/zsh
set -e

# Определение рабочей директории
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Настройка JAVA_HOME, отдавая приоритет Java 21 LTS (Lombok & Spring Boot 4)
if [ -z "$JAVA_HOME" ] || [ "$("${JAVA_HOME}/bin/java" -version 2>&1 | grep -o 'version "[0-9]*' | tr -dc '0-9')" -gt 24 ] 2>/dev/null; then
    if /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
        export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
    elif /usr/libexec/java_home >/dev/null 2>&1; then
        export JAVA_HOME="$(/usr/libexec/java_home)"
    fi
fi

SKIP_TESTS=false
if [ "$1" = "--open" ] || [ "$1" = "--report-only" ]; then
    SKIP_TESTS=true
fi

if [ "$SKIP_TESTS" = false ]; then
    echo "============================================================"
    echo "  Запуск тестов во всех микросервисах со сбором покрытия    "
    echo "  Java: $($JAVA_HOME/bin/java -version 2>&1 | head -n 1)"
    echo "============================================================"

    # Запуск тестов и сборка JaCoCo отчетов
    ./mvnw clean test jacoco:report
fi

echo ""
echo "============================================================"
echo "  Генерация сводного отчета покрытия кода (Coverage Report) "
echo "============================================================"

REPORT_DIR="$PROJECT_DIR/target/coverage-report"
mkdir -p "$REPORT_DIR"

# Формирование единого сводного HTML-дашборда
cat << 'HTML_EOF' > "$REPORT_DIR/index.html"
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сводное покрытие кода (JaCoCo Coverage Dashboard)</title>
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-card: #1e293b;
            --text-primary: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #38bdf8;
            --border: #334155;
            --green: #22c55e;
            --yellow: #eab308;
            --red: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 30px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            max-width: 1000px;
            width: 100%;
        }
        header {
            margin-bottom: 25px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 15px;
        }
        h1 {
            font-size: 26px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .subtitle {
            color: var(--text-muted);
            margin-top: 6px;
            font-size: 14px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 16px;
            margin-bottom: 25px;
        }
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            transition: transform 0.15s, border-color 0.15s;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .card:hover {
            transform: translateY(-2px);
            border-color: var(--accent);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }
        .module-name {
            font-size: 17px;
            font-weight: 600;
            color: #fff;
        }
        .badge {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 6px;
            background: #0284c7;
            color: white;
            font-weight: 500;
        }
        .card-desc {
            font-size: 13px;
            color: var(--text-muted);
            margin-bottom: 15px;
            line-height: 1.4;
        }
        .btn-view {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 14px;
            background: #2563eb;
            color: white;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            transition: background 0.15s;
        }
        .btn-view:hover {
            background: #1d4ed8;
        }
        .tip-box {
            background: #1e293b;
            border-left: 4px solid var(--accent);
            padding: 16px;
            border-radius: 6px;
            font-size: 13px;
            color: var(--text-muted);
            line-height: 1.5;
        }
        .tip-box strong {
            color: #fff;
        }
        .tip-box code {
            background: #0f172a;
            padding: 2px 6px;
            border-radius: 4px;
            color: #38bdf8;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Отчеты покрытия кода тестами (JaCoCo Coverage)</h1>
            <p class="subtitle">Система управления сотрудниками • Микросервисная архитектура (Лабораторная работа №3)</p>
        </header>

        <div class="grid">
            <div class="card">
                <div>
                    <div class="card-header">
                        <span class="module-name">employee-service</span>
                        <span class="badge">Бизнес-сервис</span>
                    </div>
                    <p class="card-desc">JPA, Hibernate, Liquibase, H2 / PostgreSQL Testcontainers, жизненный цикл сотрудников, назначения, должности.</p>
                </div>
                <a class="btn-view" href="../../employee-service/target/site/jacoco/index.html" target="_blank">
                    Открыть отчет employee-service ↗
                </a>
            </div>

            <div class="card">
                <div>
                    <div class="card-header">
                        <span class="module-name">attendance-service</span>
                        <span class="badge">Реактивный</span>
                    </div>
                    <p class="card-desc">Spring WebFlux, Spring Data R2DBC, PostgreSQL, учет посещаемости сотрудников и отметки.</p>
                </div>
                <a class="btn-view" href="../../attendance-service/target/site/jacoco/index.html" target="_blank">
                    Открыть отчет attendance-service ↗
                </a>
            </div>

            <div class="card">
                <div>
                    <div class="card-header">
                        <span class="module-name">schedule-service</span>
                        <span class="badge">Бизнес-сервис</span>
                    </div>
                    <p class="card-desc">Графики работы, смены, Resilience4j Circuit Breaker / Feign клиент, транзакционные операции.</p>
                </div>
                <a class="btn-view" href="../../schedule-service/target/site/jacoco/index.html" target="_blank">
                    Открыть отчет schedule-service ↗
                </a>
            </div>

            <div class="card">
                <div>
                    <div class="card-header">
                        <span class="module-name">common-dto</span>
                        <span class="badge">Общие DTO</span>
                    </div>
                    <p class="card-desc">Общие модели данных, валидация DTO, сериализация/десериализация Jackson JSON.</p>
                </div>
                <a class="btn-view" href="../../common-dto/target/site/jacoco/index.html" target="_blank">
                    Открыть отчет common-dto ↗
                </a>
            </div>
        </div>

        <div class="tip-box">
            <strong>Как смотреть покрытие прямо в IntelliJ IDEA:</strong><br>
            В выпадающем списке вариантов запуска (Run Configurations) в верхней панели выберите <code>All Tests with Coverage</code> и нажмите кнопку <b>Run with Coverage</b> (зеленый щиток со стрелкой) или <b>Run</b>. В среде появится панель <i>Coverage</i> с разбивкой по пакетам, классам и подсветкой строчек в редакторе (зеленым/красным).
        </div>
    </div>
</body>
</html>
HTML_EOF

echo "✓ Сводный дашборд создан: $REPORT_DIR/index.html"

# Открытие отчета в браузере только если передан флаг --open
if [ "$1" = "--open" ]; then
    if command -v open >/dev/null 2>&1; then
        open "$REPORT_DIR/index.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$REPORT_DIR/index.html"
    fi
    echo "Отчет открыт в браузере."
else
    echo "Отчет сохранен в: $REPORT_DIR/index.html"
    echo "(Для открытия в браузере выполните: ./run-tests-with-coverage.sh --open)"
fi

echo "============================================================"
echo "  Готово!                                                   "
echo "============================================================"
