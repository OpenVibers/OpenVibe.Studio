'use strict';
const express = require('express');
const { esc } = require('./html');
const { send } = require('./layout');
const { ADAPTERS } = require('./adapters');
const { hasBundle } = require('./bundles');
const { APPS } = require('./product');

function createPages({ config, sso, pics, video }) {
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

    r.get('/image-tools', (req, res) => {
        const picture = /^[2-9a-km-zA-HJ-NP-Z]{8}$/.test(String(req.query.picture || '')) ? String(req.query.picture) : '';
        send(res, { title: 'Image tools', viewer: viewerOf(req), config, path: '/image-tools', body:
            '<h1>Edit a picture with AI</h1><p>Make an edited copy on Pics. The original stays unchanged and the new picture starts unlisted, like every upload.</p>' +
            '<form id="image-tools"><label>Picture slug <input name="picture" required value="' + esc(picture) + '"></label>' +
            '<label>Operation <select name="operation"><option value="upscale">Upscale</option><option value="remove-background">Remove background</option><option value="restyle">Restyle</option></select></label>' +
            '<label>Style instructions <textarea name="prompt" maxlength="1000"></textarea></label><button type="submit">Make edited copy</button></form>' +
            '<p id="image-tools-status" role="status"></p><script src="/js/image-tools.js" defer></script>' });
    });
    r.get('/', (req, res) => {
        const viewer = viewerOf(req);
        const photo = APPS.find((x) => x.id === 'photo'), light = APPS.find((x) => x.id === 'light');
        const body = '<section class="hero"><div>' +
            '<h1>Edit photos right in your browser.</h1>' +
            '<p>Photo for layers and retouching. Light for your library and RAW files. Free and open source, with your files on OpenVibe.</p>' +
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

    /**
     * The app page, with a hand-off source when it was opened from another site. `open` is
     * { source: 'pics', id, name, label, href } or null; the browser layer reads the data-*
     * attributes and puts the bytes into the app after its frame has started.
     */
    const appPage = (adapter, viewer, open = null) => {
        const installed = hasBundle(config.bundleRoot, adapter.id);
        const src = '/apps/' + adapter.bundle.path + '/' + adapter.bundle.entry + (adapter.bundle.query || '');
        const commands = adapter.commands.map((command) =>
            '<button class="button-quiet" type="button" data-command="' + esc(command.id) + '" title="' + esc(command.description || command.title) + '">' + esc(command.title) + '</button>').join('');
        const saveNote = adapter.capabilities.save ? '' :
            'Save to OpenVibe is not available for this app: its browser build has no scriptable export, so export from the app and the file downloads to your browser.';
        const sourceLine = open && open.label
            ? '<p class="fine-print app-source">From ' + (open.href ? '<a href="' + esc(open.href) + '" rel="noopener">' + esc(open.label) + '</a>' : esc(open.label)) +
              (open.name ? ' · ' + esc(open.name) : '') + '</p>'
            : '';
        const head = '<section class="app-head"><div>' +
            '<h1>' + esc(adapter.title) + '</h1>' + sourceLine +
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
        const openAttrs = open && open.source
            ? ' data-studio-open-source="' + esc(open.source) + '" data-studio-open-id="' + esc(open.id || '') +
              '" data-studio-open-name="' + esc(open.name || '') + '"'
            : '';
        return '<section class="app-shell" data-studio-app="' + esc(adapter.id) + '" data-studio-driver="' + esc(adapter.driver) +
            '" data-studio-signed-in="' + (viewer.kind === 'user' ? 'true' : 'false') + '"' + openAttrs + '>' + head + files + frame + '</section>' + scripts;
    };

    /** The Studio side of "Edit in Studio": a video from OpenVibe.Video, loaded in a plain editor shell. */
    const videoEditor = (media, source) => {
        const duration = Number(media.duration_seconds) > 0 ? Math.round(Number(media.duration_seconds)) + ' s' : 'a video';
        const preview = '<div class="app-frame-wrap"><video class="app-frame" controls preload="metadata" playsinline src="/api/v1/studio/media/' +
            encodeURIComponent(media.id) + '/bytes"></video></div>';
        if (!media.can_edit) {
            return '<section class="page-intro"><h1>Edit in Studio</h1><p class="fine-print app-source">From <a href="' + esc(source.url) +
                '" rel="noopener">' + esc(source.name) + '</a> · ' + esc(media.title) + '</p></section>' +
                '<p class="app-status">You can watch this video here, but only its owner can edit it. <a class="ovk-btn ovk-btn--quiet" href="' +
                esc(source.url) + '" rel="noopener">Open on Video</a></p>' + preview;
        }
        const form = media.status === 'ready' ? '<form data-studio-publish data-media="' + esc(media.id) + '">' +
            '<label>Title <input name="title" type="text" maxlength="120" required value="' + esc(media.title) + '"></label>' +
            '<label>Who can see the copy <select name="visibility"><option value="private" selected>Only you</option><option value="unlisted">Only people with the link</option><option value="public">Anyone</option></select></label>' +
            '<p class="fine-print">Publishing makes a new copy on OpenVibe.Video. The original stays as it is; the copy starts processing there.</p>' +
            '<p><button class="ovk-btn ovk-btn--primary" type="submit">Publish on Video</button> ' +
            '<a class="ovk-btn ovk-btn--quiet" href="' + esc(source.url) + '" rel="noopener">Open on Video</a></p>' +
            '<p class="app-status" data-role="status" role="status" aria-live="polite"></p></form>'
            : '<p class="app-status">The video is still processing on OpenVibe.Video. Reload this page when it is ready. <a href="' + esc(source.url) + '">Open on Video</a></p>';
        return '<section class="page-intro"><h1>Edit in Studio</h1><p class="fine-print app-source">From <a href="' + esc(source.url) +
            '" rel="noopener">' + esc(source.name) + '</a> · ' + esc(media.title) + ' · ' + esc(duration) + '</p></section>' +
            '<section class="app-shell" data-studio-edit-video data-studio-media="' + esc(media.id) + '">' + preview + form +
            '<script src="/js/edit-video.js" defer></script></section>';
    };

    const editFail = (res, viewer, status, title, detail) => send(res, {
        title, viewer, config, path: '/edit',
        body: '<section class="page-intro"><h1>' + esc(title) + '</h1><p>' + esc(detail) + '</p><p><a class="button-primary" href="/">Back to Studio</a></p></section>',
    }, status);
    const editSignIn = (res, req) => { res.redirect(302, '/auth/login?next=' + encodeURIComponent(req.originalUrl || '/edit')); };

    /**
     * GET /edit?media=<OpenVibe.Video id>&from=video     a recording opened from Video
     * GET /edit?pics=<Pics slug>&from=cam&app=photo|light  a picture opened from Cam or Pics
     *
     * Both are signed-in hand-offs: Studio asks the source service, with the person's own
     * Network token, whether that person may read the object. A private object of someone
     * else answers 404 exactly as a missing id does. The route then loads it into the
     * matching editor and says where it came from.
     */
    r.get('/edit', async (req, res) => {
        const viewer = viewerOf(req);
        const token = sso.extractToken(req);
        if (!viewer || viewer.kind !== 'user' || !token) { editSignIn(res, req); return; }
        const picsSlug = String(req.query.pics || '');
        const mediaId = String(req.query.media || '');
        const from = String(req.query.from || '').slice(0, 20);
        if (picsSlug) {
            if (!/^[2-9a-km-zA-HJ-NP-Z]{8}$/.test(picsSlug)) { editFail(res, viewer, 400, 'No picture to open', 'That picture address is not one Studio can open.'); return; }
            try {
                const image = await pics.getImage(token, picsSlug);
                const appId = req.query.app === 'light' ? 'light' : 'photo';
                const adapter = ADAPTERS.find((one) => one.id === appId) || ADAPTERS[0];
                const label = from === 'cam' ? 'OpenVibe.Cam' : 'OpenVibe.Pics';
                const href = from === 'cam' ? 'https://openvibe.cam' : (image.page || 'https://openvibe.pics');
                send(res, { title: 'Edit ' + (image.name || 'a picture') + ' in Studio', viewer, config, path: '/edit',
                    body: appPage(adapter, viewer, { source: 'pics', id: picsSlug, name: image.name || picsSlug, label, href }) });
            } catch (err) {
                if (err && err.status === 404) editFail(res, viewer, 404, 'That picture is not yours to edit', 'It does not exist, or its owner has not shared it with you.');
                else if (err && err.status === 401) editSignIn(res, req);
                else editFail(res, viewer, 502, 'The picture could not be opened', 'OpenVibe.Pics did not answer just now. Try again in a minute.');
            }
            return;
        }
        if (!mediaId) { editFail(res, viewer, 400, 'Nothing to open', 'Open a video with /edit?media=<id> or a picture with /edit?pics=<slug>.'); return; }
        if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(mediaId)) { editFail(res, viewer, 400, 'No video to open', 'That video address is not one Studio can open.'); return; }
        try {
            const data = await video.getMedia(token, mediaId);
            send(res, { title: 'Edit ' + (data.media.title || 'a video') + ' in Studio', viewer, config, path: '/edit',
                body: videoEditor(data.media, data.source) });
        } catch (err) {
            if (err && err.status === 404) editFail(res, viewer, 404, 'That video is not yours to edit', 'It does not exist, or its owner has not shared it with you.');
            else if (err && err.status === 401) editSignIn(res, req);
            else editFail(res, viewer, 502, 'The video could not be opened', 'OpenVibe.Video did not answer just now. Try again in a minute.');
        }
    });

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
        const body = '<section class="page-intro"><h1>Attribution</h1>' +
            '<p>Studio hosts builds of open-source projects. Each one keeps its own licence and its own attribution files; here they are in full.</p></section>' +
            '<ul class="limit-list">' + rows + '</ul>' +
            '<p class="fine-print">OpenVibe.Studio is MIT licensed. The apps are the work of their own authors and are used under their own terms; ' +
            'OpenVibe.Studio hosts a build of them and is not otherwise connected to the upstream projects.</p>';
        send(res, { title: 'Attribution', body: body, viewer: viewerOf(req), config: config, path: '/attribution' });
    });

    return r;
}

module.exports = { createPages };
