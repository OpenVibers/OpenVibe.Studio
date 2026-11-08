# Attribution

OpenVibe.Studio hosts builds of open-source projects. Each build keeps its own licence and its
own attribution files, and the build artifacts carry them.

## PhotoCraft

- Project: <https://github.com/storytold/photocraft>
- Build: `v0.21.0` (the tag is pinned in `server/adapters/photo.js` and in `.github/workflows/bundle.yml`)
- Licence: MIT OR Apache-2.0, at your choice. The build keeps `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE` and `ATTRIBUTION.md`.
- Built by: our CI, with Rust stable, the `wasm32-unknown-unknown` target and Trunk 0.21.14.
- Why our own build: the release archive of the web build does not start (the loader looks for its
  module under a path the archive does not have). The build in this repository is made from the
  pinned tag and is checked by a smoke test that fails unless the app reaches its first frame.

## LightCraft

- Project: <https://github.com/storytold/lightcraft>
- Build: `v0.19.0` (the tag is pinned in `server/adapters/light.js` and in `.github/workflows/bundle.yml`)
- Licence: MIT OR Apache-2.0, at your choice. The build keeps `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE` and `ATTRIBUTION.md`.
- Built by: our CI, with Rust stable, the `wasm32-unknown-unknown` target, `cargo xtask web` and wasm-bindgen 0.2.129.
- The optional Chinese font (16 MB) is left out of our build, so Chinese and Japanese text has no
  glyphs. The two fonts the module always embeds are under the SIL Open Font License 1.1: BIZ
  UDPGothic and Noto Sans Thai. Their licence texts travel with the bundle.

## OpenVibe.Studio

The service in this repository is MIT licensed (see `LICENSE`). It is a separate work: it hosts a
build of each project under its own terms and adds the OpenVibe layer around it (the sign-in, the
files a person owns, and the way back out).

The OpenVibe Shared kit and the OpenVibe SDK and Contracts packages are used as dependencies;
each keeps its own licence.
