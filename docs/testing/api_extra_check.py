"""Test bổ sung: refresh/logout token, search/filter/sort/pagination. Dùng: python3 api_extra_check.py"""
import json, urllib.request, urllib.error, time
B = "http://localhost:8000/api/v1"
res = []
def call(m, p, tok=None, body=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = f"Bearer {tok}"
    r = urllib.request.Request(B + p, method=m, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.load(f)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {}
def chk(name, cond, extra=""):
    res.append(cond); print("PASS" if cond else "FAIL", name, extra)
def items(d): x = d["data"]; return x if isinstance(x, list) else x["items"]

def login(email, pw="Test@12345"):
    for _ in range(8):
        s, d = call("POST", "/auth/login/", body={"email": email, "password": pw})
        if s != 429: return s, d
        time.sleep(10)
    return s, d

# ---- token lifecycle
s, d = login("user2@gamereview.test"); chk("login 200", s == 200)
acc, ref = d["data"]["access"], d["data"]["refresh"]
s, d2 = call("POST", "/auth/refresh/", body={"refresh": ref}); chk("refresh -> new access", s == 200 and d2["data"].get("access"))
ref2 = d2["data"].get("refresh", ref)
chk("refresh rotates refresh token", ref2 != ref)
s, _ = call("POST", "/auth/refresh/", body={"refresh": ref}); chk("old (rotated) refresh rejected", s == 401, s)
s, _ = call("POST", "/auth/refresh/", body={"refresh": "garbage"}); chk("garbage refresh rejected", s == 401, s)
s, _ = call("GET", "/auth/me/", d2["data"]["access"]); chk("new access works", s == 200)
s, _ = call("GET", "/auth/me/", "garbage"); chk("garbage access -> 401", s == 401, s)
s, _ = call("POST", "/auth/logout/", body={"refresh": ref2}); chk("logout 200", s == 200, s)
s, _ = call("POST", "/auth/refresh/", body={"refresh": ref2}); chk("refresh after logout rejected", s == 401, s)
s, _ = call("POST", "/auth/login/", body={"email": "user2@gamereview.test", "password": "wrong"}); chk("wrong password 401", s == 401, s)
s, _ = call("POST", "/auth/register/", body={"email": "user1@gamereview.test", "password": "Str0ng!Pass#9"}); chk("register duplicate email 400", s == 400, s)
s, _ = call("POST", "/auth/register/", body={"email": "not-an-email", "password": "Str0ng!Pass#9"}); chk("register invalid email 400", s in (400, 429), s)

# ---- games list
s, d = call("GET", "/games/"); allg = d["data"]
chk("games paginated envelope", s == 200 and "pagination" in allg, allg["pagination"])
total = allg["pagination"]["total"]
s, d = call("GET", "/games/?page_size=3"); chk("page_size=3", len(items(d)) == 3)
s, d = call("GET", "/games/?page_size=3&page=2"); p2 = [g["slug"] for g in items(d)]
s, d = call("GET", "/games/?page_size=3&page=1"); p1 = [g["slug"] for g in items(d)]
chk("page 2 differs from page 1", p1 and p2 and not set(p1) & set(p2))
s, _ = call("GET", "/games/?page=9999"); chk("page out of range 404", s == 404, s)
s, d = call("GET", "/games/?search=elden"); chk("search 'elden'", [g["slug"] for g in items(d)] == ["elden-ring"], [g["slug"] for g in items(d)])
s, d = call("GET", "/games/?search=zzzzqqq"); chk("search no result -> empty", s == 200 and items(d) == [])
s, d = call("GET", "/games/?ordering=name"); n = [g["name"] for g in items(d)]; chk("ordering name asc", n == sorted(n), n[:3])
s, d = call("GET", "/games/?ordering=-name"); n = [g["name"] for g in items(d)]; chk("ordering name desc", n == sorted(n, reverse=True))
s, d = call("GET", "/games/?ordering=release_date"); r = [g["release_date"] for g in items(d)]; chk("ordering release_date", r == sorted(r))
s, d = call("GET", "/games/?ordering=-release_date"); r = [g["release_date"] for g in items(d)]; chk("ordering -release_date", r == sorted(r, reverse=True))
s, d = call("GET", "/categories/"); cats = items(d) if "items" in str(type(d["data"])) or isinstance(d["data"], list) else d["data"]
cats = d["data"] if isinstance(d["data"], list) else d["data"]["items"]
cs = cats[0]["slug"]
s, d = call("GET", f"/games/?category={cs}"); g = items(d)
chk("filter by category", s == 200 and all(x["category"]["slug"] == cs for x in g) and len(g) > 0, f"{cs}:{len(g)}")
s, d = call("GET", "/games/?category=nope-xyz"); chk("unknown category -> empty/400, not 500", s in (200, 400) and (s == 400 or items(d) == []), s)
s, d = call("GET", "/games/?ordering=password"); chk("invalid ordering safe (not 500)", s in (200, 400), s)
s, d = call("GET", "/games/hollow-knight/"); g = d["data"]
chk("detail has avg rating + review_count", "average_rating" in g and "review_count" in g, f'{g["average_rating"]} / {g["review_count"]}')
# rating math matches reviews
s, rv = call("GET", "/games/hollow-knight/reviews/?page_size=100"); rr = [x["rating"] for x in items(rv)]
chk("average_rating == mean of reviews", rr and abs(sum(rr)/len(rr) - g["average_rating"]) < 0.01 and len(rr) == g["review_count"], f"{rr}")
for o, key, rev in [("rating", "rating", False), ("-rating", "rating", True), ("created_at", "created_at", False), ("-created_at", "created_at", True)]:
    s, rv = call("GET", f"/games/hollow-knight/reviews/?ordering={o}&page_size=100"); v = [x[key] for x in items(rv)]
    chk(f"reviews ordering {o}", s == 200 and v == sorted(v, reverse=rev), v[:4])
s, _ = call("GET", "/games/not-exist/"); chk("unknown game 404", s == 404, s)
s, _ = call("GET", "/nonexistent/"); chk("unknown API url -> JSON 404", s == 404, s)
s, d = call("GET", "/health/"); chk("health ok", s == 200)

# ---- admin lists: search/filter/pagination
_, a = login("admin1@gamereview.test"); A = a["data"]["access"]
s, d = call("GET", "/admin/users/?search=alice", A); chk("admin users search", s == 200 and any("alice" in u["email"] for u in items(d)))
s, d = call("GET", "/admin/users/?page_size=2", A); chk("admin users page_size", len(items(d)) == 2)
s, d = call("GET", "/admin/reports/?status=PENDING", A); chk("admin reports status filter", s == 200, s)
s, d = call("GET", "/admin/reports/?status=RESOLVED", A); chk("admin reports resolved filter", s == 200, s)
s, d = call("GET", "/admin/comments/?hidden=true", A); chk("admin comments hidden filter", s == 200, s)
s, d = call("GET", "/admin/reviews/?search=a", A); chk("admin reviews search", s == 200, s)
s, d = call("GET", "/games/?status=INACTIVE", A); chk("admin sees INACTIVE via filter", s == 200 and all(g["status"] == "INACTIVE" for g in items(d)) and items(d), len(items(d)))
s, d = call("GET", "/games/"); inact = [g for g in items(d) if g["status"] == "INACTIVE"]; chk("guest list excludes INACTIVE", not inact)
print("TOTAL", len(res), "FAIL", res.count(False))
