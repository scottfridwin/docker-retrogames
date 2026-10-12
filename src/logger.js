const levels = ["TRACE", "DEBUG", "INFO", "WARNING", "ERROR"];
const threshold = Math.max(0, levels.indexOf(process.env.LOG_LEVEL?.toUpperCase() || "INFO"));

function log(level, ...args) {
  if (levels.indexOf(level) >= threshold) {
    console.log(`[${level}]`, ...args);
  }
}

export const trace = (...args) => log("TRACE", ...args);
export const debug = (...args) => log("DEBUG", ...args);
export const info = (...args) => log("INFO", ...args);
export const warn = (...args) => log("WARNING", ...args);
export const error = (...args) => log("ERROR", ...args);

export default { trace, debug, info, warn, error };
