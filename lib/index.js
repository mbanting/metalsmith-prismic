'use strict';

var each        = require('async').each
var Prismic     = require('prismic.io').Prismic
var debug       = require('debug')('metalsmith-prismic')
var _           = require('underscore')
var clone       = require('clone')
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

                // user release as reference if no reference found
                if (!ref) {
                  ref = release || 'master';
                }

                // setup the context object
                ctx.api = api;
                ctx.linkResolver = getLinkResolver(ctx);
                ctx.htmlSerializer = config['htmlSerializer'] || function() {};
                ctx.ref = ref;
                ctx.OAuth = config['accessToken'];

                each(Object.keys(files), function (fileName, callback) {
                    retrieveContentForFile(fileName, callback, ctx)
                }, function(err) {debug("metalsmith-prismic done!"); done(err)})
            }
        }

        function getLinkResolver(ctx) {
            return function(doc, isBroken) {
                if (config['linkResolver'] != undefined) {
                    return config['linkResolver'](ctx, doc);
                } else {
                    if (isBroken) return false;
                    return '/' + doc.type + '/' + doc.id + '/' + doc.slug + (ctx.maybeRef ? '?ref=' + ctx.maybeRef : '');
                }
            }
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
                    file.prismic[queryKey].results = [];
                    var queryString = file.prismic[queryKey].query;
                    var bookmark = file.prismic[queryKey].bookmark;
                    var orderings = file.prismic[queryKey].orderings;
                    var fetchLinks = file.prismic[queryKey].fetchLinks;
                    var pageSize = file.prismic[queryKey].pageSize;
                    var allPages = file.prismic[queryKey].allPages;
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
                    queryKeys[queryKey] = {"queryString": queryString,
                                           "bookmark": bookmark,
                                           "pageSize": pageSize,
                                           "allPages": allPages,
                                           "orderings": orderings,
                                           "fetchLinks": fetchLinks,
                                           "formName": formName};
                }

                // asynchronously retrieve and process each query
                each(Object.keys(queryKeys), function (currentQueryKey, queriedAndProcessedCallback) {
                    debug("%s: api.form(\"%s\").query('%s').ref(ctx.ref).submit()", queryKey, formName, queryString);
                    var totalPages;
                    var page = 1;

                    if (queryKeys[currentQueryKey].queryString) {
                        // fetch by query
                        queryNextPage();
                    } else if (queryKeys[currentQueryKey].bookmark) {
                        // fetch by bookmark
                        var bookmarkID = ctx.api.bookmarks[queryKeys[currentQueryKey].bookmark];
                        if (bookmarkID) {
                            ctx.api.getByID(bookmarkID, {}, prismicBookmarkCallback);
                        } else {
                            // Missing bookmark, leave data empty
                            queriedAndProcessedCallback();
                        }
                    } else {
                        throw new TypeError('Must specify either query or bookmark');
                    }

                    function queryNextPage() {
                        ctx.api.form(queryKeys[currentQueryKey].formName)
                            .query(queryKeys[currentQueryKey].queryString)
                            .pageSize(queryKeys[currentQueryKey].pageSize)
                            .page(page)
                            .orderings(queryKeys[currentQueryKey].orderings)
                            .fetchLinks(queryKeys[currentQueryKey].fetchLinks)
                            .ref(ctx.ref).submit(prismicQueryCallback);
                    }

                    function prismicQueryCallback(err, d) {
                        if (err) {
                            queriedAndProcessedCallback(err);
                        }
                        else {
                            processRetrievedContent(d, file.prismic, currentQueryKey, ctx);
                            totalPages = d.total_pages;
                            if (queryKeys[currentQueryKey].allPages &&
                                page < totalPages) {
                                page++;
                                queryNextPage();
                            } else {
                                queriedAndProcessedCallback();
                            }
                        }
                    }

                    function prismicBookmarkCallback(err, d) {
                        if (err) {
                            queriedAndProcessedCallback(err);
                        } else {
                            file.prismic[currentQueryKey] = processRetrievedDocument(d, file.prismic, currentQueryKey, ctx);
                            queriedAndProcessedCallback();
                        }
                    }

                }, function(err){
                    if(err != null) {
                        console.log(err);
                        callback(err);
                        return;
                    }
                    generateCollectionFiles(fileName, collectionQuery, callback, ctx);
                });
            } else {
                callback();
            }
        }

        // processes the retrieved content and adds it to the metadata
        function processRetrievedContent(content, filePrismicMetadata, queryKey, ctx) {
            if (content.results != null && content.results.length > 0) {
                var queryMetadata = filePrismicMetadata[queryKey];
                for (var i = 0; i < content.results.length; i++) {
                    var result = processRetrievedDocument(content.results[i], filePrismicMetadata, queryKey, ctx);
                    filePrismicMetadata[queryKey].results.push(result);
                }
            }
        }

        // processes and return single retrieved document
        function processRetrievedDocument(document, filePrismicMetadata, queryKey, ctx) {
            // add the complete result except for the data fragments
            var result = _.omit(document, 'fragments');
            result.data = {};

            // process the data fragments, invoking helpers to make the data more usable
            if (document.fragments != null && Object.keys(document.fragments).length  > 0) {
                for (var fragmentFullName in document.fragments) {

                    // strip the document type from the fragment name
                    var fragmentName = fragmentFullName.substr(fragmentFullName.lastIndexOf('.') + 1);

                    var fragment = document.fragments[fragmentFullName];
                    result.data[fragmentName] = processSingleFragment(fragment, ctx, filePrismicMetadata[queryKey]);
                }
            }

            return result;
        }

        // process a single fragment, and return the fragment object with json and html data
        function processSingleFragment(fragment, ctx, queryMetadata) {
          // return array fragments (link[0], link[1], ... named fragments) as arrays if arrayFragments are enabled
          if (Array.isArray(fragment)) {
            if (queryMetadata.arrayFragments) {
              return fragment.map(function(subFragment) {
                return processSingleFragment(subFragment, ctx, queryMetadata);
              });
            } else {
              // only return first element of array
              if (fragment.length) {
                return processSingleFragment(fragment[0], ctx, queryMetadata);
              } else {
                // only return one element of empty array, lets say that is null
                return null;
              }
            }
          }

          // initialize Prismic fragment javascript wrapper, unless already initialized
          if (!fragment.asHtml) {
            fragment = Prismic.Fragments.initField(fragment);
          }
          var fragmentObject = {
            json: fragment
          };

          if (!queryMetadata.output || queryMetadata.output.indexOf('html') > -1) {
            fragmentObject.html = fragment.asHtml(ctx.linkResolver, ctx.htmlSerializer);
          }

          if (queryMetadata.output && queryMetadata.output.indexOf('text') > -1) {
            //  https://github.com/prismicio/javascript-kit/issues/104
            if (!(fragment instanceof Prismic.Fragments.SliceZone) && !(fragment instanceof Prismic.Fragments.SliceZone)) {
              fragmentObject.text = fragment.asText(ctx.linkResolver);
            }
          }

          // Add child fragments
          if (fragment instanceof Prismic.Fragments.DocumentLink && fragment.document.data) {
            // from document links
            fragmentObject.children = _.mapObject(fragment.document.data[fragment.type], function(subFragment) {
              if (subFragment.type) {
                return processSingleFragment(subFragment, ctx, queryMetadata);
              } else {
                // some document link subfragments aren't proper fragments
                // for example StructuredText isn't supported
                // we can't really do anything else than return the raw data
                return {
                  json: subFragment
                };
              }
            });
          } else if (fragment instanceof Prismic.Fragments.Group) {
            // from groups
            fragmentObject.children = _.map(fragment.toArray(), function(group) {
              return _.mapObject(group.fragments, function(subFragment) {
                return processSingleFragment(subFragment, ctx, queryMetadata);
              });
            });
          } else if (fragment instanceof Prismic.Fragments.SliceZone) {
            // TODO
            fragmentObject.children = _.map(fragment.value, function(sliceFragment) {
              var subFragmentObject = processSingleFragment(sliceFragment.value, ctx, queryMetadata);
              subFragmentObject.sliceType = sliceFragment.sliceType;
              subFragmentObject.sliceLabel = sliceFragment.label;
              return subFragmentObject;
            });
          }

          return fragmentObject;
        }

        // if any of the queries are designated the collection query, then generate a file for each of the results
        function generateCollectionFiles(fileName, collectionQuery, callback, ctx) {
            if (collectionQuery != null) {
                var file = files[fileName];
                var newFiles = {};
                var fileExtension = file.prismic[collectionQuery].collection.fileExtension;
                var fileSuffix = (fileExtension != undefined && fileExtension !== "")? "." + fileExtension:"";
                // for every result in the collection query
                for (var i = 0; i < file.prismic[collectionQuery].results.length; i++) {

                    // clone the file and replace the original collectionQuery results with the current result
                    var newFile = clone(file);
                    newFile.prismic[collectionQuery].results = [file.prismic[collectionQuery].results[i]];

                    // add the filename to the ctx object to make it available for use in the linkResolver function
                    ctx.path = fileName;

                    // use the linkResolver to generate the filename removing the leading slash if present
                    newFiles[(ctx.linkResolver(file.prismic[collectionQuery].results[i]) + fileSuffix).replace(/^\//g, '')] = newFile;
                }

                delete files[fileName];
                _.extend(files, newFiles);
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
