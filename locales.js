/**
 * Locales.js is a locale manager for the Ghiraldi framework.  It checks the Accept-Language request header
 * and attempts to use the language string found there.  It defaults to generic english (although this can be overridden
 * in the app configuration).
 * 
 * Locales are defined in the resources/<lang>.json file, where <lang> is the language code.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. 
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * 
 * Copyright (C) 2012, John O'Connor
 * 
 **/
var _ = require('underscore'),
    defaultLocale = 'en',
    appPlugin = 'app',
    vsprintf = require('sprintf').vsprintf,
    translationObject = {},
    markdown = require('markdown').markdown;


/**
 * Set the locale objects that will store string keys and translations.  This must be done at least once (preferably 
 * during app initialization).
 * @param object the object representing the strings and keys.
 * @param locale the locale to contain this object.
 * @param plugin the plugin to which this string belongs.  Defaults to 'app'.
**/
var setLocale = function(object, locale, plugin) {
    if (_.isNull(locale) || _.isUndefined(locale)) {
        locale = defaultLocale;
    }
    if (_.isNull(plugin) || _.isUndefined(plugin)) {
        plugin = appPlugin;
    }
    if (_.isNull(translationObject[plugin]) || _.isUndefined(translationObject[plugin])) {
        translationObject[plugin] = {};
        translationObject[plugin][locale] = {};
    }
    translationObject[plugin][locale] = object;
}

/**
 * Translates using the default plugins and locales.  This allow us to create a shortcut in the app view for translating that
 * is simplified for the common case.  ie: x('hello') would translate "hello" using the default locale and app plugin.
 * @param key the key to look up for translation.
 * @param plural if true, return the plural form.  if false or null, return the singular form. defaults to false.
 * @param args an array of optional arguments to be used in variable substition in the string.
 **/
var translateDefaults = function(key, args, plural) {
//    console.log("Translate defaults: " + key);
    return translate(key, null, null, plural, args);
}

/**
 * Get the translation of key with the locale set in the request object.
 * @param key the key to look up for translation.
 * @param request the request object containing the users' locale.
 * @param plugin, the plugin namespace for the translation.  Defaults to 'app'.
 * @param plural if true, return the plural form.  if false, return the singular form. Defaults to false.
 * @param args an array of optional arguments to be used in variable substitition in the string.
 * @return the translated string.
 **/
var translate = function(key, request, plugin, plural, args) {
    if (_.isNull(request) || _.isUndefined(request)) {
        request = {locale: defaultLocale};
    }
    if (_.isNull(plugin) || _.isUndefined(plugin)) {
        plugin = appPlugin
    }
    if (_.isNull(request.locale) || _.isUndefined(request.locale)) {
        request.locale = defaultLocale;
    }
    if (_.isNull(args) || _.isUndefined(args)) {
        args = [];
    }
//    console.log("request = " + JSON.stringify(request));
//    console.log("plugin = " + plugin);
//    console.log("locale = " + request.locale);
//    console.log("args = " + JSON.stringify(args));
    if (!_.isNull(plural) && !_.isUndefined(plural) && plural) {
//        console.log("Printing plural");
        var xlation = vsprintf(getPluralTranslation(key, request.locale, plugin), args);
//        xlation = markdown.toHTML(xlation);
//        console.log(xlation);
        return xlation;
    } else {
//        console.log("Printing singular");
        var xlation = vsprintf(getSingularTranslation(key, request.locale, plugin), args);
//        xlation = markdown.toHTML(xlation);
//        console.log(xlation);
        return xlation;
    }
}

/** 
 * Returns the singular translation of a string.  If the translation return is an object, the 'one' key is returned.
 * If it's an array, the first index is returned.  If it's a plain string, that string is returned.
 * @return the singluar translated string.
 **/
var getSingularTranslation = function(key, locale, plugin) {
    var translation = getTranslation(key, locale, plugin);
    if(_.isObject(translation)) {
        if (!_.isArray(translation)) {
            return translation.one;
        } else {
            return translation[0];
        }
    } else if (_.isString(translation)) {
        return translation;
    }
}

/**
 * Returns the plural translation of a string.  If the translation return is an object, the 'others' key is returned.
 * If it's an array, the second index is returned.  If it's a plain string, that string is returned.
 * @return the plural translated string.
 **/
var getPluralTranslation = function(key, locale, plugin) {
    var translation = getTranslation(key, locale, plugin);
    if(_.isObject(translation)) {
        if (!_.isArray(translation)) {
            return translation.other;
        } else {
            return translation[1];
        }
    } else if (_.isString(translation)) {
        return translation;
    }
}

/**
 * Get the translation of the key with the specified locale in the specified plugin.
 * @param key the key to look up for translation.
 * @param locale the locale, defaults to 'default'
 * @param plugin, the plugin namespace for the translation.  Defaults to 'app'.
 * @return the translated string.
 **/
var getTranslation = function(key, locale, plugin) {
    if (_.isNull(translationObject[plugin]) || 
        _.isUndefined(translationObject[plugin]) || 
        _.isNull(translationObject[plugin][locale]) || 
        _.isUndefined(translationObject[plugin][locale])
        ) {
        return ''
    }
    
    if (_.isNull(translationObject[plugin][locale][key]) || _.isUndefined(translationObject[plugin][locale][key])) {
        if (locale == defaultLocale) {
            return '';
        } else {
            return getTranslation(key, defaultLocale, plugin);
        }
    } else {
        return translationObject[plugin][locale][key];
    }
};

var init = function (request, response, next) {
  if (typeof request === 'object') {
    guessLanguage(request);
  }
  if (typeof next === 'function') {
    next();
  }
};

function guessLanguage(request) {
  if (typeof request === 'object') {
    var language_header = request.headers['accept-language'],
        languages = [],
        regions = [];

    request.languages = [defaultLocale];
    request.regions = [defaultLocale];
    request.language = defaultLocale;
    request.region = defaultLocale;

    if (language_header) {
      language_header.split(',').forEach(function (l) {
        var header = l.split(';', 1)[0];
        var lr = header.split('-', 2);
        if (lr[0]) {
          languages.push(lr[0].toLowerCase());
        }
        if (lr[1]) {
          regions.push(lr[1].toLowerCase());
        }
      });

      if (languages.length > 0) {
        request.languages = languages;
        request.language = languages[0];
      }

      if (regions.length > 0) {
        request.regions = regions;
        request.region = regions[0];
      }
    }
    
    defaultLocale = request.language;
  }
}

/**
 * Exports the following methods:
 * defaultLocale: the default locale - can be overridden in the app.
 * appPlugin: The name of the folder for this application - use only if the app folder has been changed.
 * xlate: The verbose translate method.
 * x: The default translate method that uses the current language and app plugin. Use this unless you need to do something custom.
 * setLocale: Sets the current locale.
 * TranslationObject: Can use this to get the object that stores all of the locales available in this framework (including
 *                      from plugins).  Typically used for debugging.
 * init: alize the locales.js extension.
 **/
module.exports = {
    defaultLocale: defaultLocale,
    appPlugin: appPlugin,
    xlate: translate,
    x: translateDefaults,
    setLocale: setLocale,
    translationObject: translationObject,
    init: init
}