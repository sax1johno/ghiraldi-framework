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
    Q = require('q'),
    express = require('express'),
    _ = require('underscore'),
    locales = require('./locales'),
    flash = require('connect-flash'),
    registry = require('mongoose-schema-registry'),
    pluginRegistry = require('ghiraldi-plugin-registry').registry,
    Plugin = require('ghiraldi-plugin-registry').Plugin,
    mongoose = require('mongoose'),
    Schema = require('mongoose').Schema,
    EventEmitter = require('events').EventEmitter,
    logger = require('ghiraldi-simple-logger'),
    controllers = [],
    settings = require('./package').ghiraldi;

// var registry = new ModelRegistry();

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

pluginRegistry.on('add', function(tag, plugin) {
    logger.log('trace', "Plugin added: " + JSON.stringify(tag) + " with values " + JSON.stringify(plugin));
})

/**
 * The main boot function.  This boots the application and catches all startup errors.
 * @param app, the app provided by express.js
 * @author John O'Connor
 **/
exports.boot = function(app){
    var bootDefer = Q.defer();
    
    /** Run the boot methods sequentially and return the promise at the end. **/
    bootFramework(app)
    .then(function() {
        return bootConfig(app);
    }).then(function() {
        return bootPlugins(app);
    }).then(function() {
        return bootApp(app);
    }).then(function() {
        return registerModels(app);
    }).then(function() {
        return registerControllers(app);
    }).then(function() {
        logger.log("trace", "reached the end of the line");
        bootDefer.resolve({'status': status, 'port': port, 'errors': errors, 'config': config});        
    }, function(err) {
        logger.log("trace", "REJECTED: error = " + err);        
        bootDefer.reject(err);        
    }).done();
    
    return bootDefer.promise;
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
    
    app.set('views', __dirname + '/'); 
    app.set('view engine', 'jade');
    bootEventEmitter.emit('bootFramework');
    return Q();
}

/**
 * Reads the config.json file and performs additional dynamic app configuration.
 * @param app the express.js application.
 **/
function bootConfig(app) {
   logger.log('trace', "Booting application configuration");    
  config = settings;
  
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

    bootEventEmitter.emit('bootConfig');
   logger.log('trace', "End of boot config");        
    return Q();
}

/**
 * Boots the application being developed with the framework.
 * @param app a reference to the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootApp(app) {
    logger.log('trace', "Booting the app");
    var basedir = __dirname + '/app';
    var appPlugin = new Plugin();
    appPlugin.name = 'app';
    appPlugin.fileName = '';
    appPlugin.baseDir = basedir;
    appPlugin.name = 'app';
    var bootAppDefer = Q.defer();
    bootPluginConfig(app, __dirname)
        .then(function(pConfig) {
            config = pConfig;
            return bootModels(app, appPlugin, config);
        }).then(function() {
            return bootControllers(app, appPlugin, {});
        }).then(function() {
            return bootResources(app, appPlugin, {});
        }).then(function() {
            return bootViews(app, appPlugin, {});
        }).then(function() {
            /** The last step is to register the booted plugin with the plugin registry. **/
            return registerPlugin(app, appPlugin, {});
        }).then(function() {
            bootAppDefer.resolve();
        }, function(err) {
            bootAppDefer.reject(err);
        }).done();
    return bootAppDefer.promise;
}

/**
 * Boots up the project plugins.
 * @param app the express.js application.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootPlugins(app, completeFn) {
    var bootPluginsDefer = Q.defer();
   logger.log('trace', "Booting the plugins");
   var plugins = settings.pluginsEnabled;
   if (_.size(plugins) <= 0) {
       bootEventEmitter.emit('bootPlugins');
       logger.log('trace', 'Size of plugins <= 0');
       bootPluginsDefer.resolve();
   } else {
        var pluginResult = Q.resolve();
        function loadPlugins() {
            plugins.forEach(function(p) {
                pluginResult = pluginResult.then(function() {
                    return bootPlugin(app, p);
                });
            });
            return pluginResult
        }
        
        loadPlugins().then(function() {
            logger.log('trace', 'Boot plugins complete');
            bootEventEmitter.emit('bootPlugins');
            bootPluginsDefer.resolve();
        }, function(err) {
            logger.log('warning', err.stack);
            bootEventEmitter.emit('bootPlugins');
            bootPluginsDefer.reject(err);                            
        })
    }
    return bootPluginsDefer.promise;
}

/**
 * Boots up a plugin.
 * @param app the application server.
 * @param plugin the plugin file name
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootPlugin(app, plugin, completeFn) {
    var bootPluginDefer = Q.defer();
    logger.log('trace', "Detected plugin: " + plugin);
    var thisPlugin = new Plugin();
    var pluginLocation = require.resolve(plugin);
    logger.log('trace', 'Plugin located at ' + pluginLocation);
    thisPlugin.name = plugin;
    thisPlugin.fileName = pluginLocation;
    thisPlugin.baseDir = pluginLocation.replace('/index.js', '');
    var config = {};
    bootPluginConfig(app, thisPlugin.baseDir)
        .then(function(pConfig) {
            config = pConfig;
            return bootModels(app, thisPlugin, config);
        }).then(function() {
            return bootResources(app, thisPlugin, config);
        }).then(function() {
            return bootControllers(app, thisPlugin, config);
        }).then(function() {
            return bootViews(app, thisPlugin, config);
        }).then(function() {
            /** The last step is to register the booted plugin with the plugin registry. **/
            return registerPlugin(app, thisPlugin, config);
        }).then(function() {
            logger.log('trace', 'Done booting plugin ' + thisPlugin.name);
            bootPluginDefer.resolve();
        }, function(err) {
            logger.error('trace', 'There was an error booting a plugin: Plugin = ' + thisPlugin.name + ', ' + err);
            bootPluginDefer.reject(err);
        }).done();
    return bootPluginDefer.promise;
}

