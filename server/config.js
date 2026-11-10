'use strict';
require('dotenv').config();
const trim = (s) => String(s || '').replace(/\/+$/, '');
const path = require('path');

function load(env = process.env) {
    const port = Number.parseInt(env.PORT, 10) || 5155;
    const networkUrl = trim(env.OV_NETWORK_URL || 'https://openvibe.network');
    return {
        port,
        host: env.HOST || '127.0.0.1',
        baseUrl: trim(env.BASE_URL || `http://localhost:${port}`),
        drillPort: Number.parseInt(env.DRILL_PORT, 10) || port + 10000,
        trustProxy: env.TRUST_PROXY != null ? Number(env.TRUST_PROXY) : 2,
        networkUrl,
        networkInternalUrl: trim(env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000'),
        downloadUrl: trim(env.OV_DOWNLOAD_URL || 'https://openvibe.download'),
        imageWorkerUrl: trim(env.STUDIO_IMAGE_WORKER_URL || ''),
        picsUrl: trim(env.OV_PICS_URL || 'https://openvibe.pics'),
        videoUrl: trim(env.OV_VIDEO_URL || 'https://openvibe.video'),
        clientId: env.OV_OAUTH_CLIENT_ID || 'studio',
        clientSecret: env.OV_OAUTH_CLIENT_SECRET || '',
        secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
        bundleRoot: env.STUDIO_BUNDLE_ROOT || path.join(__dirname, '..', 'public', 'apps'),
    };
}
module.exports = { load };
