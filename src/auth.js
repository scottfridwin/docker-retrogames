// Identifies the user from the headers set by the Authentik forward-auth outpost in Traefik.
// Traefik replaces these headers on every authenticated request, so they cannot be supplied
// by the client as long as the app is only reachable through Traefik.
import logger from "./logger.js";

// Usernames become part of save file names ("userdata_<username>_<gameid>.jsdos"), so no path
// separators and no "_" (which would make user/game boundaries ambiguous).
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.@+-]{0,127}$/;

const MOCK_USER = { username: "mockuser", email: "mockuser@example.com", groups: ["mock", "dev"] };

export function authentik({ mockLogin }) {
  return (req, res, next) => {
    if (mockLogin) {
      req.user = MOCK_USER;
      return next();
    }

    const username = req.get("x-authentik-username");
    if (!username) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!USERNAME_PATTERN.test(username)) {
      logger.warn(`Rejecting unsupported username ${JSON.stringify(username)}`);
      return res.status(403).json({ error: "Unsupported username" });
    }

    const groups = req.get("x-authentik-groups");
    req.user = {
      username,
      email: req.get("x-authentik-email") || "",
      groups: groups
        ? groups
            .split("|")
            .flatMap((g) => g.split(","))
            .filter(Boolean)
        : [],
    };
    next();
  };
}
