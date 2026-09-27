import os
import json
import uuid
import logging
from datetime import date as Date
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, ToolCallStart, ToolCallReady, StreamDone
import services as svc

logger = logging.getLogger(__name__)
WEEKDAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]


def fn(name, desc, props, required=None):
    return {"type": "function", "function": {"name": name, "description": desc, "parameters": {
        "type": "object", "properties": props, "required": required or []}}}


SEG = {"type": "array", "description": "Отрезки времени. rate — процент оплаты (100,120,125,150,175,200...). Если rate не указан, отрезок считается автоматически по норме и сверхурочным.",
       "items": {"type": "object", "properties": {"start": {"type": "string", "description": "HH:MM"},
                                                  "end": {"type": "string", "description": "HH:MM"},
                                                  "rate": {"type": "number"}}, "required": ["start", "end"]}}

TOOLS = [
    fn("get_settings", "Текущие настройки: ставка, норма, коэффициенты, категории дней, налоги.", {}),
    fn("update_settings", "Частично обновить настройки (только изменяемые ключи).", {"patch": {"type": "object", "description":
       "Ключи: hourly_rate, daily_norm_hours, work_days (массив 0=вс..6=сб), ot1_hours, ot1_rate, ot2_rate, special_ot_rate, break_minutes_default, travel_per_day, monthly_goal_hours, monthly_goal_income, tax_enabled, credit_points, credit_point_value, pension_pct, study_fund_pct, auto_holidays, show_optional_holidays, auto_paid_holidays, sick_law_il (больничный по закону Израиля: 1-й день 0%, 2–3 — 50%, с 4-го 100%), reminders_enabled, reminder_start_time (HH:MM), reminder_end_time (HH:MM), timezone"}}, ["patch"]),
    fn("upsert_day_type", "Создать или изменить категорию дня.", {
        "key": {"type": "string", "description": "латинский ключ, напр. short_day"}, "name": {"type": "string"},
        "color": {"type": "string", "description": "#RRGGBB"},
        "kind": {"type": "string", "enum": ["work", "paid", "unpaid", "off"], "description": "work — рабочие часы; paid — оплачиваемое отсутствие (отпуск/больничный); unpaid — неоплачиваемое/прогул; off — выходной"},
        "rate": {"type": "number", "description": "базовый % оплаты для work"}, "norm_hours": {"type": "number"},
        "pay_percent": {"type": "number", "description": "% оплаты для paid"}, "bonus_pct": {"type": "number", "description": "бонус % к засчитанным часам и оплате"}},
       ["key", "name", "kind"]),
    fn("delete_day_type", "Удалить пользовательскую категорию.", {"key": {"type": "string"}}, ["key"]),
    fn("list_holidays", "Праздники за год (авто Израиль + пользовательские).", {"year": {"type": "integer"}}, ["year"]),
    fn("set_holiday", "Добавить/изменить праздник или особый день.", {
        "date": {"type": "string", "description": "YYYY-MM-DD"}, "name": {"type": "string"},
        "kind": {"type": "string", "enum": ["holiday", "eve", "optional", "custom"]},
        "day_off": {"type": "boolean", "description": "true — нерабочий день"},
        "day_type": {"type": "string", "description": "категория, применяемая если работаешь в этот день"},
        "norm_hours": {"type": "number", "description": "норма часов в этот день (напр. 4 для полудня)"}}, ["date", "name"]),
    fn("remove_holiday", "Удалить/скрыть праздник на дату.", {"date": {"type": "string"}}, ["date"]),
    fn("get_entries", "Записи дней за период.", {"start": {"type": "string"}, "end": {"type": "string"}}, ["start", "end"]),
    fn("upsert_entry", "Создать или полностью заменить запись дня.", {
        "date": {"type": "string"}, "day_type": {"type": "string"}, "segments": SEG,
        "break_minutes": {"type": "number"}, "bonus_pct": {"type": "number"}, "paid_hours": {"type": "number"},
        "norm_hours": {"type": "number"}, "comment": {"type": "string"}, "extra_pay": {"type": "number", "description": "доплата в ₪"}},
       ["date", "day_type"]),
    fn("bulk_set_days", "Поставить категорию на диапазон дат (отпуск, больничный и т.п.).", {
        "start": {"type": "string"}, "end": {"type": "string"}, "day_type": {"type": "string"},
        "only_workdays": {"type": "boolean", "description": "только рабочие дни (по умолчанию true)"},
        "comment": {"type": "string"}}, ["start", "end", "day_type"]),
    fn("delete_entry", "Удалить запись дня.", {"date": {"type": "string"}}, ["date"]),
    fn("get_month_stats", "Статистика месяца: часы, сверхурочные, брутто, налоги, нетто.", {"month": {"type": "string", "description": "YYYY-MM"}}, ["month"]),
    fn("set_payslip", "Сохранить фактические данные из зарплатного листка (тлуш) за месяц для сверки с расчётом.", {
        "month": {"type": "string", "description": "YYYY-MM"}, "gross": {"type": "number"}, "net": {"type": "number"},
        "hours": {"type": "number"}, "income_tax": {"type": "number"}, "social": {"type": "number", "description": "Битуах Леуми + мас бриют"},
        "pension": {"type": "number"}, "comment": {"type": "string"}}, ["month", "gross"]),
    fn("compare_payslip", "Сравнить расчёт приложения с фактическим тлушем за месяц.", {"month": {"type": "string"}}, ["month"]),
]

MUTATING = {"update_settings", "upsert_day_type", "delete_day_type", "set_holiday", "remove_holiday",
            "upsert_entry", "bulk_set_days", "delete_entry", "set_payslip"}


