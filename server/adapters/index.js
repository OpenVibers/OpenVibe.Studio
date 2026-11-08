'use strict';
const { assertAdapter, assertDriver } = require('./contract');
const photo = require('./photo');
const light = require('./light');

const ADAPTERS = [photo, light];

function byId(id) {
    return ADAPTERS.find((adapter) => adapter.id === id) || null;
}

module.exports = { ADAPTERS, byId, assertAdapter, assertDriver };
