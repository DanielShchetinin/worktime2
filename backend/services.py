import random
from datetime import datetime, timezone, date as Date, timedelta
from typing import List, Optional
from fastapi import HTTPException
from pydantic import BaseModel, Field
from core import db, BaseDocument
from logic import (DEFAULT_SETTINGS, merge_settings, auto_holidays, suggest_type, calc_day, type_map,
                   month_stats, expected_hours, weekday, apply_sick_law)

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"
DATE = r"^\d{4}-\d{2}-\d{2}$"


class Segment(BaseModel):
    start: str = Field(pattern=HHMM)
    end: Optional[str] = Field(default=None, pattern=HHMM)
    rate: Optional[float] = None
    started_at: Optional[str] = None
    note: Optional[str] = None


class EntryIn(BaseModel):
    day_type: str = "work"
    segments: List[Segment] = []
    break_minutes: float = 0
    bonus_pct: Optional[float] = None
    paid_hours: Optional[float] = None
    norm_hours: Optional[float] = None
    comment: str = ""
    extra_pay: float = 0


class Entry(BaseDocument, EntryIn):
    user_id: str
    date: str
    updated_at: str = ""

    def out(self):
        return self.model_dump(exclude={"id", "user_id"})


class HolidayIn(BaseModel):
    name: str
    kind: str = "custom"
    day_off: bool = False
    day_type: Optional[str] = None
    norm_hours: Optional[float] = None
    hidden: bool = False


class Holiday(BaseDocument, HolidayIn):
    user_id: str
    date: str


def now_utc():
    return datetime.now(timezone.utc)


def check_date(d: str):
    try:
        Date.fromisoformat(d)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Неверная дата: {d}")


# ---------- settings ----------
async def get_settings(uid):
    return merge_settings(await db.settings.find_one({"user_id": uid}, {"_id": 0}))


async def update_settings(uid, patch: dict):
    clean = {k: v for k, v in patch.items() if k in DEFAULT_SETTINGS}
    if "day_types" in clean:
        for t in clean["day_types"]:
            if not t.get("key") or not t.get("name") or t.get("kind") not in ("work", "paid", "unpaid", "off"):
                raise HTTPException(status_code=400, detail="Некорректная категория дня")
    await db.settings.update_one({"user_id": uid}, {"$set": clean}, upsert=True)
    return await get_settings(uid)


async def upsert_day_type(uid, t: dict):
    s = await get_settings(uid)
    types = [x for x in s["day_types"] if x["key"] != t["key"]]
    old = next((x for x in s["day_types"] if x["key"] == t["key"]), {})
    merged = {"color": "#64D2FF", "rate": 100, "norm_hours": None, "pay_percent": 100, "bonus_pct": 0,
              "builtin": False, **old, **{k: v for k, v in t.items() if v is not None}}
    return await update_settings(uid, {"day_types": types + [merged]})


async def delete_day_type(uid, key):
    s = await get_settings(uid)
    t = next((x for x in s["day_types"] if x["key"] == key), None)
    if not t or t.get("builtin"):
        raise HTTPException(status_code=400, detail="Нельзя удалить встроенную категорию")
    return await update_settings(uid, {"day_types": [x for x in s["day_types"] if x["key"] != key]})


# ---------- holidays ----------
async def get_holidays(uid, year, s=None):
    s = s or await get_settings(uid)
    hol = auto_holidays(year, s["show_optional_holidays"]) if s["auto_holidays"] else {}
    async for doc in db.holidays.find({"user_id": uid, "date": {"$regex": f"^{year}-"}}):
        h = Holiday.from_mongo(doc)
        if h.hidden:
            hol.pop(h.date, None)
        else:
            hol[h.date] = {**h.model_dump(exclude={"id", "user_id", "hidden"}), "source": "user"}
    return hol


async def set_holiday(uid, dstr, data: HolidayIn):
    check_date(dstr)
    h = Holiday(user_id=uid, date=dstr, **data.model_dump())
    doc = h.to_mongo()
    await db.holidays.update_one({"user_id": uid, "date": dstr}, {"$set": doc}, upsert=True)
    return h.model_dump(exclude={"id", "user_id"})


async def remove_holiday(uid, dstr):
    await db.holidays.delete_one({"user_id": uid, "date": dstr})
    auto = auto_holidays(int(dstr[:4]))
    if dstr in auto:
        await set_holiday(uid, dstr, HolidayIn(name=auto[dstr]["name"], hidden=True))
    return {"ok": True}


# ---------- entries ----------
async def get_entry(uid, dstr):
    return Entry.from_mongo(await db.entries.find_one({"user_id": uid, "date": dstr}))


async def list_entries(uid, start, end):
    cur = db.entries.find({"user_id": uid, "date": {"$gte": start, "$lte": end}}).sort("date", 1)
    return [Entry.from_mongo(d).out() async for d in cur]


