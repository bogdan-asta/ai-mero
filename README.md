# EventAI

Веб-платформа, которая помогает пройти путь от идеи мероприятия до плана подготовки и документов.

## Текущая версия

Этап 0: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, адаптивный лендинг, светлая/тёмная тема и заготовки Supabase. Авторизация, база данных и ИИ будут реализованы в следующих этапах.

## Требования

- Node.js 20.9 или новее
- npm 10 или новее
- Проект Supabase для последующих этапов

## Запуск локально

```powershell
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Для проверки кода:

```powershell
npm run lint
npm run build
```

## Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com/dashboard).
2. Откройте **Project Settings → API**.
3. Скопируйте Project URL и ключ `anon` / publishable.
4. Создайте локальный файл окружения:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Заполните в `.env.local` значения `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Не добавляйте секретный `service_role` ключ в переменные `NEXT_PUBLIC_*`, клиентский код или Git.

## Настройка OpenRouter

Для этапа с ИИ понадобится ключ в [OpenRouter](https://openrouter.ai/). Добавьте `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL` и `OPENROUTER_FALLBACK_MODEL` в локальный `.env.local` и переменные серверного окружения при деплое. Ключ используется только серверными API-маршрутами и пока не нужен для запуска лендинга.

## Структура

```text
src/
  app/                 страницы, layout, провайдеры темы
  components/ui/       компоненты shadcn/ui
  lib/supabase/        клиенты Supabase для браузера и сервера
  lib/utils.ts         общие утилиты UI
supabase/
  migrations/          SQL-миграции (будут добавлены на этапе авторизации)
  seed.sql             тестовые данные (будут добавлены вместе с моделью данных)
.env.example           пример локальной конфигурации без секретов
DECISIONS.md            принятые технические решения
```

## Технические решения

Зафиксированы в [DECISIONS.md](./DECISIONS.md).
