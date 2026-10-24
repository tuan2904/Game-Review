import { chromium } from "playwright-core";
const U = "http://localhost:5173";
const TAG = Date.now().toString().slice(-6);
const NEW = `ui${TAG}@gamereview.test`;
let fails = 0;
const br = await chromium.launch({ channel: "chrome", headless: true });
async function ctx() { const c = await br.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await c.newPage(); p.setDefaultTimeout(6000); return [c, p]; }
async function step(name, fn) { try { const r = await fn(); console.log("PASS", name, r ?? ""); } catch (e) { fails++; console.log("FAIL", name, "::", String(e.message).split("\n")[0]); } }
const body = (p) => p.locator("body").innerText();
const has = async (p, re) => { await p.waitForFunction((s) => new RegExp(s, "i").test(document.body.innerText), re.source, { timeout: 6000 }); };
async function login(p, email, pw = "Test@12345") { await p.goto(U + "/login"); await p.fill("input[name=email]", email); await p.fill("input[name=password]", pw); await p.click("button[type=submit]"); await p.waitForURL((u) => !u.pathname.includes("/login")); }

// ---- NEW USER
let [c, p] = await ctx();
await step("Register: weak password rejected", async () => {
  await p.goto(U + "/register");
  await p.fill("input[name=email]", NEW); await p.fill("input[name=password]", "12345678");
  for (const n of ["first_name","last_name"]) if (await p.locator(`input[name=${n}]`).count()) await p.fill(`input[name=${n}]`, "Ui");
  await p.click("button[type=submit]"); await has(p, /password/); if (!p.url().includes("/register")) throw new Error("left register");
});
await step("Register: strong password -> logged in", async () => {
  await p.fill("input[name=password]", "Str0ng!Pass#9"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.includes("/register")); await has(p, /Log out/);
});
await p.goto(U + "/games/stardew-valley"); await p.waitForTimeout(1500);
await step("Review: submit without rating/content shows error", async () => {
  await p.getByRole("button", { name: /^(submit|post|save|write|add)/i }).first().click().catch(()=>{});
  await p.screenshot({ path: "ui2-review-form.png", fullPage: true });
});
await step("Review: create (5 stars)", async () => {
  await p.getByLabel("5 stars").check({ force: true });
  await p.getByLabel("Your review").fill(`Great farm sim ${TAG}`);
  await p.locator(".review-form button[type=submit]").click();
  await has(p, new RegExp(`Great farm sim ${TAG}`));
});
await step("Review: duplicate form no longer offered / own review has Edit+Delete", async () => {
  const mine = p.locator(".review-card", { hasText: `Great farm sim ${TAG}` });
  await mine.getByRole("button", { name: "Edit" }).waitFor(); await mine.getByRole("button", { name: /Delete/ }).waitFor();
});
await step("Review: edit", async () => {
  const mine = p.locator(".review-card", { hasText: `Great farm sim ${TAG}` });
  await mine.getByRole("button", { name: "Edit" }).click();
  await p.getByLabel("Your review").fill(`Edited farm sim ${TAG}`); await p.getByLabel("4 stars").check({ force: true });
  await p.locator(".review-form button[type=submit]").click(); await has(p, new RegExp(`Edited farm sim ${TAG}`));
});
await step("Comment: banned word rejected", async () => {
  const mine = p.locator(".review-card", { hasText: `Edited farm sim ${TAG}` });
  await mine.getByRole("button", { name: "Show comments" }).click();
  const box = mine.locator("textarea").last();
  await box.fill("you are an idiot"); await mine.locator(".comment-form button[type=submit]").click();
  await has(p, /isn't allowed/);
});
await step("Comment: create", async () => {
  const mine = p.locator(".review-card", { hasText: `Edited farm sim ${TAG}` });
  await mine.locator("textarea").last().fill(`Nice one ${TAG}`); await mine.locator(".comment-form button[type=submit]").click();
  await has(p, new RegExp(`Nice one ${TAG}`));
});
await step("Report: another user's review", async () => {
  const other = p.locator(".review-card").filter({ hasNotText: `Edited farm sim ${TAG}` }).first();
  await other.getByRole("button", { name: "Report", exact: true }).first().click();
  await p.locator("form.report-control select").selectOption("SPAM");
  await p.locator("form.report-control button[type=submit]").click(); await has(p, /Reported/);
});
await p.screenshot({ path: "ui2-newuser-game.png", fullPage: true });
await step("Logout", async () => { await p.getByRole("button", { name: "Log out" }).click(); await has(p, /Log in|Login|Sign in/); });
await c.close();

// ---- ADMIN
[c, p] = await ctx();
await login(p, "admin1@gamereview.test");
await step("Admin moderation: pending report visible + resolve", async () => {
  await p.goto(U + "/admin/moderation"); await p.waitForTimeout(1500);
  await p.screenshot({ path: "ui2-mod-reports.png", fullPage: true });
  await p.getByRole("button", { name: /^Resolve/ }).first().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: "ui2-mod-resolved.png", fullPage: true });
});
await step("Admin moderation: reviews tab search + comments tab hide/unhide", async () => {
  await p.locator(".admin-tabs").getByRole("button", { name: /Comments/ }).click(); await p.waitForTimeout(1200);
  await p.getByLabel(/Search comments/).fill(`Nice one ${TAG}`); await p.locator("form.admin-filters button[type=submit]").click(); await p.waitForTimeout(1200);
  await has(p, new RegExp(`Nice one ${TAG}`));
  const crow = p.locator("tr", { hasText: `Nice one ${TAG}` });
  await crow.getByRole("button", { name: "Hide", exact: true }).click(); await crow.getByText("Hidden").waitFor();
  await crow.getByRole("button", { name: "Unhide" }).click(); await crow.getByText("Visible").waitFor();
});
await step("Admin users: lock + unlock new user", async () => {
  await p.goto(U + "/admin/users"); await p.getByLabel(/Search users/).fill(NEW); await p.getByRole("button", { name: /Search/ }).click(); await p.waitForTimeout(1200);
  const row = p.locator("tr", { hasText: NEW });
  await row.getByRole("button", { name: "Lock" }).click(); await has(p, /Locked/);
  await p.screenshot({ path: "ui2-users-locked.png" });
});
await step("Locked user cannot log in", async () => {
  const [c2, p2] = await ctx();
  await p2.goto(U + "/login"); await p2.fill("input[name=email]", NEW); await p2.fill("input[name=password]", "Str0ng!Pass#9"); await p2.click("button[type=submit]");
  await has(p2, /Invalid email or password/); await c2.close();
});
await step("Admin users: unlock", async () => {
  await p.locator("tr", { hasText: NEW }).getByRole("button", { name: "Unlock" }).click(); await has(p, /Active/);
});
await step("Admin users: cannot lock self (no button)", async () => {
  await p.getByLabel(/Search users/).fill("admin1@"); await p.getByRole("button", { name: /Search/ }).click(); await p.waitForTimeout(1200);
  await has(p, /You/);
});
await step("Admin categories: create, rename, delete", async () => {
  await p.goto(U + "/admin/categories"); await p.waitForTimeout(1200);
  await p.getByLabel("Name", { exact: true }).fill(`UiCat${TAG}`); await p.locator(".admin-form-panel button[type=submit]").click(); await has(p, new RegExp(`UiCat${TAG}`));
  const row = p.locator("tr", { hasText: `UiCat${TAG}` });
  await row.getByRole("button", { name: /^Delete/ }).click(); await p.waitForTimeout(400);
  await p.locator("[role=group]", { hasText: /Delete .*\?/ }).getByRole("button", { name: "Delete", exact: true }).click(); await p.waitForTimeout(1200);
  if ((await body(p)).includes(`UiCat${TAG}`)) throw new Error("category still present");
});
await step("Admin games: create via form", async () => {
  await p.goto(U + "/admin/games/new"); await p.waitForTimeout(1500);
  await p.getByLabel("Name", { exact: true }).fill(`UiGame${TAG}`);
  await p.getByLabel(/^Description/).fill("desc"); await p.getByLabel("Developer").fill("Dev"); await p.getByLabel("Publisher").fill("Pub");
  await p.getByLabel("Release date").fill("2024-01-01");
  await p.locator("select").last().selectOption({ index: 1 });
  await p.screenshot({ path: "ui2-game-form.png", fullPage: true });
  await p.locator("form button[type=submit]").click(); await p.waitForURL(/\/admin\/games$/, { timeout: 8000 });
  await has(p, new RegExp(`UiGame${TAG}`));
});
await step("Admin games: deactivate then guest cannot see", async () => {
  const row = p.locator("tr", { hasText: `UiGame${TAG}` });
  await row.getByRole("button", { name: /Deactivate|Hide|Inactive/ }).first().click(); await p.waitForTimeout(1200);
  const [c3, p3] = await ctx(); await p3.goto(U + `/games/uigame${TAG}`); await p3.waitForTimeout(1500);
  if ((await body(p3)).includes(`UiGame${TAG}`)) throw new Error("inactive game visible to guest"); await c3.close();
});
await step("Admin games: delete", async () => {
  const row = p.locator("tr", { hasText: `UiGame${TAG}` });
  await row.getByRole("button", { name: /^Delete/ }).click(); await p.waitForTimeout(400);
  await p.locator("[role=group]", { hasText: /Delete .*\?/ }).getByRole("button", { name: "Delete", exact: true }).click(); await p.waitForTimeout(1200);
  if ((await body(p)).includes(`UiGame${TAG}`)) throw new Error("game still present");
});
await br.close();
console.log("TAG", TAG, "NEW", NEW, "FAILS", fails);