function bootPluginConfig(app, basedir, completeFn) {
    var pluginConfig = basedir + '/package.json';
    logger.log("trace", "Plugin config directory = " + pluginConfig);
    config = require(pluginConfig).ghiraldi;
    if (!_.isUndefined(config) && !_.isNull(config)) {
        return Q.resolve(config);
    } else {
        return Q.resolve({});
    }
}

/** 
 * Boots up the framework with the resources for this project.
 * @param app the application server.
 * @param basedir the base directory for the resources.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootResources(app, plugin, config, completeFn) {
    var basedir = plugin.baseDir;
    var bootResourcesDefer = Q.defer();
    logger.log('trace', 'Booting resources for ' + basedir);
    if (locales === null || locales === undefined) {
        locales = {};
    }
    var resourcePath = basedir.match(/\/[a-zA-Z0-9.\-]+$/);
    resourcePath = resourcePath.toString().replace(/-.*/, '').replace('/', '');
    fs.readdir(basedir + '/resources', function(err, resourceFiles) {
        if (err) {
            logger.log('warning', 'No resource files were found');
            bootResourcesDefer.resolve();
        } else {
            if (resourceFiles !== null && resourceFiles !== undefined) {
                var resourceFilesIndex = resourceFiles.length;
                resourceFiles.forEach(function(resource){
                    var res = require(basedir + '/resources/' + resource);
                    resource = resource.replace('.json', '');
                    locales.setLocale(res, resource, resourcePath);
                    resourceFilesIndex--;
                    if (resourceFilesIndex <= 0) {
                        // completeFn();
                        bootResourcesDefer.resolve();
                    }
                });
            } else {
                bootEventEmitter.emit('bootResources');
                bootResourcesDefer.resolve();
            }
        }
    });
    return bootResourcesDefer.promise;
}

/**
 * Add the views to the plugin registry.
 * Generally, the views directly under the "views" folder of a plugin or app are put under the tag for that
 * app or plugin.  ie: views->add.jade for plugin "user" will be accessed by using pluginRegistry.get('user').views('add').
 * Views that are in a subfolder, or have the pluginName_viewName.jade will replace the view in the plugin registry
 * for that plugin.  ie: in the Roles plugin, the user_add.jade file will override the add view for the user plugin.
 * Same goes with a folder in role called "user", ie: role->view->user->add.jade will be accessible using
 * pluginRegistry.get('user').views('add').
 * @param app the application server
 * @param basedir the plugin directory (NOT preceded with __dirname). This is because __dirname is prepended to the viewsDir
 * in express.js.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootViews(app, plugin, config, completeFn) {
    var bootViewsDefer = Q.defer();
    logger.log('trace', 'booting views in ' + plugin.name);
    var basedir = plugin.baseDir + '/views';
    logger.log('trace', 'Views dir = ' + basedir);
    fs.readdir(basedir, function(err, files) {
        if (err) {
            logger.log('warning', err);
            bootViewsDefer.resolve();
            // completeFn();
        } else if (_.isNull(files) || _.isUndefined(files)) {
            // completeFn();
            logger.log('warning', "No views were found.");
            bootViewsDefer.resolve();
        } else if (files.length <= 0) {
            // completeFn();
            logger.log('warning', "No views were found.");
            bootViewsDefer.resolve();
        } else {
            var filesIndex = files.length;
            files.forEach(function(file) {
                fs.stat(basedir + '/' + file, function(err, stats) {
                    if (err) {
                        logger.log('warning', err);
                        bootViewsDefer.resolve(err);
                    } else if (stats.isFile()) {
                        // if the file has an underscore (_), then the text before the underscore is a 
                        // plugin name, and the text after is the view.  Otherwise, we keep the plugin name.
                        // ie: pluginName_viewName.jade.
                        
                        var viewTagRegex = /(.*)\.jade/;
                        var viewTagsMatch = viewTagRegex.exec(file);
                        var pluginDir = plugin;
                        // var pluginFile = basedir + "/views/" + file;
                        var pluginFile = basedir + '/' + file;
                        logger.log('trace', JSON.stringify(viewTagsMatch));
                        /** TODO: Implement the underscore matching **/
