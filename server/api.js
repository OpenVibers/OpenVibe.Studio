'use strict';
const express = require('express');
const { Readable } = require('node:stream');
const { ADAPTERS } = require('./adapters');

/** The Studio API: what the apps are, what a person owns, and the way in and out. */
function createApi({ config, sso, media, pics, video }) {
    const r = express.Router();

    const token = (req, res) => {
        const value = sso.extractToken(req);
        if (!value) {
            res.status(401).type('application/problem+json').json({
                type: 'about:blank', title: 'Sign in required', status: 401, code: 'studio.auth.required',
                detail: 'Sign in with OpenVibe to open and save files.',
            });
            return null;
        }
        return value;
    };

    const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch((e) => {
        if (res.headersSent) return next(e);
        const status = Number(e.status) || 502;
        res.status(status).type('application/problem+json').json({
            type: 'about:blank', title: e.message || 'OpenVibe request failed', status,
            code: e.code || 'studio.upstream_error', detail: e.detail || '',
        });
    });

    r.get('/apps', (_req, res) => res.json({
        apps: ADAPTERS.map((adapter) => ({
            id: adapter.id, title: adapter.title, capabilities: adapter.capabilities,
            commands: adapter.commands, base: adapter.base,
        })),
    }));

    r.get('/files', wrap(async (req, res) => {
        const value = token(req, res);
        if (!value) return;
        const out = { download: { files: [], folders: [], usage: null }, pics: { images: [] }, problems: [] };
        try {
            const data = await media.listFiles(value, { limit: req.query.limit });
            out.download = data;
        } catch (e) {
            out.problems.push({ source: 'download', code: e.code || 'media.upstream_error', detail: e.detail || e.message });
        }
        try {
            out.pics.images = await pics.listImages(value);
        } catch (e) {
            out.problems.push({ source: 'pics', code: e.code || 'pics.upstream_error', detail: e.detail || e.message });
        }
        res.json(out);
    }));

    r.get('/files/:source/:id/bytes', wrap(async (req, res) => {
        const value = token(req, res);
        if (!value) return;
        const source = req.params.source;
        const id = req.params.id;
        const file = source === 'pics' ? await pics.bytes(id, value) : await media.downloadBytes(value, id);
        const name = String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_');
        res.set('Content-Type', file.contentType || 'application/octet-stream');
        res.set('Content-Disposition', 'attachment; filename="' + name + '"');
        res.set('Cache-Control', 'private, no-store');
        res.send(file.bytes);
    }));

    /** The video bytes a Studio editor previews: the person's token goes to Video, which decides access. */
    r.get('/media/:id/bytes', wrap(async (req, res) => {
        const value = token(req, res);
        if (!value) return;
        const out = await video.bytes(value, String(req.params.id || ''), req.get('range'));
        res.status(out.status);
        res.set('Cache-Control', 'private, no-store');
        for (const name of ['content-type', 'content-range', 'content-length', 'accept-ranges']) {
            const v = out.headers.get(name);
            if (v) res.set(name, v);
        }
        Readable.fromWeb(out.body).pipe(res);
    }));

    /** The reverse link: publish an edit back on OpenVibe.Video (Video makes the copy). */
    r.post('/publish', express.json({ limit: '16kb' }), wrap(async (req, res) => {
        const value = token(req, res);
        if (!value) return;
        const bearer = /^Bearer /i.test(req.get('authorization') || '');
        if (!bearer && req.get('origin') !== config.baseUrl && req.get('sec-fetch-site') !== 'same-origin') {
            throw new StudioError(403, 'request.cross_site', 'Publish from Studio itself.');
        }
        const b = req.body || {};
        if (typeof b.media !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(b.media)) {
            throw new StudioError(422, 'studio.publish.invalid', 'Open a video with /edit?media=<id> first.');
        }
        if (b.title !== undefined && typeof b.title !== 'string') throw new StudioError(422, 'studio.publish.invalid', 'The title must be text.');
        if (b.visibility !== undefined && !['private', 'unlisted', 'public'].includes(b.visibility)) throw new StudioError(422, 'studio.publish.invalid', 'Choose private, unlisted or public.');
        const out = await video.publish(value, { media: b.media, title: b.title, visibility: b.visibility });
        res.status(202).json(out);
    }));

    r.post('/save', express.raw({ type: '*/*', limit: '256mb' }), wrap(async (req, res) => {
        const value = token(req, res);
        if (!value) return;
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!body.length) {
            res.status(422).type('application/problem+json').json({
                type: 'about:blank', title: 'Nothing to save', status: 422, code: 'studio.save.empty',
            });
            return;
        }
        const name = String(req.get('x-file-name') || 'export');
        const contentType = req.get('content-type') || 'application/octet-stream';
        const file = await media.uploadFile(value, { name: name, contentType: contentType, bytes: body });
        res.status(201).json({ file });
    }));

    return r;
}

module.exports = { createApi };
