'use strict';
const { assertAdapter } = require('./contract');

/**
 * LightCraft. The web build speaks the documented host bridge (lightcraft:open, lightcraft:cmd,
 * lightcraft:save) to a same-origin parent page, so files can be opened and exports can be handed
 * over to OpenVibe.
 */
const adapter = {
    id: 'light',
    title: 'LightCraft',
    base: {
        name: 'LightCraft',
        repository: 'https://github.com/storytold/lightcraft',
        tag: 'v0.19.0',
        licence: 'MIT OR Apache-2.0',
        licenceFiles: ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE', 'ATTRIBUTION.md'],
        upstream: 'https://github.com/storytold/lightcraft',
        builtBy: 'our CI (Rust stable, wasm32-unknown-unknown, cargo xtask web, wasm-bindgen 0.2.129)',
    },
    bundle: { path: 'light', entry: 'index.html', query: '?host=parent' },
    driver: 'lightcraft',
    capabilities: { open: true, save: true, commands: true },
    commands: [
        { id: 'library.info', title: 'Library info', description: 'What the app knows about your library: photo count, size and where it is kept.' },
        { id: 'library.state', title: 'Library state', description: 'The source, filter, sort and selection in the app right now.' },
        { id: 'photo.inspect', title: 'Active photo', description: 'What the app knows about the photo in view.' },
        { id: 'develop.get', title: 'Develop settings', description: 'The develop settings of the photo in view.' },
        { id: 'develop.controls', title: 'Develop controls', description: 'Every develop control with its current value.' },
    ],
};

module.exports = assertAdapter(adapter);
