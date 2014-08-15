var equal = require('assert-dir-equal');
var Metalsmith = require('metalsmith');
var prismic = require('..');
var templates = require('metalsmith-templates');
var ignore = require('metalsmith-ignore');

describe('metalsmith-prismic', function(){
    it('should retrieve content from Prismic', function(done){
        Metalsmith('test/fixtures/basic')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api"
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars",
                "directory": "src/templates"    // templates need to be in src so they can be watched
            }))

            // do not include templating files into build
            .use(ignore('templates/*'))

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/basic/expected', 'test/fixtures/basic/build');
                done();
            });
    });
});



// Used for debugging purposes only
function log() {
    return function (files, metalsmith, done){
        for (var file in files) {
            if (files[file].prismic != null) {
                console.log("%s: %s", file, JSON.stringify(files[file]))
            }
        }
        done();
    };
}
