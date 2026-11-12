# AGENTS.md — OpenVibe.Studio

## Project overview

OpenVibe.Studio is the network's creative-app host at `https://openvibe.studio`. It serves two
open-source native editors compiled to WebAssembly — **Photo** (PhotoCraft, a layered photo editor)
and **Light** (LightCraft, a photo library and RAW developer) — inside an OpenVibe account, plus the
signed-in hand-offs from Video and Cam and the Pics image tools.

- **Entry:** `server/index.js` (`node server/index.js`); app in `server/app.js`; config
  `server/config.js`; port `5155`, drill port `15155`, service id `studio`.
- **Pages and API:** `server/pages.js` (the app pages and `/edit`), `server/api.js`
  (`/api/v1/studio/*`: file bytes, media bytes, publish, image edits), `server/app.js` mounts
  health, `/auth`, `/shared`, discovery (`/robots.txt`, `/sitemap.xml`, `/llms.txt`,
  `/llms-full.txt`, `/.well-known/agent.json`) and `/openapi.json`.
- **Adapters:** `server/adapters/` — `contract.js`, `index.js`, `photo.js`, `light.js`. One adapter
  per app keeps the same contract (`open(file)`, `save()`, `commands()`) so a base can be swapped.
- **OpenVibe clients:** `server/openvibe/media.js`, `pics.js`, `video.js` — each call is scoped to
  the person's own Network token.
- **Browser:** `public/js/drivers.js` (one driver per app), `studio.js`, `edit-video.js`,
  `image-tools.js`; own CSS in `public/css`. The apps run in a same-origin iframe with the shared
  navbar outside it. No bundler for our layer.
- **Bundles:** `scripts/build-bundles.sh`, `scripts/fetch-bundles.sh`, `scripts/smoke.js`; the
  `bundles` GitHub workflow builds from pinned upstream tags and publishes an artifact with a
  checksum file. A bundle is never committed.

## Owns, does not own

Owns the service layer, the adapter contract, the signed-in hand-off routes, the Pics image-edit
endpoint and the `STUDIO_BUNDLE_ROOT` bundle upload/fetch path. It does not own the editors: Photo is
[PhotoCraft](https://github.com/storytold/photocraft), Light is
[LightCraft](https://github.com/storytold/lightcraft), both MIT OR Apache-2.0, built from pinned
release tags; the licence and attribution stay with every build (`ATTRIBUTION.md`, `NOTICE`,
`STATUS.json`). It does not own media bytes (Media/Video), pictures (Pics), the download drive
(Download) or identity (Network).

## Who calls it, what it calls

A signed-in person opens the app pages; Video and Cam send them to
`GET /edit?media=<Video id>&from=video` and `GET /edit?pics=<Pics slug>&from=cam`. Studio asks the
source service with the person's own Network token whether that person may read the object, and a
private object of someone else answers 404 exactly like a missing id. It calls OpenVibe.Video
(`/api/v1/video/studio/publish` to send a trimmed range, cover, title and visibility), OpenVibe.Pics
(read bytes, save a separate private picture through its re-encoding pipeline), OpenVibe.Download
(hand an export to the person's drive) and Network (SSO/JWKS). The Pics image edit needs
`STUDIO_IMAGE_WORKER_URL`, an operator-controlled worker (`POST /edit`, image in/out); no person token
is sent to it, and without it the endpoint answers 503 and the UI disables submission.

## Auth

Network SSO (RS256 JWT + session cookie). Every Studio API and hand-off is the signed-in person's own
call — never a service token on their behalf — and authorization is the source service's answer with
that token. A private object of another person is a 404, not a 403. The image worker receives only
the selected picture, never a token.

## Bundles and deploy

The `bundles` workflow checks out the pinned upstream tags, builds with Rust stable,
`wasm32-unknown-unknown`, Trunk 0.21.14 (PhotoCraft) or `cargo xtask web` + wasm-bindgen 0.2.129
(LightCraft), runs the first-frame smoke test in headless Chrome and publishes the bundle with a
checksum file. The deploy fetches that artifact, verifies the checksums and unpacks it into
`STUDIO_BUNDLE_ROOT` (default `public/apps`); without a bundle the page says so instead of showing an
empty frame. `sudo ovhost deploy studio` deploys the service; unit
`deploy/systemd/openvibe-studio.service`, env `/etc/openvibe/studio.env`, nginx
`deploy/nginx/openvibe.studio.conf`. Rollback with `sudo ovhost rollback studio --to <sha>`.

## Commands and tests

```bash
npm ci
npm start                    # http://127.0.0.1:5155
npm test                     # node --test test/*.test.js
node scripts/smoke.js --app light --dir artifacts/light   # first-frame check
node scripts/fetch-bundles.sh   # fetch the built artifact in a deploy
```

`npm test` uses the built-in Node test runner (not `openvibe-shared/test-runner`); tests use an
in-process fake image worker and stub services, never model calls or spending. `test/adapters.test.js`
enforces the one adapter contract; `test/studio.test.js`, `test/media.test.js` and
`test/image-tools.test.js` cover the pages, hand-off authorization, publish polling and the worker
fallback.

## Conventions and pitfalls

- CommonJS, 4-space indent, single quotes, semicolons; no linter. Server-rendered pages with the
  shared Frame; phone-first CSS.
- **A bundle is never committed.** Ship it as an artifact, verify the checksums, unpack into the
  bundle root; a bundle that loads but never reaches its first frame is worse than no bundle.
- **Keep the adapter contract identical** across apps (`assertAdapter`/`assertDriver`); a new base is
  an adapter, not a fork of the page.
- **The hand-off never trusts an id:** ask the source service with the person's token, and keep the
  private-object 404 indistinguishable from missing.
- **Photo has no scriptable browser API:** a dropped file and no export the page can ask for — say so
  on the page instead of faking a bridge.
- **Image edits need the operator worker**; without it, fail available/503, never call a model from
  the service.
- **Honest limits stay documented:** the heavy first load, the 4 GB phone memory warning and
  online-only use are product statements, not bugs to hide.
