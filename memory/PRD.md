# Смена — учёт рабочего времени (PRD)

## Original problem statement
Красивое продвинутое веб-приложение (телефон + десктоп) для записи рабочих дней: кнопка «Начать рабочий день», ручная отметка, красивая статистика, категории дней, праздники, отпуска, комментарии, глубокая настройка, ставки 120/150/200%, прогулы, неоплачиваемые, ранний уход с +30%. ИИ-чат, которому можно объяснить словами — он всё настроит. Стиль Apple, немного прозрачный.

## User choices
- JWT email/password auth (регистрация + вход)
- ИИ: Claude Sonnet 4.6 (Emergent LLM key)
- Почасовая ставка + оценка налогов Израиля
- Авто-праздники Израиля
- Светлая и тёмная тема с переключателем
- Feedback #2: «слишком много AI slop» → переделано в нативный iOS-стиль (по референсу Hours Tracker)

## Architecture
- Backend FastAPI: core.py (db, auth), logic.py (расчёт дня, ставки, налоги, праздники `holidays` lib), services.py, assistant.py (Claude + 12 tools, SSE), server.py (routes /api/*)
- Frontend React + react-query + recharts + framer-motion; pages: Auth, Dashboard, Calendar, Stats, Chat, Settings
- Mongo collections: users, settings, entries (user_id+date), holidays (overrides), chat_messages, login_attempts

## Implemented (2026-06)
- Auth (JWT + refresh, brute-force lock), admin + demo seed
- Таймер старт/пауза/продолжить/завершить, живой заработок
- Ручная запись: отрезки времени с авто/фикс ставкой, перерыв, норма, бонус %, доплата, комментарий
- Категории дней (работа, предпраздничный, праздник, выходной, отпуск, больничный, за свой счёт, прогул, +30%), кастомные
- Праздники Израиля (рус. названия), каноны, свои дни, скрытие
- Статистика месяц/год: KPI, часы по ставкам, доход по ставкам, брутто→нетто (налог, Битуах Леуми, пенсия), список месяцев с отклонением от нормы
- ИИ-ассистент (Claude) меняет настройки/праздники/записи
- iOS-style redesign (system font, flat cards, translucent bars)
- Iteration 3: monthly report PDF + Excel; PWA (manifest, icons, service worker, iPhone home screen); shift reminders (web push VAPID + cron */15 `/api/cron/reminders` + in-app banners); Israeli sick law (1st day 0%, 2–3 50%, 4+ 100%, toggle); voice input to assistant (whisper-1); chat sessions are no longer stored on server (sessionStorage only, «Новый чат»)

## Backlog
- P1: несколько работодателей/проектов
- P2: голосовые ответы ассистента (TTS)
- P2: отправка отчёта на email бухгалтеру
