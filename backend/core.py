from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional
from bson import ObjectId
from fastapi import Request, HTTPException, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self):
        d = self.model_dump(by_alias=True)
        if d.get("_id") is None:
            d.pop("_id", None)
        else:
            d["_id"] = ObjectId(d["_id"])
        return d


class User(BaseDocument):
    email: str
    name: str = ""
    role: str = "user"
    password_hash: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def public(self):
        return {"id": self.id, "email": self.email, "name": self.name, "role": self.role}


JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def set_auth_cookies(response: Response, access: str, refresh: Optional[str] = None):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    if refresh:
        response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                            max_age=2592000, path="/")


async def current_user(request: Request) -> User:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token, "access")
    user = User.from_mongo(await db.users.find_one({"_id": ObjectId(payload["sub"])}))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
