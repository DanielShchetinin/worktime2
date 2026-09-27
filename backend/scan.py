import os
import re
import json
import uuid
import tempfile
from fastapi import HTTPException
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, TextDelta, StreamDone

ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic",
           "image/heif": ".heif", "application/pdf": ".pdf"}
KEYS = ("gross", "net", "hours", "income_tax", "social", "pension")

PROMPT = """Ты извлекаешь данные из израильского зарплатного листка (תלוש שכר). Он может быть на иврите, английском или русском, фото может быть под углом.
Найди значения за месяц (не накопительные с начала года):
- gross: брутто, сумма всех начислений (ברוטו / סה"כ תשלומים / שכר ברוטו)
- net: к выплате на руки (נטו לתשלום / שכר נטו)
- hours: отработанные часы (שעות עבודה / סה"כ שעות); если есть только дни — null
- income_tax: подоходный налог (מס הכנסה)
- social: Битуах Леуми + мас бриют вместе (ביטוח לאומי + מס בריאות)
- pension: отчисление работника в пенсию (ניכוי עובד לפנסיה / קרן פנסיה עובד)
- month: месяц листка в формате YYYY-MM
Ответь ТОЛЬКО JSON-объектом с ключами month, gross, net, hours, income_tax, social, pension. Числа без валюты и разделителей тысяч. Если значение не найдено — null."""


def _num(v):
    if v is None:
        return None
    try:
        return round(float(str(v).replace(",", "").replace("₪", "").strip()), 2)
    except ValueError:
        return None


async def scan_payslip(data: bytes, mime: str):
    if mime not in ALLOWED:
        raise HTTPException(status_code=400, detail="Нужна фотография (JPG, PNG, HEIC) или PDF")
    with tempfile.NamedTemporaryFile(suffix=ALLOWED[mime], delete=False) as f:
        f.write(data)
        path = f.name
    text = ""
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"scan-{uuid.uuid4()}",
                       system_message=PROMPT).with_model("gemini", "gemini-3-flash-preview")
        msg = UserMessage(text="Извлеки данные из этого тлуша.", file_contents=[FileContentWithMimeType(file_path=path, mime_type=mime)])
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"Не удалось распознать тлуш: {ex}")
    finally:
        os.unlink(path)
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise HTTPException(status_code=422, detail="Не удалось найти цифры на изображении")
    try:
        obj = json.loads(m.group(0))
    except ValueError:
        raise HTTPException(status_code=422, detail="Не удалось разобрать ответ распознавания")
    month = obj.get("month")
    out = {k: _num(obj.get(k)) for k in KEYS}
    out["month"] = month if isinstance(month, str) and re.match(r"^\d{4}-(0[1-9]|1[0-2])$", month) else None
    if all(out[k] is None for k in KEYS):
        raise HTTPException(status_code=422, detail="На изображении не найдено данных тлуша")
    return out
