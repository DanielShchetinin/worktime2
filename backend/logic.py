import calendar
from datetime import date as Date, datetime, timedelta
import holidays as pyholidays

DEFAULT_DAY_TYPES = [
    {"key": "work", "name": "Рабочий день", "color": "#30D158", "kind": "work", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "half_holiday", "name": "Предпраздничный", "color": "#FFCC00", "kind": "work", "rate": 100, "norm_hours": 5, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "holiday", "name": "Работа в праздник", "color": "#FF9500", "kind": "work", "rate": 150, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "weekend", "name": "Работа в выходной", "color": "#FF6B6B", "kind": "work", "rate": 150, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "short_bonus", "name": "Короткий день +30%", "color": "#64D2FF", "kind": "work", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 30, "builtin": False},
    {"key": "vacation", "name": "Отпуск", "color": "#0A84FF", "kind": "paid", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "holiday_paid", "name": "Праздник (оплачиваемый)", "color": "#FFB340", "kind": "paid", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "sick", "name": "Больничный", "color": "#BF5AF2", "kind": "paid", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0, "builtin": True},
    {"key": "unpaid", "name": "За свой счёт", "color": "#FF453A", "kind": "unpaid", "rate": 100, "norm_hours": None, "pay_percent": 0, "bonus_pct": 0, "builtin": True},
    {"key": "absence", "name": "Прогул", "color": "#8E8E93", "kind": "unpaid", "rate": 100, "norm_hours": None, "pay_percent": 0, "bonus_pct": 0, "builtin": True},
    {"key": "day_off", "name": "Выходной", "color": "#636366", "kind": "off", "rate": 100, "norm_hours": None, "pay_percent": 0, "bonus_pct": 0, "builtin": True},
]

DEFAULT_SETTINGS = {
    "hourly_rate": 50.0,
    "currency": "₪",
    "country": "IL",
    "daily_norm_hours": 8.0,
    "work_days": [0, 1, 2, 3, 4],
    "ot1_hours": 2.0,
    "ot1_rate": 125,
    "ot2_rate": 150,
    "special_ot_rate": 200,
    "break_minutes_default": 0,
    "travel_per_day": 0.0,
    "monthly_goal_hours": 182.0,
    "monthly_goal_income": 10000.0,
    "tax_enabled": True,
    "credit_points": 2.25,
    "credit_point_value": 242.0,
    "pension_pct": 6.0,
    "study_fund_pct": 0.0,
    "auto_holidays": True,
    "show_optional_holidays": True,
    "auto_paid_holidays": False,
    "sick_law_il": True,
    "reminders_enabled": False,
    "reminder_start_time": "08:30",
    "reminder_end_time": "18:00",
    "timezone": "Asia/Jerusalem",
    "day_types": DEFAULT_DAY_TYPES,
}

RU_HOLIDAYS = {
    "Ta'anit Ester": "Пост Эстер", "Purim": "Пурим", "Shushan Purim": "Шушан Пурим",
    "Pesach": "Песах", "Pesach holiday": "Холь ха-моэд Песах", "Seventh day of Pesach": "Седьмой день Песаха",
    "Remembrance Day": "День памяти", "Independence Day": "День независимости", "Lag BaOmer": "Лаг ба-Омер",
    "Jerusalem Day": "День Иерусалима", "Shavuot": "Шавуот", "Tisha B'Av": "Тиша бе-Ав",
    "Rosh Hashanah": "Рош ха-Шана", "Yom Kippur": "Йом Кипур", "Sukkot": "Суккот",
    "Sukkot holiday": "Холь ха-моэд Суккот", "Simchat Torah / Shemini Atzeret": "Симхат Тора",
    "Sigd": "Сигд", "Hanukkah": "Ханука", "Holocaust Remembrance Day": "День Катастрофы",
    "Yitzhak Rabin Memorial Day": "День памяти Рабина", "Herzl Day": "День Герцля",
}


def ru_name(name: str) -> str:
    return "; ".join(RU_HOLIDAYS.get(p.strip(), p.strip()) for p in name.split(";"))


def weekday(dstr: str) -> int:
    return (Date.fromisoformat(dstr).weekday() + 1) % 7  # 0=Sunday


def merge_settings(doc):
    s = {**DEFAULT_SETTINGS, **{k: v for k, v in (doc or {}).items() if k in DEFAULT_SETTINGS}}
    keys = {t["key"] for t in s["day_types"]}
    s["day_types"] = list(s["day_types"]) + [t for t in DEFAULT_DAY_TYPES if t.get("builtin") and t["key"] not in keys]
    return s


