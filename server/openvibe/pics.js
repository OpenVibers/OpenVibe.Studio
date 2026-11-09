'use strict';
const { StudioError } = require('./media');

/**
 * OpenVibe.Pics: the pictures a person owns. The image bytes are public (the site serves them
 * under /i/<slug>), so a picture can be fetched without the owner's session.
 */
function createPicsClient({ baseUrl, fetchImpl = globalThis.fetch }) {
    const root = String(baseUrl || '').replace(/\/+$/, '');

    async function request(path, token) {
        const res = await fetchImpl(root + '/api/v1' + path, {
            headers: Object.assign({ accept: 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new StudioError(res.status, data.code || 'pics.upstream_error', data.detail || data.title || 'OpenVibe.Pics returned ' + res.status);
        }
        return res.json().catch(() => ({}));
    }

    const wire = (image) => ({
        id: image.slug || image.id || null,
        slug: image.slug || null,
        name: image.name || image.title || image.slug || 'image',
        contentType: image.mime_type || image.content_type || 'image/jpeg',
        direct: (image.links && image.links.direct) || null,
        page: (image.links && image.links.page) || null,
        thumb: (image.links && image.links.thumb) || null,
    });

    return {
        root,
        async listImages(token) {
            const data = await request('/me/images', token);
            const images = Array.isArray(data.images) ? data.images : (Array.isArray(data) ? data : []);
            return images.map(wire);
        },
        async bytes(slug, token) {
            const data = await request('/images/' + encodeURIComponent(slug), token);
            const image = wire(data.image || data);
            const res = await fetchImpl(root + '/api/v1/images/' + encodeURIComponent(slug) + '/bytes', { redirect: 'error', headers: { authorization: 'Bearer ' + token } });
            if (!res.ok) throw new StudioError(res.status, 'pics.bytes.unavailable', 'This picture is unavailable.');
            return { name: image.name, contentType: image.contentType, bytes: Buffer.from(await res.arrayBuffer()) };
        },
        async save(token, bytes, contentType, title) {
            const res = await fetchImpl(root + '/api/v1/images', { method: 'POST', redirect: 'error', headers: { authorization: 'Bearer ' + token, 'content-type': contentType, 'x-title': encodeURIComponent(title) }, body: bytes });
            if (!res.ok) throw new StudioError(res.status, 'pics.save.failed', 'The edited picture could not be saved.');
            return res.json();
        },
    };
}

module.exports = { createPicsClient };
