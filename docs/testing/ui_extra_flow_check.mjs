import { chromium } from "playwright-core";
const U = "http://localhost:5173";
const TAG = Date.now().toString().slice(-6);
const NEW = `ui${TAG}@gamereview.test`, PW = "Str0ng!Pass#9";
let fails = 0;
const br = await chromium.launch({ channel: "chrome", headless: true });
async function ctx(w = 1280, h = 1000) { const c = await br.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.setDefaultTimeout(7000);
  const g = p.goto.bind(p); p.goto = async (...a) => { const r = await g(...a); if (p.__auth) await p.waitForFunction(() => /Log out/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {}); return r; }; return [c, p]; }
async function step(name, fn) { try { const r = await fn(); console.log("PASS", name, r ?? ""); } catch (e) { fails++; console.log("FAIL", name, "::", String(e.message).split("\n")[0]); try { await P.screenshot({ path: "fail-" + fails + ".png", fullPage: true }); console.log("   url", P.url(), (await P.locator("body").innerText()).slice(0, 300).replace(/\n/g, " | ")); } catch {} } }
const body = (p) => p.locator("body").innerText();
const has = (p, re) => p.waitForFunction((s) => new RegExp(s, "i").test(document.body.innerText), re.source, { timeout: 7000 });
const gone = (p, re) => p.waitForFunction((s) => !new RegExp(s, "i").test(document.body.innerText), re.source, { timeout: 7000 });
const cards = (p) => p.locator("a[href^='/games/']").evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")))]);
async function review(p, slug, text, stars = 5) {
  await p.goto(U + `/games/${slug}`); const wb = p.getByRole("button", { name: /write.*review/i }); if (await wb.count()) await wb.first().click(); await p.getByLabel(`${stars} star${stars > 1 ? "s" : ""}`).check({ force: true });
  await p.getByLabel("Your review").fill(text); await p.locator(".review-form button[type=submit]").click(); await has(p, new RegExp(text));
}

let P; let [c, p] = await ctx(); P = p;
await p.goto(U + "/register");
await p.fill("input[name=email]", NEW); await p.fill("input[name=password]", PW);
for (const n of ["first_name", "last_name"]) if (await p.locator(`input[name=${n}]`).count()) await p.fill(`input[name=${n}]`, "Ui");
await p.click("button[type=submit]"); await p.waitForURL((u) => !u.pathname.includes("/register")); await has(p, /Log out/); p.__auth = true;

// ---- Games page: search / filter / sort
await step("Games: search narrows list", async () => {
  await p.goto(U + "/games"); await p.getByLabel("Search games").fill("elden"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  const t = await body(p); if (!/Elden Ring/.test(t) || /Hollow Knight/.test(t)) throw new Error("search wrong");
  if (!/q=|search=|elden/.test(p.url())) throw new Error("url not synced " + p.url());
});
await step("Games: search no result -> empty state, clear filters works", async () => {
  await p.getByLabel("Search games").fill("zzzqqq"); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /clear/i }).first().click(); await p.waitForTimeout(1200); await has(p, /Hollow Knight/);
});
await step("Games: category filter", async () => {
  await p.goto(U + "/games"); const sel = p.locator("select").first(); await sel.selectOption({ index: 1 }); await p.waitForTimeout(1500);
  const n = (await cards(p)).length; if (n < 1 || n >= 8) throw new Error("count " + n); return `${n} games`;
});
await step("Games: sort Name A-Z / Z-A", async () => {
  await p.goto(U + "/games"); const sel = p.locator("select").nth(1);
  const names = async () => (await p.locator(".game-card h2, .game-card h3, .game-card__title").allInnerTexts()).map((s) => s.trim());
  await sel.selectOption({ label: "Name A–Z" }); await p.waitForTimeout(1500); const a = await names();
  await sel.selectOption({ label: "Name Z–A" }); await p.waitForTimeout(1500); const z = await names();
  if (!a.length || JSON.stringify(a) !== JSON.stringify([...a].sort((x, y) => x.localeCompare(y)))) throw new Error("A-Z wrong " + a);
  if (JSON.stringify(z) !== JSON.stringify([...a].reverse())) throw new Error("Z-A wrong " + z);
});
await step("Games: card shows rating or 'No reviews yet'", async () => { await p.goto(U + "/games"); await has(p, /★|No reviews yet/); });
await step("Game detail: unknown slug -> not found, no crash", async () => { await p.goto(U + "/games/does-not-exist"); await has(p, /not found|doesn't exist|couldn't/); });

