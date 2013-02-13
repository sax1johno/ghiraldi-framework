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
    flash = require('connect-flash'),
    registry = require('mongoose-schema-registry'),
    mongoose = require('mongoose'),
    EventEmitter = require('events').EventEmitter,
    logger = require('ghiraldi-simple-logger'),
    controllers = [];
    
var bootEventEmitter = new EventEmitter();

require('coffee-script');

/**
 * Basic variables used during bootstrapping.
 **/
var status = false,
    port = process.env.PORT,
    errors,
    config;

exports.events = function() {
    return bootEventEmitter;
};

registry.on('add', function(tag, schema) {
    logger.log('trace', "Schema entry added: " + tag + " " + JSON.stringify(schema));
})

/**
 * The main boot function.  This boots the application and catches all startup errors.
 * @param app, the app provided by express.js
 * @author John O'Connor
 **/
exports.boot = function(app){
//    try {
        bootEventEmitter.on('bootFramework', function() {
            bootConfig(app);
        });
        
        bootEventEmitter.on('bootConfig', function() {
            bootData(app);
        });
        
        bootEventEmitter.on('bootData', function() {
            bootPlugins(app);
        });
        
        bootEventEmitter.on('bootPlugins', function() {
            bootApp(app);
        });
        
        bootEventEmitter.on('bootApp', function() {
            registerModels(app);
        });
        
        bootEventEmitter.on('registerModels', function() {
            registerControllers(app);
        });
        
        bootEventEmitter.on('registerControllers', function() {
            app.emit('boot', port);
        });
        
        bootEventEmitter.on('error', function(errors) {
            bootEventEmitter.emit('bootError', errors)
        })
        
        bootFramework(app);
        
//    } catch (e) {
//        app.emit('bootError', e)
//    }
};

/**
 * Sets up the express app, with the default ghiraldi app middleware and base settings.
 * These need to be made more dynamic, but for now it works.
 * @param app the express.js app.
 **/
function bootFramework(app) {
   logger.log('trace', "Booting framework");
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
    bootEventEmitter.emit('bootFramework');
}

/**
 * Reads the config.json file and performs additional dynamic app configuration.
 * @param app the express.js application.
 **/
function bootConfig(app) {
   logger.log('trace', "Booting application configuration");    
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
    bootEventEmitter.emit('bootConfig');
}

