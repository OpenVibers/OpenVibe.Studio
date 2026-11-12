# OpenVibe.Studio

Photo and Light: two open-source creative apps served inside an OpenVibe account.

**Live site:** https://openvibe.studio · **API docs:** https://openvibe.services · **For AI:** https://openvibe.studio/llms.txt
**Run it:** `npm ci && npm run dev` (Node 22 or newer) · **Tests:** `npm test`

- **Photo** is [PhotoCraft](https://github.com/storytold/photocraft), a layered photo editor.
- **Light** is [LightCraft](https://github.com/storytold/lightcraft), a photo library and RAW developer.

The apps are the work of their own authors and are used under their own licences (MIT OR
Apache-2.0). We build them from pinned release tags, serve them under an OpenVibe sign-in, and
keep the licence and attribution with every build. See [ATTRIBUTION.md](ATTRIBUTION.md) and
[STATUS.json](STATUS.json).

## What is in here

    server/            the service: pages, the API, the adapters, the OpenVibe clients
    public/js/         the browser side: one driver per app, and the layer around it
    test/              the tests
    scripts/           the bundle build and the first-frame smoke test
    .github/workflows/ ci.yml (tests and the pinned security workflow) and bundle.yml (the builds)

## Running it

    npm ci
    npm start            # http://127.0.0.1:5155, the drill port is 15155

    npm test             # the tests
    node scripts/smoke.js --app light --dir artifacts/light   # the first-frame check

The service serves the app bundles from `STUDIO_BUNDLE_ROOT` (by default `public/apps`). Without a
bundle the app page says so instead of showing an empty frame.

## The bundles

A bundle is never kept in git. The `bundles` workflow checks out the pinned upstream tags, builds
them (Rust stable, `wasm32-unknown-unknown`, Trunk 0.21.14 for PhotoCraft, `cargo xtask web` and
wasm-bindgen 0.2.129 for LightCraft), runs the smoke test and publishes the result with a
checksum file. The deploy fetches that artifact, checks the checksums and unpacks it into the
bundle root.

The smoke test is the gate: the build fails unless the app reaches its first frame in headless
Chrome. A bundle that loads but never starts is worse than no bundle.

PhotoCraft is built by us on purpose. The published web release archive does not start: its loader
looks for the module under a path the archive does not have.

## The layer around an app

Every app sits in an iframe inside our own page, with the OpenVibe navbar outside it. One adapter
per app keeps the same contract, so a base can be swapped:

    open(file)   open a file from the person's OpenVibe library
    save()       hand an export to the person's OpenVibe.Download drive
    commands()   the app's own commands

- **LightCraft** speaks the documented host bridge (`lightcraft:open`, `lightcraft:cmd`,
  `lightcraft:save`) to a same-origin parent, so files open and exports come back.
- **PhotoCraft** has no scriptable API in the browser: a file is dropped on the app, and there is
  no export the page can ask for. The app page says so.

## Hand-off from Video and Cam

`GET /edit?media=<OpenVibe.Video id>&from=video` and `GET /edit?pics=<Pics slug>&from=cam` are the signed-in
hand-off into Studio. Studio asks the source service with the person's own Network token whether that person may
read the object; a private object of someone else answers 404 exactly as a missing id does. A picture opens in
Photo (or `app=light`) with its source named (`From OpenVibe.Cam`); the browser layer fetches the bytes through
`/api/v1/studio/files/pics/:slug/bytes` and puts them into the running app. A video opens in **Trim and publish**: the preview is at
`/api/v1/studio/media/:id/bytes`; two seconds fields and **Set start here** / **Set end here** take the time from the
player, **Use this frame as the cover** records the frame, and **Publish on Video** sends the range, cover, title and
visibility to Video's `/api/v1/video/studio/publish`. Video's existing cuts service re-encodes that range as a new
copy (the original is unchanged); the page polls `/api/v1/studio/publish/:cut` until the copy is ready. A range under
one second or outside the video is refused in plain words.

Set `OV_VIDEO_URL` when Video is not at `https://openvibe.video` (the drill). The Studio routes are documented in
`server/pages.js` (`/edit`) and `server/api.js` (`/media/:id/bytes`, `/publish`).

## Honest limits

- Heavy first load: both apps are native editors compiled to WebAssembly.
- A phone with 4 GB of RAM can run out of memory on big files: a 4 GB Photoshop file used 2.7-3.0 GB.
- Online only: neither app caches for offline use.
- Cut (FilmCraft) is not part of Studio v0.

## Licence

The service is MIT licensed ([LICENSE](LICENSE)). The apps keep their own licences, and the
attribution is in [ATTRIBUTION.md](ATTRIBUTION.md).

<!-- versions:start -->
- openvibe-contracts: v0.417.0
- openvibe-sdk: v0.161.0
- openvibe-shared: v4.227.0
<!-- versions:end -->

### Pics image tools

`/image-tools?picture=<slug>` opens an edit of a Pics picture. The authenticated
`POST /api/v1/studio/images/edit` API accepts `{picture, operation, prompt?}`;
operation is `upscale`, `remove-background`, or `restyle`. It reads authorized Pics
bytes and saves a separate private picture through Pics' re-encoding pipeline.

Deployment requires `STUDIO_IMAGE_WORKER_URL`, an operator-controlled image worker
with `POST /edit` accepting `{operation, prompt, image: {mime_type, base64}}` and
returning JPEG, PNG or WebP bytes. No person token is sent to that worker; it receives
only the selected picture. The worker is not supplied by this PR. Without it the
capability endpoint reports unavailable, the UI disables submission and the API
returns 503. Tests use an in-process fake; no model calls or spending occurred.
