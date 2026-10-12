# retrogames

[![Build, Test & Publish](https://github.com/scottfridwin/docker-retrogames/actions/workflows/build.yml/badge.svg)](https://github.com/scottfridwin/docker-retrogames/actions/workflows/build.yml)

> ⚠️ **AI-assisted project.** Much of the code in this repository was written or reworked by AI (GitHub Copilot)
> under human direction and review. Read the code and run the tests before relying on it.

A small web app for playing DOS games in the browser with [js-dos](https://js-dos.com/), with each user's saved
progress stored on the server. Users are identified by the headers set by an
[Authentik](https://goauthentik.io/) forward-auth outpost in front of the app (Traefik), so the app has no login
of its own.

## Image

`ghcr.io/scottfridwin/retrogames` (`linux/amd64`, `linux/arm64`), with an SBOM, build provenance and a signed GitHub build attestation.
Every merge to `main` publishes `:main` and `:sha-<commit>`; releases add `:X.Y.Z`, `:X.Y`, `:X` and `:latest`.
Pin an exact version in production.

## Configuration

| Variable             | Default    | Description                                                                                                  |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `GAMES_DIR`          | (required) | Game library, read-only. One directory per game (see below).                                                 |
| `USERDATA_DIR`       | (required) | Saved progress, writable. Files are named `userdata_<username>_<gameid>.jsdos`.                              |
| `PORT`               | `3000`     | HTTP port.                                                                                                   |
| `AUTOSAVEINTERVAL`   | `30000`    | Milliseconds between autosaves while a game runs; `0` disables autosave.                                     |
| `MAX_USERDATA_BYTES` | `67108864` | Largest accepted save upload (64 MiB).                                                                       |
| `LOG_LEVEL`          | `INFO`     | `TRACE`, `DEBUG`, `INFO`, `WARNING` or `ERROR`.                                                              |
| `MOCK_LOGIN`         | `false`    | Development only: treat every request as `mockuser`. Refused when `NODE_ENV=production` (the image default). |

Each game lives in `GAMES_DIR/<gameid>/`, where `<gameid>` matches `[A-Za-z0-9][A-Za-z0-9_-]*`:

- `metadata.json`: `displayName`, `emulation` (`"dos"`), `publisher`, `releaseYear`, `ageLow`, `tags`,
  `descriptions` (`[{ "header": "...", "body": "..." }]`)
- `bundle.jsdos`: the js-dos bundle
- `screenshot.png`: the tile image

## Security model

- The app trusts the `X-Authentik-Username`, `-Email` and `-Groups` headers. Traefik's forward-auth replaces
  them on every request, so **the container must only be reachable through Traefik** (don't publish its port).
- Usernames must match `[A-Za-z0-9][A-Za-z0-9.@+-]*` (no `_`, no path separators); others get `403`.
- Save data is only read or written for games that exist in the library, and only within `USERDATA_DIR`.
- The image runs as a non-root user and works with a read-only root filesystem.

## Games

No games are included. Use DOS software you have the right to run, packaged as
[js-dos bundles](https://js-dos.com/). The repository's only sample is `mnt/games/demo`, a tiny DOS program
written for this project (source in [`demo-game/`](demo-game/)) for local development.

See [`SECURITY.md`](SECURITY.md) for reporting vulnerabilities and [`docs/development.md`](docs/development.md)
for local development and the release process.

## License

[MIT](LICENSE). The image also ships third-party front-end libraries under their own licenses, notably
[js-dos](https://github.com/caiiiycuk/js-dos) (GPL-2.0), Bootstrap and jQuery (MIT), Font Awesome Free
(CC-BY-4.0, OFL-1.1, MIT) and the Ubuntu font (Ubuntu Font Licence).
