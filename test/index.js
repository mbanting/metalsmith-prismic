var equal = require('assert-dir-equal');
var Metalsmith = require('metalsmith');
var prismic = require('..');
var templates = require('metalsmith-templates');
var beautify = require('metalsmith-beautify');

describe('metalsmith-prismic', function(){
    it('should retrieve content from Prismic', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/basic')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api"
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/basic/expected', 'test/fixtures/basic/build');
                done();
            });
    });

    it('should generate links with the custom linkResolver', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/linkResolver')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api",
                "linkResolver": function (ctx, doc) {
                    if (doc.isBroken) return false;
                    return '/' + doc.type + '/' + doc.slug + (ctx.maybeRef ? '?ref=' + ctx.maybeRef : '');
                }
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/linkResolver/expected', 'test/fixtures/linkResolver/build');
                done();
            });
    });

    it('should generate multiple files from the results of the collection prismic query', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/collection')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api"
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/collection/expected', 'test/fixtures/collection/build');
                done();
            });
    });

    it('should generate multiple files from the results of the collection prismic query using a custom linkResolver', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/collection-linkResolver')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api",
                "linkResolver": function (ctx, doc) {
                    if (doc.isBroken) return false;
                    return '/' + doc.type + '/' + doc.slug + (ctx.maybeRef ? '?ref=' + ctx.maybeRef : '');
                }
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/collection-linkResolver/expected', 'test/fixtures/collection-linkResolver/build');
                done();
            });
    });

    it.skip('should not allow more than one query to be a collection prismic query', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/collection-invalid')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api"
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                done();
            });
    });

    it('should retrieve max number of documents specified by pageSize', function(done){
        this.timeout(5000);
        Metalsmith('test/fixtures/pageSize')
            .use(prismic({
                "url": "http://lesbonneschoses.prismic.io/api"
            }))

            //.use (log())

            // use Handlebars templating engine to insert content
            .use(templates({
                "engine": "handlebars"
            }))

            .use (beautify())

            .build(function(err){
                if (err) return done(err);
                equal('test/fixtures/pageSize/expected', 'test/fixtures/pageSize/build');
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
