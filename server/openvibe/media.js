'use strict';

class StudioError extends Error {
    constructor(status, code, detail) {
        super(detail || code);
        this.status = status || 502;
        this.code = code || 'studio.upstream_error';
        this.detail = detail || '';
    }
}

/**
 * OpenVibe.Download (MediaHub): the files a person owns, and the upload that puts a file there.
 * The API accepts a person's Network token as a Bearer; the byte route for a file does not, so
 * bytes come through a public share link (see downloadBytes).
 */
function createMediaClient({ baseUrl, fetchImpl = globalThis.fetch }) {
    const root = String(baseUrl || '').replace(/\/+$/, '');

    async function request(token, path, options = {}) {
        const res = await fetchImpl(root + '/api/v1' + path, {
            method: options.method || 'GET',
            headers: Object.assign({ authorization: 'Bearer ' + token, accept: 'application/json' }, options.headers || {}),
            ...(options.body !== undefined ? { body: options.body } : {}),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new StudioError(res.status, data.code || 'media.upstream_error', data.detail || data.title || 'OpenVibe.Download returned ' + res.status);
        }
        return res.json().catch(() => ({}));
    }

    return {
        root,
        async listFiles(token, options = {}) {
            const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
            const data = await request(token, '/files?limit=' + encodeURIComponent(limit));
            return {
                files: Array.isArray(data.files) ? data.files : [],
                folders: Array.isArray(data.folders) ? data.folders : [],
                usage: data.usage || null,
            };
        },
        async getFile(token, id) {
            const data = await request(token, '/files/' + encodeURIComponent(id));
            return { file: data.file || null, shares: Array.isArray(data.shares) ? data.shares : [] };
        },
        async downloadBytes(token, id) {
            const info = await this.getFile(token, id);
            const file = info.file;
            if (!file) throw new StudioError(404, 'media.file_not_found', 'No such file in your OpenVibe.Download drive.');
            const share = info.shares.find((one) => one && (one.public === true || one.state === 'public'));
            if (!share) {
                throw new StudioError(501, 'media.bytes.unavailable',
                    'OpenVibe.Download has no route that hands a file\'s bytes to a person\'s token yet. Share the file publicly and it can be opened here.');
            }
            const res = await fetchImpl(root + '/s/' + encodeURIComponent(share.slug) + '/f/' + encodeURIComponent(file.id) + '/download', { headers: { accept: '*/*' } });
            if (!res.ok) throw new StudioError(res.status, 'media.bytes.unavailable', 'OpenVibe.Download returned ' + res.status + ' for the share link.');
            return { name: file.name, contentType: file.content_type || 'application/octet-stream', bytes: Buffer.from(await res.arrayBuffer()) };
        },
        async uploadFile(token, file) {
            const bytes = Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes || []);
            const name = String(file.name || 'export');
            const contentType = file.contentType || 'application/octet-stream';
            const start = await request(token, '/files', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: name, size: bytes.length, content_type: contentType }),
            });
            const upload = start.upload || {};
            if (!upload.id) throw new StudioError(502, 'media.upload.unavailable', 'OpenVibe.Download did not start an upload.');
            const partSize = Number(upload.part_size) || bytes.length || 1;
            const expected = Number(upload.parts_expected) || 1;
            const missing = Array.isArray(upload.missing) && upload.missing.length ? upload.missing : Array.from({ length: expected }, (_, index) => index + 1);
            for (const part of missing) {
                const from = (part - 1) * partSize;
                const to = Math.min(bytes.length, from + partSize);
                await request(token, '/uploads/' + encodeURIComponent(upload.id) + '/parts/' + part, {
                    method: 'PUT',
                    headers: { 'content-type': 'application/octet-stream' },
                    body: bytes.subarray(from, to),
                });
            }
            const done = await request(token, '/uploads/' + encodeURIComponent(upload.id) + '/complete', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{}',
            });
            return done.file || { name: name, size: bytes.length };
        },
    };
}

module.exports = { createMediaClient, StudioError };