def auto_holidays(year: int, include_optional: bool = True) -> dict:
    out = {}
    pub = pyholidays.Israel(years=year, categories=("public",))
    if include_optional:
        for d, n in pyholidays.Israel(years=year, categories=("optional",)).items():
            out[d.isoformat()] = {"date": d.isoformat(), "name": ru_name(n), "kind": "optional", "day_off": False,
                                  "day_type": None, "norm_hours": None, "source": "auto"}
    for d, n in pub.items():
        eve = d - timedelta(days=1)
        if eve not in pub and eve.year == year:
            out[eve.isoformat()] = {"date": eve.isoformat(), "name": "Канун: " + ru_name(n), "kind": "eve",
                                    "day_off": False, "day_type": "half_holiday", "norm_hours": None, "source": "auto"}
    for d, n in pub.items():
        out[d.isoformat()] = {"date": d.isoformat(), "name": ru_name(n), "kind": "holiday", "day_off": True,
                              "day_type": "holiday", "norm_hours": None, "source": "auto"}
    return out


def suggest_type(dstr, s, hol):
    if hol and hol.get("day_type"):
        return hol["day_type"]
    return "work" if weekday(dstr) in s["work_days"] else "weekend"


def type_map(s):
    return {t["key"]: t for t in s["day_types"]}


def expected_hours(dstr, s, types, hol):
    if hol and hol.get("day_off"):
        return 0.0
    if weekday(dstr) not in s["work_days"]:
        return 0.0
    if hol and hol.get("norm_hours"):
        return float(hol["norm_hours"])
    if hol and hol.get("day_type") and types.get(hol["day_type"], {}).get("norm_hours"):
        return float(types[hol["day_type"]]["norm_hours"])
    return float(s["daily_norm_hours"])


def hm(v: str) -> int:
    h, m = v.split(":")
    return int(h) * 60 + int(m)


def seg_minutes(seg, now):
    if seg.get("end"):
        d = hm(seg["end"]) - hm(seg["start"])
        return d + 1440 if d < 0 else d
    if seg.get("started_at"):
        return max(0.0, (now - datetime.fromisoformat(seg["started_at"])).total_seconds() / 60)
    return 0.0


def calc_day(entry, s, types, hol, now):
    t = types.get(entry.get("day_type") or "work") or types["work"]
    hourly = float(s["hourly_rate"])
    norm = float(entry.get("norm_hours") or (hol or {}).get("norm_hours") or t.get("norm_hours") or s["daily_norm_hours"])
    bonus = entry.get("bonus_pct")
    bonus = float(t.get("bonus_pct") or 0) if bonus is None else float(bonus)
    breakdown, worked, leave_hours, leave_pay = {}, 0.0, 0.0, 0.0
    base = float(t.get("rate") or 100)
    ot1 = float(s["ot1_rate"]) if base <= 100 else float(s["special_ot_rate"])
    ot2 = float(s["ot2_rate"]) if base <= 100 else float(s["special_ot_rate"])
    current_rate = base

    def add(rate, hours):
        if hours > 0:
            k = str(int(rate)) if float(rate).is_integer() else str(rate)
            breakdown[k] = breakdown.get(k, 0.0) + hours

    if t["kind"] == "work":
        auto_min = 0.0
        for seg in entry.get("segments") or []:
            m = seg_minutes(seg, now)
            if seg.get("rate"):
                add(float(seg["rate"]), m / 60)
            else:
                auto_min += m
        auto_min = max(0.0, auto_min - float(entry.get("break_minutes") or 0))
        h = auto_min / 60
        ot1h = float(s["ot1_hours"])
        add(base, min(h, norm))
        add(ot1, min(max(h - norm, 0), ot1h))
        add(ot2, max(h - norm - ot1h, 0))
        worked = sum(breakdown.values())
        current_rate = base if h < norm else (ot1 if h < norm + ot1h else ot2)
    elif t["kind"] == "paid":
        pay_percent = entry.get("pay_percent_override")
        pay_percent = float(t.get("pay_percent") or 0) if pay_percent is None else float(pay_percent)
        leave_hours = float(entry.get("paid_hours") or norm)
        leave_pay = leave_hours * hourly * pay_percent / 100

    pay_by_rate = {k: round(v * hourly * float(k) / 100, 2) for k, v in breakdown.items()}
    work_pay = sum(pay_by_rate.values())
    bonus_pay = work_pay * bonus / 100
    extra = float(entry.get("extra_pay") or 0) + (float(s["travel_per_day"]) if worked > 0 else 0)
    overtime = sum(v for k, v in breakdown.items() if float(k) > base)
    return {
        "day_type": t["key"], "kind": t["kind"], "norm_hours": norm, "bonus_pct": bonus,
        "worked_hours": round(worked, 4), "credited_hours": round(worked * (1 + bonus / 100) + leave_hours, 4),
        "overtime_hours": round(overtime, 4), "leave_hours": leave_hours,
        "breakdown": {k: round(v, 4) for k, v in breakdown.items()}, "pay_by_rate": pay_by_rate,
        "work_pay": round(work_pay, 2), "bonus_pay": round(bonus_pay, 2), "leave_pay": round(leave_pay, 2),
        "extra_pay": round(extra, 2), "gross": round(work_pay + bonus_pay + leave_pay + extra, 2),
        "current_rate": current_rate, "hourly_rate": hourly,
        "pay_percent": pay_percent if t["kind"] == "paid" else None, "sick_day": entry.get("sick_day"),
    }


