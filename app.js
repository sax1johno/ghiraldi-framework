/**
 * This is the lightweight app.js file that runs your new express-powered Ghiraldi app.
 * Run this to run your entire application.
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