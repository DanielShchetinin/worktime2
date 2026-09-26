import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pywebpush import webpush, WebPushException
from core import db
import services as svc
from logic import weekday

logger = logging.getLogger(__name__)


async def save_subscription(uid, sub: dict):
    await db.push_subs.update_one({"endpoint": sub["endpoint"]}, {"$set": {
        "user_id": uid, "endpoint": sub["endpoint"], "keys": sub.get("keys") or {},
        "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)


async def remove_subscription(uid, endpoint: str):
    await db.push_subs.delete_one({"user_id": uid, "endpoint": endpoint})


def _send(sub, payload):
    webpush(subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]})


async def send_push(uid, title, body, url="/"):
    sent = 0
    async for sub in db.push_subs.find({"user_id": uid}):
        try:
            await asyncio.to_thread(_send, sub, {"title": title, "body": body, "url": url})
            sent += 1
        except WebPushException as ex:
            status = getattr(ex.response, "status_code", None)
            if status in (404, 410):
                await db.push_subs.delete_one({"_id": sub["_id"]})
            else:
                logger.warning(f"push failed: {ex}")
    return sent


def _minutes(hm: str) -> int:
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


async def _notify_once(uid, day, kind, title, body):
    r = await db.reminder_log.update_one({"user_id": uid, "date": day, "kind": kind},
                                         {"$setOnInsert": {"at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    if r.upserted_id is not None:
        await send_push(uid, title, body)


async def check_user(uid):
    s = await svc.get_settings(uid)
    if not s["reminders_enabled"]:
        return
    now = datetime.now(ZoneInfo(s["timezone"]))
    today, hm = now.date().isoformat(), now.strftime("%H:%M")
    active = await svc.active_entry(uid)
    if active:
        if active.date != today or hm >= s["reminder_end_time"]:
            await _notify_once(uid, today, "end", "Смена всё ещё идёт",
                               f"Рабочий день должен был закончиться в {s['reminder_end_time']}. Не забыли завершить смену?")
        return
    hol = (await svc.get_holidays(uid, now.year, s)).get(today)
    if weekday(today) not in s["work_days"] or (hol and hol.get("day_off")):
        return
    if await svc.get_entry(uid, today):
        return
    start = _minutes(s["reminder_start_time"])
    if start <= _minutes(hm) < start + 180:
        await _notify_once(uid, today, "start", "Пора начинать смену",
                           f"Сейчас {hm}. Откройте «Смену» и нажмите «Начать рабочий день».")


async def run_reminders():
    for uid in await db.push_subs.distinct("user_id"):
        try:
            await check_user(uid)
        except Exception:
            logger.exception(f"reminder check failed for {uid}")
