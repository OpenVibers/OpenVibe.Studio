'use strict';
const express = require('express');
const { esc } = require('./html');
const { send } = require('./layout');
const { ADAPTERS } = require('./adapters');
const { hasBundle } = require('./bundles');
const { APPS, LIMITS } = require('./product');

function createPages({ config, sso }) {
    const r = express.Router();
    const viewerOf = (req) => req.user || req.viewer || { kind: 'anonymous' };

    const appCard = (app) => {
        const limits = app.limits.map((limit) => '<li>' + esc(limit) + '</li>').join('');
        return '<article class="app-card">' +
            '<span class="eyebrow">' + esc(app.title) + '</span>' +
            '<h3>' + esc(app.tagline) + '</h3>' +
            '<p>' + esc(app.what) + '</p>' +
            '<ul class="app-limits">' + limits + '</ul>' +
            '<p class="app-licence">Licence: ' + esc(app.licence) + '. ' + esc(app.licenceNote) +
            ' <a href="' + esc(app.upstream) + '" rel="noopener">Upstream project</a>.</p>' +
            '<p><a class="button-primary" href="/' + esc(app.id) + '">Open ' + esc(app.title) + '</a></p>' +
            '</article>';
    };

    r.get('/', (req, res) => {
        const viewer = viewerOf(req);
        const cards = APPS.map(appCard).join('');
        const limits = LIMITS.map((limit) => '<li>' + esc(limit) + '</li>').join('');
        const licences = APPS.map((app) => '<li><strong>' + esc(app.title) + '</strong> — ' + esc(app.licence) +
            '. <a href="' + esc(app.upstream) + '" rel="noopener">' + esc(app.upstream) + '</a>. ' + esc(app.licenceNote) + '</li>').join('');
        const body = '<section class="hero"><div>' +
            '<span class="eyebrow">PHOTO AND LIGHT</span>' +
            '<h1>Two real creative apps on the OpenVibe network.</h1>' +
            '<p>Photo is a layered photo editor. Light is a photo library and RAW developer. Both run in your browser as WebAssembly, both are built from pinned release tags by our own CI, and both sit inside your OpenVibe account.</p>' +
            '<p><a class="button-primary" href="/photo">Open Photo</a> <a class="button-secondary" href="/light">Open Light</a></p>' +
            '</div></section>' +
            '<section id="apps"><div class="section-heading"><div><span class="eyebrow">WHAT IS HERE</span><h2>The apps</h2></div>' +
            '<p>Each app is an upstream open-source project. We build it from a pinned tag, serve it here, and keep its licence and attribution.</p></div>' +
            '<div class="app-grid">' + cards + '</div></section>' +
            '<section id="limits"><div class="section-heading"><div><span class="eyebrow">BEFORE YOU START</span><h2>Honest limits</h2></div>' +
            '<p>Measured, not guessed.</p></div><ul class="limit-list">' + limits + '</ul></section>' +
            '<section id="licences"><div class="section-heading"><div><span class="eyebrow">CREDIT</span><h2>Licences and attribution</h2></div></div>' +
            '<ul class="limit-list">' + licences + '</ul>' +
            '<p class="fine-print">OpenVibe.Studio itself is MIT licensed. The full attribution is on the <a href="/attribution">attribution page</a>.</p></section>';
        send(res, { title: 'Photo and Light, the creative apps on OpenVibe', body: body, viewer: viewer, config: config, path: '/' });
    });

    const appPage = (adapter, viewer) => {
        const installed = hasBundle(config.bundleRoot, adapter.id);
        const src = '/apps/' + adapter.bundle.path + '/' + adapter.bundle.entry + (adapter.bundle.query || '');
        const commands = adapter.commands.map((command) =>
            '<button class="button-quiet" type="button" data-command="' + esc(command.id) + '" title="' + esc(command.description || command.title) + '">' + esc(command.title) + '</button>').join('');
        const saveNote = adapter.capabilities.save ? '' :
            'Save to OpenVibe is not available for this app: its browser build has no scriptable export, so export from the app and the file downloads to your browser.';
        const head = '<section class="app-head"><div>' +
            '<span class="eyebrow">' + esc(adapter.title) + '</span>' +
            '<h1>' + esc(adapter.title) + '</h1>' +
            '<p>Build ' + esc(adapter.base.tag) + ' of ' + esc(adapter.base.repository.replace('https://github.com/', '')) +
            ', built by ' + esc(adapter.base.builtBy) + '. Licence: ' + esc(adapter.base.licence) + '.</p>' +
            '</div><div class="app-actions">' +
            '<button class="button-secondary" type="button" data-action="open">Open from OpenVibe</button>' +
            '<button class="button-secondary" type="button" data-action="save"' + (adapter.capabilities.save ? '' : ' disabled') + '>Save to OpenVibe</button>' +
            (commands ? '<span class="app-commands">' + commands + '</span>' : '') +
            '</div>' +
            '<p class="app-status" data-role="status" aria-live="polite"></p>' +
            (saveNote ? '<p class="fine-print">' + esc(saveNote) + '</p>' : '') +
            '</section>';
        const files = '<div class="app-files" data-role="files" hidden><h2>Your OpenVibe files</h2>' +
            '<ul data-role="file-list"></ul><p data-role="files-note" class="fine-print"></p></div>' +
            '<pre class="app-output" data-role="output" hidden></pre>';
        const frame = installed
            ? '<div class="app-frame-wrap"><iframe class="app-frame" src="' + esc(src) + '" title="' + esc(adapter.title) +
              '" allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe></div>'
            : '<p class="app-missing">The ' + esc(adapter.title) + ' bundle is not installed on this server yet. ' +
              'The deploy fetches it from the build artifacts by tag and checksum; a bundle is never kept in git.</p>';
        const scripts = '<script src="/js/drivers.js"></script><script src="/js/studio.js"></script>';
        return '<section class="app-shell" data-studio-app="' + esc(adapter.id) + '" data-studio-driver="' + esc(adapter.driver) +
            '" data-studio-signed-in="' + (viewer.kind === 'user' ? 'true' : 'false') + '">' + head + files + frame + '</section>' + scripts;
    };

    r.get('/:app(photo|light)', (req, res) => {
        const adapter = ADAPTERS.find((one) => one.id === req.params.app);
        if (!adapter) {
            send(res, {
                title: 'No such app',
                body: '<section class="page-intro"><h1>No such app</h1><p><a href="/">Back to Studio</a></p></section>',
                viewer: viewerOf(req), config: config, path: '/',
            }, 404);
            return;
        }
        const viewer = viewerOf(req);
        send(res, { title: adapter.title + ' in Studio', body: appPage(adapter, viewer), viewer: viewer, config: config, path: '/' + adapter.id });
    });

    r.get('/attribution', (req, res) => {
        const rows = ADAPTERS.map((adapter) => '<li><strong>' + esc(adapter.base.name) + '</strong> — ' + esc(adapter.base.licence) +
            '. Built by ' + esc(adapter.base.builtBy) + ' from <a href="' + esc(adapter.base.repository) + '" rel="noopener">' + esc(adapter.base.repository) +
            '</a> at tag ' + esc(adapter.base.tag) + '. Licence files kept with the build: ' +
            esc(adapter.base.licenceFiles.join(', ')) + '.</li>').join('');
        const body = '<section class="page-intro"><span class="eyebrow">CREDIT</span><h1>Attribution</h1>' +
            '<p>Studio hosts builds of open-source projects. Each one keeps its own licence and its own attribution files; here they are in full.</p></section>' +
            '<ul class="limit-list">' + rows + '</ul>' +
            '<p class="fine-print">OpenVibe.Studio is MIT licensed. The apps are the work of their own authors and are used under their own terms; ' +
            'OpenVibe.Studio hosts a build of them and is not otherwise connected to the upstream projects.</p>';
        send(res, { title: 'Attribution', body: body, viewer: viewerOf(req), config: config, path: '/attribution' });
    });

    return r;
}

module.exports = { createPages };