//                        if (!_.isUndefined(match[2])) {
//                            // There were 2 captures, so the format was pluginName_view.jade
//                            pluginDir = match[1];
//                            pluginFile = '/plugins/' + match[1] + '/views/' + match[2];
//                        }
                        plugin.views[viewTagsMatch[1]] = pluginFile;
                        filesIndex--;
                        var pluginName = "";
                        if (filesIndex <= 0) {
                            bootViewsDefer.resolve();
                        }
                    } else {
                        // At some point, we should manage directories the same way
                        // we manage underscores.  For now, just ignore them.
                        filesIndex--;
                        if (filesIndex <= 0) {
                            bootViewsDefer.resolve();                            
                            // completeFn();
                        }
                    }
                });
            });
        }
    });
    return bootViewsDefer.promise;
}

/**
 * Boot up the framework with the models found in basedir.
 * @param app the application server.
 * @param basedir the base directory for the models.
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootModels(app, plugin, config, completeFn) {
    var bootModelsDefer = Q.defer();
    var basedir = plugin.baseDir;
    logger.log('trace', 'booting models for ' + basedir);
    Q.nfcall(fs.readdir, basedir + '/models')
        .then(function(files) {
            if (_.isNull(files) || _.isUndefined(files)) {
                logger.log('warning', "No models were found.");
                bootModelsDefer.resolve();
            } else if (files.length <= 0) {
                logger.log('warning', "No models were found.");
                // completeFn();            
                bootModelsDefer.resolve();    
            } else {
                var filesIndex = files.length;
                files.forEach(function(file) {
                    fs.stat(basedir + '/models/' + file, function(err, stats) {
                        if (err) {
                            logger.log('trace', "error stating file " + file + ": " + err);
                            bootModelsDefer.resolve();
                        }
                        if (stats.isFile()) {
                            logger.log('trace', "model: " + file);
                            bootModel(app, basedir, file, function() {
                                filesIndex--;
                                if (filesIndex <= 0) {
                                    bootModelsDefer.resolve();
                                }
                            });
                        } else {
                            filesIndex--;
                            if (filesIndex <= 0) {
                                bootModelsDefer.resolve();
                            }
                        }
                    });
                });
                logger.log("trace", "files = " + files.join());
            }
        }, function(err) {
            logger.log('warning', err);
            bootModelsDefer.resolve();
        });
    // fs.readdir(basedir + '/models', function(err, files) {
    //     if (err) { 
    //         logger.log('warning', err);
    //         bootModelsDefer.resolve(err);
    //     } else if (_.isNull(files) || _.isUndefined(files)) {
    //         logger.log('warning', "No models were found.");
    //         bootModelsDefer.resolve();
    //         // completeFn();            
    //     } else if (files.length <= 0) {
    //         logger.log('warning', "No models were found.");
    //         // completeFn();            
    //         bootModelsDefer.resolve();
    //     } else {
    //         var filesIndex = files.length;
    //         files.forEach(function(file) {
    //             fs.stat(basedir + '/models/' + file, function(err, stats) {
    //                 if (stats.isFile()) {
    //                     logger.log('trace', "model: " + file);
    //                     bootModel(app, basedir, file, function() {
    //                         filesIndex--;
    //                         if (filesIndex <= 0) {
    //                             bootModelsDefer.resolve();
    //                         }
    //                     });
    //                 } else {
    //                     filesIndex--;
    //                     if (filesIndex <= 0) {
    //                         bootModelsDefer.resolve();
    //                     }
    //                 }
    //             });
    //         });
    //     }
    // });
    return bootModelsDefer.promise;
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
    var registerModelsDefer = Q.defer();
    logger.log('trace', 'Registering models');
    var keys = registry.getKeys();
    logger.log('trace', "keys = " + JSON.stringify(keys));
    if (_.isEmpty(keys)) {
        bootEventEmitter.emit('registerModels');
        registerModelsDefer.resolve();
    } else {
        _.each(keys, function(key, index, list) {
            var thisSchema = registry.getSchema(key);
            thisSchema.__proto__ = Schema.prototype;
            mongoose.model(key,  thisSchema);
            if (index == _.size(list) - 1) {
                bootEventEmitter.emit('registerModels');
                registerModelsDefer.resolve();
            }
        });
    }
    return registerModelsDefer.promise;
}

/**
 * Registers a plugin that has been completely booted.
 * Called as the last item in bootPlugins if nothing has
 * failed.
 **/
