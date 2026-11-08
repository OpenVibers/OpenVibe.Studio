# Launch sequence for openvibe.studio

This pull request prepares the service, the builds and the host files. Opus performs the host-level
swap after review; openvibe.studio stays parked until then, and no host change is part of this
pull request.

1. **DNS and Cloudflare:** make sure the `openvibe.studio` zone is active at Cloudflare. Add apex
   and `www` A/AAAA records to the OpenVibe host, proxied through Cloudflare like the other room
   domains. Keep the DNS-only ACME validation route reachable during certificate issuance.
2. **TLS:** issue `/etc/letsencrypt/live/openvibe.studio/{fullchain.pem,privkey.pem}` for apex and
   `www` before enabling the TLS server block.
3. **Network OAuth:** deploy the Network change with the Studio cutover. It seeds the confidential
   OAuth client `studio`, the redirect URI `https://openvibe.studio/auth/callback`, and lists
   Studio in the Network Frame.
4. **Service:** run `sudo ovhost service add studio`. It clones this repository into
   `/opt/openvibe.studio`, creates `/etc/openvibe/studio.env` with mode 0600 and prints the
   remaining steps without printing secrets. Use the Network service-principal setup to create or
   rotate the client `studio`; set `OV_OAUTH_CLIENT_ID=studio`. The unit is
   `deploy/systemd/openvibe-studio.service`: it runs as `ubuntu` from `/opt/openvibe.studio` on
   `127.0.0.1:5155` with the same hardening as the other room services. If the host tooling does
   not install it, put it in place by hand:

       sudo cp deploy/systemd/openvibe-studio.service /etc/systemd/system/
       sudo systemctl daemon-reload
       sudo systemctl enable --now openvibe-studio

   Then check `http://127.0.0.1:5155/api/health`.
5. **The bundles:** the `bundles` workflow builds PhotoCraft and LightCraft from their pinned
   tags on every push to `main`, checks that each build reaches its first frame, and publishes the
   two trees as one tarball plus a `SHA256SUMS` file in the release
   `bundles-<photo tag>-<light tag>`. The release is public: the host fetches it with curl and
   needs no GitHub account and no token.

       sudo -u ubuntu STUDIO_BUNDLE_ROOT=/opt/openvibe.studio/public/apps \
         /opt/openvibe.studio/scripts/fetch-bundles.sh

   Run it **after each deploy** and **whenever the pinned tags change** (the release name follows
   the tags, so a new tag means a new release). The script checks the tarball against
   `SHA256SUMS` before it unpacks anything, and it swaps the bundle tree in one step: the root
   becomes a link to `public/versions/<release>`, so a running service never sees half a bundle.
   Restart the service afterwards so it picks the new tree up.
6. **Vhost and parked redirect:** the reference vhost is `deploy/nginx/openvibe.studio.conf`. It
   sends plain HTTP to HTTPS, `www` to the apex, rate-limits `/auth/` and `/api/` (zones
   `studio_auth` and `studio_api`), caps request bodies at 64k (the apps run in the browser) and
   serves the bundle files under `/apps/` from disk with the rules the WebAssembly build needs:
   `application/wasm`, no-cache on the loader and the part list, and a year of immutable cache on
   the hashed parts only. Its bundle root is `/opt/openvibe.studio/public`, so keep it in step with
   `STUDIO_BUNDLE_ROOT` if that path differs. After review and the readiness checks, Opus removes
   the `openvibe.studio` redirect blocks from Network's `parked-domains.conf`, installs the vhost
   with `sudo ovhost nginx render studio --install`, runs `nginx -t` and reloads nginx as one
   host-level swap.
7. **Verify:** check `/`, `/photo`, `/light`, `/api/health` and `/auth/login` through HTTPS, and
   that `/apps/light/lightcraft_web_bg.wasm` answers with `application/wasm`.

Two things to keep in mind at launch. The 64k body limit in the vhost fits the pages and the app
frames; a save that carries a large export through the service does not fit in it, so big exports
have to be saved from the app itself. And the bundles are a moving target: a new pinned tag means a
new release, and the fetch script has to run again before the service serves the new build.

The drill port is the service port plus 10000: `5155` serves the site, `15155` is the drill.
