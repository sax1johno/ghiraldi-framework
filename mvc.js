/**
 * mvc.js
 * @author John O'Connor
 * This file contains the bulk of the Ghiraldi framework.  It bootstraps the controllers, models, data sources, configuration
 * and other parts of the application.
 * 
 * You should not change anything in this file unless you know what you're doing.  Seriously - here be dragons.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. 
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 **/
 
/**
 * Framework dependencies
 */
var fs = require('fs'), 
    express = require('express'),
    _ = require('underscore'),
    locales = require('./locales'),
    flash = require('connect-flash');

require('coffee-script');

/**
 * Basic variables used during bootstrapping.
 **/
var status = false,
    port = process.env.PORT,
    errors,
    config;

/**
 * The main boot function.  This boots the application and catches all startup errors.
 * @param app, the app provided by express.js
 * @param completeFn the method to be executed when the bootstrap is completed.
 * @author John O'Connor
 **/
exports.boot = function(app, completeFn){
    try {
        bootFramework(app, function() {
            console.log("Framework booted");
            bootConfig(app, function() {
                console.log("config booted");
                bootData(app, function() {
                    console.log("data booted");
                    bootPlugins(app, function() {
                         console.log("Plugins booted");
                        bootApp(app, function() {
                            console.log("Done booting application");
                            completeFn({
                                status: true,
                                port: port
                            });
                        });
                    });
                });
            });
        });
    } catch (e) {
        status = false;
        errors = e;
        completeFn({
            status: false,
            errors: e
        });
    }
};

/**
 * Sets up the express app, with the default ghiraldi app middleware and base settings.
 * These need to be made more dynamic, but for now it works.
 * @param app the express.js app.
 * @param completeFn The function that executes once framework boot is complete.
 * TODO: Make these configurable, so users can add variables (ie: views) and middleware
 * (ie: express.bodyParser) from their app without modifying mvc.js.
 **/
function bootFramework(app, completeFn) {
  // console.log("Booting framework");
  app.use(flash());
  app.use(express.logger(':method :url :status'));
    
  app.use(express.bodyParser({uploadDir: __dirname + '/app/public/files'}));
  
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  
  app.use(express.session({ secret: '8y3l138ut13je31r13sad13vs8h3ety3r8t13w8weyhel' }));
  app.use(require(__dirname + '/app/helpers.js'));

  app.use(app.router);
  app.use(express.static(__dirname + '/app/public'));
  
  app.use(locales.init);

  app.set('views', __dirname + '/app/views'); 
  app.set('view engine', 'jade');
    completeFn();
}

/**
 * Reads the config.json file and performs additional dynamic app configuration.
 * @param app the express.js application.
 * @param completeFn a function that executes upon completion of the boot process.
 **/
function bootConfig(app, completeFn) {
  config = require(__dirname + '/app/config.json');
  
  var environment = process.env.NODE_ENV;
  if (_.isUndefined(environment) || _.isNull(environment)) {
    environment = config.environment;
  }
    
  var appSettings = config[environment];
  config = config[environment];
  
  if (appSettings.port !== null && appSettings.port !== undefined) {
      port = appSettings.port;
  }
  
  if (appSettings.logger !== null && appSettings.logger !== undefined) {
        app.use(express.logger(appSettings.logger));
  }
  if (appSettings.uploadDir !== null && appSettings.uploadDir !== undefined) {
    app.use(express.bodyParser({uploadDir: __dirname + appSettings.uploadDir}));
  }
  
  if (appSettings.sessionSecretSalt !== null && appSettings.sessionSecretSalt !== undefined) {
        app.use(express.session({ secret: appSettings.sessionSecretSalt }));
  }

  if (appSettings.viewsDir !== null && appSettings.viewsDir !== undefined) {
        app.set('views', __dirname + appSettings.viewsDir); 
  }
  
  if (appSettings.viewEngine !== null && appSettings.viewEngine !== undefined) {
        app.set('view engine', appSettings.viewEngine);
  }
  
  if (appSettings.helpers !== null && appSettings.helpers !== undefined) {
    // some static view helpers
    app.use(require(__dirname + appSettings.helpers));
  }  
  if (appSettings.helpers !== null && appSettings.helpers !== undefined) {
        app.use(require(__dirname + appSettings.helpers));
  }
  // Removed in Express 3.0 - generic helpers are now used instead.
//  if (appSettings.dynamicHelpers !== null && appSettings.dynamicHelpers !== undefined) {
//    // Some dynamic view helpers
//    app.dynamicHelpers(require(__dirname + appSettings.dynamicHelpers));
//  }
//  
//  if (appSettings.helpers !== null && appSettings.helpers !== undefined) {
//      // some static view helpers
//      app.helpers(require(__dirname + appSettings.helpers));
//  }
  completeFn();
}

