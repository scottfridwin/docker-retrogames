import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { loadGames } from "../src/games.js";
import { loadConfig } from "../src/config.js";

let tmp, gamesDir, userdataDir, server, base;

async function writeGame(id, metadata, files = {}) {
  const dir = path.join(gamesDir, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify(metadata));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content);
  }
}

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "retrogames-test-"));
  gamesDir = path.join(tmp, "games");
  userdataDir = path.join(tmp, "userdata");
  await fs.mkdir(userdataDir, { recursive: true });
  await writeGame(
    "oregon_trail",
    { displayName: "The Oregon Trail", emulation: "dos" },
    { "screenshot.png": "png", "bundle.jsdos": "bundle" },
  );
  await writeGame("number_munchers", { emulation: "dos" }, { "bundle.jsdos": "munch" });
  await writeGame("bad name", { displayName: "Ignored" });

  const config = loadConfig({ GAMES_DIR: gamesDir, USERDATA_DIR: userdataDir, MAX_USERDATA_BYTES: "1024" });
  const app = createApp(config, await loadGames(gamesDir));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(tmp, { recursive: true, force: true });
});

const as = (username, init = {}) => ({
  ...init,
  headers: { ...(init.headers || {}), "X-Authentik-Username": username },
});

test("health check needs no authentication", async () => {
  const resp = await fetch(`${base}/healthz`);
  assert.equal(resp.status, 200);
});

test("index page and vendored front-end assets are served", async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /FridWin Games/);
  for (const asset of [
    "/vendor/bootstrap/css/bootstrap.min.css",
    "/vendor/jquery/jquery.min.js",
    "/vendor/fontawesome/css/all.min.css",
    "/vendor/fonts/ubuntu/400.css",
    "/js-dos/js-dos.js",
  ]) {
    assert.equal((await fetch(`${base}${asset}`)).status, 200, asset);
  }
  assert.equal((await fetch(`${base}/vendor/bootstrap/../../package.json`)).status, 404);
});

test("API requires the Authentik username header", async () => {
  assert.equal((await fetch(`${base}/api/games`)).status, 401);
});

test("usernames that could alter the save file path are rejected", async () => {
  for (const username of ["../etc", "a/b", "alice_oregon", ".hidden", "x".repeat(200)]) {
    const resp = await fetch(`${base}/api/session`, as(username));
    assert.equal(resp.status, 403, username);
  }
});

test("session reports the user and the autosave interval in milliseconds", async () => {
  const resp = await fetch(
    `${base}/api/session`,
    as("scott.fridlund", { headers: { "X-Authentik-Email": "s@example.com", "X-Authentik-Groups": "a|b" } }),
  );
  assert.deepEqual(await resp.json(), {
    user: { username: "scott.fridlund", email: "s@example.com", groups: ["a", "b"] },
    autosaveIntervalMs: 30000,
  });
});

test("games are listed with directory-based ids; invalid directories are skipped", async () => {
  const games = await (await fetch(`${base}/api/games`, as("alice"))).json();
  assert.deepEqual(
    games.map((g) => [g.id, g.displayName]),
    [
      ["number_munchers", "number munchers"],
      ["oregon_trail", "The Oregon Trail"],
    ],
  );
});

test("game files are served for known games only", async () => {
  assert.equal(await (await fetch(`${base}/api/games/oregon_trail/data`, as("alice"))).text(), "bundle");
  assert.equal((await fetch(`${base}/api/games/number_munchers/screenshot`, as("alice"))).status, 404);
  assert.equal((await fetch(`${base}/api/games/unknown/data`, as("alice"))).status, 404);
});

test("save data round trip: put, head, get, delete", async () => {
  const url = `${base}/api/games/oregon_trail/userdata`;
  assert.equal((await fetch(url, as("alice"))).status, 404);

  const put = await fetch(
    url,
    as("alice", { method: "PUT", body: "save-1", headers: { "Content-Type": "application/zip" } }),
  );
  assert.equal(put.status, 200);
  assert.equal(await fs.readFile(path.join(userdataDir, "userdata_alice_oregon_trail.jsdos"), "utf-8"), "save-1");

  const head = await fetch(url, as("alice", { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "6");

  assert.equal(await (await fetch(url, as("alice"))).text(), "save-1");
  assert.equal((await fetch(url, as("alice", { method: "DELETE" }))).status, 200);
  assert.equal((await fetch(url, as("alice", { method: "DELETE" }))).status, 404);
});

test("users cannot read, overwrite or delete another user's save", async () => {
  await fs.writeFile(path.join(userdataDir, "userdata_bob_oregon_trail.jsdos"), "bob-save");
  const traversals = [
    "x%2F..%2Fuserdata_bob_oregon_trail",
    "..%2Fuserdata_bob_oregon_trail",
    "oregon_trail%2F..%2F..%2Fuserdata_bob_oregon_trail",
    "%2E%2E",
  ];
  for (const id of traversals) {
    const url = `${base}/api/games/${id}/userdata`;
    assert.equal((await fetch(url, as("alice"))).status, 404, `GET ${id}`);
    assert.equal((await fetch(url, as("alice", { method: "PUT", body: "evil" }))).status, 404, `PUT ${id}`);
    assert.equal((await fetch(url, as("alice", { method: "DELETE" }))).status, 404, `DELETE ${id}`);
  }
  assert.equal(await fs.readFile(path.join(userdataDir, "userdata_bob_oregon_trail.jsdos"), "utf-8"), "bob-save");
  assert.deepEqual((await fs.readdir(tmp)).sort(), ["games", "userdata"]);
});

test("oversized and empty saves are rejected", async () => {
  const url = `${base}/api/games/number_munchers/userdata`;
  const big = await fetch(url, as("alice", { method: "PUT", body: "x".repeat(2048) }));
  assert.equal(big.status, 413);
  const empty = await fetch(url, as("alice", { method: "PUT", body: "" }));
  assert.equal(empty.status, 400);
  await assert.rejects(fs.access(path.join(userdataDir, "userdata_alice_number_munchers.jsdos")));
});

test("MOCK_LOGIN cannot be enabled in production", () => {
  const env = { GAMES_DIR: "/g", USERDATA_DIR: "/u", MOCK_LOGIN: "true" };
  assert.equal(loadConfig(env).mockLogin, true);
  assert.throws(() => loadConfig({ ...env, NODE_ENV: "production" }), /MOCK_LOGIN/);
});

test("invalid numeric settings are rejected", () => {
  assert.throws(() => loadConfig({ GAMES_DIR: "/g", USERDATA_DIR: "/u", PORT: "abc" }), /PORT/);
  assert.equal(loadConfig({ GAMES_DIR: "/g", USERDATA_DIR: "/u", AUTOSAVEINTERVAL: "0" }).autosaveIntervalMs, 0);
});
