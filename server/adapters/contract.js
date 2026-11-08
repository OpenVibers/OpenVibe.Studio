'use strict';

const ADAPTER_FIELDS = ['id', 'title', 'base', 'bundle', 'driver', 'capabilities', 'commands'];

/**
 * Every adapter (one per app) must have the same shape, so a base can be swapped for another
 * without touching the layer around it.
 */
function assertAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') throw new Error('an adapter must be an object');
    for (const field of ADAPTER_FIELDS) {
        if (!(field in adapter)) throw new Error(`adapter ${adapter.id || '?'} is missing ${field}`);
    }
    if (typeof adapter.id !== 'string' || !adapter.id) throw new Error('an adapter needs a string id');
    if (typeof adapter.title !== 'string' || !adapter.title) throw new Error(`adapter ${adapter.id} needs a title`);
    const base = adapter.base;
    if (!base || typeof base.repository !== 'string' || typeof base.tag !== 'string' || typeof base.licence !== 'string') {
        throw new Error(`adapter ${adapter.id} needs base.repository, base.tag and base.licence`);
    }
    if (!Array.isArray(base.licenceFiles) || !base.licenceFiles.length) throw new Error(`adapter ${adapter.id} needs base.licenceFiles`);
    if (!adapter.bundle || typeof adapter.bundle.path !== 'string' || typeof adapter.bundle.entry !== 'string') {
        throw new Error(`adapter ${adapter.id} needs bundle.path and bundle.entry`);
    }
    if (typeof adapter.driver !== 'string' || !adapter.driver) throw new Error(`adapter ${adapter.id} needs a driver name`);
    for (const key of ['open', 'save', 'commands']) {
        if (typeof (adapter.capabilities || {})[key] !== 'boolean') throw new Error(`adapter ${adapter.id} needs capability ${key}`);
    }
    if (!Array.isArray(adapter.commands)) throw new Error(`adapter ${adapter.id} needs a commands array`);
    for (const command of adapter.commands) {
        if (!command || typeof command.id !== 'string' || !command.id || typeof command.title !== 'string' || !command.title) {
            throw new Error(`adapter ${adapter.id} has a command without an id and a title`);
        }
    }
    return adapter;
}

/** The shape the browser side of an adapter (the driver) must have. */
function assertDriver(driver) {
    if (!driver || typeof driver !== 'object') throw new Error('a driver must be an object');
    for (const method of ['open', 'save', 'run']) {
        if (typeof driver[method] !== 'function') throw new Error(`driver ${driver.id || '?'} is missing ${method}()`);
    }
    return driver;
}

module.exports = { assertAdapter, assertDriver, ADAPTER_FIELDS };
