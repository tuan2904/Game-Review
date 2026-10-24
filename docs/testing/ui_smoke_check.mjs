import { chromium } from "playwright-core";
const U = "http://localhost:5173";
const res = [];
const ok = (n, c, extra = "") => { res.push([n, c ? "PASS" : "FAIL", extra]); console.log(c ? "PASS" : "FAIL", n, extra); };
const br = await chromium.launch({ channel: "chrome", headless: true });
async function ctx() { const c = await br.newContext({ viewport: { width: 1280, height: 900 } }); return [c, await c.newPage()]; }
async function login(p, email, pw = "Test@12345") {
  await p.goto(U + "/login"); await p.fill('input[name=email]', email); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForTimeout(1500);
}
const body = (p) => p.locator("body").innerText();

// GUEST
let [c, p] = await ctx();
await p.goto(U + "/games"); await p.waitForTimeout(1500);
ok("Guest: games list shows cards", (await body(p)).includes("Elden Ring"));
await p.goto(U + "/favorites"); await p.waitForTimeout(1000);
ok("Guest: /favorites -> /login", p.url().includes("/login"));
await p.goto(U + "/admin"); await p.waitForTimeout(1000);
ok("Guest: /admin -> /login", p.url().includes("/login"));
await p.goto(U + "/register"); await p.fill('input[name=email]', `ui${Date.now()}@gamereview.test`);
await p.screenshot({ path: "guest-register.png" });
await c.close();

// LOCKED
[c, p] = await ctx();
await login(p, "locked@gamereview.test");
ok("Locked: login rejected", p.url().includes("/login"), (await body(p)).match(/Invalid[^\n]*/)?.[0] || "");
await p.screenshot({ path: "locked.png" }); await c.close();

// USER1
[c, p] = await ctx();
await login(p, "user1@gamereview.test");
ok("User: logged in (leaves /login)", !p.url().includes("/login"), p.url());
ok("User: no Admin menu", !(await p.locator('nav a[href="/admin"]').count()));
await p.goto(U + "/admin"); await p.waitForTimeout(1200);
ok("User: /admin shows access denied", !(await body(p)).includes("Total games") && !/Pending reports/i.test(await body(p)), (await body(p)).slice(0,120).replace(/\n/g," "));
await p.screenshot({ path: "user-admin-denied.png" });
await p.goto(U + "/games/hollow-knight"); await p.waitForTimeout(1500);
await p.screenshot({ path: "user-game.png", fullPage: true });
const fav = p.getByRole("button", { name: /favorite/i }).first();
const before = await fav.innerText();
await fav.click(); await p.waitForTimeout(1000);
const after = await fav.innerText();
ok("User: favorite toggles", before !== after, `${before} -> ${after}`);
await p.goto(U + "/favorites"); await p.waitForTimeout(1200);
ok("User: /favorites page loads", (await body(p)).length > 50);
await p.screenshot({ path: "user-favorites.png" });
await p.goto(U + "/profile"); await p.waitForTimeout(1000);
ok("User: profile shows email", (await body(p)).includes("user1@gamereview.test"));
await p.screenshot({ path: "user-profile.png" });
await c.close();

// ADMIN1
[c, p] = await ctx();
await login(p, "admin1@gamereview.test");
ok("Admin: Admin menu visible", (await p.locator('a[href="/admin"]').count()) > 0);
for (const [path, label] of [["/admin","dashboard"],["/admin/games","games"],["/admin/categories","categories"],["/admin/users","users"],["/admin/moderation","moderation"]]) {
  await p.goto(U + path); await p.waitForTimeout(1500);
  const t = await body(p);
  ok(`Admin: ${path} renders`, !/access denied|not found/i.test(t) && t.length > 80);
  await p.screenshot({ path: `admin-${label}.png`, fullPage: true });
}
await br.close();
console.log(res.filter(r => r[1]==="FAIL").length, "FAIL of", res.length);
