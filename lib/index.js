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
                }, function(err) {debug("metalsmith-prismic done!"); done(err)})
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
                var collectionQuery;

                // create associative array of query keys and their query & formName
                for (var queryKey in file.prismic) {
                    debug("processing %s", queryKey);
                    var queryString = file.prismic[queryKey].query;
                    var orderings = file.prismic[queryKey].orderings;
                    var pageSize = file.prismic[queryKey].pageSize;
                    var formName = file.prismic[queryKey].formName;
                    if (formName == null) {
                        formName = "everything"
                    }
                    var collectionMetaData = file.prismic[queryKey].collection;
                    if (collectionMetaData != null) {
                        if (collectionQuery != null) {
                            throw new TypeError('Only one query can be designated the collection query. Please update the configuration settings appropriately.');
                        } else if (typeof collectionMetaData != "boolean" && file.prismic[queryKey].collection.fileExtension == null) {
                            throw new TypeError('The file extension to use when generating the files for the collection must be specified.');
                        } else if (collectionMetaData === true || typeof collectionMetaData != "boolean") {
                            collectionQuery = queryKey;
                        }
                    }
                    queryKeys[queryKey] = {"queryString": queryString, "pageSize": pageSize, "orderings": orderings, "formName": formName};
                }

                // asynchronously retrieve and process each query
                each(Object.keys(queryKeys), function (currentQueryKey, queriedAndProcessedCallback) {
                    debug("%s: api.form(\"%s\").query('%s').ref(ctx.ref).submit()", queryKey, formName, queryString);
                    ctx.api.form(queryKeys[currentQueryKey].formName).query(queryKeys[currentQueryKey].queryString).pageSize(queryKeys[currentQueryKey].pageSize).orderings(queryKeys[currentQueryKey].orderings).ref(ctx.ref).submit(function(err, d) {
                        if (err) {
                            console.error(err);
                        }
                        else {
                            processRetrievedContent(d, file.prismic, currentQueryKey, ctx)
                        }

                        queriedAndProcessedCallback();
                    });
                }, function(err){if(err != null){console.log(err);}generateCollectionFiles(fileName, collectionQuery, callback, ctx)});
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

        // if any of the queries are designated the collection query, then generate a file for each of the results
        function generateCollectionFiles(fileName, collectionQuery, callback, ctx) {
            if (collectionQuery != null) {
                var file = files[fileName];
                var newFiles = {};
                var fileJson = JSON.stringify(file);
                var fileExtension = file.prismic[collectionQuery].collection.fileExtension;
                var fileSuffix = (fileExtension != undefined && fileExtension !== "")? "." + fileExtension:"";
                // for every result in the collection query
                for (var i = 0; i < file.prismic[collectionQuery].results.length; i++) {

                    // clone the file and replace the original collectionQuery results with the current result
                    var newFile = JSON.parse(fileJson);
                    newFile.prismic[collectionQuery].results = [file.prismic[collectionQuery].results[i]];

                    // use the linkResolver to generate the filename
                    newFiles[ctx.linkResolver(ctx, file.prismic[collectionQuery].results[i]) + fileSuffix] = newFile;
                }

                delete files[fileName];
                _.extend(files, newFiles)
            }

            callback();
        }

    }


    function checkProperty(object, property) {
        if ((object[property]) == null) {
            throw new TypeError('Missing property \'' + property + '\'. Please update the configuration settings appropriately.');
        }
    }
}