async def save_entry(e: Entry):
    e.updated_at = now_utc().isoformat()
    doc = e.to_mongo()
    doc.pop("_id", None)
    await db.entries.update_one({"user_id": e.user_id, "date": e.date}, {"$set": doc}, upsert=True)
    return e


async def upsert_entry(uid, dstr, data: EntryIn):
    check_date(dstr)
    s = await get_settings(uid)
    if data.day_type not in type_map(s):
        raise HTTPException(status_code=400, detail=f"Неизвестная категория: {data.day_type}")
    e = await save_entry(Entry(user_id=uid, date=dstr, **data.model_dump()))
    return await day_info(uid, dstr, s, e)


async def delete_entry(uid, dstr):
    await db.entries.delete_one({"user_id": uid, "date": dstr})
    return {"ok": True}


async def bulk_set_days(uid, start, end, day_type, only_workdays=True, comment=""):
    check_date(start)
    check_date(end)
    s = await get_settings(uid)
    if day_type not in type_map(s):
        raise HTTPException(status_code=400, detail=f"Неизвестная категория: {day_type}")
    d, last, changed = Date.fromisoformat(start), Date.fromisoformat(end), []
    hol_cache = {}
    while d <= last and len(changed) < 370:
        dstr = d.isoformat()
        if d.year not in hol_cache:
            hol_cache[d.year] = await get_holidays(uid, d.year, s)
        h = hol_cache[d.year].get(dstr)
        if not only_workdays or (weekday(dstr) in s["work_days"] and not (h and h.get("day_off"))):
            e = await get_entry(uid, dstr) or Entry(user_id=uid, date=dstr)
            e.day_type = day_type
            if comment:
                e.comment = comment
            await save_entry(e)
            changed.append(dstr)
        d += timedelta(days=1)
    return {"updated": changed, "count": len(changed)}


async def day_info(uid, dstr, s=None, e=None):
    check_date(dstr)
    s = s or await get_settings(uid)
    hol_all = await get_holidays(uid, int(dstr[:4]), s)
    hol = hol_all.get(dstr)
    e = e or await get_entry(uid, dstr)
    types = type_map(s)
    ent = None
    if e:
        start = (Date.fromisoformat(dstr) - timedelta(days=31)).isoformat()
        ctx = {x["date"]: x for x in await list_entries(uid, start, dstr)}
        ctx[dstr] = e.out()
        ent = apply_sick_law(ctx, s, hol_all)[dstr]
    return {"date": dstr, "holiday": hol, "suggested_type": suggest_type(dstr, s, hol),
            "expected_hours": expected_hours(dstr, s, types, hol),
            "entry": e.out() if e else None, "calc": calc_day(ent, s, types, hol, now_utc()) if e else None}


# ---------- timer ----------
async def active_entry(uid):
    return Entry.from_mongo(await db.entries.find_one({"user_id": uid, "segments": {"$elemMatch": {"end": None}}}))


async def start_timer(uid, dstr, time, day_type=None):
    check_date(dstr)
    if await active_entry(uid):
        raise HTTPException(status_code=400, detail="Смена уже идёт")
    s = await get_settings(uid)
    e = await get_entry(uid, dstr)
    if not e:
        hol = (await get_holidays(uid, int(dstr[:4]), s)).get(dstr)
        e = Entry(user_id=uid, date=dstr, day_type=day_type or suggest_type(dstr, s, hol),
                  break_minutes=s["break_minutes_default"])
    elif day_type:
        e.day_type = day_type
    if type_map(s).get(e.day_type, {}).get("kind") != "work":
        e.day_type = "work"
    e.segments.append(Segment(start=time, started_at=now_utc().isoformat()))
    await save_entry(e)
    return await day_info(uid, dstr, s, e)


async def stop_timer(uid, time):
    e = await active_entry(uid)
    if not e:
        raise HTTPException(status_code=400, detail="Нет активной смены")
    for seg in e.segments:
        if seg.end is None:
            seg.end = time
    e.segments = [x for x in e.segments if x.end != x.start]
    await save_entry(e)
    return await day_info(uid, e.date, None, e)


# ---------- payslips (actual salary) ----------
class PayslipIn(BaseModel):
    gross: float = Field(ge=0)
    net: Optional[float] = None
    hours: Optional[float] = None
    income_tax: Optional[float] = None
    social: Optional[float] = None
    pension: Optional[float] = None
    comment: str = ""


class Payslip(BaseDocument, PayslipIn):
    user_id: str
    month: str

    def out(self):
        return self.model_dump(exclude={"id", "user_id"})


def check_month(month: str):
    import re
    if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", month or ""):
        raise HTTPException(status_code=400, detail=f"Неверный месяц: {month}")


async def list_payslips(uid, year: int):
    cur = db.payslips.find({"user_id": uid, "month": {"$regex": f"^{year}-"}}).sort("month", 1)
    return [Payslip.from_mongo(d).out() async for d in cur]


async def get_payslip(uid, month):
    p = Payslip.from_mongo(await db.payslips.find_one({"user_id": uid, "month": month}))
    return p.out() if p else None