function registerPlugin(app, plugin, config) {
    logger.log("trace", "Ready to register plugin");
    var registerPluginDeferred = Q.defer();
    var pluginName;
    if (config.name) {
        pluginName = config.name;
    } else {
        pluginName = plugin.name;
    }
    pluginRegistry.add(pluginName, plugin, function() {
        logger.log('trace', 'Plugin should have been registered');
        // logger.log('trace', 'Plugin registry now looks like the following: ' + JSON.stringify(pluginRegistry));
        registerPluginDeferred.resolve();  
    }, function(err) {
        logger.log('error', 'There was an error registering the plugin ' + plugin.name + ': ' + err);
        registerPluginDeferred.reject(err);
    });
    
    return registerPluginDeferred.promise;
}


// Bootstrap controllers

/**
 * Boot up the framework with the controllers found in basedir.
 * For now, this function will add the controllers to the array, and controllers will actually be included in the framework at the end.
 * @param app the application server.
 * @param basedir the base directory that contains the controllers
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootControllers(app, plugin, config, completeFn) {
    var bootControllersDefer = Q.defer();
    var basedir = plugin.baseDir;
    logger.log('trace', 'Booting controllers for ' + basedir);
    fs.readdir(basedir + '/controllers', function(err, files){
        if (err) {
            logger.log('error', 'Errors happened attempting to read controllers');
            bootControllersDefer.reject("Unable to boot controllers: " + err);
        } else {
            if (!_.isNull(files) && !_.isUndefined(files)) {
                if (files.length <= 0) {
                    logger.log('error', "no controllers found");
                    bootControllersDefer.reject("No controllers found in " + basedir);
                } else {
                    var filesIndex = files.length;
                    files.forEach(function(file){
                        logger.log('trace', "pushing controller " + basedir + " / " + file + " to controllers");                        
                        filesIndex--;
                        controllers.push({'basedir': basedir, 'file': file});
                        if (filesIndex <= 0) {
                            bootControllersDefer.resolve();
                        }
                       // bootController(app, basedir, file, function() {
                       //     if (filesIndex <= 0) {
                       //         completeFn();
                       //     }
                       // });
                    });
                }
            }
        }
    });
    return bootControllersDefer.promise;
}

/**
 * Registers the previously booted controllers.  This runs once all of the controllers have been
 * found and models have been registered.
 * @param app the application context
 * @param completeFn a method that is executed once the registration is complete
 **/
function registerControllers(app, completeFn) {
    logger.log('trace', 'registering controllers');
    var registerControllersDefer = Q.defer();
    logger.log('trace', 'controllers = ' + controllers);
    if (!_.isUndefined(controllers) && !_.isNull(controllers) && !_.isEmpty(controllers)) {
        _.each(controllers, function(controller, index, list) {
            bootController(app, controller.basedir, controller.file, function() {
                if (index == _.size(list) - 1) {
                    registerControllersDefer.resolve();
                    bootEventEmitter.emit('registerControllers');                        
                }
            });
        });
    } else {
        bootEventEmitter.emit('registerControllers');        
        registerControllersDefer.reject('No controllers were found to register.');
    }
    return registerControllersDefer.promise;
}

/**
 * Boot data into the framwork using the config.json configuration file.  Currently only supports mongodb.
 * @param app the application server
 * @param completeFn a function to be executed when booting is complete.
 **/
function bootData(app, completeFn) {
    var bootDataDefer = Q.defer();
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
            bootDataDefer.resolve();            
        } else {
            logger.log('warning', 'Incompatible data provider, or no data provider was found.');
            bootDataDefer.resolve();
        }
    } else {
        logger.log('warning', 'No data source configuration was found.')
        bootDataDefer.resolve();
    }
    bootEventEmitter.emit('bootData');
    return bootDataDefer.promise;
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
//            if (basedir.toString().match(/\/app$/)) {
//                routepath = route.route;
//            } else {
//                routepath = basedir + route.route;
//            }
            // Changed over to using absolute routes in controllers.  Allows for
            // more fine external control of routes at the expense of possible
            // routing overlap.
            routepath = route.route;
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