/**
 * Boots the application being developed with the framework.
 * @param app a reference to the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootApp(app, completeFn) {
     console.log("Booting the app");
    var basedir = __dirname + '/app';
    try {
            bootModels(app, basedir, function() {
                 console.log("Booted app models");
                bootControllers(app, basedir, function() {
                     console.log("Booted app controllers");
                    bootResources(app, basedir, function() {
                         console.log("Booted app resources");
                        completeFn();
                    });
                });
            });
    } catch (e) {
        errors = e;
        console.log(errors);
        completeFn();
    }
}

/**
 * Boots up the project plugins.
 * @param app the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootPlugins(app, completeFn) {
    fs.readdir(__dirname + '/app/plugins', function(err, plugins) {
        if (err) {
            console.log(err);
            completeFn(); 
        } else if (_.isNull(plugins) || _.isUndefined(plugins)) {
            console.log("No plugins were found");
            completeFn();
        } else {
            // console.log("booting plugins");
            var pluginIndex = plugins.length;
            console.log("Plugins.length = " + plugins.length);
            try {
                plugins.forEach(function(plugin) {
                    console.log("Detected plugin: " + plugin);
                    bootModels(app, __dirname + '/app/plugins/' + plugin, function() {
                        bootResources(app, __dirname + '/app/plugins/' + plugin, function() {
                            bootControllers(app, __dirname + '/app/plugins/' + plugin, function() {
                                pluginIndex--;
                                // console.log("Plugin index = " + pluginIndex);
                                if (pluginIndex == 0) {
                                    completeFn();
                                }
                            });
                        });
                    });
                });                    
            } catch (e) {
                console.log(e);
                completeFn();
            }
        }
    });
}

/** Boots up the framework with the resources for this project.
 * @param app the application server.
 * @param basedir the base directory for the resources.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootResources(app, basedir, completeFn) {
    if (locales === null || locales === undefined) {
        locales = {};
    }
    var resourcePath = basedir.match(/\/[a-zA-Z0-9.\-]+$/);
    resourcePath = resourcePath.toString().replace(/-.*/, '').replace('/', '');
    fs.readdir(basedir + '/resources', function(err, resourceFiles) {
        if (resourceFiles !== null && resourceFiles !== undefined) {
            var resourceFilesIndex = resourceFiles.length;
            resourceFiles.forEach(function(resource){
                var res = require(basedir + '/resources/' + resource);
                resource = resource.replace('.json', '');
                locales.setLocale(res, resource, resourcePath);
                resourceFilesIndex--;
                if (resourceFilesIndex <= 0) {
                    completeFn();
                }
            });
        } else {
            completeFn();
        }
    });
}

/**
 * Boot up the framework with the models found in basedir.
 * @param app the application server.
 * @param basedir the base directory for the models.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootModels(app, basedir, completeFn) {
    fs.readdir(basedir + '/models', function(err, files) {
        if (err) { 
            completeFn();
            console.log("err = " + err);
        } else if (_.isNull(files) || _.isUndefined(files)) {
            completeFn();
            console.log("files is not defined or null");
        } else if (files.length <= 0) {
            completeFn();
            console.log("No files found");
        } else {
            var filesIndex = files.length;
            files.forEach(function(file) {
                console.log(file);
                fs.stat(basedir + '/models/' + file, function(err, stats) {
                    if (stats.isFile()) {
                        bootModel(app, basedir, file);
                        filesIndex--;
                    } else {
                        filesIndex--;
                    }
                    if (filesIndex <= 0) {
                        completeFn();
                    }
                });
            });
        }
    });
}

/**
 * Boots a model into the application framework.
 * @internal
 * @param app the application server.
 * @param basedir the base directory of the models.
 * @param file the file containing the data model.
 **/
function bootModel(app, basedir, file) {
    // console.log("Booting model " + basedir + " - " + file);
    require(basedir + '/models/' + file);
}

// Bootstrap controllers

