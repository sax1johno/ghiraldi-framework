Ghiraldi (pronounced "gear-ahl-dee') is a component-based MVC framework for node.js apps based on Express.js.

# What is Ghiraldi?
Perhaps I should start with what Ghiraldi ISN'T.
* Ghiraldi is NOT a rails clone.  I took what I consider that to be the best parts of Django, RAILS, javascript, grails, and others.
* Ghrialdi is NOT a rapid application development platform, although apps can be developed very quickly using Ghiraldi.  The focus of Ghiraldi is more on writing modular, larger web applications using Node.js.
* Ghiraldi is NOT just another MVC framework.  While applications are build using an MVC architecture, Ghrialdi is more interested in building reusable component blocks (called plugins).  Specifically, any application can become a plugin by naming it correctly and putting in the "plugins" directory of your application.

__So, what IS Ghiraldi?__
Ghiraldi is a modular framework for developing big web apps in node.js.  With that goal in mind, Ghiraldi was designed to encourage creating small, testable modules and connecting
them together in infinitely complex ways.  Modules, and even entire apps, are easy to re-use and re-purpose.  Modules are all self contained - even routes are defined in
the controller level of your applications.

Ghrialdi attempts to strike a balance between magic and traceability - it provides just enough magic to make development substantially faster and easier, but not 
so much that you have to find workarounds just to overcome the magical parts of the framework.

Some of its features are the following:
* MVC application architecture with plugins for extending functionality.
* All apps can become plugins - in fact, placing an app in the plugins directory with a name and version number loads it as a plugin.
* Built on Express.js and you can use any express, connect, or node.js middleware / modules with ease.
* Routes are defined at the controller-level for modular routing at the component level.
* Controllers can be written in coffee-script or javascript - just add your controller file with a .coffee extension to the controllers directory and Ghiraldi will automatically pick it up.
* Views can be written in any view technology supported by express.  The default is JADE, but you can configure any other.

# Anatomy of a Ghiraldi app
A ghiraldi app consists of three different layers:
1. The framework layer consists of the main application bootstrap code, package definition information, and a locales extension.
2. The application layer contains your application which is built on the Ghiraldi framework.
3. Within the application layer is the plugin layer.  Plugins are other applications that are bootstrapped along with your application and extend its functionality.

Structurally, all framework files are contained within the base directory.
> -v ghiraldi-framework
> --  app.js                - The core file to be run by node (ie: node app.js).  This bootstraps the framework and creates the express.js app.
> --  locales.js            - An extension that allows ghiraldi to understand languages and locales.
> --  mvc.js                - The core of the framework.  Bootstraps the entire application and handles app-wide middleware.
> --  package.json          - The node.js package description for this application.
> --  README.md             - The README markdown file for Ghiraldi (you're probably reading README now).
> --v app                   - This directory contains all of the components of your application.  Default is the Rosetta app.
> ---- > controllers        - The controllers for your application. This contains all of the logic for your application components.
> ---- > models             - The data models for your application.  Modules that represent data to be stored in a database go here.
> ---- > plugins            - The plugins that your application uses.  Each of these will most likely be git submodules for other applications you use.
> ---- > public             - The public files served by your application.  They are automatically routed to their directory names (ie: /js maps to the js directory, /img maps to the img directory, etc).
> ---- v resources          - Locale resources - this contains all of the locale strings and files for your app.
> ------- en.js              - The English-language locale strings, stored as key-value pairs.  Key is used to access a string across languages, and value is the value of that key in this language (for en.js, in english).
> ---- > tests              - Tests for your components go here.  NodeUnit is recommended, but any other testing framework should work fine.
> ---- > utils              - Utilities that aren't specific to any one component.  This is a good place for utilities that address cross-cutting concerns.
> ---- > views              - The views for your application.  Ghiraldi uses Jade by default, but you can configure it to use another.
> ---- config.json          - Your application configuration - all app configuration (and default overrides) goes here.
> ---- helpers.js           - A utility class to put app-wide middleware.

# QUICK START
Ghiraldi provides a basic starting project (called "rosetta") that provides a good starting point for your apps.  It has some of the more common and useful patterns 
for writing Ghiraldi apps, including a template you can use for controllers, models, and configuration.  Rosetta is licensed under the liberal MIT license so you can use it
as the foundation for any application you'd like to create.

#COPYRIGHT AND LICENSE
Copyright (C) 2012, John O'Connor

Ghiraldi is licensed under the Mozilla Public License (MPL) Version 2.0, found in the LICENSE file or at http://mozilla.org/MPL/2.0/. My intention in releasing Ghiraldi under MPL is to give you, the end developer, as much freedom as possible in
developing your applications while still ensuring that modifications to the Ghiraldi framework core are contributed back to the project (a "reciprocol license").