async def set_payslip(uid, month, data: PayslipIn):
    check_month(month)
    p = Payslip(user_id=uid, month=month, **data.model_dump())
    doc = p.to_mongo()
    await db.payslips.update_one({"user_id": uid, "month": month}, {"$set": doc}, upsert=True)
    return p.out()


async def delete_payslip(uid, month):
    await db.payslips.delete_one({"user_id": uid, "month": month})
    return {"ok": True}


def compare_payslip(stats, p):
    t, tax = stats["totals"], stats["tax"]
    pairs = [("hours", "Часы", t["worked_hours"]), ("gross", "Брутто", t["gross"]),
             ("income_tax", "Подоходный налог", tax["income_tax"]), ("social", "Битуах Леуми + здоровье", tax["social"]),
             ("pension", "Пенсия", tax["pension"]), ("net", "Нетто", tax["net"])]
    return [{"key": k, "label": lbl, "calc": round(c, 2), "actual": p[k], "diff": round(p[k] - c, 2)}
            for k, lbl, c in pairs if p.get(k) is not None]


# ---------- stats ----------
async def get_month_stats(uid, month: str, today: Optional[str] = None):
    y, m = int(month[:4]), int(month[5:7])
    s = await get_settings(uid)
    hol = await get_holidays(uid, y, s)
    start = (Date(y, m, 1) - timedelta(days=31)).isoformat()
    entries = {e["date"]: e for e in await list_entries(uid, start, f"{month}-31")}
    return month_stats(s, entries, hol, y, m, now_utc(), today or Date.today().isoformat())


async def get_year_stats(uid, year: int, today: Optional[str] = None):
    s = await get_settings(uid)
    hol = await get_holidays(uid, year, s)
    all_e = {e["date"]: e for e in await list_entries(uid, f"{year - 1}-12-01", f"{year}-12-31")}
    months = []
    for m in range(1, 13):
        r = month_stats(s, all_e, hol, year, m, now_utc(), today or Date.today().isoformat())
        months.append({"month": r["month"], **{k: r["totals"][k] for k in
                       ("worked_hours", "credited_hours", "overtime_hours", "gross", "worked_days", "expected_hours")},
                       "net": r["tax"]["net"]})
    return {"year": year, "months": months}


# ---------- demo ----------
async def seed_demo(uid):
    if await db.entries.count_documents({"user_id": uid}) > 0:
        return
    s = await get_settings(uid)
    rnd = random.Random(42)
    today = Date.today()
    d = today - timedelta(days=60)
    while d < today:
        dstr = d.isoformat()
        h = (await get_holidays(uid, d.year, s)).get(dstr)
        if weekday(dstr) in s["work_days"] and not (h and h.get("day_off")):
            roll = rnd.random()
            if roll < 0.06:
                e = Entry(user_id=uid, date=dstr, day_type="vacation", comment="Отпуск")
            elif roll < 0.09:
                e = Entry(user_id=uid, date=dstr, day_type="sick")
            elif roll < 0.11:
                e = Entry(user_id=uid, date=dstr, day_type="absence")
            elif roll < 0.18:
                e = Entry(user_id=uid, date=dstr, day_type="short_bonus",
                          segments=[Segment(start="08:00", end="13:30")], comment="Ушёл раньше, +30%")
            else:
                end_m = 17 * 60 + rnd.choice([0, 0, 30, 60, 90, 120, 150, 180])
                e = Entry(user_id=uid, date=dstr, day_type=(h or {}).get("day_type") or "work",
                          segments=[Segment(start="08:30", end=f"{end_m // 60:02d}:{end_m % 60:02d}")],
                          break_minutes=30)
            await save_entry(e)
        d += timedelta(days=1)


async def payslip_year_summary(uid, year: int):
    keys = ("gross", "net", "hours", "income_tax", "social", "pension")
    totals = {k: {"calc": 0.0, "actual": 0.0, "diff": 0.0, "months": 0} for k in keys}
    months, under, over, match = [], 0, 0, 0
    for p in await list_payslips(uid, year):
        rows = {r["key"]: r for r in compare_payslip(await get_month_stats(uid, p["month"]), p)}
        for k, r in rows.items():
            t = totals[k]
            t["calc"] += r["calc"]
            t["actual"] += r["actual"]
            t["diff"] += r["diff"]
            t["months"] += 1
        main = rows.get("net") or rows.get("gross")
        if abs(main["diff"]) < max(1, abs(main["calc"]) * 0.01):
            match += 1
        elif main["diff"] < 0:
            under += 1
        else:
            over += 1
        months.append({"month": p["month"], "gross": rows.get("gross"), "net": rows.get("net")})
    totals = {k: {**v, **{x: round(v[x], 2) for x in ("calc", "actual", "diff")}} for k, v in totals.items() if v["months"]}
    return {"year": year, "months": months, "totals": totals, "under": under, "over": over, "match": match}
