"""Backend API integration tests for Smena work-day tracker.
Covers: auth, settings, timer, entries, holidays, stats, chat history, calc correctness.
Uses REACT_APP_BACKEND_URL against public preview URL.
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://hours-dashboard-20.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

DEMO_EMAIL = "demo@smena.app"
DEMO_PASS = "demo12345"


# --------- fixtures ---------
@pytest.fixture(scope="session")
def new_user():
    """Freshly registered user - one per test session (avoids demo data collisions)."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Password123!", "name": "Tester"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "password": "Password123!", "token": d["access_token"], "user": d["user"], "refresh": d["refresh_token"]}


@pytest.fixture(scope="session")
def auth_headers(new_user):
    return {"Authorization": f"Bearer {new_user['token']}"}


@pytest.fixture(scope="session")
def demo_headers():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    if r.status_code != 200:
        pytest.skip(f"demo login failed: {r.status_code} {r.text}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --------- auth ---------
class TestAuth:
    def test_register_duplicate(self, new_user):
        r = requests.post(f"{API}/auth/register", json={"email": new_user["email"], "password": "x1x2x3x4"})
        assert r.status_code == 400

    def test_login_wrong_password(self, new_user):
        r = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": "wrongpass!"})
        assert r.status_code == 401

    def test_login_correct(self, new_user):
        r = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and "refresh_token" in d
        assert d["user"]["email"] == new_user["email"]

    def test_me(self, auth_headers, new_user):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_refresh(self, new_user):
        r = requests.post(f"{API}/auth/refresh", json={"refresh_token": new_user["refresh"]})
        assert r.status_code == 200
        assert "access_token" in r.json()


# --------- settings ---------
class TestSettings:
    def test_get_defaults(self, auth_headers):
        r = requests.get(f"{API}/settings", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["hourly_rate"] == 50.0
        assert d["currency"] == "₪"
        assert len(d["day_types"]) >= 10
        keys = {t["key"] for t in d["day_types"]}
        assert {"work", "vacation", "short_bonus", "holiday", "weekend", "unpaid", "sick"}.issubset(keys)

    def test_update_and_persist(self, auth_headers):
        r = requests.put(f"{API}/settings", headers=auth_headers, json={"hourly_rate": 75.5, "monthly_goal_income": 12000})
        assert r.status_code == 200
        assert r.json()["hourly_rate"] == 75.5
        # reload
        r2 = requests.get(f"{API}/settings", headers=auth_headers)
        assert r2.json()["hourly_rate"] == 75.5
        assert r2.json()["monthly_goal_income"] == 12000
        # revert
        requests.put(f"{API}/settings", headers=auth_headers, json={"hourly_rate": 50.0})


# --------- entries / calc ---------
class TestEntries:
    def test_upsert_work_entry_calc(self, auth_headers):
        # 08:00-17:00 no break with hourly 50, norm 8h -> 8h @100% + 1h @125% = 400 + 62.5 = 462.5
        payload = {"day_type": "work",
                   "segments": [{"start": "08:00", "end": "17:00"}],
                   "break_minutes": 0, "comment": "TEST_calc"}
        r = requests.put(f"{API}/entries/2026-03-10", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        calc = d.get("calc") or d
        # Accept nested response shape variations
        if "calc" not in d and "gross" in d:
            calc = d
        # Fetch day to confirm persisted calc
        r2 = requests.get(f"{API}/day/2026-03-10", headers=auth_headers)
        assert r2.status_code == 200
        di = r2.json()
        c = di["calc"]
        assert c is not None
        assert abs(c["worked_hours"] - 9.0) < 0.01
        assert abs(c["gross"] - 462.5) < 0.5, f"expected gross 462.5, got {c['gross']} breakdown={c['breakdown']}"
        bd = c["breakdown"]
        assert abs(bd.get("100", 0) - 8.0) < 0.01
        assert abs(bd.get("125", 0) - 1.0) < 0.01

    def test_delete_entry(self, auth_headers):
        payload = {"day_type": "work", "segments": [{"start": "09:00", "end": "12:00"}]}
        requests.put(f"{API}/entries/2026-03-11", headers=auth_headers, json=payload)
        r = requests.delete(f"{API}/entries/2026-03-11", headers=auth_headers)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/day/2026-03-11", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json().get("entry") in (None, {}) or not r2.json().get("entry")

    def test_bulk_vacation(self, auth_headers):
        r = requests.post(f"{API}/entries/bulk", headers=auth_headers,
                          json={"start": "2026-05-04", "end": "2026-05-08", "day_type": "vacation",
                                "only_workdays": True, "comment": "TEST_bulk"})
        assert r.status_code == 200
        # Verify at least one entry created
        r2 = requests.get(f"{API}/entries?start=2026-05-04&end=2026-05-08", headers=auth_headers)
        assert r2.status_code == 200
        entries = r2.json()
        assert len(entries) >= 3
        assert all(e["day_type"] == "vacation" for e in entries)

    def test_short_bonus_credited(self, auth_headers):
        # short_bonus with 8h segment: worked 8, credited = 8 * 1.3 = 10.4
        r = requests.put(f"{API}/entries/2026-03-12", headers=auth_headers,
                         json={"day_type": "short_bonus",
                               "segments": [{"start": "08:00", "end": "16:00"}]})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/day/2026-03-12", headers=auth_headers)
        c = r2.json()["calc"]
        assert abs(c["worked_hours"] - 8.0) < 0.01
        assert abs(c["credited_hours"] - 10.4) < 0.05
        assert c["bonus_pct"] == 30


# --------- timer ---------
class TestTimer:
    def test_timer_flow(self, auth_headers):
        # start
        r = requests.post(f"{API}/timer/start", headers=auth_headers,
                          json={"date": "2026-04-01", "time": "09:00"})
        assert r.status_code == 200, r.text
        # active
        r2 = requests.get(f"{API}/timer?date=2026-04-01", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["active"] is not None
        # stop
        r3 = requests.post(f"{API}/timer/stop", headers=auth_headers, json={"time": "17:00"})
        assert r3.status_code == 200
        # confirm no active
        r4 = requests.get(f"{API}/timer?date=2026-04-01", headers=auth_headers)
        assert r4.json()["active"] is None


# --------- holidays ---------
class TestHolidays:
    def test_israeli_holidays_2026(self, auth_headers):
        r = requests.get(f"{API}/holidays?year=2026", headers=auth_headers)
        assert r.status_code == 200
        hols = r.json()
        assert isinstance(hols, list) and len(hols) > 5
        names = " ".join(h["name"] for h in hols)
        assert "Рош ха-Шана" in names, f"missing Rosh Hashanah in: {names[:400]}"
        assert "Йом Кипур" in names, f"missing Yom Kippur"

    def test_custom_holiday(self, auth_headers):
        r = requests.put(f"{API}/holidays/2026-12-25", headers=auth_headers,
                         json={"name": "TEST_holiday", "day_off": True, "day_type": "holiday"})
        assert r.status_code == 200
        r2 = requests.delete(f"{API}/holidays/2026-12-25", headers=auth_headers)
        assert r2.status_code == 200


# --------- stats ---------
class TestStats:
    def test_month_stats(self, auth_headers):
        # ensure at least one entry in the month under test (xdist workers have separate fixture sessions)
        requests.put(f"{API}/entries/2026-03-15", headers=auth_headers,
                     json={"day_type": "work", "segments": [{"start": "09:00", "end": "17:00"}]})
        r = requests.get(f"{API}/stats/month?month=2026-03", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["month"] == "2026-03"
        assert "totals" in d and "tax" in d and "days" in d
        assert len(d["days"]) == 31
        assert d["totals"]["gross"] > 0

    def test_year_stats(self, auth_headers):
        r = requests.get(f"{API}/stats/year?year=2026", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "months" in d or "totals" in d


# --------- chat (iteration 2: sessions no longer stored on server) ---------
class TestChat:
    def test_history_endpoint_removed(self, auth_headers):
        r = requests.get(f"{API}/chat/history", headers=auth_headers)
        assert r.status_code in (404, 405), f"chat/history should be removed, got {r.status_code}"

    def test_transcribe_too_small(self, auth_headers):
        files = {"file": ("tiny.webm", b"12345", "audio/webm")}
        r = requests.post(f"{API}/chat/transcribe", headers=auth_headers, files=files)
        assert r.status_code == 400, f"too small file should be 400, got {r.status_code} {r.text}"

    def test_transcribe_no_auth(self):
        files = {"file": ("tiny.webm", b"x" * 600, "audio/webm")}
        r = requests.post(f"{API}/chat/transcribe", files=files)
        assert r.status_code == 401


# --------- iteration 2: reports ---------
class TestReports:
    def test_report_pdf(self, demo_headers):
        r = requests.get(f"{API}/reports/month?month=2026-09&format=pdf", headers=demo_headers)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert r.content[:4] == b"%PDF", "not a PDF"

    def test_report_xlsx(self, demo_headers):
        r = requests.get(f"{API}/reports/month?month=2026-09&format=xlsx", headers=demo_headers)
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "officedocument" in ct, ct
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        # xlsx = zip; starts with PK
        assert r.content[:2] == b"PK"

    def test_report_no_auth(self):
        r = requests.get(f"{API}/reports/month?month=2026-09&format=pdf")
        assert r.status_code == 401


# --------- iteration 2: sick law (Israeli 0/50/50/100) ---------
class TestSickLaw:
    def test_sick_streak_pay_percent(self, auth_headers):
        # ensure sick_law enabled + 5-day work-week defaults
        requests.put(f"{API}/settings", headers=auth_headers,
                     json={"sick_law_il": True, "work_days": [0, 1, 2, 3, 4], "hourly_rate": 50.0})
        # Sun-Wed 2026-06-07..10 are Sun/Mon/Tue/Wed in 2026 (Sun=0)
        dates = ["2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"]
        expected_pct = [0, 50, 50, 100]
        expected_sick_day = [1, 2, 3, 4]
        for d in dates:
            r = requests.put(f"{API}/entries/{d}", headers=auth_headers,
                             json={"day_type": "sick", "comment": "TEST_sick"})
            assert r.status_code == 200, r.text
        # Fetch stats and validate calc.pay_percent + calc.sick_day
        r = requests.get(f"{API}/stats/month?month=2026-06", headers=auth_headers)
        assert r.status_code == 200
        days = {d["date"]: d for d in r.json()["days"]}
        for d, pct, n in zip(dates, expected_pct, expected_sick_day):
            c = days[d]["calc"]
            assert c is not None, d
            assert c["day_type"] == "sick"
            assert c["sick_day"] == n, f"{d}: sick_day expected {n} got {c['sick_day']}"
            assert c["pay_percent"] == pct, f"{d}: pay_percent expected {pct} got {c['pay_percent']}"

    def test_sick_law_off_pays_100(self, auth_headers):
        requests.put(f"{API}/settings", headers=auth_headers, json={"sick_law_il": False})
        # existing sick entries from previous test now should have pay_percent 100
        r = requests.get(f"{API}/stats/month?month=2026-06", headers=auth_headers)
        days = {d["date"]: d for d in r.json()["days"]}
        c = days["2026-06-07"]["calc"]
        assert c["pay_percent"] == 100, c
        # restore
        requests.put(f"{API}/settings", headers=auth_headers, json={"sick_law_il": True})
        # cleanup
        for d in ["2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"]:
            requests.delete(f"{API}/entries/{d}", headers=auth_headers)


# --------- iteration 2: settings reminders / timezone ---------
class TestReminderSettings:
    def test_persist_reminders(self, auth_headers):
        payload = {"reminders_enabled": True, "reminder_start_time": "09:15",
                   "reminder_end_time": "18:45", "timezone": "Europe/Moscow"}
        r = requests.put(f"{API}/settings", headers=auth_headers, json=payload)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/settings", headers=auth_headers)
        d = r2.json()
        assert d["reminders_enabled"] is True
        assert d["reminder_start_time"] == "09:15"
        assert d["reminder_end_time"] == "18:45"
        assert d["timezone"] == "Europe/Moscow"
        # restore
        requests.put(f"{API}/settings", headers=auth_headers,
                     json={"reminders_enabled": False, "reminder_start_time": "08:30",
                           "reminder_end_time": "18:00", "timezone": "Asia/Jerusalem"})


# --------- iteration 2: push API ---------
class TestPush:
    def test_vapid_key(self, auth_headers):
        r = requests.get(f"{API}/push/key", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json().get("key"), str) and len(r.json()["key"]) > 40

    def test_subscribe_unsubscribe(self, auth_headers):
        fake_endpoint = f"https://fake.push.example/{uuid.uuid4().hex}"
        sub = {"endpoint": fake_endpoint,
               "keys": {"p256dh": "BFAKE_p256dh_key_dummy_value_for_test_00000",
                        "auth": "FAKE_auth_dummy"}}
        r = requests.post(f"{API}/push/subscribe", headers=auth_headers, json=sub)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # test send (may prune the fake endpoint silently)
        r2 = requests.post(f"{API}/push/test", headers=auth_headers)
        assert r2.status_code == 200
        assert "sent" in r2.json()
        # unsubscribe
        r3 = requests.post(f"{API}/push/unsubscribe", headers=auth_headers, json={"endpoint": fake_endpoint})
        assert r3.status_code == 200


# --------- iteration 2: cron reminders webhook ---------
class TestCron:
    def test_cron_no_auth(self):
        r = requests.post(f"{API}/cron/reminders")
        assert r.status_code == 401

    def test_cron_wrong_secret(self):
        r = requests.post(f"{API}/cron/reminders", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401

    def test_cron_authed_and_idempotent(self):
        secret = os.environ.get("WEBHOOK_CRON_SECRET") or _read_secret_from_env()
        assert secret, "WEBHOOK_CRON_SECRET missing"
        run_id = f"test-{uuid.uuid4().hex}"
        h = {"Authorization": f"Bearer {secret}", "X-Webhook-Id": run_id}
        r = requests.post(f"{API}/cron/reminders", headers=h)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        assert r.json().get("duplicate") in (None, False)
        # replay same run_id
        r2 = requests.post(f"{API}/cron/reminders", headers=h)
        assert r2.status_code == 200
        assert r2.json().get("duplicate") is True


def _read_secret_from_env():
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("WEBHOOK_CRON_SECRET"):
                    v = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return v
    except FileNotFoundError:
        pass
    return None


# --------- iteration 2: PWA static assets ---------
class TestPWA:
    def test_manifest(self):
        r = requests.get(f"{BASE}/manifest.json")
        assert r.status_code == 200
        d = r.json()
        assert "icons" in d and len(d["icons"]) >= 2
        assert d.get("display") == "standalone"

    def test_sw(self):
        r = requests.get(f"{BASE}/sw.js")
        assert r.status_code == 200
        assert "push" in r.text.lower()

    def test_icons_exist(self):
        for path in ("/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"):
            r = requests.get(f"{BASE}{path}")
            assert r.status_code == 200, path

    def test_index_meta(self):
        r = requests.get(f"{BASE}/")
        assert r.status_code == 200
        assert "apple-touch-icon" in r.text
        assert "manifest.json" in r.text


# --------- demo seeded data smoke ---------
class TestDemo:
    def test_demo_has_month_data(self, demo_headers):
        # server is 2026-09 approx; check current or nearby month has data
        for m in ["2026-09", "2026-08", "2026-07"]:
            r = requests.get(f"{API}/stats/month?month={m}", headers=demo_headers)
            assert r.status_code == 200
            if r.json()["totals"]["gross"] > 0:
                return
        pytest.fail("demo user had no gross across recent months")
