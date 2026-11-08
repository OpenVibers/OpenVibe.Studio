'use strict';
const fs = require('fs');
const { bundleHeaders, bundlePath } = require('./bundles');

/**
 * The app bundles are static files with rules of their own: the WebAssembly module needs the
 * application/wasm type, hashed parts may be cached forever and the loader may not be. The
 * bundles live outside git; the deploy fetches them from the build artifacts by tag and checksum.
 */
function createBundleFiles({ root }) {
    return (req, res, next) => {
        const rel = decodeURIComponent(req.path || '').replace(/^\/+/, '');
        const parts = rel.split('/').filter(Boolean);
        const appId = parts.shift() || '';
        const rest = parts.join('/');
        const file = bundlePath(root, appId, rest);
        if (!file) return next();
        let stat;
        try {
            stat = fs.statSync(file);
        } catch {
            return next();
        }
        if (!stat.isFile()) return next();
        const headers = bundleHeaders(appId, rest);
        for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
        const etag = '"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';
        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', stat.mtime.toUTCString());
        res.setHeader('Content-Length', stat.size);
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        if (req.method === 'HEAD') {
            res.status(200).end();
            return;
        }
        res.status(200);
        fs.createReadStream(file).pipe(res);
    };
}

module.exports = { createBundleFiles };