/**
 * Boots the application being developed with the framework.
 * @param app a reference to the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootApp(app) {
   logger.log('trace', "Booting the app");
    var basedir = __dirname + '/app';
    try {
            bootModels(app, basedir, function() {
                logger.log('trace', "Booted app models");
                bootControllers(app, basedir, function() {
                    logger.log('trace', "Booted app controllers");
                    bootResources(app, basedir, function() {
                        logger.log('trace', "Booted app resources");
                        bootEventEmitter.emit('bootApp');
                    });
                });
            });
    } catch (e) {
        logger.log("error", e.stack);
        bootEventEmitter.emit('error', e);
    }
}

/**
 * Boots up the project plugins.
 * @param app the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootPlugins(app, completeFn) {
   logger.log('trace', "Booting the plugins");    
    fs.readdir(__dirname + '/app/plugins', function(err, plugins) {
        if (err) {
            logger.log("warning", err);
        } else if (_.isNull(plugins) || _.isUndefined(plugins)) {
            logger.log('debug', "No plugins found");    
        } else {
            try {
                if (plugins.length == 0) {
                    bootEventEmitter.emit('bootPlugins');
                } else {
                    var index = 0;
                    var bootThesePlugins = function() {
                        bootPlugin(app, plugins[index], function() {
                            logger.log('trace', index);
                            if (index == _.size(plugins) - 1) {
                                bootEventEmitter.emit('bootPlugins');
                            } else {
                                index++;
                                bootThesePlugins();
                            }
                        });
                    };
                    bootThesePlugins(index);
//                    bootPlugin(app, plugins[index], function() {
//                        logger.log('trace', index);
//                        if (index == _.size(plugins) - 1) {
//                            bootEventEmitter.emit('bootPlugins');
//                        } else {
//                            index++;
//                            bootPlugin(app, plugins[index], this);
//                        }
//                    });
                }
            } catch (e) {
                logger.log('warning', e.stack);
                bootEventEmitter.emit('bootPlugins');
            }
        }
    });
}

/**
 * Boots up a plugin.
 * @param app the application server.
 * @param plugin the plugin
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootPlugin(app, plugin, completeFn) {
    logger.log('trace', "Detected plugin: " + plugin);
    bootModels(app, __dirname + '/app/plugins/' + plugin, function() {
        bootResources(app, __dirname + '/app/plugins/' + plugin, function() {
            bootControllers(app, __dirname + '/app/plugins/' + plugin, function() {
                completeFn();
            });
        });
    });
}

/** 
 * Boots up the framework with the resources for this project.
 * @param app the application server.
 * @param basedir the base directory for the resources.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootResources(app, basedir, completeFn) {
    logger.log('trace', 'Booting resoureces');
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
            bootEventEmitter.emit('bootResources');        
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
    logger.log('trace', 'booting models');
    fs.readdir(basedir + '/models', function(err, files) {
        if (err) { 
            completeFn();
            logger.log('warning', err);
        } else if (_.isNull(files) || _.isUndefined(files)) {
            completeFn();
            logger.log('warning', "No models were found.");
        } else if (files.length <= 0) {
            completeFn();
            logger.log('warning', "No models were found.");
        } else {
            var filesIndex = files.length;
            files.forEach(function(file) {
                fs.stat(basedir + '/models/' + file, function(err, stats) {
                    if (stats.isFile()) {
                        logger.log('trace', file);
                        bootModel(app, basedir, file, function() {
                            filesIndex--;
                            if (filesIndex <= 0) {
                                completeFn();
                            }
                        });
                    } else {
                        filesIndex--;
                        if (filesIndex <= 0) {
                            completeFn();
                        }
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
function bootModel(app, basedir, file, completeFn) {
    var modelObject = require(basedir + '/models/' + file);
    var keys = _.keys(modelObject);
    var keysIndex = _.size(keys);
    _.each(modelObject, function(schema, tag, list) {
        keysIndex--;
        registry.add(tag, modelObject[tag]);
        if (keysIndex <= 0) {
            completeFn();
        }
    });
}

function registerModels(app) {
    logger.log('trace', 'Registering models');
    var keys = registry.getKeys();
    logger.log('trace', "keys = " + JSON.stringify(keys));
    if (_.isEmpty(keys)) {
        bootEventEmitter.emit('registerModels');
    } else {
        _.each(keys, function(key, index, list) {
            mongoose.model(key,  registry.get(key));
            if (index == _.size(list) - 1) {
                bootEventEmitter.emit('registerModels');
            }
        });
    }
}

// Bootstrap controllers

/**
 * Boot up the framework with the controllers found in basedir.
 * For now, this function will add the controllers to the array, and controllers will actually be included in the framework at the end.
 * @param app the application server.
 * @param basedir the base directory that contains the controllers
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootControllers(app, basedir, completeFn) {
    logger.log('trace', 'Booting controllers');
  fs.readdir(basedir + '/controllers', function(err, files){
        if (err) {
            completeFn();
        } else {
            if (!_.isNull(files) && !_.isUndefined(files)) {
                if (files.length <= 0) {
                    completeFn();
                    logger.log('warning', "no controllers found");
                } else {
                    var filesIndex = files.length;
                    files.forEach(function(file){
                        filesIndex--;
                        controllers.push({'basedir': basedir, 'file': file});
                        completeFn();
//                        bootController(app, basedir, file, function() {
//                            if (filesIndex <= 0) {
//                                completeFn();
//                            }
//                        });
                    });
                }
            };        
        }
    });
}

/**
 * Registers the previously booted controllers.  This runs once all of the controllers have been
 * found and models have been registered.
 * @param app the application context
 * @param completeFn a method that is executed once the registration is complete
 **/
function registerControllers(app, completeFn) {
    if (!_.isUndefined(controllers) && !_.isNull(controllers) && !_.isEmpty(controllers)) {
        _.each(controllers, function(controller, index, list) {
            bootController(app, controller.basedir, controller.file, function() {
                if (index == _.size(list) - 1) {
                    if (!_.isUndefined(completeFn) && !_.isNull(completeFn)) {
                        completeFn();
                    }
                    bootEventEmitter.emit('registerControllers');                        
                }
            });
        });
    } else {
        completeFn();
        bootEventEmitter.emit('registerControllers');
    }

//                        bootController(app, basedir, file, function() {
//                            if (filesIndex <= 0) {
//                                completeFn();
//                            }
//                        });    
}

/**
 * Boot data into the framwork using the config.json configuration file.  Currently only supports mongodb.
 * @param app the application server
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootData(app, completeFn) {
    logger.log("trace", "booting data");
    if (!_.isUndefined(config.data) && !_.isNull(config.data)) {
        if (config.data.provider === 'mongodb') {
            var mongoose = require('mongoose');
            var connectionString = "mongodb://";
            if (config.data.host && config.data.database) {
                if (config.data.username && config.data.password) {
                    connectionString += config.data.username + ":" + config.data.password + "@"
                }
                connectionString += config.data.host + "/" + config.data.database;
                logger.log("trace", "connection string = " + connectionString);
                mongoose.connect(connectionString);
            }
        } else {
            logger.log('warning', 'Incompatible data provider, or no data provider was found.');
        }
    } else {
        logger.log('warning', 'No data source configuration was found.')
    }
    bootEventEmitter.emit('bootData');
}

/**
 * Boot a controller into the framework.
 * @param app the application server
 * @basedir the base directory for the controllers
 * - used to distinguish plugins from app.
 * @param file the controller file
 **/
function bootController(app, basedir, file, completeFn) {
  logger.log('trace', "Booting controller " + basedir + " - " + file);
  var actions = require(basedir + '/controllers/' + file);
  if (!_.has(actions, 'routes')) {
      if (!_.isUndefined(completeFn) && !_.isNull(completeFn)) {
        completeFn();
      }
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
            logger.log('trace', 'route path = ' + routepath);
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