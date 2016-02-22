# metalsmith-prismic [![Build Status](https://travis-ci.org/mbanting/metalsmith-prismic.svg?branch=master)](https://travis-ci.org/mbanting/metalsmith-prismic)

A Metalsmith.io plugin to pull in content from [Prismic.io]


## Installation

    $ npm install --save metalsmith-prismic

## Configuration

### CLI Usage

  Install the node modules and add `metalsmith-prismic` to your list of plugins in `metalsmith.json`. Include the
- `url` (eg. https://lesbonneschoses.prismic.io/api) of your Prismic.io repository.
- `accessToken` is optional, depending if your repository needs it or not.
- `release` the name or raw reference of the release you want to generate; if none specified then master release will be generated
- `linkResolver` an optional function to generate links or the path of a generated collection of files; if none specified then a default format of "/&lt;document.type&gt;/&lt;document.id&gt;/&lt;document.slug&gt;" will be used


```json
{
  "plugins": {
    "metalsmith-prismic": {
      "url": "<your repository's API url>",
      "accessToken": "<optional accessToken>",
      "release": "<optional release name or raw reference value>",
    }
  }
}
```

### Javascript Usage

  Instead of using the CLI, you can configure your Metalsmith.io project to use the metalsmith-prismic plugin via Javascript.

```js
var prismic = require('metalsmith-prismic');

// pull in content from Prismic
.use(prismic({
    "url": "<your repository's API url>",
    "accessToken": "<optional access token>",
    "release": "<optional release name or raw reference value>",
    "linkResolver": <optional linkResolver function>
}))
```

## Usage

Pulling in content from the site's repository in [Prismic.io] for display is a two step process.

In your file's metadata add the Prismic queries and optional orderings, pageSize, arrayFragments, and fetchLinks parameters
```yaml
---
template: index_en.hbt
prismic:
  page-header-footer:
    query: '[[:d = at(document.type, "page-header-footer")]]'
  hero-slide:
    query: '[[:d = at(document.type, "hero-slide")]]'
    orderings: '[my.hero-slide.seqNum]'
    pageSize: 50
    arrayFragments: true
  blog:
    query: '[[:d = at(document.type, "blog")]]'
    allPages: true
    formName: 'tech-related'
---
```
###### query
The required `query` parameter specifies the query to run, following the [Prismic's predicate-based query syntax](https://developers.prismic.io/documentation/api-documentation#predicate-based-queries).

###### orderings
The optional `orderings` parameter specifies how the results should be ordered, following the [Prismic's ordering syntax](https://developers.prismic.io/documentation/api-documentation#orderings).

###### pageSize & allPages
The optional `pageSize` parameter specifies the maximum number of results to retrieve for the query. The default is based on Prismic's own default of 20 items. Prismic also caps the maximum results for each query at 100. Any pageSize set above this number will be ignored by Prismic.

To get around this limitation and retrieve all results, use the optional `allPages` parameter and set it to true. Doing so will force the plugin to override the `pageSize` and get all results by repeatedly executing the query against Prismic, combining all paged results.

###### arrayFragments
Prismic has an undocumented feature where fragments named like location[0], location[1] and so on, will be returned as an array in the request response. By default, only the first one will be returned. To get an array of all the fragments, use the optional `arrayFragments` parameter and set to true.

###### formName
By default the query runs against the _everything_ Prismic form. To run against a different form (eg. a collection), provide the `formName` (eg. collection name)

This pulls the Prismic response into the file's metadata.

```yaml
---
  template: "index_en.hbt"
  prismic:
    page-header-footer:
      query: "[[:d = at(document.type, \"page-header-footer\")]]"
      results:
        -
          id: <id>
          type: "page-header-footer"
          href: <url>
          tags: []
          slug: "home"
          slugs:
            - "home"
          linkedDocuments: []
          data:
            homeLabel_en:
              json:
                value: "Home"
              html: "<span>Home</span>"
            videoLabel_en:
              json:
                value: "Video"
              html: "<span>Video</span>"
            prizesLabel_en:
              json:
                value: "Prizes"
              html: "<span>Prizes</span>"
            newsLabel_en:
              json:
                value: "News"
              html: "<span>News</span>"
            qcLabel_en:
              json:
                value: "Questions/Comments"
              html: "<span>Questions/Comments</span>"
    hero-slide:
      query: "[[:d = at(document.type, \"hero-slide\")]]"
      orderings: "[my.hero-slide.seqNum]"
      results:
        -
          id: <id>
          type: "hero-slide"
          href: <url>
          tags: []
          slug: "welcome-to-our-website"
          slugs:
            - "welcome"
            - "welcome-to-our-website"
          linkedDocuments: []
          data:
            title_en:
              json:
                blocks:
                  -
                    type: "heading1"
                    text: "Introducing our new site!"
                    spans: []
              html: "<h1>Introducing our new site!</h1>"
            introduction_en:
              json:
                blocks:
                  -
                    type: "paragraph"
                    text: "Welcome to our new site, generated by Metalsmith.io with content from Prismic!"
                    spans: []
                  -
                    type: "paragraph"
                    text: "Why? Because the two combined is a sweet combo"
                    spans: []
              html: "<p>Welcome to our new site, generated by Metalsmith.io with content from Prismic!</p><p>Why? Because the two combined is a sweet combo</p>"
  contents: []
  mode: "0644"

---
```

###### fetchLinks
Prismic supports fetching data from nested documents through links using the Prismic `fetchLinks` query parameter. You can use this specify the nested content to be retrieved with this plugin as well.
```yaml
---
template: index.hbt
prismic:
  jobOffers:
    query: '[[:d = any(document.type, ["job-offer"])]]'
    arrayFragments: true
    fetchLinks: 'store.name,store.address,product.name'
---
```

##### Generating a Collection of Files
You'll often need to generate a collection of files from a collection of documents, such as blog posts. This can be achieved with the `collection` property designating that data binding to generate one file for every document in the query's result.
```yaml
---
template: blog-post.hbt
prismic:
  blog-post:
    query: '[[:d = at(document.type, "blog-post")]]'
    collection: true
  page-header-footer:
    query: '[[:d = at(document.type, "header")]]'
---
```
In the example above, the query for the blog-post returns a collection of results (ie. a collection of blog posts). Because it's been designated as the collection to generate, a file for each blog post will be created, with each file containing the metadata for a single blog post. The results for all other queries, such as for the page-header-footer in the example above, will also be available for each of these generated files. At most one data binding can be designated as the collection for each source file.

The location of these files will be determined by the `linkResolver` function, which, as mentioned above, can be overridden with your own function to determine the path in which these files are created in. In addition, the filename of the source will be injected into the `ctx.path` property so you can use it in your `linkResolver` function.
```js
"linkResolver": function (ctx, doc) {
    if (doc.isBroken) return;
    // create file based off of type, id and the filename (extracted from the full path)
    return '/' + doc.type + '/' + doc.id + '/' +  ctx.path.replace(/^.*(\\|\/|\:)/, '');
}
```

As mentioned above, if no `linkResolver` function is provided the default one will be used, generating links with the default format of "/&lt;document.type&gt;/&lt;document.id&gt;/&lt;document.slug&gt;". This  will generate files with no file extension. To specify one, the `collection` can be further customized with the `fileExtension` property.
```yaml
---
template: blog-post.hbt
prismic:
  blog-post:
    query: '[[:d = at(document.type, "blog-post")]]'
    collection:
      fileExtension: 'html'
  page-header-footer:
    query: '[[:d = at(document.type, "header")]]'
---
```
The example above will append a .html file extension to each generated blog-post file.

##### Displaying Content
Now that this content from Prismic is available in the file's metadata, you can display it by using the [metalsmith-templates] plugin. For example, here is how to do it with the plugin's [Handlebars] engine.

```html
<div>
    <ul>
        <li><a href="#intro">{{{ prismic.page-header-footer.results.[0].data.homeLabel_en.html }}}</a></li>
        <li><a href="#video">{{{ prismic.page-header-footer.results.[0].data.videoLabel_en.html }}}</a></li>
        <li><a href="#prizes">{{{ prismic.page-header-footer.results.[0].data.prizesLabel_en.html }}}</a></li>
        <li><a href="#news">{{{ prismic.page-header-footer.results.[0].data.newsLabel_en.html }}}</a></li>
        <li><a href="#comments">{{{ prismic.page-header-footer.results.[0].data.qcLabel_en.html }}}</a></li>
    </ul>
</div>
<div>
    {{{prismic.blog-post.results.[0].data.title.html}}}
    {{{prismic.blog-post.results.[0].data.author.html}}}
    {{{prismic.blog-post.results.[0].data.post.html}}}
</div>
```

## To Do
- This plugin is still early in development and has only been tested with a limited set of Prismic queries and predicates. If anything isn't working please let me know!
- Mock out Prismic for unit tests, and for integration tests switch to this project's own Prismic repository instead of using the default one

## License

  MIT

[Prismic.io]:https://prismic.io/
[metalsmith-templates]:https://github.com/segmentio/metalsmith-templates
[Handlebars]:http://handlebarsjs.com/
