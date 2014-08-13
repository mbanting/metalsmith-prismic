'use strict';

var each        = require('async').each
var Prismic     = require('prismic.io').Prismic
var debug       = require('debug')('metalsmith-prismic')
var _           = require('underscore')

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin to retrieve content from Prismic.io and place in the file's metadata.
 *
 * @param {Object} options
 *   @property {String} url
 *   @property {String} accessToken (optional)
 * @return {Function}
 */

function plugin(config) {

    checkProperty(config, 'url');

    return function(files, metalsmith, done){
        // initialize the API
        Prismic.Api(config['url'], retrieveContent, config['accessToken']);

        function retrieveContent(err, api) {
            if (err) {
                console.error("Could not initialize API: " + err);
            }
            else {

                // obtain the reference
                var release = config['release'];
                var ref;
                var ctx = {};
                for (var currentRef in api.data.refs) {
                    if ((!release || release.toLowerCase() == "master") && (api.data.refs[currentRef].isMaster)) {
                        ref = api.data.refs[currentRef].ref;
                    }
                    else if (release == api.data.refs[currentRef].label) {
                        ref = api.data.refs[currentRef].ref;
                    }
                }
                // obtain the linkResolver
                var lr;
                if (config['linkResolver'] != undefined) {
                    lr = config['linkResolver'];
                } else {
                    lr = linkResolver;
                }

                // setup the context object
                ctx.api = api;
                ctx.linkResolver = lr;
                ctx.ref = ref;
                ctx.OAuth = config['accessToken'];

                each(Object.keys(files), function (fileName, callback) {
                    retrieveContentForFile(fileName, callback, ctx)
                }, function() {debug("metalsmith-prismic done!"); done()})
            }
        }

        function linkResolver(ctx, doc) {
            if (doc.isBroken) return false;
            return '/' + doc.type + '/' + doc.id + '/' + doc.slug + (ctx.maybeRef ? '?ref=' + ctx.maybeRef : '');
        }

        // retrieves and processes the content for the given filename
        function retrieveContentForFile(fileName, callback, ctx) {
            var file = files[fileName];
            if (file.prismic) {
                debug("Pulling in content for file: %s", fileName);
                var queryKeys = {};

                // create associative array of query keys and their query & formName
                for (var queryKey in file.prismic) {
                    debug("processing %s", queryKey);
                    var queryString = file.prismic[queryKey].query;
                    var formName = file.prismic[queryKey].formName;
                    if (formName == null) {
                        formName = "everything"
                    }
                    queryKeys[queryKey] = {"queryString": queryString, "formName": formName};
                }

                // asynchronously retrieve and process each query
                each(Object.keys(queryKeys), function (currentQueryKey, queriedAndProcessedCallback) {
                    debug("%s: api.form(\"%s\").query('%s').ref(ctx.ref).submit()", queryKey, formName, queryString);
                    ctx.api.form(queryKeys[currentQueryKey].formName).query(queryKeys[currentQueryKey].queryString).ref(ctx.ref).submit(function(err, d) {
                        if (err) {
                            console.error(err);
                        }
                        else {
                            processRetrievedContent(d, file.prismic, currentQueryKey, ctx)
                        }

                        queriedAndProcessedCallback();
                    });
                }, callback);
            } else {
                callback();
            }
        }

        // processes the retrieved content and adds it to the metadata
        function processRetrievedContent(content, filePrismicMetadata, queryKey, ctx) {
            var results = [];
            if (content.results != null && content.results.length > 0) {
                for (var i = 0; i < content.results.length; i++) {

                    // add the complete result except for the data fragments
                    var result = _.omit(content.results[i], 'fragments');
                    result.data = {}

                    // process the data fragments, invoking helpers to make the data more usable
                    if (content.results[i].fragments != null && Object.keys(content.results[i].fragments).length  > 0) {
                        for (var fragmentFullName in content.results[i].fragments) {

                            // strip the document type from the fragment name
                            var fragmentName = fragmentFullName.substr(fragmentFullName.lastIndexOf('.') + 1);
                            result.data[fragmentName] = {};
                            result.data[fragmentName].json = content.results[i].get(fragmentFullName);
                            result.data[fragmentName].html = content.results[i].get(fragmentFullName).asHtml(ctx);
                        }
                    }
                    results.push(result);
                }
            }
            filePrismicMetadata[queryKey].results = results;
        }

    }

    function checkProperty(object, property) {
        if ((object[property]) == null) {
            throw new TypeError('Missing property \'' + property + '\'. Please update the configuration settings appropriately.');
        }
    }
}

