'use strict';
/*
 * The layer around an app: the OpenVibe files a person owns, the way into the app, the way back
 * out, and the app's own commands. It talks to the app only through the driver, so the app can
 * be swapped without changing this file.
 */
(function () {
    const root = document.querySelector('[data-studio-app]');
    if (!root) return;
    const appId = root.getAttribute('data-studio-app');
    const driverName = root.getAttribute('data-studio-driver');
    const signedIn = root.getAttribute('data-studio-signed-in') === 'true';
    const drivers = window.StudioDrivers || {};
    const factory = drivers[driverName];
    if (!factory) return;
    const driver = factory();
    const statusEl = root.querySelector('[data-role="status"]');
    const outputEl = root.querySelector('[data-role="output"]');
    const filesEl = root.querySelector('[data-role="files"]');
    const fileListEl = root.querySelector('[data-role="file-list"]');
    const filesNoteEl = root.querySelector('[data-role="files-note"]');
    const iframe = root.querySelector('iframe');

    let pendingSave = null;
    let pendingResponse = null;

    function say(text) {
        if (statusEl) statusEl.textContent = text || '';
    }

    function show(value) {
        if (!outputEl) return;
        if (!value) {
            outputEl.hidden = true;
            outputEl.textContent = '';
            return;
        }
        outputEl.hidden = false;
        outputEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    function nextSave(timeout) {
        return new Promise((resolve) => {
            pendingSave = resolve;
            window.setTimeout(() => {
                if (pendingSave === resolve) {
                    pendingSave = null;
                    resolve(null);
                }
            }, timeout || 20000);
        });
    }

    function nextResponse(timeout) {
        return new Promise((resolve) => {
            pendingResponse = resolve;
            window.setTimeout(() => {
                if (pendingResponse === resolve) {
                    pendingResponse = null;
                    resolve(null);
                }
            }, timeout || 20000);
        });
    }

    const ctx = {
        origin: window.location.origin,
        iframe: iframe,
        window: iframe ? iframe.contentWindow : null,
        nextSave: nextSave,
        nextResponse: nextResponse,
    };

    window.addEventListener('message', (event) => {
        if (!iframe || event.source !== iframe.contentWindow) return;
        const data = event.data || {};
        if (data.type === 'lightcraft:save') {
            const file = { name: data.name || 'export', bytes: data.bytes instanceof ArrayBuffer ? new Uint8Array(data.bytes) : new Uint8Array(data.bytes || []) };
            if (pendingSave) {
                const resolve = pendingSave;
                pendingSave = null;
                resolve({ ok: true, file: file });
            }
            return;
        }
        if (data.type === 'lightcraft:response') {
            const answer = { ok: data.ok !== false, value: data.value };
            if (pendingSave) {
                const resolve = pendingSave;
                pendingSave = null;
                resolve({ ok: answer.ok, detail: answer.value });
                return;
            }
            if (pendingResponse) {
                const resolve = pendingResponse;
                pendingResponse = null;
                resolve(answer);
            }
            return;
        }
        if (data.type === 'lightcraft:failed') {
            say('The app could not start: ' + (data.error || 'no reason given'));
        }
    });

    function addFileItem(list, label, note, onOpen) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button-quiet';
        button.textContent = 'Open';
        button.addEventListener('click', onOpen);
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = label;
        item.appendChild(name);
        if (note) {
            const meta = document.createElement('small');
            meta.textContent = note;
            item.appendChild(meta);
        }
        item.appendChild(button);
        list.appendChild(item);
    }

    async function openBytes(source, id, name) {
        say('Opening ' + name + '…');
        const res = await fetch('/api/v1/studio/files/' + encodeURIComponent(source) + '/' + encodeURIComponent(id) + '/bytes', { credentials: 'same-origin' });
        if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            say(problem.detail || problem.title || 'That file could not be opened.');
            return;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const result = await driver.open(ctx, { name: name, type: res.headers.get('content-type') || 'application/octet-stream', bytes: bytes });
        say(result.detail || (result.ok ? 'Opened.' : 'The app did not take the file.'));
    }

    async function loadFiles() {
        if (filesEl) filesEl.hidden = false;
        if (fileListEl) fileListEl.textContent = '';
        say('Looking up your OpenVibe files…');
        const res = await fetch('/api/v1/studio/files', { credentials: 'same-origin' });
        if (res.status === 401) {
            say('Sign in to open files from OpenVibe.');
            if (filesNoteEl) {
                filesNoteEl.textContent = '';
                const link = document.createElement('a');
                link.href = '/auth/login?next=' + encodeURIComponent(window.location.pathname);
                link.textContent = 'Sign in with OpenVibe';
                filesNoteEl.appendChild(link);
            }
            return;
        }
        if (!res.ok) {
            say('Your OpenVibe files could not be read just now.');
            return;
        }
        const data = await res.json();
        const problems = Array.isArray(data.problems) ? data.problems : [];
        if (fileListEl) {
            for (const file of (data.download && data.download.files) || []) {
                addFileItem(fileListEl, file.name || file.id, file.content_type || '', () => openBytes('download', file.id, file.name || file.id));
            }
            for (const image of (data.pics && data.pics.images) || []) {
                addFileItem(fileListEl, image.name || image.slug || image.id, 'OpenVibe.Pics', () => openBytes('pics', image.slug || image.id, image.name || image.slug || image.id));
            }
            if (!fileListEl.childNodes.length) {
                const empty = document.createElement('li');
                empty.textContent = 'No files found in your OpenVibe drive.';
                fileListEl.appendChild(empty);
            }
        }
        if (filesNoteEl) {
            filesNoteEl.textContent = problems.length
                ? problems.map((one) => one.source + ': ' + (one.detail || one.code)).join(' · ')
                : 'Files come from OpenVibe.Download and OpenVibe.Pics.';
        }
        say('Your OpenVibe files are listed below.');
    }

    async function saveToOpenVibe() {
        if (!signedIn) {
            say('Sign in to save to OpenVibe.');
            return;
        }
        say('Asking the app for the file…');
        const result = await driver.save(ctx);
        if (!result.ok || !result.file) {
            say(result.detail || 'There was nothing to save.');
            return;
        }
        const res = await fetch('/api/v1/studio/save', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': result.file.contentType || 'application/octet-stream', 'x-file-name': result.file.name || 'export' },
            body: result.file.bytes,
        });
        if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            say(problem.detail || problem.title || 'The file could not be saved to OpenVibe.');
            return;
        }
        say('Saved ' + (result.file.name || 'the file') + ' to your OpenVibe drive.');
    }

    root.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const action = button.getAttribute('data-action');
        if (action === 'open') {
            event.preventDefault();
            await loadFiles();
            return;
        }
        if (action === 'save') {
            event.preventDefault();
            await saveToOpenVibe();
            return;
        }
        const command = button.getAttribute('data-command');
        if (command) {
            event.preventDefault();
            say('Running ' + command + '…');
            const result = await driver.run(ctx, command, {});
            say(result.detail || 'Done.');
            show(result.ok ? result.value : null);
        }
    });

    say(appId + ' is ready.');
})();
