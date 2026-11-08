'use strict';

/** What the home page says about each app. The limits are measured, not guessed. */
const APPS = [
    {
        id: 'photo',
        title: 'PhotoCraft',
        tagline: 'A layered photo editor, in the browser.',
        what: 'PhotoCraft is an open-source photo editor with layers, masks, curves and RAW development. Studio serves a build of it inside an OpenVibe page: sign in, drop in a file from your OpenVibe library, and work.',
        limits: [
            'Heavy first load. The app ships its module as gzip parts, so the first frame takes seconds on a slow line.',
            'Memory. A 4 GB Photoshop file passed the app\'s 4 GB cap but used 2.7-3.0 GB of memory; a phone with 4 GB can run out of memory on big files.',
            'No scriptable export in the browser build. Save to OpenVibe is not offered for Photo: export from the app and the file downloads to your browser.',
        ],
        upstream: 'https://github.com/storytold/photocraft',
        licence: 'MIT OR Apache-2.0',
        licenceNote: 'The upstream repository ships LICENSE-MIT and LICENSE-APACHE (your choice), plus NOTICE and ATTRIBUTION.md. Our build keeps those files.',
    },
    {
        id: 'light',
        title: 'LightCraft',
        tagline: 'A photo library and RAW developer, in the browser.',
        what: 'LightCraft is an open-source photo library and RAW developer: a catalogue, develop controls and exports, with the library kept in your own browser storage. Studio serves a build of it inside an OpenVibe page, so a photo can come from your OpenVibe library and an export can go back to it.',
        limits: [
            'Heavy first load. The module is about 13.5 MB before compression (about 3.1 MB over Brotli) and is compiled before the first frame.',
            'Our build leaves out the optional 16 MB Chinese font, so Chinese and Japanese text has no glyphs. Everything else works.',
            'The library lives in your browser\'s storage for this site. Clearing site data empties it; keep your originals elsewhere.',
            'Online only. Neither app caches for offline use, and neither works from a file:// page.',
        ],
        upstream: 'https://github.com/storytold/lightcraft',
        licence: 'MIT OR Apache-2.0',
        licenceNote: 'The upstream repository ships LICENSE-MIT and LICENSE-APACHE (your choice), plus NOTICE and ATTRIBUTION.md. Our build keeps those files.',
    },
];

/** The limits both apps share, measured on the reference machine in the Studio due diligence. */
const LIMITS = [
    'Heavy first load: both apps are native editors compiled to WebAssembly. Measured time to first frame was about 2.5 s at 1280 px and 0.6 s at 390 px for LightCraft, and about 1.3 s for PhotoCraft once the loader path is fixed.',
    'Phones with 4 GB of RAM can run out of memory on big files. Both apps run on a phone; neither is light.',
    'Works online only. Neither app ships a service worker, so nothing loads without a connection.',
    'Cut (FilmCraft) is not part of Studio v0. It stays a desktop and agent tool.',
    'No fake pictures: this page shows a capture of an app only when it comes from a running build.',
];

function appById(id) {
    return APPS.find((app) => app.id === id) || null;
}

module.exports = { APPS, LIMITS, appById };
