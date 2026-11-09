'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createApp } = require('../server/app');

const config = {
    port: 0, host: '127.0.0.1', baseUrl: 'http://studio.test', networkUrl: 'https://openvibe.network',
    networkInternalUrl: 'http://127.0.0.1:4000', downloadUrl: 'https://openvibe.download', picsUrl: 'https://openvibe.pics',
    clientId: 'studio', clientSecret: '', secureCookies: false, trustProxy: 2, drillPort: 15155, bundleRoot: '',
};

function fakeSso() {
    return {
        router: () => express.Router(),
        optionalAuth: () => (req, _res, next) => {
            if ((req.headers.cookie || '').includes('ov_token=person-a')) req.user = { kind: 'user', sub: 'usr_a', displayName: 'Person A' };
            next();
        },
        extractToken: (req) => {
            const auth = req.headers.authorization || '';
            if (auth.startsWith('Bearer ')) return auth.slice(7);
            const match = (req.headers.cookie || '').match(/(?:^|;\s*)ov_token=([^;]+)/);
            return (match && match[1]) || null;
        },
    };
}

const fakeMedia = {
    calls: [],
    listFiles: async (token) => { fakeMedia.calls.push(['list', token]); return { files: [{ id: 'file_a', name: 'sunset.jpg', content_type: 'image/jpeg', size: 12 }], folders: [], usage: { bytes: 12 } }; },
    downloadBytes: async (token, id) => { fakeMedia.calls.push(['bytes', token, id]); throw Object.assign(new Error('no byte route'), { status: 501, code: 'media.bytes.unavailable', detail: 'no public share' }); },
    uploadFile: async (token, file) => { fakeMedia.calls.push(['upload', token, file.name, file.bytes.length]); return { id: 'file_new', name: file.name, size: file.bytes.length }; },
};

const fakePics = {
    listImages: async () => [{ id: 'img_a', slug: 'img_a', name: 'mountains.jpg' }],
    bytes: async () => ({ name: 'mountains.jpg', contentType: 'image/jpeg', bytes: Buffer.from([1, 2, 3]) }),
};

function bundleFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bundles-'));
    fs.mkdirSync(path.join(root, 'light'), { recursive: true });
    fs.mkdirSync(path.join(root, 'photo', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'light', 'index.html'), '<!doctype html><title>LightCraft</title>');
    fs.writeFileSync(path.join(root, 'light', 'lightcraft_web_bg.wasm'), Buffer.from([0, 97, 115, 109]));
    fs.writeFileSync(path.join(root, 'photo', 'index.html'), '<!doctype html><title>PhotoCraft</title>');
    fs.writeFileSync(path.join(root, 'photo', 'app', 'parts.txt'), 'photocraft-parts 1\n');
    fs.writeFileSync(path.join(root, 'photo', 'app', 'photocraft-web.js'), 'export {};\n');
    fs.writeFileSync(path.join(root, 'photo', 'app', 'photocraft-web-abcdef12.part-0'), 'part');
    return root;
}

async function serve(opts = {}) {
    const { app } = createApp({
        config: Object.assign({}, config, { bundleRoot: bundleFixture() }, opts.config || {}),
        sso: fakeSso(),
        media: opts.media || fakeMedia,
        pics: opts.pics || fakePics,
    });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return { base: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('the home names both apps, their limits and their licences', async (t) => {
    const s = await serve(); t.after(s.close);
    const res = await fetch(s.base);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /PhotoCraft/);
    assert.match(html, /LightCraft/);
    assert.match(html, /Good to know/);
    assert.match(html, /MIT OR Apache-2\.0/);
    assert.match(html, /github\.com\/storytold\/photocraft/);
    assert.match(html, /github\.com\/storytold\/lightcraft/);
    assert.match(html, /Video editing comes later/);
    assert.match(html, /4 GB/);
    assert.doesNotMatch(html, /<img/);
});

test('the app pages wrap the app in the layer, with the sign-in state', async (t) => {
    const s = await serve(); t.after(s.close);
    const guest = await fetch(s.base + '/light');
    const guestHtml = await guest.text();
    assert.equal(guest.status, 200);
    assert.match(guestHtml, /Open from OpenVibe/);
    assert.match(guestHtml, /Save to OpenVibe/);
    assert.match(guestHtml, /data-studio-app="light"/);
    assert.match(guestHtml, /data-studio-driver="lightcraft"/);
    assert.match(guestHtml, /data-studio-signed-in="false"/);
    assert.match(guestHtml, /apps\/light\/index\.html\?host=parent/);

    const person = await fetch(s.base + '/light', { headers: { cookie: 'ov_token=person-a' } });
    assert.match(await person.text(), /data-studio-signed-in="true"/);

    const photo = await fetch(s.base + '/photo');
    const photoHtml = await photo.text();
    assert.match(photoHtml, /data-studio-driver="photocraft"/);
    assert.match(photoHtml, /no scriptable export/);
});

test('the bundles are served with the type and the cache rules the apps need', async (t) => {
    const s = await serve(); t.after(s.close);
    const wasm = await fetch(s.base + '/apps/light/lightcraft_web_bg.wasm');
    assert.equal(wasm.status, 200);
    assert.match(wasm.headers.get('content-type'), /application\/wasm/);
    assert.equal(wasm.headers.get('cache-control'), 'no-cache');

    const part = await fetch(s.base + '/apps/photo/app/photocraft-web-abcdef12.part-0');
    assert.equal(part.status, 200);
    assert.match(part.headers.get('cache-control'), /immutable/);

    const loader = await fetch(s.base + '/apps/photo/app/photocraft-web.js');
    assert.equal(loader.headers.get('cache-control'), 'no-cache');
    assert.match(loader.headers.get('content-type'), /javascript/);

    const list = await fetch(s.base + '/apps/photo/app/parts.txt');
    assert.equal(list.headers.get('cache-control'), 'no-cache');
    assert.match(list.headers.get('content-type'), /text\/plain/);

    const page = await fetch(s.base + '/apps/photo/index.html');
    assert.equal(page.headers.get('cache-control'), 'no-cache');

    assert.equal((await fetch(s.base + '/apps/light/nothing-here')).status, 404);
    assert.equal((await fetch(s.base + '/apps/../package.json')).status, 404);
});

test('saving needs a signed-in person', async (t) => {
    fakeMedia.calls.length = 0;
    const s = await serve(); t.after(s.close);
    const guest = await fetch(s.base + '/api/v1/studio/save', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: 'bytes' });
    assert.equal(guest.status, 401);
    assert.equal(fakeMedia.calls.filter((call) => call[0] === 'upload').length, 0);

    const person = await fetch(s.base + '/api/v1/studio/save', {
        method: 'POST',
        headers: { cookie: 'ov_token=person-a', 'content-type': 'image/jpeg', 'x-file-name': 'export.jpg' },
        body: 'bytes',
    });
    assert.equal(person.status, 201);
    const upload = fakeMedia.calls.find((call) => call[0] === 'upload');
    assert.deepEqual(upload, ['upload', 'person-a', 'export.jpg', 5]);
});

