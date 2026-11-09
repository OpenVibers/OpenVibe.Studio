'use strict';
// What openvibe.studio tells an agent about itself (SEO-2). Every field is something the site really serves; the
// OpenAPI document is the workshop API this site publishes.
module.exports = {
    network: 'OpenVibe',
    site: 'openvibe.studio',
    id: 'studio',
    name: 'OpenVibe.Studio',
    purpose: 'Photo and Light: two open-source creative apps (PhotoCraft, LightCraft) built from pinned release tags and served inside an OpenVibe account.',
    home: 'https://openvibe.studio',
    api: 'https://openvibe.studio/api/v1/studio',
    openapi: 'https://openvibe.studio/openapi.json',
    docs: 'https://openvibe.studio/llms-full.txt',
    llms: 'https://openvibe.studio/llms.txt',
    llmsFull: 'https://openvibe.studio/llms-full.txt',
    sitemap: 'https://openvibe.studio/sitemap.xml',
    policy: {
        robots: 'https://openvibe.network/bot.json',
        auth: ['none', 'Network OIDC'],
        rateLimit: 'The API is rate limited per address; the app bundle files are static and cached.',
    },
};
