# Backend (Cloudflare Worker + D1)

Этот backend собирает данные из:
- YouTube через прямой API-вызов к Composio (`YOUTUBE_GET_CHANNEL_STATISTICS`)
- Google Sheets (продажи) через прямой API-вызов к Composio (`GOOGLESHEETS_BATCH_GET`)
- Telegram-канал через Telegram Bot API (`getUpdates`) и/или webhook

## Что реализовано

- `GET /api/dashboard` — данные для всех блоков дашборда
- `POST /api/refresh-all` — принудительное обновление всех источников (под кнопку `utility-refresh-button`)
- `POST /api/telegram/webhook` — прием обновлений Telegram (опционально)
- `GET /api/health` — healthcheck
- Cron в `09:00 МСК` (в Cloudflare это `0 6 * * *` UTC)

## Быстрый запуск

1. Установить зависимости:
```bash
cd backend
npm install
```

2. Создать D1 базу:
```bash
npx wrangler d1 create dashboard-db
```

3. Подставить `database_id` в `backend/wrangler.jsonc`.

4. Применить миграции:
```bash
npx wrangler d1 migrations apply dashboard_db --remote
```

5. Секреты:
```bash
npx wrangler secret put COMPOSIO_API_KEY
npx wrangler secret put COMPOSIO_CONNECTED_ACCOUNT_ID
npx wrangler secret put SALES_SPREADSHEET_ID
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

6. Локально:
```bash
npx wrangler dev
```

7. Деплой:
```bash
npx wrangler deploy
```

## Переменные окружения

Обязательные:
- `COMPOSIO_API_KEY`
- `SALES_SPREADSHEET_ID`
- `TELEGRAM_BOT_TOKEN` (если нужен блок Telegram)

Опциональные, но рекомендуемые:
- `COMPOSIO_CONNECTED_ACCOUNT_ID`
- `COMPOSIO_CONNECTED_ACCOUNT_ID_YOUTUBE`
- `COMPOSIO_CONNECTED_ACCOUNT_ID_SHEETS`
- `COMPOSIO_API_BASE_URL` (по умолчанию `https://api.composio.dev`)
- `COMPOSIO_EXECUTE_PATH` (по умолчанию `/v1/actions/execute`)
- `ALLOWED_ORIGINS` (например `https://your-frontend.vercel.app`)
- `SALES_SHEET_NAME`, `SALES_RANGE`, `SALES_COL_*`
- `TELEGRAM_CHANNEL_ID`
- `TELEGRAM_WEBHOOK_SECRET`

Для вашей структуры таблицы со скриншота:
- `SALES_COL_PRODUCT=Title`
- `SALES_COL_UNIT_PRICE=Cost`
- `SALES_COL_QUANTITY=Count`
- `SALES_COL_DATE=Date`
- `SALES_COL_AMOUNT=` (оставить пустым, сумма будет считаться как `Cost * Count`)

## Что нужно для Telegram-канала

Минимум:
- `TELEGRAM_BOT_TOKEN`
- Бот добавлен администратором в канал
- (опционально) `TELEGRAM_CHANNEL_ID` для фильтра конкретного канала

Для webhook-режима дополнительно:
- публичный URL backend `/api/telegram/webhook`
- секрет `TELEGRAM_WEBHOOK_SECRET`
- команда:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://<your-worker>.workers.dev/api/telegram/webhook",
    "secret_token":"<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates":["channel_post"]
  }'
```
