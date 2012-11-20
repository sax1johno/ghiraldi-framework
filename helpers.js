var _ = require('underscore');
var locales = require('./locales');
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