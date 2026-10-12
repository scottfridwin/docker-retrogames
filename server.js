// Entry point: load config and games, then start the HTTP server.
import fs from "node:fs/promises";
import { loadConfig } from "./src/config.js";
import { loadGames } from "./src/games.js";
import { createApp } from "./src/app.js";
import logger from "./src/logger.js";

const config = loadConfig();
if (config.mockLogin) {
  logger.warn("MOCK_LOGIN is enabled: every request is treated as 'mockuser' (development only)");
}

await fs.mkdir(config.userdataDir, { recursive: true });
const games = await loadGames(config.gamesDir);
const server = createApp(config, games).listen(config.port, () => {
  logger.info(`Listening on port ${config.port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
