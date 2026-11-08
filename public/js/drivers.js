'use strict';
/*
 * The browser side of the adapters: one driver per app, all with the same contract
 * (open(file), save(), run(command, params)). A driver only talks to the app inside the frame;
 * everything around it - the navbar, the sign-in, the OpenVibe files - is the same for every app,
 * so a base can be swapped without touching the page.
 */
(function (root, factory) {
    const drivers = factory();
    if (typeof module === 'object' && module.exports) module.exports = drivers;
    else root.StudioDrivers = drivers;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function photocraft() {
        return {
            id: 'photocraft',
            async open(ctx, file) {
                const win = ctx.window;
                if (!win || !win.document) {
                    return { ok: false, code: 'photo.frame.missing', detail: 'The PhotoCraft frame is not ready yet.' };
                }
                const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes || []);
                const transfer = new win.DataTransfer();
                transfer.items.add(new win.File([bytes], file.name || 'photo.jpg', { type: file.type || 'application/octet-stream' }));
                const fire = (type) => win.document.dispatchEvent(new win.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
                fire('dragenter');
                fire('dragover');
                fire('drop');
                return { ok: true, detail: 'Dropped ' + (file.name || 'the file') + ' into PhotoCraft.' };
            },
            async save() {
                return {
                    ok: false, code: 'photo.save.unsupported',
                    detail: "PhotoCraft's browser build has no scriptable export: export from the app and the file downloads to your browser.",
                };
            },
            async run() {
                return { ok: false, code: 'photo.commands.unsupported', detail: "PhotoCraft's browser build has no scriptable commands." };
            },
        };
    }

    function lightcraft() {
        return {
            id: 'lightcraft',
            async open(ctx, file) {
                const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes || []);
                ctx.window.postMessage({ type: 'lightcraft:open', name: file.name || 'photo.jpg', bytes: bytes }, ctx.origin);
                return { ok: true, detail: 'Sent ' + (file.name || 'the file') + ' to LightCraft.' };
            },
            async save(ctx) {
                ctx.window.postMessage({ type: 'lightcraft:cmd', id: 'app.export', params: '{}' }, ctx.origin);
                const handed = await ctx.nextSave(20000);
                if (!handed) {
                    return { ok: false, code: 'light.save.timeout', detail: 'LightCraft did not hand over a file within 20 seconds.' };
                }
                if (handed.ok === false) {
                    return { ok: false, code: 'light.export.failed', detail: String(handed.detail || 'LightCraft could not export that file.') };
                }
                return { ok: true, detail: 'LightCraft handed over ' + handed.file.name + '.', file: handed.file };
            },
            async run(ctx, commandId, params) {
                ctx.window.postMessage({ type: 'lightcraft:cmd', id: commandId, params: JSON.stringify(params || {}) }, ctx.origin);
                const value = await ctx.nextResponse(20000);
                if (!value) {
                    return { ok: false, code: 'light.command.timeout', detail: 'LightCraft did not answer ' + commandId + ' within 20 seconds.' };
                }
                if (value.ok === false) {
                    return { ok: false, code: 'light.command.failed', detail: String(value.value || 'the command failed') };
                }
                return { ok: true, detail: commandId + ' answered.', value: value.value };
            },
        };
    }

    return { photocraft: photocraft, lightcraft: lightcraft };
});
