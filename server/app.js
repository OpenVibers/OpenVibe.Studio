'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { createSsoClient } = require('openvibe-sdk/sso');
const { createApi } = require('./api');
const { createPages } = require('./pages');
const { createBundleFiles } = require('./bundle-files');
const { createMediaClient } = require('./openvibe/media');
const { createPicsClient } = require('./openvibe/pics');
const { APPS } = require('./product');
const seo = require('openvibe-shared/seo');
const agentDescriptor = require('./agent-descriptor');
const configLib = require('./config');

const SITE_NAME = 'OpenVibe.Studio';
const SUMMARY = 'Photo and Light: two open-source creative apps (PhotoCraft, LightCraft) built from pinned release tags and served inside an OpenVibe account.';
const appText = (id) => {
    const app = APPS.find((one) => one.id === id);
    return app ? `${app.tagline} ${app.what}` : '';
};
// The public pages, for /llms-full.txt: the same pages llms.txt and the sitemap list.
const PUBLIC_PAGES = [
    { title: SITE_NAME, url: '/', text: SUMMARY },
    { title: 'Photo', url: '/photo', text: appText('photo') },
    { title: 'Light', url: '/light', text: appText('light') },
    { title: 'Attribution', url: '/attribution', text: 'The open-source projects Studio hosts, their licences, upstream repositories and the licence files kept with each build.' },
];

function createApp(opts = {}) {
    const config = opts.config || configLib.load();
    const sso = opts.sso || createSsoClient({
        site: 'studio', baseUrl: config.baseUrl, clientId: config.clientId, clientSecret: config.clientSecret,
        networkUrl: config.networkUrl, networkInternalUrl: config.networkInternalUrl, secureCookies: config.secureCookies,
    });
    const media = opts.media || createMediaClient({ baseUrl: config.downloadUrl, fetchImpl: opts.fetchImpl });
    const pics = opts.pics || createPicsClient({ baseUrl: config.picsUrl, fetchImpl: opts.fetchImpl });
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', config.trustProxy);
    app.use(helmet({ contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://openvibe.network', 'https://static.cloudflareinsights.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://openvibe.network'],
        connectSrc: ["'self'", 'https://openvibe.network', 'https://openvibe.download', 'https://openvibe.pics', 'https://cloudflareinsights.com'],
        frameSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        workerSrc: ["'self'", 'blob:'],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://openvibe.network'],
    } }, crossOriginEmbedderPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
    app.use(express.urlencoded({ extended: false }));
    app.use('/auth', sso.router(express));
    app.use(sso.optionalAuth());
    app.get('/api/health', (_req, res) => res.json({
        status: 'ok', service: 'openvibe-studio', version: require('../package.json').version, drill_port: config.drillPort,
    }));
    app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://openvibe.studio/sitemap.xml\n'));
    app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        '<url><loc>https://openvibe.studio/</loc></url><url><loc>https://openvibe.studio/photo</loc></url>' +
        '<url><loc>https://openvibe.studio/light</loc></url><url><loc>https://openvibe.studio/attribution</loc></url></urlset>'));
    { const legal = require('openvibe-shared/legal'); app.get(legal.PATHS, legal.handler({ id: 'studio', service: 'studio', host: 'openvibe.studio', name: 'OpenVibe.Studio', profile: 'hosting' })); }
    app.get('/llms.txt', (_req, res) => res.type('text/plain').send(
        '# OpenVibe.Studio\n\n' + SUMMARY + '\n\n- [Home](/)\n- [Photo](/photo)\n- [Light](/light)\n- [Attribution](/attribution)\n- [API docs](/openapi.json)\n- [Full text for language models](/llms-full.txt)\n- [Agent descriptor](/.well-known/agent.json)\n'));
    // The same pages with their text, for a model that wants the site in one read (llms-full.txt, llmstxt.org).
    app.get('/llms-full.txt', (_req, res) => res.type('text/plain').send(seo.llmsFull({
        site: SITE_NAME, summary: SUMMARY, base: 'https://openvibe.studio',
        sections: [{ title: 'Pages', pages: PUBLIC_PAGES }],
    })));
    // What openvibe.studio tells an agent about itself (SEO-2, openvibe-shared/agent-layer's shape).
    app.get('/.well-known/agent.json', (_req, res) => res.set('Cache-Control', 'public, max-age=3600').json(agentDescriptor));
    app.get('/openapi.json', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'openapi.json')));
    app.use('/api/v1/studio', createApi({ sso, media, pics }));
    // GET /release.json (ADR-016): the navbar's release watch polls it so open tabs learn of a new release (the 11-09
    // browser sweep found it answering 404 here).
    require('openvibe-shared/release').createRelease({ service: 'studio', root: path.join(__dirname, '..') }).mount(app);
    app.use('/shared', require('openvibe-shared/serve').handler());
    app.use('/apps', createBundleFiles({ root: config.bundleRoot }));
    app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '1h' }));
    app.use(createPages({ config, sso, media, pics }));
    app.use((err, _req, res, _next) => {
        if (res.headersSent) return;
        res.status(err.status || 500).type('text/plain').send('Studio could not complete that request.');
    });
    return { app, config, sso, media, pics };
}

module.exports = { createApp };
