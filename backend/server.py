from core import (db, client, User, hash_password, verify_password, create_access_token, create_refresh_token,
                  decode_token, set_auth_cookies, current_user)
import os
import json
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
import services as svc
from assistant import stream_chat, history

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: Optional[str] = None


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class TimerStartIn(BaseModel):
    date: str
    time: str = Field(pattern=svc.HHMM)
    day_type: Optional[str] = None


class TimerStopIn(BaseModel):
    time: str = Field(pattern=svc.HHMM)


class BulkIn(BaseModel):
    start: str
    end: str
    day_type: str
    only_workdays: bool = True
    comment: str = ""


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    today: str


def auth_payload(response: Response, user: User):
    access, refresh = create_access_token(user.id, user.email), create_refresh_token(user.id)
    set_auth_cookies(response, access, refresh)
    return {"user": user.public(), "access_token": access, "refresh_token": refresh}


# ---------- auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Этот email уже зарегистрирован")
    user = User(email=email, name=body.name or email.split("@")[0], password_hash=hash_password(body.password))
    res = await db.users.insert_one(user.to_mongo())
    user.id = str(res.inserted_id)
    return auth_payload(response, user)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until", "") > datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте через 15 минут")
    user = User.from_mongo(await db.users.find_one({"email": email}))
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        count = (att or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {
            "count": count, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    await db.login_attempts.delete_one({"identifier": ident})
    return auth_payload(response, user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    response.delete_cookie("refresh_token", path="/", samesite="none", secure=True)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: User = Depends(current_user)):
    return user.public()


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response, body: Optional[RefreshIn] = None):
    token = (body.refresh_token if body else None) or request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = decode_token(token, "refresh")
    user = User.from_mongo(await db.users.find_one({"_id": ObjectId(payload["sub"])}))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user.id, user.email)
    set_auth_cookies(response, access)
    return {"access_token": access}


@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": token, "user_id": str(user["_id"]), "used": False,
                                                   "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)})
        logger.info(f"Password reset link: /reset-password?token={token}")
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset(body: ResetIn):
    t = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not t or t["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Ссылка недействительна")
    await db.users.update_one({"_id": ObjectId(t["user_id"])}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"_id": t["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


# ---------- settings ----------
@api.get("/settings")
async def get_settings(user: User = Depends(current_user)):
    return await svc.get_settings(user.id)


@api.put("/settings")
async def put_settings(patch: dict, user: User = Depends(current_user)):
    return await svc.update_settings(user.id, patch)


# ---------- timer / days ----------
@api.get("/timer")
async def timer(date: str, user: User = Depends(current_user)):
    active = await svc.active_entry(user.id)
    return {"active": active.out() if active else None, "today": await svc.day_info(user.id, date)}


@api.post("/timer/start")
async def timer_start(body: TimerStartIn, user: User = Depends(current_user)):
    return await svc.start_timer(user.id, body.date, body.time, body.day_type)


@api.post("/timer/stop")
async def timer_stop(body: TimerStopIn, user: User = Depends(current_user)):
    return await svc.stop_timer(user.id, body.time)


@api.get("/day/{date}")
async def day(date: str, user: User = Depends(current_user)):
    return await svc.day_info(user.id, date)


@api.get("/entries")
async def entries(start: str, end: str, user: User = Depends(current_user)):
    return await svc.list_entries(user.id, start, end)


@api.put("/entries/{date}")
async def put_entry(date: str, body: svc.EntryIn, user: User = Depends(current_user)):
    return await svc.upsert_entry(user.id, date, body)


@api.delete("/entries/{date}")
async def del_entry(date: str, user: User = Depends(current_user)):
    return await svc.delete_entry(user.id, date)


@api.post("/entries/bulk")
async def bulk(body: BulkIn, user: User = Depends(current_user)):
    return await svc.bulk_set_days(user.id, body.start, body.end, body.day_type, body.only_workdays, body.comment)


# ---------- holidays ----------
@api.get("/holidays")
async def holidays(year: int, user: User = Depends(current_user)):
    return sorted((await svc.get_holidays(user.id, year)).values(), key=lambda h: h["date"])


@api.put("/holidays/{date}")
async def put_holiday(date: str, body: svc.HolidayIn, user: User = Depends(current_user)):
    return await svc.set_holiday(user.id, date, body)


@api.delete("/holidays/{date}")
async def del_holiday(date: str, user: User = Depends(current_user)):
    return await svc.remove_holiday(user.id, date)


# ---------- stats ----------
@api.get("/stats/month")
async def stats_month(month: str, today: Optional[str] = None, user: User = Depends(current_user)):
    return await svc.get_month_stats(user.id, month, today)


@api.get("/stats/year")
async def stats_year(year: int, today: Optional[str] = None, user: User = Depends(current_user)):
    return await svc.get_year_stats(user.id, year, today)


# ---------- chat ----------
@api.get("/chat/history")
async def chat_history(user: User = Depends(current_user)):
    return await history(user.id, 100)


@api.delete("/chat/history")
async def chat_clear(user: User = Depends(current_user)):
    await db.chat_messages.delete_many({"user_id": user.id})
    return {"ok": True}


@api.post("/chat/stream")
async def chat_stream(body: ChatIn, user: User = Depends(current_user)):
    async def gen():
        async for ev in stream_chat(user.id, body.message, body.today):
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_user(email, password, name, role):
    existing = User.from_mongo(await db.users.find_one({"email": email}))
    if existing is None:
        u = User(email=email, name=name, role=role, password_hash=hash_password(password))
        res = await db.users.insert_one(u.to_mongo())
        return str(res.inserted_id)
    if not verify_password(password, existing.password_hash or ""):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
    return existing.id


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.entries.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.holidays.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.chat_messages.create_index([("user_id", 1), ("created_at", -1)])
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await seed_user(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Владелец", "admin")
    demo_id = await seed_user(os.environ["DEMO_EMAIL"], os.environ["DEMO_PASSWORD"], "Демо", "user")
    await svc.seed_demo(demo_id)


@app.on_event("shutdown")
async def shutdown():
    client.close()
