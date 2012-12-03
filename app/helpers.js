/**
 * Helpers.js
 * This file contains some helper functions that have been useful to me in the past.
 * @author John O'Connor
 * @license MIT License
 * 
 * Copyright 2012, John O'Connor
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/

var _ = require('underscore');
var locales = require('../locales');
var markdown = require('markdown').markdown

var navActive = function(req, res, next) {
  res.locals.navActive = function(title, url){
    return req.url == url
      ? 'class="active">'
      : '>';
  }
};

var md = function(markdownText) {
    return markdown.toHTML(markdownText);
}

/**
 * Ordinal returns a number in ordinal form (ie: 1st, 2nd, 3rd, etc).
 * @param number the number to be ordinated.
 **/
var ordinal = function(number) {
    if (10 < number && number < 14) return number + 'th';
    switch (number % 10) {
        case 1: return number + 'st';
        case 2: return number + 'nd';
        case 3: return number + 'rd';
        default: return number + 'th';
    }
};

var helpers = function(req, res, next) {
    console.log("Using the middleware helpers");
    res.locals.x = locales.x;
    res.locals.markdown = md;
    res.locals.ordinal = ordinal;
    res.locals.request = req;
    res.locals.hasMessages = (function(req) {
        if (!req.session) {
            return false;
        } else {
            return Object.keys(req.session.flash || {}).length;
        }
    });
    res.locals.role = (function(req) {
        if (_.isNull(req.session.role) || _.isUndefined(req.session.role)) {
            return null;
        }
        return req.session.role;        
    });
    
    res.locals.messages = (function(req){
        return function(){
            var msgs = req.session.messages;
            console.log(msgs);
            /*
            return Object.keys(msgs).reduce(function(arr, type){
            return arr.concat(msgs[type]);
            }, []);
            */
            return msgs;
        };
    });
    navActive(req, res);
    next();
};

module.exports = helpers;