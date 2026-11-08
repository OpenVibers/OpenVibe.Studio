'use strict';
const { createApp } = require('./app');
const { app, config } = createApp();
app.listen(config.port, config.host, () => console.log(`[Studio] listening on ${config.host}:${config.port} (drill ${config.drillPort})`));