/**
 * Boot up the framework with the controllers found in basedir.
 * @param app the application server.
 * @param basedir the base directory that contains the controllers
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootControllers(app, basedir, completeFn) {
  fs.readdir(basedir + '/controllers', function(err, files){
        if (err) {
            completeFn();
        } else {
            if (!_.isNull(files) && !_.isUndefined(files)) {
                if (files.length <= 0) {
                    completeFn();
                    console.log("no files found");
                } else {
                    var filesIndex = files.length;
                    files.forEach(function(file){
                        filesIndex--;
                        bootController(app, basedir, file, function() {
                            if (filesIndex <= 0) {
                                completeFn();
                            }
                        });
                    });
                }
            };        
        }
    });
}

/**
 * Boot data into the framwork using the config.json configuration file.  Currently only supports mongodb.
 * @param app the application server
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootData(app, completeFn) {
    if (!_.isUndefined(config.data) && !_.isNull(config.data)) {
        if (config.data.provider === 'mongodb') {
            var mongoose = require('mongoose');
            var connectionString = "mongodb://";
            if (config.data.host && config.data.database) {
                if (config.data.username && config.data.password) {
                    connectionString += config.data.username + ":" + config.data.password + "@"
                }
                connectionString += config.data.host + "/" + config.data.database;
                mongoose.connect(connectionString);
    //            console.log("database = " + connectionString);
                completeFn();
            } else {
                completeFn();                
            }
        } else {
            // console.log("Provider " + config.data.provider + " not supported");
            completeFn();
        }
    } else {
        completeFn();
    }
}

/**
 * Boot a controller into the framework.
 * @param app the application server
 * @basedir the base directory for the controllers - used to distinguish plugins from app.
 * @param file the controller file
 **/
function bootController(app, basedir, file, completeFn) {
  // console.log("Booting controller " + basedir + " - " + file);
  var actions = require(basedir + '/controllers/' + file);
  if (!_.has(actions, 'routes')) {
      completeFn();
      return;
  }
  Object.keys(actions).map(function(action){
    if (action == 'routes') {
        // add some routes from the routes part.
        //actions[action] = routes array.
        var actionsIndex = actions[action].length;
        if (actionsIndex <= 0) {
            completeFn();
        }
        actions[action].forEach(function(route) {
            actionsIndex--;
            var routepath;
            basedir = basedir.match(/\/[a-zA-Z0-9.\-]+$/);
            basedir = basedir.toString().replace(/-.*/, '');
            if (basedir.toString().match(/\/app$/)) {
                routepath = route.route;
            } else {
                routepath = basedir + route.route;
            }
            console.log(routepath);
            var fn = routeAction(routepath, route.method);
            switch(route.verb) {
                case 'get':
                    if (route.middleware) {
                        app.get(routepath, route.middleware, route.method);
                    } else {
                        app.get(routepath, route.method);
                    }
                    break;
                case 'put':
                    if (route.middleware) {
                        app.put(routepath, route.middleware, route.method);
                    } else {
                        app.put(routepath, route.method);
                    }
                    break;
                case 'post':
                    if (route.middleware) {
                        app.post(routepath, route.middleware, route.method);
                    } else {
                        app.post(routepath, route.method);
                    }  
                    break;
                case 'del':
                    if (route.middleware) {
                        app.del(routepath, route.middleware, route.method);
                    } else {
                        app.del(routepath, route.method);
                    }                    
                    break;
                default:
                    // The case where no verb has been defined.
                    if (route.middleware) {
                        // Augment the current middleware with your middleware.
                        app.use(routepath, route.middleware);
                    }
            }
            // console.log('adding route ' + routepath);
            if (actionsIndex <= 0) {
                // console.log("Actions index = 0");
                completeFn();
            }
        });
    }
  });
}
    
/**
 * Allow us to call the route action in the application context.
 **/
function routeAction(route, fn) {
    return function(req, res, next) {
        fn.apply(this, arguments);
    };
}

/* Note: the rest of this stuff should eventually go in a library somewhere. Perhaps when I have the time */
/**
 * Walk a directory tree and return the files in that tree.
 * @param dir the directory to be walked.
 * @param done a function that executes once file walking is complete with the signaure done(err, [files])
 **/
var walk = function(dir, done) {
    var results = [];
    fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, results);
            file = dir + '/' + file;
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    results.push(file);
                    next();
                }
            });
        })();
    });
};