"""Chạy ma trận quyền theo role trên API thật. Dùng: python3 role_matrix_check.py"""
import json, urllib.request, urllib.error, time
B = "http://localhost:8000/api/v1"
PW = "Test@12345"

def call(method, path, tok=None, body=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = f"Bearer {tok}"
    r = urllib.request.Request(B + path, method=method, headers=h,
                               data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.load(f)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {}

def login(email):
    s, d = call("POST", "/auth/login/", body={"email": email, "password": PW})
    return s, (d.get("data") or {}).get("access")

def items(d):
    x = d["data"]
    return x if isinstance(x, list) else x["items"]

T = {}
for k, e in [("super","superadmin@gamereview.test"),("admin1","admin1@gamereview.test"),
             ("user1","user1@gamereview.test"),("user2","user2@gamereview.test"),
             ("user3","user3@gamereview.test")]:
    s, T[k] = login(e); assert s == 200, (e, s)
T["guest"] = None
ls, _ = login("locked@gamereview.test")

results = []
def chk(case, who, method, path, body, expect, tok_key=None):
    s, d = call(method, path, T.get(tok_key or who), body)
    ok = s in (expect if isinstance(expect, (list, tuple)) else [expect])
    results.append((case, who, f"{method} {path}", expect, s, "PASS" if ok else "FAIL"))
    return d

uniq = str(int(time.time()))
chk("Locked user login", "locked", "POST", "/auth/login/", {"email":"locked@gamereview.test","password":PW}, 401, "guest")
# public reads
for w in ["guest","user1","admin1"]:
    chk("List games", w, "GET", "/games/", None, 200)
    chk("Game detail", w, "GET", "/games/elden-ring/", None, 200)
# me
chk("GET /auth/me", "guest", "GET", "/auth/me/", None, 401)
chk("GET /auth/me", "user1", "GET", "/auth/me/", None, 200)
chk("PATCH /auth/me", "user1", "PATCH", "/auth/me/", {"first_name":"User"}, 200)
# category / game write
cat = {"name": f"Cat{uniq}", "slug": f"cat{uniq}"}
chk("Create category", "guest", "POST", "/categories/", cat, 401)
chk("Create category", "user1", "POST", "/categories/", cat, 403)
d = chk("Create category", "admin1", "POST", "/categories/", cat, 201)
cid = d["data"]["id"]
chk("Update category", "user1", "PATCH", f"/categories/{cid}/", {"name": f"Cat{uniq}x"}, 403)
chk("Update category", "admin1", "PATCH", f"/categories/{cid}/", {"name": f"Cat{uniq}x"}, 200)
game = {"name": f"G{uniq}", "slug": f"g{uniq}", "description":"d","developer":"dev","publisher":"pub",
        "release_date":"2024-01-01","cover_image":"","status":"INACTIVE","category_id":cid}
chk("Create game", "guest", "POST", "/games/", game, 401)
chk("Create game", "user1", "POST", "/games/", game, 403)
d = chk("Create game (INACTIVE)", "admin1", "POST", "/games/", game, 201)
gid = d["data"]["id"]; gslug = f"g{uniq}"
chk("INACTIVE game hidden", "guest", "GET", f"/games/{gslug}/", None, 404)
chk("INACTIVE game hidden", "user1", "GET", f"/games/{gslug}/", None, 404)
chk("INACTIVE game visible", "admin1", "GET", f"/games/{gslug}/", None, 200)
chk("Update game", "user1", "PATCH", f"/games/{gid}/", {"status":"ACTIVE"}, 403)
chk("Update game (ACTIVE)", "admin1", "PATCH", f"/games/{gid}/", {"status":"ACTIVE"}, 200)
# reviews
rv = {"rating": 4, "content": "Good game"}
chk("Create review", "guest", "POST", f"/games/{gslug}/reviews/", rv, 401)
d = chk("Create review", "user1", "POST", f"/games/{gslug}/reviews/", rv, 201)
rid = d["data"]["id"]
chk("Duplicate review", "user1", "POST", f"/games/{gslug}/reviews/", rv, 409)
chk("Invalid rating 6", "user2", "POST", f"/games/{gslug}/reviews/", {"rating":6,"content":"x"}, 400)
chk("Edit own review", "user1", "PATCH", f"/reviews/{rid}/", {"rating":5}, 200)
chk("Edit other's review", "user2", "PATCH", f"/reviews/{rid}/", {"rating":1}, 403)
chk("Edit other's review (admin)", "admin1", "PATCH", f"/reviews/{rid}/", {"content":"edited by admin"}, 200)
# comments
cm = {"content": "nice review"}
chk("Create comment", "guest", "POST", f"/reviews/{rid}/comments/", cm, 401)
d = chk("Create comment", "user2", "POST", f"/reviews/{rid}/comments/", cm, 201)
cmid = d["data"]["id"]
chk("Banned word comment", "user2", "POST", f"/reviews/{rid}/comments/", {"content":"you idiot"}, 400)
chk("Comment >2000 chars", "user2", "POST", f"/reviews/{rid}/comments/", {"content":"a"*2001}, 400)
chk("Edit other's comment", "user3", "PATCH", f"/comments/{cmid}/", {"content":"hack"}, 403)
chk("Edit own comment", "user2", "PATCH", f"/comments/{cmid}/", {"content":"nice review 2"}, 200)
chk("Moderate comment", "user2", "POST", f"/comments/{cmid}/moderate/", {"is_hidden":True}, 403)
chk("Hide comment", "admin1", "POST", f"/comments/{cmid}/moderate/", {"is_hidden":True}, 200)
_, lst = call("GET", f"/reviews/{rid}/comments/", T["user3"])
ids = [c["id"] for c in items(lst)]
results.append(("Hidden comment not in user list","user3",f"GET /reviews/{rid}/comments/","absent",200,"PASS" if cmid not in ids else "FAIL"))
chk("Unhide comment", "admin1", "POST", f"/comments/{cmid}/moderate/", {"is_hidden":False}, 200)
# favorites
chk("Favorite", "guest", "POST", f"/games/{gslug}/favorite/", None, 401)
chk("Favorite", "user1", "POST", f"/games/{gslug}/favorite/", None, 201)
chk("Favorite duplicate", "user1", "POST", f"/games/{gslug}/favorite/", None, 409)
chk("List my favorites", "user1", "GET", "/me/favorites/", None, 200)
chk("List my favorites", "guest", "GET", "/me/favorites/", None, 401)
chk("Unfavorite", "user1", "DELETE", f"/games/{gslug}/favorite/", None, 200)
chk("Unfavorite again (idempotent)", "user1", "DELETE", f"/games/{gslug}/favorite/", None, 200)
# reports
rp = {"reason":"SPAM","details":"x"}
chk("Report review", "guest", "POST", f"/reviews/{rid}/report/", rp, 401)
d = chk("Report review", "user3", "POST", f"/reviews/{rid}/report/", rp, 201)
repid = d["data"]["id"]
chk("Report review duplicate", "user3", "POST", f"/reviews/{rid}/report/", rp, 409)
chk("Report invalid reason", "user2", "POST", f"/reviews/{rid}/report/", {"reason":"NOPE"}, 400)
chk("Report comment", "user3", "POST", f"/comments/{cmid}/report/", rp, 201)
# admin
for p in ["/admin/summary/","/admin/users/","/admin/reports/","/admin/reviews/","/admin/comments/"]:
    chk(f"Admin endpoint", "guest", "GET", p, None, 401)
    chk(f"Admin endpoint", "user1", "GET", p, None, 403)
    chk(f"Admin endpoint", "admin1", "GET", p, None, 200)
chk("Resolve report", "user1", "POST", f"/admin/reports/{repid}/resolve/", None, 403)
chk("Resolve report", "admin1", "POST", f"/admin/reports/{repid}/resolve/", None, 200)
chk("Resolve report again", "admin1", "POST", f"/admin/reports/{repid}/resolve/", None, 409)
_, ul = call("GET", "/admin/users/?search=user3", T["admin1"])
u3 = next(u for u in items(ul) if u["email"]=="user3@gamereview.test")["id"]
_, ul = call("GET", "/admin/users/?search=admin1", T["admin1"])
a1 = next(u for u in items(ul) if u["email"]=="admin1@gamereview.test")["id"]
chk("Lock user", "user1", "POST", f"/admin/users/{u3}/status/", {"is_active":False}, 403)
chk("Lock self", "admin1", "POST", f"/admin/users/{a1}/status/", {"is_active":False}, 400)
chk("Lock user3", "admin1", "POST", f"/admin/users/{u3}/status/", {"is_active":False}, 200)
chk("Locked token rejected", "user3", "GET", "/auth/me/", None, 401)
chk("Unlock user3", "admin1", "POST", f"/admin/users/{u3}/status/", {"is_active":True}, 200)
# cleanup / delete rules
chk("Delete category in use", "admin1", "DELETE", f"/categories/{cid}/", None, 409)
chk("Delete game with review", "admin1", "DELETE", f"/games/{gid}/", None, 409)
chk("Delete other's comment", "user3", "DELETE", f"/comments/{cmid}/", None, 403)
chk("Delete other's review", "user2", "DELETE", f"/reviews/{rid}/", None, 403)
chk("Delete own comment", "user2", "DELETE", f"/comments/{cmid}/", None, 200)
chk("Delete review (owner)", "user1", "DELETE", f"/reviews/{rid}/", None, 200)
chk("Delete game", "user1", "DELETE", f"/games/{gid}/", None, 403)
chk("Delete game", "admin1", "DELETE", f"/games/{gid}/", None, 200)
chk("Delete category", "admin1", "DELETE", f"/categories/{cid}/", None, 200)

print(f"{'CASE':38}{'ROLE':8}{'REQUEST':44}{'EXP':>10}{'GOT':>5} RESULT")
for r in results: print(f"{r[0]:38}{r[1]:8}{r[2]:44}{str(r[3]):>10}{r[4]:>5} {r[5]}")
print("TOTAL", len(results), "FAIL", sum(r[5]=="FAIL" for r in results))
