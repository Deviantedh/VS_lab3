/**
 * Легковесный HTTP-сервер для раздачи статики двух фронтендов:
 * - Порт 3000: Панель администратора (frontend/admin)
 * - Порт 3001: Личный кабинет сотрудника (frontend/employee)
 * 
 * Без сторонних зависимостей (pure Node.js).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function createStaticServer(rootDir, port, name) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
      reqPath = '/index.html';
    }

    const filePath = path.join(rootDir, reqPath);

    // Безопасность путей (защита от path traversal)
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Доступ запрещен');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fallback на index.html для SPA роутинга если файл не найден и нет расширения
        if (!path.extname(reqPath)) {
          const indexPath = path.join(rootDir, 'index.html');
          fs.readFile(indexPath, (indexErr, indexData) => {
            if (indexErr) {
              res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('404 Не найдено');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(indexData);
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Файл не найден: ${reqPath}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log(`[${name}] запущен на: http://localhost:${port}`);
  });

  return server;
}

const adminDir = path.join(__dirname, 'admin');
const employeeDir = path.join(__dirname, 'employee');

const args = process.argv.slice(2);
const adminOnly = args.includes('--admin-only');
const employeeOnly = args.includes('--employee-only');

console.log('='.repeat(55));
console.log('Запуск клиентских интерфейсов СУС');
console.log('='.repeat(55));

if (!employeeOnly) {
  createStaticServer(adminDir, 3000, 'Панель Управления (Admin/HR)');
}

if (!adminOnly) {
  createStaticServer(employeeDir, 3001, 'Кабинет Сотрудника (Employee)');
}

console.log('API бэкенда ожидается на: http://localhost:8080');
console.log('Нажмите Ctrl+C для остановки.');
