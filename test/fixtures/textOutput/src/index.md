---
template: index.hbt
prismic:
  macaron:
    query: '[[:d = at(document.tags, ["Macaron"])] [:d = any(document.type, ["product"])]]'
    orderings: '[my.product.name]'
    output: text
  jobOffers:
    query: '[[:d = any(document.type, ["job-offer"])]]'
    output: text
---
