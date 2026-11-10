'use strict';
const { StudioError } = require('./media');

/**
 * OpenVibe.Video: the other end of "Edit in Studio" (server/openvibe/video.js).
 *
 * A recording on openvibe.video is a Media VOD in Video's tenant, not an OpenVibe.Download
 * drive file. Studio opens it by the id Video shows for it (the vup_… upload id, /watch?v=
 * id or Media's VOD id) through Video's Studio hand-off API, with the signed-in person's
 * own Network token as a Bearer. Video decides whether that person may read it (a private
 * video of someone else answers 404, like a missing id) and returns the metadata, the bytes
 * and whether the person may publish a copy back there.
 *
 *   GET  /api/v1/video/studio/media/:id         { media, source }
 *   GET  /api/v1/video/studio/media/:id/bytes   the bytes (Range reads for the preview)
 *   POST /api/v1/video/studio/publish           { media, title, visibility } → { video }
 */
function createVideoClient({ baseUrl, fetchImpl = globalThis.fetch }) {
    const root = String(baseUrl || '').replace(/\/+$/, '');
    const headers = (token, extra = {}) => Object.assign({ authorization: 'Bearer ' + token, accept: 'application/json' }, extra);

    async function request(token, path, options = {}) {
        const res = await fetchImpl(root + '/api/v1/video' + path, {
            method: options.method || 'GET',
            headers: headers(token, options.headers || {}),
            ...(options.body !== undefined ? { body: options.body } : {}),
            signal: AbortSignal.timeout(Number(options.timeoutMs) || 60_000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new StudioError(res.status, data.code || 'video.upstream_error', data.detail || data.title || 'OpenVibe.Video returned ' + res.status);
        }
        return data;
    }

    return {
        root,
        async getMedia(token, id) {
            return await request(token, '/studio/media/' + encodeURIComponent(id));
        },
        async bytes(token, id, range) {
            const res = await fetchImpl(root + '/api/v1/video/studio/media/' + encodeURIComponent(id) + '/bytes', {
                headers: headers(token, range ? { range: String(range) } : {}),
                redirect: 'error',
                signal: AbortSignal.timeout(2 * 3600_000),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new StudioError(res.status, data.code || 'video.bytes.unavailable', data.detail || data.title || 'That video is unavailable.');
            }
            return { status: res.status, headers: res.headers, body: res.body };
        },
        async publish(token, input) {
            const data = await request(token, '/studio/publish', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(input || {}),
                timeoutMs: 6 * 3600_000,
            });
            return data;
        },
    };
}

module.exports = { createVideoClient };
