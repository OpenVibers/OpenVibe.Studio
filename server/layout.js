'use strict';
const shell = require('openvibe-shared/shell');
const serve = require('openvibe-shared/serve');
const NAV = [
    { label: 'Home', href: '/' },
    { label: 'Photo', href: '/photo' },
    { label: 'Light', href: '/light' },
];
function page({ title, body, viewer, config, path = '/' }) {
    const nav = { service: 'studio', apiBase: config.networkUrl, links: NAV.map((x) => ({ ...x, active: path === x.href })), history: { type: 'page', title }, silentLogin: `${config.baseUrl}/auth/login?silent=1&next={url}`, sessionUrl: '/auth/me', loginUrl: '/auth/login?next={path}', logoutUrl: '/auth/logout?next={path}' };
    const footer = { service: 'studio', variant: 'full', brandName: 'OpenVibe.Studio' };
    return shell.page({ name: 'OpenVibe.Studio', lang: 'en', title: `${title} · OpenVibe.Studio`, titleSuffix: '', siteName: 'OpenVibe.Studio', description: 'Photo and Light, the creative apps on the OpenVibe network.', canonical: `${config.baseUrl}${path}`, robots: 'index, follow', home: '/', navLinks: NAV, navbar: nav, footer,
        head: `<link rel="stylesheet" href="${serve.url('kit.css')}"><link rel="stylesheet" href="/css/studio.css"><meta name="referrer" content="strict-origin-when-cross-origin">`,
        body: `<div id="navbar-mount"></div><main id="main" class="studio-page">${body}</main>` });
}
function send(res, opts, status = 200) { res.set('Cache-Control', opts.viewer?.kind === 'user' ? 'private, no-store' : 'public, max-age=60'); res.set('Vary', 'Cookie'); res.status(status).type('html').send(page(opts)); }
module.exports = { page, send, NAV };
