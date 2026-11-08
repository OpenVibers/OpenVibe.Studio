'use strict';
const { assertAdapter } = require('./contract');

/**
 * PhotoCraft. The web build has no scriptable API of its own: files are opened by dropping them
 * on the app, and there is no export the page can ask for. Both limits are shown in the app, not
 * hidden.
 */
const adapter = {
    id: 'photo',
    title: 'PhotoCraft',
    base: {
        name: 'PhotoCraft',
        repository: 'https://github.com/storytold/photocraft',
        tag: 'v0.21.0',
        licence: 'MIT OR Apache-2.0',
        licenceFiles: ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE', 'ATTRIBUTION.md'],
        upstream: 'https://github.com/storytold/photocraft',
        builtBy: 'our CI (Rust stable, wasm32-unknown-unknown, Trunk 0.21.14)',
    },
    bundle: { path: 'photo', entry: 'index.html', query: '' },
    driver: 'photocraft',
    capabilities: { open: true, save: false, commands: false },
    commands: [],
};

module.exports = assertAdapter(adapter);