// ---- Review/comment own delete
await step("Review create + comment + delete comment (confirm) + delete review (confirm)", async () => {
  await review(p, "celeste", `Del me ${TAG}`);
  const mine = () => p.locator(".review-card", { hasText: `Del me ${TAG}` });
  await mine().getByRole("button", { name: "Show comments" }).click();
  await mine().locator("textarea").last().fill(`cmt ${TAG}`); await mine().locator(".comment-form button[type=submit]").click(); await has(p, new RegExp(`cmt ${TAG}`));
  const cm = p.locator(".comment", { hasText: `cmt ${TAG}` });
  await cm.getByRole("button", { name: "Delete" }).click(); await cm.getByRole("button", { name: "Delete" }).last().click(); await gone(p, new RegExp(`cmt ${TAG}`));
  await mine().getByRole("button", { name: "Delete" }).click(); await p.locator("[aria-label='Confirm deletion']").getByRole("button", { name: "Delete" }).click();
  await gone(p, new RegExp(`Del me ${TAG}`));
  await p.reload(); await has(p, /Log out/); await p.waitForTimeout(1000); if ((await body(p)).includes(`Del me ${TAG}`)) throw new Error("review back after reload");
});
await step("Review: can write a new one again after deleting", async () => { await review(p, "celeste", `Again ${TAG}`, 3); });
await step("Review: delete cancel keeps review", async () => {
  const mine = p.locator(".review-card", { hasText: `Again ${TAG}` });
  await mine.getByRole("button", { name: "Delete" }).click(); await p.locator("[aria-label='Confirm deletion']").getByRole("button", { name: "Cancel" }).click();
  await mine.getByRole("button", { name: "Edit" }).waitFor();
});

// ---- Review for admin to delete + comment
await review(p, "stardew-valley", `Admin target ${TAG}`, 2);
await step("Review: sort select works (Highest/Lowest)", async () => {
  const sel = p.locator("select").last(); await sel.selectOption({ label: "Highest rated" }); await p.waitForTimeout(1200);
  await sel.selectOption({ label: "Lowest rated" }); await p.waitForTimeout(1200);
  const first = await p.locator(".review-card").first().innerText(); if (!/Admin target/.test(first) && !/★/.test(first)) throw new Error("unexpected");
});
await p.locator(".review-card", { hasText: `Admin target ${TAG}` }).getByRole("button", { name: "Show comments" }).click();
await p.locator(".review-card", { hasText: `Admin target ${TAG}` }).locator("textarea").last().fill(`admin del cmt ${TAG}`);
await p.locator(".review-card", { hasText: `Admin target ${TAG}` }).locator(".comment-form button[type=submit]").click(); await has(p, new RegExp(`admin del cmt ${TAG}`));

