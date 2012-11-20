
var index = function(req, res) {
    res.render('index.jade', {title: 'Ghiraldi'});
};

module.exports = {
    routes: [
        { 
            verb: 'get',
            route: '/',
            method: index
        }
    ]
}