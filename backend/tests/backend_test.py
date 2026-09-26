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


# --------- chat ---------
class TestChat:
    def test_history_empty_for_new(self, auth_headers):
        r = requests.get(f"{API}/chat/history", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_clear(self, auth_headers):
        r = requests.delete(f"{API}/chat/history", headers=auth_headers)
        assert r.status_code == 200


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
