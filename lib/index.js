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
                each(Object.keys(files), function (fileName, callback) {
                    retrieveContentForFile(fileName, callback, api)
                }, function() {debug("metalsmith-prismic done!"); done()})
            }
        }

        // retrieves and processes the content for the given filename
        function retrieveContentForFile(fileName, callback, api) {
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
                    debug("%s: api.form(\"%s\").query('%s').ref(api.master()).submit()", queryKey, formName, queryString);
                    api.form(queryKeys[currentQueryKey].formName).query(queryKeys[currentQueryKey].queryString).ref(api.master()).submit(function(err, d) {
                        if (err) {
                            console.error(err);
                        }
                        else {
                            processRetrievedContent(d, file.prismic, currentQueryKey)
                        }

                        queriedAndProcessedCallback();
                    });
                }, callback);
            } else {
                callback();
            }
        }

        // processes the retrieved content and adds it to the metadata
        function processRetrievedContent(content, filePrismicMetadata, queryKey) {
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
                            result.data[fragmentName].html = content.results[i].get(fragmentFullName).asHtml();
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