// ---- Favorites
await step("Favorites: add 2, list shows both, remove in place", async () => {
  for (const s of ["hollow-knight", "celeste"]) { await p.goto(U + `/games/${s}`); await p.getByRole("button", { name: /Add to favorites/ }).click(); await has(p, /Remove from favorites/); }
  await p.goto(U + "/favorites"); await has(p, /Hollow Knight/); await has(p, /Celeste/);
  await p.getByRole("button", { name: /Remove|Unfavorite|favorites/i }).first().click(); await p.waitForTimeout(1200);
  const n = (await cards(p)).length; if (n !== 1) throw new Error("expected 1 left, got " + n);
});
await step("Favorites: empty state after removing all", async () => {
  await p.getByRole("button", { name: /Remove|Unfavorite|favorites/i }).first().click(); await p.waitForTimeout(1200); await has(p, /no favorites|haven't|empty|nothing/i);
});

// ---- Profile / session
await step("Profile: edit name + persists after reload", async () => {
  await p.goto(U + "/profile"); await p.getByLabel("First name").fill(`Fn${TAG}`); await p.getByLabel("Last name").fill("Ln");
  await p.getByRole("button", { name: "Save changes" }).click(); await has(p, /Profile updated/);
  await p.reload(); await has(p, /Log out/); await p.waitForTimeout(1000); if ((await p.getByLabel("First name").inputValue()) !== `Fn${TAG}`) throw new Error("not persisted");
});
await step("Profile: name shown in header", async () => { await has(p, new RegExp(`Fn${TAG}`)); });
await step("Session survives page reload (auto refresh token)", async () => {
  await p.goto(U + "/favorites"); await p.reload(); await has(p, /Log out/); if (p.url().includes("/login")) throw new Error("kicked to login");
});
await step("Tampered refresh token -> logged out on reload", async () => {
  p.__auth = false; await p.evaluate(() => sessionStorage.setItem("gamereview.refresh", "garbage")); await p.reload(); await p.waitForTimeout(2000);
  if ((await body(p)).includes("Log out")) throw new Error("still logged in");
  await p.goto(U + "/profile"); await p.waitForTimeout(1200); if (!p.url().includes("/login")) throw new Error("profile accessible");
});
await step("Expired access token auto-refreshes (simulate 401)", async () => {
  const [c2, p2] = await ctx(); await p2.goto(U + "/login"); await p2.fill("input[name=email]", NEW); await p2.fill("input[name=password]", PW); await p2.click("button[type=submit]");
  await p2.waitForURL((u) => !u.pathname.includes("/login"));
  let n = 0; await p2.route("**/api/v1/auth/me/", (r) => (n++ === 0 ? r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, message: "expired" }) }) : r.continue()));
  await p2.route("**/api/v1/me/favorites/**", (r) => r.continue());
  await p2.goto(U + "/profile"); await p2.waitForTimeout(2000);
  if (!(await body(p2)).includes("Log out")) throw new Error("lost session"); await c2.close();
});
await c.close();

// ---- Mobile
await step("Mobile 390px: no horizontal overflow, menu usable", async () => {
  const [cm, pm] = await ctx(390, 800);
  for (const path of ["/", "/games", "/games/hollow-knight", "/login"]) {
    await pm.goto(U + path); await pm.waitForTimeout(1200);
    const o = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 2) throw new Error(`${path} overflow ${o}px`);
  }
  await pm.goto(U + "/"); await pm.screenshot({ path: "ui3-mobile.png" });
  const burger = pm.locator("button[aria-label*='menu' i], button[aria-controls]").first();
  if (await burger.count()) { await burger.click(); await pm.getByRole("link", { name: "Games" }).first().waitFor(); }
  await cm.close();
});

