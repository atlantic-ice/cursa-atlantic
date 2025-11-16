# Система нормоконтроля документов (CURSA)

## Описание
Система проверки и исправления форматирования документов DOCX в соответствии с требованиями ГОСТ.

## Запуск сервера

### Windows
1. Откройте командную строку или PowerShell
2. Перейдите в директорию backend:
   ```
   cd путь\к\проекту\backend
   ```
3. Запустите скрипт run_server.bat:
   ```
   run_server.bat
   ```

### Linux/macOS
1. Откройте терминал
2. Перейдите в директорию backend:
   ```
   cd путь/к/проекту/backend
   ```
3. Убедитесь, что скрипт имеет права на выполнение:
   ```
   chmod +x run_server.sh
   ```
4. Запустите скрипт:
   ```
   ./run_server.sh
   ```

## Запуск без скриптов
Если по каким-то причинам скрипты не работают, вы можете запустить сервер вручную:

```
cd backend
python run.py
```

## Доступ к приложению
После запуска сервер будет доступен по адресу:
- http://localhost:5000/

## API Endpoints
- Проверка состояния: GET /api/health
- Загрузка документа: POST /api/document/upload
- Исправление документа: POST /api/document/correct
- Скачивание исправленного документа: GET /api/document/download-corrected

## Настройка ИИ (опционально)
Функции подсказок Gemini по умолчанию **выключены**. Чтобы их активировать:
1. Задайте переменную окружения `ENABLE_AI_FEATURES=true` (или `yes/1`).
2. Укажите `GEMINI_API_KEY` в `.env` через API-ключ Google Gemini.

Без этой переменной сервер игнорирует ИИ и не делает внешние запросы, что избавляет от предупреждений при отсутствии ключа или недоступности моделей.

## CORS и фронтенд-домены
- По умолчанию backend разрешает локальные адреса и `https://cursa-atlantic.vercel.app`.
- Все превью Vercel вида `https://cursa-atlantic-*.vercel.app` и `https://cursa-atlantic-*-atlantic-ices-projects.vercel.app` теперь автоматически совпадают по регулярному выражению, поэтому загрузка/скачивание работает на любом deploy.
- Для дополнительных доменов добавьте переменную `FRONTEND_ORIGINS` (через запятую), например `FRONTEND_ORIGINS=https://demo.example.com,https://stage.example.com` и перезапустите сервис.

## Запуск тестов
- Модульные тесты: `run_unit_tests.bat` (Windows) или `run_unit_tests.sh` (Linux)
- Интеграционные тесты: `run_integration_tests.bat` (Windows) или `run_integration_tests.sh` (Linux)
- Все тесты: `run_all_tests.bat` (Windows) или `run_all_tests.sh` (Linux)
- Анализ покрытия кода: `run_coverage.bat` (Windows) или `run_coverage.sh` (Linux) 