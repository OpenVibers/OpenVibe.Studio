'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMediaClient } = require('../server/openvibe/media');

function fakeFetch(routes) {
    const seen = [];
    const fetchImpl = async (url, options = {}) => {
        seen.push([url, options.method || 'GET', options.body ? Buffer.from(options.body).toString('utf8') : null]);
        const route = routes[url];
        if (!route) return { ok: false, status: 404, json: async () => ({ detail: 'no route' }) };
        return typeof route === 'function' ? route(options) : route;
    }
    return { fetchImpl, seen };
}

const ok = (body, status = 200) => ({ ok: true, status, json: async () => body });

test('the files of a person are listed with the bearer token', async () => {
    const { fetchImpl, seen } = fakeFetch({
        'https://openvibe.download/api/v1/files?limit=10': ok({ files: [{ id: 'f1', name: 'a.jpg' }], folders: [], usage: { bytes: 3 } }),
    });
    const media = createMediaClient({ baseUrl: 'https://openvibe.download', fetchImpl });
    const data = await media.listFiles('person-token', { limit: 10 });
    assert.equal(data.files[0].name, 'a.jpg');
    assert.equal(seen[0][1], 'GET');
});

test('a save is a start, the parts and a complete', async () => {
    const { fetchImpl, seen } = fakeFetch({
        'https://openvibe.download/api/v1/files': ok({ upload: { id: 'up1', part_size: 4, parts_expected: 2, missing: [1, 2] } }, 201),
        'https://openvibe.download/api/v1/uploads/up1/parts/1': ok({}),
        'https://openvibe.download/api/v1/uploads/up1/parts/2': ok({}),
        'https://openvibe.download/api/v1/uploads/up1/complete': ok({ file: { id: 'file_new', name: 'export.jpg' } }),
    });
    const media = createMediaClient({ baseUrl: 'https://openvibe.download', fetchImpl });
    const file = await media.uploadFile('person-token', { name: 'export.jpg', contentType: 'image/jpeg', bytes: Buffer.from('abcdefgh') });
    assert.equal(file.name, 'export.jpg');
    const paths = seen.map((entry) => entry[0] + ' ' + entry[1]);
    assert.deepEqual(paths, [
        'https://openvibe.download/api/v1/files POST',
        'https://openvibe.download/api/v1/uploads/up1/parts/1 PUT',
        'https://openvibe.download/api/v1/uploads/up1/parts/2 PUT',
        'https://openvibe.download/api/v1/uploads/up1/complete POST',
    ]);
    assert.equal(seen[1][2], 'abcd');
    assert.equal(seen[2][2], 'efgh');
});

test('the bytes of a file come through a public share, or the layer says so', async () => {
    const { fetchImpl } = fakeFetch({
        'https://openvibe.download/api/v1/files/f1': ok({ file: { id: 'f1', name: 'a.jpg', content_type: 'image/jpeg' }, shares: [] }),
    });
    const media = createMediaClient({ baseUrl: 'https://openvibe.download', fetchImpl });
    await assert.rejects(() => media.downloadBytes('person-token', 'f1'), (error) => {
        assert.equal(error.status, 501);
        assert.equal(error.code, 'media.bytes.unavailable');
        assert.match(error.detail, /[Ss]hare/);
        return true;
    });

    const shared = fakeFetch({
        'https://openvibe.download/api/v1/files/f1': ok({ file: { id: 'f1', name: 'a.jpg', content_type: 'image/jpeg' }, shares: [{ slug: 'abc', public: true }] }),
        'https://openvibe.download/s/abc/f/f1/download': { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
    });
    const client = createMediaClient({ baseUrl: 'https://openvibe.download', fetchImpl: shared.fetchImpl });
    const file = await client.downloadBytes('person-token', 'f1');
    assert.equal(file.name, 'a.jpg');
    assert.equal(file.bytes.length, 3);
});
