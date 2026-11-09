'use strict';
const express = require('express');
const { StudioError } = require('./openvibe/media');
const OPERATIONS = ['upscale', 'remove-background', 'restyle'];
/** An explicitly configured image worker receives only the selected raster, never a person's token. */
function createImageTools({ config, sso, pics, fetchImpl = globalThis.fetch }) {
    const r = express.Router();
    r.get('/images/tools', (_req, res) => res.json({ operations: OPERATIONS, available: Boolean(config.imageWorkerUrl) }));
    r.post('/images/edit', express.json({ limit: '8kb' }), async (req, res, next) => {
        try {
            const token = sso.extractToken(req);
            if (!token) throw new StudioError(401, 'studio.auth.required', 'Sign in to edit a picture.');
            const bearer = /^Bearer /i.test(req.get('authorization') || '');
            if (!bearer && req.get('origin') !== config.baseUrl && req.get('sec-fetch-site') !== 'same-origin') throw new StudioError(403, 'request.cross_site', 'Submit edits from Studio.');
            const b = req.body || {};
            if (!OPERATIONS.includes(b.operation) || !/^[2-9a-km-zA-HJ-NP-Z]{8}$/.test(String(b.picture || '')) || typeof (b.prompt || '') !== 'string' || String(b.prompt || '').length > 1000) throw new StudioError(422, 'studio.image.invalid', 'Choose a picture and an image operation.');
            if (!config.imageWorkerUrl) throw new StudioError(503, 'studio.image.unavailable', 'Image tools are not configured on this Studio yet.');
            const source = await pics.bytes(b.picture, token);
            if (source.bytes.length > 20 * 1024 * 1024) throw new StudioError(413, 'studio.image.too_large', 'This picture is too large to edit.');
            const response = await fetchImpl(config.imageWorkerUrl + '/edit', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000), headers: { 'content-type':'application/json' }, body: JSON.stringify({ operation:b.operation, prompt:b.prompt || '', image: { mime_type:source.contentType, base64:source.bytes.toString('base64') } }) });
            if (!response.ok) throw new StudioError(502, 'studio.image.failed', 'The image worker could not make the edit.');
            const type = response.headers.get('content-type') || '';
            if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new StudioError(502, 'studio.image.invalid_output', 'The worker did not return a supported picture.');
            const chunks = []; let size = 0;
            for await (const chunk of response.body) { size += chunk.length; if (size > 20 * 1024 * 1024) throw new StudioError(502, 'studio.image.too_large', 'The edited picture is too large.'); chunks.push(chunk); }
            const saved = await pics.save(token, Buffer.concat(chunks), type, source.name + ' — ' + b.operation);
            res.set('Cache-Control','private, no-store').status(201).json(saved);
        } catch (error) { next(error); }
    });
    return r;
}
module.exports = { createImageTools, OPERATIONS };
