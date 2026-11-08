'use strict';
const express = require('express');
const { esc } = require('./html');
const { send } = require('./layout');
const { ADAPTERS } = require('./adapters');
const { hasBundle } = require('./bundles');
const { APPS } = require('./product');

function createPages({ config, sso }) {
    const r = express.Router();
    const viewerOf = (req) => req.user || req.viewer || { kind: 'anonymous' };

    // The home is short (Opus's design pass, 11-08): one promise, two apps with three features each, three plain notes,
    // one credit line. The measured detail lives on each app's page and in the docs, not here.
    const HOME_APPS = [
        { id: 'photo', name: 'Photo', line: 'Layers, masks and retouching.', features: ['Layers and masks', 'Curves and adjustments', 'Opens PSD files'] },
        { id: 'light', name: 'Light', line: 'Your photo library and RAW developer.', features: ['RAW files', 'Develop and presets', 'A library in your browser'] },
    ];
    const appCard = (app) => '<article class="app-card"><h3>' + esc(app.name) + '</h3><p>' + esc(app.line) + '</p>' +
        '<ul class="app-features">' + app.features.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
        '<p><a class="button-primary" href="/' + esc(app.id) + '">Open ' + esc(app.name) + '</a></p></article>';

    r.get('/', (req, res) => {
        const viewer = viewerOf(req);
        const photo = APPS.find((x) => x.id === 'photo'), light = APPS.find((x) => x.id === 'light');
        const body = '<section class="hero"><div>' +
            '<span class="eyebrow">OPENVIBE STUDIO</span>' +
            '<h1>Edit photos right in your browser.</h1>' +
            '<p>Photo for layers and retouching. Light for your library and RAW files. Free and open source, with your files on OpenVibe.</p>' +
            '<p><a class="button-primary" href="/photo">Open Photo</a> <a class="button-secondary" href="/light">Open Light</a></p>' +
            '</div></section>' +
            '<section id="apps"><div class="app-grid">' + HOME_APPS.map(appCard).join('') + '</div></section>' +
            '<section id="limits"><h2>Good to know</h2><ul class="limit-list">' +
            '<li>The first open takes a few seconds while the app loads.</li>' +
            '<li>On a phone with 4 GB of memory, very large files can run out of memory.</li>' +
            '<li>It needs a connection: there is no offline mode yet. Video editing comes later.</li></ul></section>' +
            '<section id="licences"><p class="fine-print">Photo is <a href="' + esc(photo.upstream) + '" rel="noopener">PhotoCraft</a> and Light is ' +
            '<a href="' + esc(light.upstream) + '" rel="noopener">LightCraft</a>, open-source apps (' + esc(photo.licence) + ') that we build from their releases. ' +
            '<a href="/attribution">Attribution</a></p></section>';
        send(res, { title: 'Studio: edit photos in your browser', body: body, viewer: viewer, config: config, path: '/' });
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
