
/**
 * Framework dependencies - required for features.
 */

var fs = require('fs'), 
    express = require('express'),
    vm = require('vm'),
    _ = require('underscore'),
    pkg = require('./package'),
    locales = require('./locales');
    
require('coffee-script');
  
// var mongoose = 

var status = false,
    port = process.env.PORT,
    errors,
    config;

exports.boot = function(app, completeFn){
//    // console.log("Booting Ghiraldi");
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

// App settings and middleware

function bootFramework(app, completeFn) {
  // console.log("Booting framework");
  app.use(express.logger(':method :url :status'));
    
  app.use(express.bodyParser({uploadDir: __dirname + '/public/files'}));
  
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  
  app.use(express.session({ secret: '8y3l138ut13je31r13sad13vs8h3ety3r8t13w8weyhel' }));
  app.use(require(__dirname + '/helpers.js'));

  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  
  app.use(locales.init);

  app.set('views', __dirname + '/app/views'); 
  app.set('view engine', 'jade');
    completeFn();
}

function bootConfig(app, completeFn) {
  config = require(__dirname + '/config.json');
  
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
 * Boots up the framework with this application.
 * @param app the application server.
 **/
function bootApp(app, completeFn) {
     console.log("Booting the app");
    var basedir = __dirname + '/app';
    try {
             console.log("Booted app data");
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
        completeFn();
    }
}

/**
 * Boots up the framework with the project plugins.
 * @param app the application server.
 **/
function bootPlugins(app, completeFn) {
    fs.readdir(__dirname + '/plugins', function(err, plugins) {
        if (err) { 
            // console.log("There was an error: " + err);
            completeFn(); 
        } else if (_.isNull(plugins) || _.isUndefined(plugins)) {
            // console.log("No plugins were found");
            completeFn();
        } else {
            // console.log("booting plugins");
            var pluginIndex = plugins.length;
            // console.log("Plugins.length = " + plugins.length);
            if (plugins.length === 0) {
                // console.log("Plugins length was 0 - all done");
                completeFn();
            } else {
                plugins.forEach(function(plugin) {
                    bootModels(app, __dirname + '/plugins/' + plugin, function() {
                        bootResources(app, __dirname + '/plugins/' + plugin, function() {
                            bootControllers(app, __dirname + '/plugins/' + plugin, function() {
                                pluginIndex--;
                                // console.log("Plugin index = " + pluginIndex);
                                if (pluginIndex <= 0) {
                                    completeFn();
                                }
                            });
                        });
                    });
                });
            }
        }
    });
}

/** Boots up the framework with the resources for this project.
 * @param app the application server.
 * @param basedir the base directory for the resources.
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
 **/
function bootModels(app, basedir, completeFn) {
    fs.readdir(basedir + '/models', function(err, files) {
        if (err) { 
            completeFn();
//            console.log("err = " + err);
        } else if (_.isNull(files) || _.isUndefined(files)) {
            completeFn();
//            console.log("files is not defined or null");
        } else if (files.length <= 0) {
            completeFn();
//            console.log("No files found");
        } else {
            var filesIndex = files.length;
            files.forEach(function(file) {
//                console.log(file);
                filesIndex--;
                fs.stat(basedir + '/models/' + file, function(err, stats) {
                    if (stats.isFile()) {
                        bootModel(app, basedir, file);
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
 * @param app the application server.
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
 * Boot data into the framwork using the config.json configuration file.  Currently only supports mongodb
 * @param app the application server
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

/* Note: the rest of this stuff should go in a library somewhere. */
/**
 * Walk a directory tree and return the files in that tree.
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