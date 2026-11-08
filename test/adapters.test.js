'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ADAPTERS, byId, assertAdapter, assertDriver } = require('../server/adapters');
const drivers = require('../public/js/drivers.js');

test('every adapter keeps the same contract, so a base can be swapped', () => {
    assert.equal(ADAPTERS.length, 2);
    for (const adapter of ADAPTERS) {
        assert.doesNotThrow(() => assertAdapter(adapter));
        assert.ok(adapter.base.repository.startsWith('https://github.com/'));
        assert.match(adapter.base.tag, /^v\d+\.\d+\.\d+$/);
        assert.ok(adapter.base.licenceFiles.length > 0);
        assert.ok(adapter.base.builtBy.length > 0);
        assert.equal(typeof adapter.bundle.path, 'string');
        assert.equal(typeof adapter.bundle.entry, 'string');
    }
    assert.equal(byId('light').title, 'LightCraft');
    assert.equal(byId('nope'), null);
});

test('an adapter that is missing a part of the contract is refused', () => {
    const broken = Object.assign({}, byId('light'));
    delete broken.base;
    assert.throws(() => assertAdapter(broken), /base/);
    const noCommands = Object.assign({}, byId('light'), { commands: [{ id: 'x' }] });
    assert.throws(() => assertAdapter(noCommands), /command/);
});

function fakeAppWindow() {
    const events = [];
    const dropped = [];
    class FakeFile {
        constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = (options || {}).type; }
    }
    class FakeDataTransfer {
        constructor() { this.items = { add: (file) => dropped.push(file) }; }
    }
    class FakeDragEvent {
        constructor(type, init) { this.type = type; this.dataTransfer = (init || {}).dataTransfer; }
    }
    return {
        events, dropped,
        DataTransfer: FakeDataTransfer,
        File: FakeFile,
        DragEvent: FakeDragEvent,
        document: { dispatchEvent: (event) => { events.push(event); return true; } },
    };
}

function fakeCtx(overrides = {}) {
    const sent = [];
    const win = fakeAppWindow();
    const ctx = {
        origin: 'https://studio.test',
        window: { postMessage: (message) => sent.push(message) },
        iframe: { contentWindow: null },
        nextSave: async () => ({ ok: true, file: { name: 'export.jpg', bytes: new Uint8Array([1, 2, 3]) } }),
        nextResponse: async () => ({ ok: true, value: '{"photos":3}' }),
    };
    return Object.assign(ctx, overrides, { sent, win });
}

test('every driver keeps the same contract', () => {
    for (const [name, make] of Object.entries(drivers)) {
        const driver = make();
        assert.doesNotThrow(() => assertDriver(driver));
        assert.equal(driver.id, name);
    }
});

test('the light driver opens a file through the documented bridge', async () => {
    const ctx = fakeCtx();
    const result = await drivers.lightcraft().open(ctx, { name: 'sunset.jpg', bytes: new Uint8Array([1, 2, 3]) });
    assert.equal(result.ok, true);
    assert.equal(ctx.sent.length, 1);
    assert.equal(ctx.sent[0].type, 'lightcraft:open');
    assert.equal(ctx.sent[0].name, 'sunset.jpg');
    assert.ok(ctx.sent[0].bytes instanceof Uint8Array);
});

test('the light driver asks the app to export and waits for the file the app hands over', async () => {
    const ctx = fakeCtx();
    const result = await drivers.lightcraft().save(ctx);
    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'export.jpg');
    assert.equal(ctx.sent[0].type, 'lightcraft:cmd');
    assert.equal(ctx.sent[0].id, 'app.export');
});

test('the light driver reports a command that failed, with the app\'s own words', async () => {
    const ctx = fakeCtx({ nextResponse: async () => ({ ok: false, value: 'unknown command' }) });
    const result = await drivers.lightcraft().run(ctx, 'library.info', {});
    assert.equal(result.ok, false);
    assert.match(result.detail, /unknown command/);
    assert.equal(ctx.sent[0].id, 'library.info');
    assert.equal(ctx.sent[0].params, '{}');
});

test('the photo driver drops the file on the app and says it cannot save', async () => {
    const ctx = fakeCtx();
    const win = fakeAppWindow();
    ctx.window = win;
    const result = await drivers.photocraft().open(ctx, { name: 'sunset.jpg', bytes: new Uint8Array([1, 2, 3]) });
    assert.equal(result.ok, true);
    assert.deepEqual(win.events.map((event) => event.type), ['dragenter', 'dragover', 'drop']);
    assert.equal(win.dropped.length, 1);
    assert.equal(win.dropped[0].name, 'sunset.jpg');
    const save = await drivers.photocraft().save(ctx);
    assert.equal(save.ok, false);
    assert.equal(save.code, 'photo.save.unsupported');
    const run = await drivers.photocraft().run(ctx, 'library.info', {});
    assert.equal(run.ok, false);
});

test('a fake app is enough to drive every driver, and each one answers', async () => {
    for (const [name, make] of Object.entries(drivers)) {
        const ctx = fakeCtx();
        ctx.window = Object.assign(fakeAppWindow(), { postMessage: (message) => ctx.sent.push(message) });
        const driver = make();
        const opened = await driver.open(ctx, { name: 'a.jpg', bytes: new Uint8Array([9]) });
        assert.equal(typeof opened.ok, 'boolean', name + ' open');
        const saved = await driver.save(ctx);
        assert.equal(typeof saved.ok, 'boolean', name + ' save');
        const ran = await driver.run(ctx, 'library.info', {});
        assert.equal(typeof ran.ok, 'boolean', name + ' run');
    }
});