def sick_day_index(dstr, entries, s, hol):
    n, d = 1, Date.fromisoformat(dstr)
    for _ in range(60):
        d -= timedelta(days=1)
        k = d.isoformat()
        e = entries.get(k)
        if e and e.get("day_type") == "sick":
            n += 1
        elif e is None and (weekday(k) not in s["work_days"] or (hol.get(k) or {}).get("day_off")):
            continue
        else:
            break
    return n


def apply_sick_law(entries: dict, s, hol: dict):
    """Israeli sick pay: day 1 — 0%, days 2–3 — 50%, from day 4 — 100%."""
    if not s.get("sick_law_il"):
        return entries
    out = dict(entries)
    for k, e in entries.items():
        if e.get("day_type") == "sick":
            n = sick_day_index(k, entries, s, hol)
            out[k] = {**e, "sick_day": n, "pay_percent_override": 0 if n == 1 else 50 if n <= 3 else 100}
    return out


TAX_BRACKETS = [(7010, .10), (10060, .14), (16150, .20), (22440, .31), (46690, .35), (60130, .47), (float("inf"), .50)]


def estimate_tax(gross, s):
    zero = {"income_tax": 0, "social": 0, "pension": 0, "study_fund": 0, "credits": 0}
    if not s["tax_enabled"] or gross <= 0:
        return {**zero, "net": round(gross, 2), "gross": round(gross, 2), "effective_rate": 0}
    tax, prev = 0.0, 0.0
    for limit, rate in TAX_BRACKETS:
        if gross > prev:
            tax += (min(gross, limit) - prev) * rate
        prev = limit
    pension = gross * float(s["pension_pct"]) / 100
    credits = float(s["credit_points"]) * float(s["credit_point_value"]) + 0.35 * min(pension, gross * 0.07)
    income_tax = max(0.0, tax - credits)
    social = min(gross, 7522) * 0.0427 + max(0.0, min(gross, 50695) - 7522) * 0.1217
    study = gross * float(s["study_fund_pct"]) / 100
    net = gross - income_tax - social - pension - study
    return {"gross": round(gross, 2), "income_tax": round(income_tax, 2), "social": round(social, 2),
            "pension": round(pension, 2), "study_fund": round(study, 2), "credits": round(min(credits, tax), 2),
            "net": round(net, 2), "effective_rate": round((gross - net) / gross * 100, 1)}


def month_stats(s, entries: dict, hol: dict, year: int, month: int, now, today: str):
    types = type_map(s)
    entries = apply_sick_law(entries, s, hol)
    days = []
    tot = {"worked_hours": 0.0, "credited_hours": 0.0, "overtime_hours": 0.0, "leave_hours": 0.0,
           "expected_hours": 0.0, "expected_to_date": 0.0, "work_pay": 0.0, "bonus_pay": 0.0, "leave_pay": 0.0,
           "extra_pay": 0.0, "gross": 0.0, "worked_days": 0}
    breakdown, pay_by_rate, counts = {}, {}, {}
    for i in range(1, calendar.monthrange(year, month)[1] + 1):
        dstr = f"{year:04d}-{month:02d}-{i:02d}"
        h = hol.get(dstr)
        exp = expected_hours(dstr, s, types, h)
        e = entries.get(dstr)
        if not e and s["auto_paid_holidays"] and h and h.get("day_off") and weekday(dstr) in s["work_days"]:
            e = {"date": dstr, "day_type": "holiday_paid", "virtual": True, "segments": []}
        c = calc_day(e, s, types, h, now) if e else None
        tot["expected_hours"] += exp
        if dstr <= today:
            tot["expected_to_date"] += exp
        if c:
            for k in ("worked_hours", "credited_hours", "overtime_hours", "leave_hours", "work_pay", "bonus_pay",
                      "leave_pay", "extra_pay", "gross"):
                tot[k] += c[k]
            if c["worked_hours"] > 0:
                tot["worked_days"] += 1
            for k, v in c["breakdown"].items():
                breakdown[k] = breakdown.get(k, 0) + v
            for k, v in c["pay_by_rate"].items():
                pay_by_rate[k] = pay_by_rate.get(k, 0) + v
            counts[c["day_type"]] = counts.get(c["day_type"], 0) + 1
        days.append({"date": dstr, "weekday": weekday(dstr), "holiday": h, "expected_hours": exp,
                     "suggested_type": suggest_type(dstr, s, h), "entry": e, "calc": c})
    tot = {k: round(v, 2) for k, v in tot.items()}
    tot["breakdown"] = {k: round(v, 2) for k, v in breakdown.items()}
    tot["pay_by_rate"] = {k: round(v, 2) for k, v in pay_by_rate.items()}
    tot["counts"] = counts
    tot["avg_hours"] = round(tot["worked_hours"] / tot["worked_days"], 2) if tot["worked_days"] else 0
    return {"month": f"{year:04d}-{month:02d}", "days": days, "totals": tot, "tax": estimate_tax(tot["gross"], s),
            "goals": {"hours": s["monthly_goal_hours"], "income": s["monthly_goal_income"]}}