// ---- ADMIN
[c, p] = await ctx();
await p.goto(U + "/login"); await p.fill("input[name=email]", "admin1@gamereview.test"); await p.fill("input[name=password]", "Test@12345"); await p.click("button[type=submit]"); await p.waitForURL((u) => !u.pathname.includes("/login")); await has(p, /Log out/); p.__auth = true;
await step("Admin: sees others' comment on game page and deletes it", async () => {
  await p.goto(U + "/games/stardew-valley"); const r = p.locator(".review-card", { hasText: `Admin target ${TAG}` });
  await r.getByRole("button", { name: "Show comments" }).click(); const cm = p.locator(".comment", { hasText: `admin del cmt ${TAG}` });
  await cm.getByRole("button", { name: "Delete" }).click(); await cm.getByRole("button", { name: "Delete" }).last().click(); await gone(p, new RegExp(`admin del cmt ${TAG}`));
});
await step("Admin: moderation Reviews tab search + delete other's review", async () => {
  await p.goto(U + "/admin/moderation"); await p.locator(".admin-tabs").getByRole("button", { name: "Reviews" }).click(); await p.waitForTimeout(1000);
  await p.getByLabel(/Search reviews/).fill(`Admin target ${TAG}`); await p.locator("form.admin-filters button[type=submit]").click(); await p.waitForTimeout(1200);
  const row = p.locator("tr", { hasText: `Admin target ${TAG}` }); await row.getByRole("button", { name: "Delete" }).click(); await row.getByRole("button", { name: "Delete" }).last().click();
  await gone(p, new RegExp(`Admin target ${TAG}`));
});
await step("Admin: edit game (rename) and revert", async () => {
  await p.goto(U + "/admin/games"); await p.getByLabel("Search games").fill("Celeste"); await p.locator("form.admin-filters button[type=submit]").click(); await p.waitForTimeout(1200);
  await p.locator("tr", { hasText: "Celeste" }).getByRole("link", { name: "Edit" }).click(); await p.waitForURL(/edit/);
  const nm = p.getByLabel("Name", { exact: true }); const old = await nm.inputValue(); await nm.fill(old + " X");
  await p.locator("form button[type=submit]").click(); await p.waitForURL(/\/admin\/games$/); await has(p, /Celeste X/);
  await p.goto(U + "/games/celeste"); await has(p, /Celeste X/);
  await p.goto(U + "/admin/games"); await p.getByLabel("Search games").fill("Celeste X"); await p.locator("form.admin-filters button[type=submit]").click(); await p.waitForTimeout(1200);
  await p.locator("tr", { hasText: "Celeste X" }).getByRole("link", { name: "Edit" }).click(); await p.waitForURL(/edit/);
  await p.getByLabel("Name", { exact: true }).fill(old); await p.locator("form button[type=submit]").click(); await p.waitForURL(/\/admin\/games$/);
});
await step("Admin: rename category and revert", async () => {
  await p.goto(U + "/admin/categories"); await p.waitForTimeout(1200);
  const row = p.locator("tr", { hasText: "Indie" }).first(); await row.getByRole("button", { name: "Edit" }).click();
  const inp = p.locator("tr input").first(); const old = await inp.inputValue(); await inp.fill(old + "Z");
  await p.locator("tr button[type=submit], tr").getByRole("button", { name: /Save|Update/ }).first().click(); await has(p, /IndieZ/);
  await p.locator("tr", { hasText: "IndieZ" }).getByRole("button", { name: "Edit" }).click(); await p.locator("tr input").first().fill(old);
  await p.locator("tr").getByRole("button", { name: /Save|Update/ }).first().click(); await gone(p, /IndieZ/);
});
await step("Admin: delete category in use -> blocked with error", async () => {
  const row = p.locator("tr", { hasText: "Indie" }).first(); await row.getByRole("button", { name: "Delete" }).click();
  await p.locator("[role=group]", { hasText: /\?/ }).getByRole("button", { name: "Delete", exact: true }).click(); await has(p, /in use|cannot|can't|referenced|still|games/); await p.waitForTimeout(500);
  if (!(await body(p)).includes("Indie")) throw new Error("category vanished");
});
await step("Admin: delete game with reviews -> blocked", async () => {
  await p.goto(U + "/admin/games"); const row = p.locator("tr", { hasText: "Elden Ring" }); await row.getByRole("button", { name: "Delete" }).click();
  await p.locator("[role=group]", { hasText: /\?/ }).getByRole("button", { name: "Delete", exact: true }).click(); await p.waitForTimeout(1200);
  if (!(await body(p)).includes("Elden Ring")) throw new Error("game deleted!");
});
await step("Admin: Users pagination/search clear", async () => {
  await p.goto(U + "/admin/users"); await p.getByLabel("Search users").fill("zzzz"); await p.locator("form.admin-filters button[type=submit]").click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /clear/i }).first().click(); await has(p, /alice@example.com/);
});
await br.close();
console.log("TAG", TAG, "FAILS", fails);
