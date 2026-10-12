# Development

Open the folder in the dev container, or use Node 24 locally.

```sh
npm ci
npm run lint      # ESLint + Prettier check (CI "Lint" job)
npm test          # node:test suite (CI "Test" job runs it inside the image on amd64 and arm64)
npm run format    # apply Prettier
```

Run the server against the sample game in `mnt/games/demo` without Authentik:

```sh
GAMES_DIR=mnt/games USERDATA_DIR=mnt/userdata MOCK_LOGIN=true npm run dev
```

or use the "Launch Game Server" configuration in `.vscode/launch.json`, then open http://localhost:3000.

The demo game counts how often it has been played, so you can check that saved progress round-trips.
Its source is `demo-game/demo.asm`; after changing it, rebuild the bundle (needs Docker):

```sh
scripts/build-demo-game.sh
```

The build is reproducible, so an unchanged source produces an identical `mnt/games/demo/bundle.jsdos`.
Never commit commercial games: only software you are allowed to redistribute belongs in this repository.

## Layout

- `server.js`: entry point (config, game loading, HTTP server, graceful shutdown)
- `src/app.js`: Express app (static files, vendored front-end libraries, API)
- `src/auth.js`: Authentik header authentication
- `src/config.js`, `src/games.js`, `src/userdata.js`: configuration, game library, save files
- `public/`: the single-page front end (`index.html`, `js/index.js`, `js/dos_play.js`)
- `test/`: API tests, including the path traversal and cross-user cases

Front-end libraries (Bootstrap, jQuery, Font Awesome, the Ubuntu font, js-dos) are npm dependencies served by
the app under `/vendor/...` and `/js-dos/`; the page loads nothing from third-party CDNs.

## Releasing

Every merge to `main` publishes `:main` and `:sha-<commit>`. When the merge changes the image (`Dockerfile`,
`package*.json`, `server.js`, `src/`, `public/`), the release job tags that exact image as `X.Y.Z`, `X.Y`, `X`
and `latest`, pushes the `vX.Y.Z` git tag and creates a GitHub release. The squash-merge commit subject picks the
bump: `feat:` → minor, `type!:` or `BREAKING CHANGE` → major, anything else → patch.
