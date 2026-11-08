'use strict';
const fs = require('fs');
const path = require('path');

const MIME = {
    '.wasm': 'application/wasm',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

// A name that carries a content hash never changes; a plain name may change with every release.
const HASHED = /-[0-9a-f]{8,}./;
const PART = /.part-[0-9a-f]+$/;

/**
 * The headers one file of a bundle is served with, following each upstream project's own rules
 * (packaging/web/_headers): PhotoCraft's hashed parts are immutable, everything else is
 * revalidated, and the WebAssembly module is served as application/wasm or the browser refuses
 * to stream-compile it.
 */
function bundleHeaders(appId, relPath) {
    const name = path.basename(relPath || '');
    const ext = path.extname(name).toLowerCase();
    const headers = { 'X-Content-Type-Options': 'nosniff' };
    if (MIME[ext]) headers['Content-Type'] = MIME[ext];
    const immutable = appId === 'photo' && (PART.test(name) || HASHED.test(name) || ext === '.wasm');
    headers['Cache-Control'] = immutable ? 'public, max-age=31536000, immutable' : 'no-cache';
    return headers;
}

/** The file a request for `rel` inside a bundle maps to, or null when it would leave the bundle. */
function bundlePath(root, appId, rel) {
    const base = path.resolve(root, String(appId || ''));
    const target = path.resolve(base, String(rel || ''));
    if (target !== base && !target.startsWith(base + path.sep)) return null;
    return target;
}

/** Whether a bundle is installed on this machine (the deploy fetches it; it is never in git). */
function hasBundle(root, appId) {
    try {
        return fs.statSync(path.join(root, appId, 'index.html')).isFile();
    } catch {
        return false;
    }
}

module.exports = { bundleHeaders, bundlePath, hasBundle, MIME };
