"""Backend test suite for Zantia Formação — auth, admin actions, telegram, quiz attempts."""
import os
import sys
import time
import uuid
import json
import requests

BASE = "https://renewable-skills-hub.preview.emergentagent.com/api"

ADMIN_EMAIL = "macedo.sousa001@gmail.com"
ADMIN_PASSWORD = "448225Ms"

results = []


def log(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})


def req(method: str, path: str, token: str = None, **kw):
    headers = kw.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, BASE + path, headers=headers, timeout=30, **kw)


def main():
    # Unique formando email for this run
    suffix = uuid.uuid4().hex[:8]
    formando_email = f"ana.silva.{suffix}@example.com"
    formando_password = "Teste@2026"
    formando_phone = "912345678"

    # ---------- 1) Register with phone ----------
    r = req("POST", "/auth/register", json={
        "email": formando_email,
        "password": formando_password,
        "name": "Ana Silva",
        "phone": formando_phone,
    })
    ok = r.status_code == 200
    body = r.json() if ok else {}
    user = (body.get("user") or {}) if ok else {}
    formando_token = body.get("access_token", "") if ok else ""
    formando_id = user.get("id", "") if ok else ""
    cond = (
        ok
        and user.get("status") == "pending"
        and user.get("phone") == formando_phone
        and bool(user.get("telegram_start_token"))
        and user.get("telegram_linked") is False
    )
    log("1) Register with phone -> pending UserOut",
        cond, f"HTTP {r.status_code} body={body}")
    formando_start_token = user.get("telegram_start_token", "")

    # ---------- 2) Register with missing/short phone -> 400 ----------
    r1 = req("POST", "/auth/register", json={
        "email": f"x.{suffix}@example.com",
        "password": "Teste@2026",
        "name": "X",
        "phone": "",
    })
    r2 = req("POST", "/auth/register", json={
        "email": f"y.{suffix}@example.com",
        "password": "Teste@2026",
        "name": "Y",
        "phone": "12",
    })
    log("2) Register with missing phone -> 400",
        r1.status_code == 400, f"HTTP {r1.status_code} {r1.text[:120]}")
    log("2b) Register with short phone -> 400",
        r2.status_code == 400, f"HTTP {r2.status_code} {r2.text[:120]}")

    # ---------- 3) Login admin -> 200, status approved, role admin ----------
    r = req("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    ok = r.status_code == 200
    body = r.json() if ok else {}
    admin_user = body.get("user") or {}
    admin_token = body.get("access_token", "") if ok else ""
    cond = ok and admin_user.get("role") == "admin" and admin_user.get("status") == "approved"
    log("3) Admin login -> approved admin",
        cond, f"HTTP {r.status_code} role={admin_user.get('role')} status={admin_user.get('status')}")

    # ---------- 18) Confirm admin phone & status post-seed ----------
    log("18) Admin phone=964177779 and status=approved",
        admin_user.get("phone") == "964177779" and admin_user.get("status") == "approved",
        f"phone={admin_user.get('phone')} status={admin_user.get('status')}")

    # ---------- 4) Login pending formando -> 200, status pending ----------
    r = req("POST", "/auth/login", json={"email": formando_email, "password": formando_password})
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = ok and (body.get("user") or {}).get("status") == "pending"
    log("4) Pending user login -> 200 status=pending",
        cond, f"HTTP {r.status_code} status={(body.get('user') or {}).get('status')}")
    # refresh formando token
    if ok:
        formando_token = body.get("access_token", "")

    # ---------- 5) GET /me with admin token ----------
    r = req("GET", "/auth/me", token=admin_token)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = ok and body.get("email") == ADMIN_EMAIL and "telegram_linked" in body and "phone" in body
    log("5) GET /auth/me admin -> full UserOut",
        cond, f"HTTP {r.status_code} keys={list(body.keys()) if ok else r.text[:120]}")

    # ---------- 6) PUT /me update name+phone ----------
    r = req("PUT", "/auth/me", token=formando_token, json={
        "name": "Novo Nome",
        "phone": "912000000",
    })
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = ok and body.get("name") == "Novo Nome" and body.get("phone") == "912000000"
    log("6) PUT /auth/me name+phone update",
        cond, f"HTTP {r.status_code} body={body if ok else r.text[:120]}")

    # ---------- 7) PUT /me with short password -> 400 ----------
    r = req("PUT", "/auth/me", token=formando_token, json={"password": "abc"})
    log("7) PUT /auth/me short password -> 400",
        r.status_code == 400, f"HTTP {r.status_code} {r.text[:120]}")

    # ---------- 8) GET /telegram-link as authenticated ----------
    r = req("GET", "/auth/telegram-link", token=formando_token)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = (
        ok
        and body.get("bot_username") == "ApoioZantiaBot"
        and body.get("linked") is False
        and isinstance(body.get("token"), str) and len(body["token"]) > 0
        and isinstance(body.get("url"), str) and "t.me/ApoioZantiaBot?start=" in body["url"]
    )
    log("8) GET /auth/telegram-link returns t.me URL",
        cond, f"HTTP {r.status_code} body={body if ok else r.text[:200]}")
    # capture refreshed start token
    refreshed_start_token = body.get("token", formando_start_token) if ok else formando_start_token

    # ---------- 9) GET /auth/users access control ----------
    r = req("GET", "/auth/users")
    log("9a) GET /auth/users no token -> 401",
        r.status_code == 401, f"HTTP {r.status_code} {r.text[:120]}")
    r = req("GET", "/auth/users", token=formando_token)
    log("9b) GET /auth/users non-admin -> 403",
        r.status_code == 403, f"HTTP {r.status_code} {r.text[:120]}")
    r = req("GET", "/auth/users", token=admin_token)
    ok = r.status_code == 200
    arr = r.json() if ok else []
    found = next((u for u in arr if u.get("id") == formando_id), None)
    cond = ok and isinstance(arr, list) and found is not None and found.get("status") == "pending"
    log("9c) GET /auth/users admin includes new pending user",
        cond, f"HTTP {r.status_code} count={len(arr) if ok else 'NA'} found={bool(found)}")

    # ---------- 10) Approve pending user ----------
    r = req("POST", f"/auth/users/{formando_id}/action", token=admin_token,
            json={"action": "approve"})
    ok = r.status_code == 200
    log("10a) Admin approve action -> 200",
        ok, f"HTTP {r.status_code} {r.text[:200]}")
    r = req("GET", "/auth/users", token=admin_token)
    arr = r.json() if r.status_code == 200 else []
    found = next((u for u in arr if u.get("id") == formando_id), None)
    log("10b) After approve, user status=approved",
        found is not None and found.get("status") == "approved",
        f"status={found.get('status') if found else 'missing'}")

    # ---------- 14) Quiz attempts pending vs approved ----------
    # Create a second pending user to test the pending-block on quiz attempts
    pending_email = f"pendente.{suffix}@example.com"
    pending_password = "Teste@2026"
    r = req("POST", "/auth/register", json={
        "email": pending_email,
        "password": pending_password,
        "name": "Pendente",
        "phone": "913999999",
    })
    pending_token = r.json().get("access_token", "") if r.status_code == 200 else ""
    pending_id = (r.json().get("user") or {}).get("id", "") if r.status_code == 200 else ""
    r = req("POST", "/auth/quiz-attempts", token=pending_token, json={
        "entity_type": "gavetoes",
        "entity_id": "g1",
        "entity_title": "Fotovoltaico",
        "score": 3,
        "total": 5,
    })
    log("14a) Quiz attempt as pending user -> 403",
        r.status_code == 403, f"HTTP {r.status_code} {r.text[:120]}")

    # Approved user (the formando we approved above)
    r = req("POST", "/auth/quiz-attempts", token=formando_token, json={
        "entity_type": "gavetoes",
        "entity_id": "g1",
        "entity_title": "Fotovoltaico",
        "score": 4,
        "total": 5,
    })
    log("14b) Quiz attempt as approved user -> 200",
        r.status_code == 200, f"HTTP {r.status_code} {r.text[:200]}")

    # ---------- 11) Reject another user, then login -> 403 with 'rejeitada' ----------
    # Use 'pending_id' for reject scenario
    r = req("POST", f"/auth/users/{pending_id}/action", token=admin_token,
            json={"action": "reject"})
    log("11a) Reject action -> 200",
        r.status_code == 200, f"HTTP {r.status_code} {r.text[:200]}")
    r = req("POST", "/auth/login", json={"email": pending_email, "password": pending_password})
    cond = r.status_code == 403 and "rejeitada" in (r.text or "").lower()
    log("11b) Login rejected user -> 403 'rejeitada'",
        cond, f"HTTP {r.status_code} {r.text[:200]}")

    # ---------- 12) Promote / demote ----------
    # Create another approved user to promote (use formando_id which is now approved)
    r = req("POST", f"/auth/users/{formando_id}/action", token=admin_token,
            json={"action": "promote"})
    ok1 = r.status_code == 200
    body = r.json() if ok1 else {}
    promoted = body.get("user") or {}
    log("12a) Promote -> role=admin status=approved",
        ok1 and promoted.get("role") == "admin" and promoted.get("status") == "approved",
        f"HTTP {r.status_code} role={promoted.get('role')} status={promoted.get('status')}")

    r = req("POST", f"/auth/users/{formando_id}/action", token=admin_token,
            json={"action": "demote"})
    ok2 = r.status_code == 200
    body = r.json() if ok2 else {}
    demoted = body.get("user") or {}
    log("12b) Demote -> role=formando",
        ok2 and demoted.get("role") == "formando",
        f"HTTP {r.status_code} role={demoted.get('role')}")

    # ---------- 13) Bad id / invalid action ----------
    r = req("POST", "/auth/users/nonexistent-id-xyz/action", token=admin_token,
            json={"action": "approve"})
    log("13a) Action on bad id -> 404",
        r.status_code == 404, f"HTTP {r.status_code} {r.text[:120]}")
    r = req("POST", f"/auth/users/{formando_id}/action", token=admin_token,
            json={"action": "explode"})
    log("13b) Invalid action -> 400",
        r.status_code == 400, f"HTTP {r.status_code} {r.text[:120]}")

    # ---------- 15) Telegram webhook /start (no token) ----------
    r = req("POST", "/telegram/webhook", json={
        "message": {"chat": {"id": 12345}, "text": "/start"}
    })
    log("15) Telegram webhook /start -> 200 ok",
        r.status_code == 200 and r.json().get("ok") is True,
        f"HTTP {r.status_code} {r.text[:120]}")

    # ---------- 16) Telegram webhook /start <valid_token> links chat ----------
    # We need a fresh user with a known telegram_start_token. We have refreshed_start_token from /telegram-link.
    # But formando_id was promoted then demoted - that's fine; it still has telegram_start_token.
    # Use a brand new user to avoid noise.
    link_email = f"link.{suffix}@example.com"
    link_password = "Teste@2026"
    r = req("POST", "/auth/register", json={
        "email": link_email,
        "password": link_password,
        "name": "Link Test",
        "phone": "919888777",
    })
    if r.status_code != 200:
        log("16-prep) register link user", False, f"HTTP {r.status_code} {r.text[:200]}")
        link_token = ""
        link_user_id = ""
        link_start_token = ""
    else:
        b = r.json()
        link_token = b.get("access_token", "")
        link_user = b.get("user") or {}
        link_user_id = link_user.get("id", "")
        link_start_token = link_user.get("telegram_start_token", "")
        log("16-prep) register link user", True,
            f"id={link_user_id} token_len={len(link_start_token)}")

    if link_start_token:
        r = req("POST", "/telegram/webhook", json={
            "message": {"chat": {"id": 99999}, "text": f"/start {link_start_token}"}
        })
        log("16a) Webhook /start <valid_token> -> 200",
            r.status_code == 200 and r.json().get("ok") is True,
            f"HTTP {r.status_code} {r.text[:200]}")

        # Wait a moment for DB update
        time.sleep(0.5)
        r = req("GET", "/auth/me", token=link_token)
        ok = r.status_code == 200
        body = r.json() if ok else {}
        log("16b) After webhook link, GET /me -> telegram_linked=true",
            ok and body.get("telegram_linked") is True,
            f"HTTP {r.status_code} telegram_linked={body.get('telegram_linked')}")
    else:
        log("16) skipped (no link_start_token)", False, "couldn't register link user")

    # ---------- 17) GET /api/gavetoes still works ----------
    r = req("GET", "/gavetoes")
    ok = r.status_code == 200
    arr = r.json() if ok else []
    cond = ok and isinstance(arr, list) and len(arr) >= 1 and "gavetinhas" in arr[0]
    log("17) GET /gavetoes unchanged surface",
        cond, f"HTTP {r.status_code} count={len(arr) if ok else 'NA'}")

    # ---------- Summary ----------
    print("\n========== SUMMARY ==========")
    fails = [r for r in results if not r["ok"]]
    print(f"Total: {len(results)}  Pass: {len(results) - len(fails)}  Fail: {len(fails)}")
    for f in fails:
        print(f"  [FAIL] {f['name']} :: {f['detail'][:200]}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
