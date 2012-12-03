/**
 * This is the lightweight app.js file that runs your new express-powered Ghiraldi app.
 * Run this to run your entire application.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. 
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * 
 **/
 
/**
 * Module dependencies.
 */
var express = require('express');

var app = express();

// Boot the MVC framework and start listening if the boot completes successfully.
require('./mvc').boot(app, function(bootParams) {
        // var port = 8888;
    if (bootParams.status === true) {
        app.listen(bootParams.port);
        console.log('ghiraldi app started on port ' + bootParams.port);
    } else{
        console.log("ghiraldi app failed to start: " + bootParams.errors);
    }
});