test('the files listing uses the person token and reports a source that fails', async (t) => {
    fakeMedia.calls.length = 0;
    const s = await serve(); t.after(s.close);
    assert.equal((await fetch(s.base + '/api/v1/studio/files')).status, 401);
    const res = await fetch(s.base + '/api/v1/studio/files', { headers: { cookie: 'ov_token=person-a' } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.download.files[0].name, 'sunset.jpg');
    assert.equal(data.pics.images[0].slug, 'img_a');
    assert.deepEqual(data.problems, []);
    assert.deepEqual(fakeMedia.calls[0], ['list', 'person-a']);

    const broken = await serve({
        media: Object.assign({}, fakeMedia, {
            listFiles: async () => { throw Object.assign(new Error('nope'), { status: 502, code: 'media.upstream_error', detail: 'the drive is down' }); },
        }),
    });
    t.after(broken.close);
    const failed = await (await fetch(broken.base + '/api/v1/studio/files', { headers: { cookie: 'ov_token=person-a' } })).json();
    assert.equal(failed.problems[0].source, 'download');
    assert.equal(failed.problems[0].detail, 'the drive is down');
});

test('the app catalogue, the attribution page and the small endpoints answer', async (t) => {
    const s = await serve(); t.after(s.close);
    const apps = await (await fetch(s.base + '/api/v1/studio/apps')).json();
    assert.deepEqual(apps.apps.map((one) => one.id), ['photo', 'light']);
    assert.equal(apps.apps[1].capabilities.save, true);
    assert.equal(apps.apps[0].capabilities.save, false);
    const attribution = await fetch(s.base + '/attribution');
    assert.equal(attribution.status, 200);
    const attributionHtml = await attribution.text();
    assert.match(attributionHtml, /storytold\/lightcraft/);
    assert.match(attributionHtml, /v0\.19\.0/);
    assert.equal((await fetch(s.base + '/api/health')).status, 200);
    const llms = await fetch(s.base + '/llms.txt');
    assert.equal(llms.status, 200);
    const llmsText = await llms.text();
    assert.ok(llmsText.includes('(/llms-full.txt)') && llmsText.includes('(/.well-known/agent.json)'), 'llms.txt names the full text and the agent descriptor');
    const full = await fetch(s.base + '/llms-full.txt');
    assert.equal(full.status, 200);
    assert.match(full.headers.get('content-type'), /^text\/plain/);
    const fullText = await full.text();
    assert.ok(fullText.startsWith('# OpenVibe.Studio\n'), 'llms-full.txt opens with the site heading');
    assert.ok(fullText.length > 500, `llms-full.txt carries the pages (${fullText.length} characters)`);
    for (const page of ['/photo', '/light', '/attribution']) assert.ok(fullText.includes(`URL: https://openvibe.studio${page}`), `llms-full.txt lists ${page}`);
    assert.ok(fullText.includes('PhotoCraft') && fullText.includes('LightCraft'), 'and the apps it serves');
    const agent = await fetch(s.base + '/.well-known/agent.json');
    assert.equal(agent.status, 200);
    assert.match(agent.headers.get('content-type'), /^application\/json/);
    const manifest = await agent.json();
    assert.equal(manifest.id, 'studio');
    assert.equal(manifest.home, 'https://openvibe.studio');
    assert.equal(manifest.llmsFull, 'https://openvibe.studio/llms-full.txt');
    assert.equal(manifest.openapi, 'https://openvibe.studio/openapi.json');
    assert.equal((await fetch(s.base + '/robots.txt')).status, 200);
    { const r = await fetch(s.base + '/release.json'); assert.equal(r.status, 200, 'the navbar release watch polls /release.json'); assert.equal((await r.json()).service, 'studio'); }
    // The release watch then listens on openvibe.events for new releases: the page's CSP must let it (11-09 sweep).
    assert.match((await fetch(s.base + '/')).headers.get('content-security-policy') || '', /connect-src[^;]*https:\/\/openvibe\.events/);
    assert.equal((await fetch(s.base + '/nope')).status, 404);
});
