// Loads game metadata from GAMES_DIR. Each game is a directory named by its id containing
// metadata.json, screenshot.png and bundle.jsdos.
import fs from "node:fs/promises";
import path from "node:path";
import logger from "./logger.js";

export const METADATA_FILENAME = "metadata.json";
export const SCREENSHOT_FILENAME = "screenshot.png";
export const BUNDLE_FILENAME = "bundle.jsdos";

// Game ids become path segments and part of save file names.
export const GAME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export async function loadGames(gamesDir) {
  const entries = await fs.readdir(gamesDir, { withFileTypes: true });
  const games = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!GAME_ID_PATTERN.test(entry.name)) {
      logger.warn(`Skipping game directory with unsupported name: ${JSON.stringify(entry.name)}`);
      continue;
    }

    const metaPath = path.join(gamesDir, entry.name, METADATA_FILENAME);
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    } catch (err) {
      if (err.code !== "ENOENT") logger.error(`Failed to read ${metaPath}: ${err.message}`);
      continue;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      logger.error(`${metaPath} must contain a JSON object`);
      continue;
    }

    games.push({
      ...metadata,
      // The directory name is the id: it locates the bundle and screenshot on disk.
      id: entry.name,
      displayName: metadata.displayName || entry.name.replace(/[-_]/g, " ").trim(),
    });
  }

  games.sort((a, b) => a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }));
  logger.info(`Loaded ${games.length} games from ${gamesDir}`);
  return games;
}