def system_prompt(today: str):
    wd = WEEKDAYS_RU[Date.fromisoformat(today).weekday()]
    return f"""Ты — «Смена», умный ассистент приложения учёта рабочего времени (Израиль, валюта ₪). Сегодня {today} ({wd}).
Ты помогаешь пользователю словами настроить всё: ставку, норму часов, коэффициенты 100/120/125/150/175/200%, категории дней, праздники (полдня, выходные), отпуска, больничные, прогулы, неоплачиваемые дни, записи смен и бонусы.

Модель расчёта:
- Категория kind=work: часы отрезков без rate делятся автоматически: до нормы — по базовому rate категории, следующие ot1_hours — по ot1_rate (125%), дальше — ot2_rate (150%). Для категорий с rate>100 (праздник/выходной) сверхурочные идут по special_ot_rate (200%).
- Отрезок с указанным rate оплачивается ровно по этому проценту (например «час по 100%, потом 2 часа по 150%»).
- bonus_pct — надбавка к засчитанным часам и оплате (например «ушёл раньше, но засчитывается +30%» → bonus_pct=30 или категория short_bonus).
- kind=paid — оплачиваемое отсутствие (paid_hours или норма × pay_percent). kind=unpaid — за свой счёт/прогул. kind=off — выходной.
- Праздник: day_off=true — нерабочий; для «работаем полдня» — day_off=false, day_type=half_holiday, norm_hours=4 (или сколько сказано).
- Дни недели: 0=воскресенье … 6=суббота. В Израиле по умолчанию рабочие 0–4.

Правила:
- Всегда используй инструменты для чтения и изменения данных, не выдумывай цифры.
- Если запрос неоднозначен (нет дат/часов) — задай один короткий уточняющий вопрос.
- После изменений коротко отчитайся маркированным списком, что именно настроено.
- Отвечай по-русски, дружелюбно и кратко, используй markdown. Не используй эмодзи."""


async def dispatch(uid, name, a):
    try:
        if name == "get_settings":
            return await svc.get_settings(uid)
        if name == "update_settings":
            s = await svc.update_settings(uid, a.get("patch") or {})
            return {"ok": True, "settings": {k: v for k, v in s.items() if k != "day_types"}}
        if name == "upsert_day_type":
            await svc.upsert_day_type(uid, a)
            return {"ok": True}
        if name == "delete_day_type":
            await svc.delete_day_type(uid, a["key"])
            return {"ok": True}
        if name == "list_holidays":
            return list((await svc.get_holidays(uid, int(a["year"]))).values())
        if name == "set_holiday":
            data = svc.HolidayIn(**{k: v for k, v in a.items() if k != "date"})
            return await svc.set_holiday(uid, a["date"], data)
        if name == "remove_holiday":
            return await svc.remove_holiday(uid, a["date"])
        if name == "get_entries":
            return await svc.list_entries(uid, a["start"], a["end"])
        if name == "upsert_entry":
            r = await svc.upsert_entry(uid, a["date"], svc.EntryIn(**{k: v for k, v in a.items() if k != "date"}))
            return {"ok": True, "calc": r["calc"]}
        if name == "bulk_set_days":
            return await svc.bulk_set_days(uid, a["start"], a["end"], a["day_type"], a.get("only_workdays", True), a.get("comment", ""))
        if name == "delete_entry":
            return await svc.delete_entry(uid, a["date"])
        if name == "set_payslip":
            return await svc.set_payslip(uid, a["month"], svc.PayslipIn(**{k: v for k, v in a.items() if k != "month"}))
        if name == "compare_payslip":
            slip = await svc.get_payslip(uid, a["month"])
            if not slip:
                return {"error": "Нет данных тлуша за этот месяц"}
            return svc.compare_payslip(await svc.get_month_stats(uid, a["month"]), slip)
        if name == "get_month_stats":
            r = await svc.get_month_stats(uid, a["month"])
            return {"totals": r["totals"], "tax": r["tax"], "goals": r["goals"]}
        return {"error": f"unknown tool {name}"}
    except Exception as ex:
        detail = getattr(ex, "detail", None) or str(ex)
        return {"error": detail}


async def stream_chat(uid, text, today, past):
    past = [m for m in past if m.get("content") and m.get("role") in ("user", "assistant")][-16:]
    while past and past[0]["role"] != "user":
        past.pop(0)
    initial = [{"role": "system", "content": system_prompt(today)}] + [{"role": m["role"], "content": m["content"]} for m in past]
    chat = (LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{uid}-{uuid.uuid4()}",
                    system_message=system_prompt(today), initial_messages=initial)
            .with_model("anthropic", "claude-sonnet-4-6")
            .with_tools(TOOLS, tool_choice="auto"))
    full, used, changed = "", [], False
    user_msg = UserMessage(text=text)
    try:
        for _ in range(10):
            pending = []
            async for ev in chat.stream_message(user_msg):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield {"type": "delta", "content": ev.content}
                elif isinstance(ev, ToolCallStart):
                    yield {"type": "tool", "name": ev.name}
                elif isinstance(ev, ToolCallReady):
                    pending.append(ev.tool_call)
                elif isinstance(ev, StreamDone):
                    break
            if not pending:
                break
            for tc in pending:
                result = await dispatch(uid, tc.name, tc.arguments or {})
                used.append(tc.name)
                if tc.name in MUTATING and not (isinstance(result, dict) and result.get("error")):
                    changed = True
                chat.add_tool_result(tc.id, json.dumps(result, ensure_ascii=False, default=str))
            if full and not full.endswith("\n"):
                full += "\n\n"
                yield {"type": "delta", "content": "\n\n"}
            user_msg = None
    except Exception as ex:
        logger.exception("chat error")
        yield {"type": "error", "content": f"Ошибка ассистента: {ex}"}
    yield {"type": "done", "changed": changed, "tools": used}
