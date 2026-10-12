// Runtime configuration from environment variables, validated up front.
import path from "node:path";

const DEFAULT_PORT = 3000;
const DEFAULT_AUTOSAVE_INTERVAL_MS = 30000;
const DEFAULT_MAX_USERDATA_BYTES = 64 * 1024 * 1024;

function positiveInt(name, raw, fallback, { allowZero = false } = {}) {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${name} must be a ${allowZero ? "non-negative" : "positive"} integer (got "${raw}")`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  if (!env.GAMES_DIR) throw new Error("GAMES_DIR is required");
  if (!env.USERDATA_DIR) throw new Error("USERDATA_DIR is required");

  const mockLogin = env.MOCK_LOGIN === "true";
  if (mockLogin && env.NODE_ENV === "production") {
    throw new Error("MOCK_LOGIN bypasses authentication and cannot be enabled when NODE_ENV=production");
  }

  return {
    port: positiveInt("PORT", env.PORT, DEFAULT_PORT),
    gamesDir: path.resolve(env.GAMES_DIR),
    userdataDir: path.resolve(env.USERDATA_DIR),
    // Milliseconds between autosaves while a game is running; 0 disables autosave.
    autosaveIntervalMs: positiveInt("AUTOSAVEINTERVAL", env.AUTOSAVEINTERVAL, DEFAULT_AUTOSAVE_INTERVAL_MS, {
      allowZero: true,
    }),
    maxUserdataBytes: positiveInt("MAX_USERDATA_BYTES", env.MAX_USERDATA_BYTES, DEFAULT_MAX_USERDATA_BYTES),
    mockLogin,
  };
}
