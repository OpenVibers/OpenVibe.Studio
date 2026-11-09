'use strict';
const express = require('express');
const { ADAPTERS } = require('./adapters');

/** The Studio API: what the apps are, what a person owns, and the way in and out. */
function createApi({ sso, media, pics }) {
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
