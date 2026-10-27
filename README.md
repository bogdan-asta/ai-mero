# EventAI

Веб-платформа, которая помогает пройти путь от идеи мероприятия до плана подготовки и документов.

## Текущая версия

Этапы 0–2: адаптивный лендинг, темы оформления, Supabase Auth, онбординг профиля, защищённые маршруты, RLS профилей и мероприятий, создание/просмотр/редактирование/удаление мероприятий. ИИ, задачи, аудитории и документы подключаются далее по плану.

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
6. Откройте **SQL Editor** в Supabase и последовательно выполните миграции из `supabase/migrations/` по возрастанию имени:
   - `20261027000000_profiles.sql`
   - `20261027000001_events.sql`
7. В **Authentication → URL Configuration** укажите Site URL `http://localhost:3000` и добавьте Redirect URL `http://localhost:3000/auth/callback`.
8. Для входа через Google включите провайдер Google в **Authentication → Providers** и настройте OAuth client ID/secret у Google. Email/password и magic link доступны без настройки Google.

Не добавляйте секретный `service_role` ключ в переменные `NEXT_PUBLIC_*`, клиентский код или Git.

После настройки откройте `/sign-up`, зарегистрируйтесь, подтвердите email (если подтверждение включено в Supabase) и заполните онбординг. Для локального теста проверьте `/sign-in`, вход по magic link, выход и восстановление пароля.

## Настройка OpenRouter

Для будущего этапа с ИИ понадобится ключ в [OpenRouter](https://openrouter.ai/). Добавьте `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL` и `OPENROUTER_FALLBACK_MODEL` в локальный `.env.local` и переменные серверного окружения при деплое. Ключ используется только серверными API-маршрутами и пока не нужен для запуска сайта.

## Структура

```text
src/
  app/                 страницы, layout, провайдеры темы
  components/ui/       компоненты shadcn/ui
  lib/supabase/        клиенты Supabase для браузера и сервера
  lib/utils.ts         общие утилиты UI
supabase/
  migrations/          SQL-миграции, включая профили и RLS
  seed.sql             тестовые данные (будут добавлены вместе с моделью данных)
.env.example           пример локальной конфигурации без секретов
DECISIONS.md            принятые технические решения
```

Маршруты авторизации: `/sign-in`, `/sign-up`, `/forgot-password`, `/auth/update-password`. Защищённые маршруты: `/onboarding`, `/dashboard` и `/events`. Владелец мероприятия может редактировать и удалять его; участники видят только мероприятия, в которые добавлены.

## Технические решения

Зафиксированы в [DECISIONS.md](./DECISIONS.md).
