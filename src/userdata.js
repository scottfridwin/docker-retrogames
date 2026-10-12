// Per-user saved progress ("userdata_<username>_<gameid>.jsdos" in USERDATA_DIR).
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function userdataPath(userdataDir, username, gameId) {
  const file = path.resolve(userdataDir, `userdata_${username}_${gameId}.jsdos`);
  // Both parts are validated against strict patterns; this is defense in depth.
  if (path.dirname(file) !== userdataDir) {
    throw new Error("userdata path escapes USERDATA_DIR");
  }
  return file;
}

// Write via a temp file + rename so a crash mid-write never leaves a truncated save.
export async function writeUserdata(file, data) {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
