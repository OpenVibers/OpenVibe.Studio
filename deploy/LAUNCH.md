# Launch sequence for openvibe.studio

This pull request prepares the service and its build. Opus performs the host-level swap after
review; openvibe.studio stays parked until then, and no host change is part of this pull request.

1. **DNS and Cloudflare:** make sure the `openvibe.studio` zone is active at Cloudflare. Add apex
   and `www` A/AAAA records to the OpenVibe host, proxied through Cloudflare like the other room
   domains. Keep the DNS-only ACME validation route reachable during certificate issuance.
2. **TLS:** issue `/etc/letsencrypt/live/openvibe.studio/{fullchain.pem,privkey.pem}` for apex and
   `www` before enabling the TLS server block.
3. **Network OAuth:** deploy the Network change with the Studio cutover. It seeds the confidential
   OAuth client `studio`, the redirect URI `https://openvibe.studio/auth/callback`, and lists
   Studio in the Network Frame.
4. **Service:** run `sudo ovhost service add studio`. It clones this repository, creates
   `/etc/openvibe/studio.env` with mode 0600 and prints the remaining steps without printing
   secrets. Use the Network service-principal setup to create or rotate the client `studio`; set
   `OV_OAUTH_CLIENT_ID=studio`, then run `sudo ovhost validate studio` and
   `sudo ovhost deploy studio --restart`. Check `http://127.0.0.1:5155/api/health`.
5. **The bundles:** the service serves the app bundles from `STUDIO_BUNDLE_ROOT` (by default
   `public/apps`). The `bundles` workflow builds them from the pinned upstream tags and publishes
   them with a checksum file; the deploy fetches that artifact, checks the checksums and unpacks
   `photo/` and `light/` into the bundle root. A bundle is never kept in git.
6. **Vhost and parked redirect:** after review and the readiness checks, Opus removes the
   `openvibe.studio` redirect blocks from Network's `parked-domains.conf`, installs the vhost and
   reloads nginx as one host-level swap.
7. **Verify:** check `/`, `/photo`, `/light`, `/api/health` and `/auth/login` through HTTPS. The
   vhost leaves `/api/` public to the service; the file endpoints need the person's Network token.

The drill port is the service port plus 10000: `5155` serves the site, `15155` is the drill.
