'use strict';
/*
 * The build smoke test: the bundle must reach its first frame in a real browser, or the build
 * fails. A bundle that loads but never starts is worse than no bundle at all, so the check waits
 * for the app's own "it is running" signal and fails the build when it never comes.
 *
 * The bundle is served by the service itself, so the check runs against the headers a person
 * really gets: the WebAssembly type, the cache rules and the content security policy.
 *
 * Usage: node scripts/smoke.js --app photo --dir artifacts/photo [--timeout 300]
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');
const { load: loadConfig } = require('../server/config');

const args = process.argv.slice(2);
function argOf(name, fallback) {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const app = argOf('--app', 'photo');
const dir = path.resolve(argOf('--dir', path.join('artifacts', app)));
const timeout = Number(argOf('--timeout', '300')) * 1000;

const SIGNALS = {
    photo: { loading: '#photocraft_loading', canvas: '#photocraft_canvas', failure: /PhotoCraft failed to start|PhotoCraft stopped/i },
    light: { loading: '#lightcraft_loading', canvas: '#lightcraft_canvas', failure: /LightCraft failed to load/i },
};

async function main() {
    const signal = SIGNALS[app];
    if (!signal) {
        console.error('smoke: unknown app ' + app);
        process.exit(2);
    }
    if (!fs.existsSync(path.join(dir, 'index.html'))) {
        console.error('smoke: no index.html in ' + dir);
        process.exit(2);
    }
    let chromium;
    try {
        ({ chromium } = require('playwright-core'));
    } catch {
        console.error('smoke: playwright-core is not installed');
        process.exit(2);
    }
    const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'studio-smoke-'));
    fs.symlinkSync(dir, path.join(root, app), 'dir');
    const config = Object.assign(loadConfig({}), { bundleRoot: root });
    const { app: service } = createApp({ config });
    const server = http.createServer(service);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const url = 'http://127.0.0.1:' + port + '/apps/' + app + '/index.html';
    const launchArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
    const candidates = [process.env.CHROME_PATH, '/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
    let browser;
    const errors = [];
    try {
        let lastError = null;
        for (const executablePath of candidates) {
            if (!fs.existsSync(executablePath)) continue;
            try {
                browser = await chromium.launch({ executablePath: executablePath, args: launchArgs });
                break;
            } catch (error) {
                lastError = error;
            }
        }
        if (!browser) {
            try {
                browser = await chromium.launch({ channel: 'chrome', args: launchArgs });
            } catch (error) {
                lastError = error;
            }
        }
        if (!browser) throw lastError || new Error('no Chrome to drive');
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeout });
        const started = await page.waitForFunction(
            (args) => {
                const loading = document.querySelector(args.loading);
                const text = document.body ? document.body.innerText : '';
                if (new RegExp(args.failure).test(text)) return true;
                return !loading;
            },
            { loading: signal.loading, failure: signal.failure.source },
            { timeout: timeout },
        ).then(() => true).catch(() => false);
        const body = await page.evaluate(() => (document.body ? document.body.innerText : ''));
        const canvas = await page.evaluate((selector) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const box = node.getBoundingClientRect();
            return { width: Math.round(box.width), height: Math.round(box.height) };
        }, signal.canvas);
        if (!started) {
            console.error('smoke: ' + app + ' did not reach its first frame within ' + (timeout / 1000) + ' s');
            console.error('smoke: page text: ' + body.replace(/\s+/g, ' ').slice(0, 400));
            for (const error of errors.slice(0, 10)) console.error('smoke: console: ' + error);
            process.exitCode = 1;
            return;
        }
        if (signal.failure.test(body)) {
            console.error('smoke: ' + app + ' reported a failure: ' + body.replace(/\s+/g, ' ').slice(0, 400));
            process.exitCode = 1;
            return;
        }
        if (!canvas || !canvas.width || !canvas.height) {
            console.error('smoke: ' + app + ' has no canvas of a real size: ' + JSON.stringify(canvas));
            process.exitCode = 1;
            return;
        }
        console.log('smoke: ' + app + ' reached its first frame (canvas ' + canvas.width + 'x' + canvas.height + ')');
        if (errors.length) {
            console.log('smoke: console errors (not fatal):');
            for (const error of errors.slice(0, 10)) console.log('smoke:   ' + error);
        }
    } finally {
        if (browser) await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => {
    console.error('smoke: ' + (error && error.message ? error.message : String(error)));
    process.exit(1);
});
