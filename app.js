/**
 * This is the lightweight app.js file that runs your new express-powered Ghiraldi app.
 * Run this to run your entire application.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. 
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * 
 * Copyright (C) 2012, John O'Connor
 **/
 
/**
 * Module dependencies.
 */
var express = require('express');

var app = express();
var simpleLogger = require('ghiraldi-simple-logger');

// Create a special framework-level log to show important messages from the framework.
simpleLogger.LOGLEVELS['Framework message'] = 101;

// Boot the MVC framework and start listening if the boot completes successfully.
var mvc = require('./mvc');

// An example of getting the bootEventListener - use this to access the events emitted during the boot process.
var bootEventListener = mvc.events();

app.on('boot', function(port) {
    app.listen(port);
    simpleLogger.log('Framework message', "App server listening on port " + port);
});

app.on('bootError', function(err) {
    simpleLogger.log('error', "Failed to boot: " + JSON.stringify(err.stack));
});

mvc.boot(app).then(function(statusObject) {
    simpleLogger.log('info', "port = " + statusObject.port);
    simpleLogger.log('Framework message', "App server listening on port " + statusObject.port);
    // console.log(statusObject.port);
    app.listen(statusObject.port);
}, function(err) {
    simpleLogger.log('error', "Failed to boot: " + JSON.stringify(err));
});