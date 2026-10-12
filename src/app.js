// Builds the Express application. Kept free of side effects so tests can create instances.
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authentik } from "./auth.js";
import { BUNDLE_FILENAME, SCREENSHOT_FILENAME } from "./games.js";
import { userdataPath, writeUserdata } from "./userdata.js";
import logger from "./logger.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleDir = (name) => path.join(ROOT, "node_modules", name);

// Front-end libraries are served from npm packages instead of third-party CDNs.
const VENDOR_MOUNTS = {
  "/js-dos": moduleDir("js-dos/dist"),
  "/vendor/bootstrap": moduleDir("bootstrap/dist"),
  "/vendor/jquery": moduleDir("jquery/dist"),
  "/vendor/fontawesome": moduleDir("@fortawesome/fontawesome-free"),
  "/vendor/fonts/ubuntu": moduleDir("@fontsource/ubuntu"),
};

export function createApp(config, games) {
  const app = express();
  app.disable("x-powered-by");
  const gamesById = new Map(games.map((g) => [g.id, g]));

  app.get("/healthz", (req, res) => res.json({ status: "ok" }));

  app.use(express.static(path.join(ROOT, "public")));
  for (const [mount, dir] of Object.entries(VENDOR_MOUNTS)) {
    app.use(mount, express.static(dir, { fallthrough: false }));
  }

  const api = express.Router();
  api.use(authentik(config));

  api.get("/session", (req, res) => {
    res.json({ user: req.user, autosaveIntervalMs: config.autosaveIntervalMs });
  });

  api.get("/games", (req, res) => res.json(games));

  // Every :gameid route below only proceeds for a known game, so ids are never taken from the URL as-is.
  api.param("gameid", (req, res, next, id) => {
    const game = gamesById.get(id);
    if (!game) return res.status(404).json({ error: "Game not found" });
    req.game = game;
    next();
  });

  api.get("/games/:gameid", (req, res) => res.json(req.game));

  const sendGameFile = (filename) => (req, res, next) => {
    res.sendFile(path.join(config.gamesDir, req.game.id, filename), (err) => {
      if (err && !res.headersSent) {
        if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
        next(err);
      }
    });
  };
  api.get("/games/:gameid/screenshot", sendGameFile(SCREENSHOT_FILENAME));
  api.get("/games/:gameid/data", sendGameFile(BUNDLE_FILENAME));

  const savePath = (req) => userdataPath(config.userdataDir, req.user.username, req.game.id);

  api.head("/games/:gameid/userdata", async (req, res) => {
    try {
      const stats = await fs.stat(savePath(req));
      res.set({
        "Content-Type": "application/zip",
        "Content-Length": String(stats.size),
        "Last-Modified": stats.mtime.toUTCString(),
      });
      res.status(200).end();
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      res.status(404).end();
    }
  });

  api.get("/games/:gameid/userdata", (req, res, next) => {
    res.sendFile(savePath(req), { headers: { "Content-Type": "application/zip" } }, (err) => {
      if (err && !res.headersSent) {
        if (err.code === "ENOENT") return res.status(404).json({ error: "No saved data found" });
        next(err);
      }
    });
  });

  api.put(
    "/games/:gameid/userdata",
    express.raw({ type: () => true, limit: config.maxUserdataBytes }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "Empty save data" });
      }
      await writeUserdata(savePath(req), req.body);
      logger.debug(`Saved userdata for ${req.user.username}/${req.game.id} (${req.body.length} bytes)`);
      res.json({ message: "User data saved successfully" });
    },
  );

  api.delete("/games/:gameid/userdata", async (req, res) => {
    try {
      await fs.unlink(savePath(req));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      return res.status(404).json({ error: "No saved data found" });
    }
    res.json({ message: "User data deleted successfully" });
  });

  app.use("/api", api);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Save data too large" });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: "Not found" });
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: "Bad request" });
    }
    logger.error(`${req.method} ${req.path} failed:`, err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
