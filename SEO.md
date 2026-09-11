# Search visibility and homepage performance

The public homepage stays at `https://whatthe.ai/`. Its canonical tag consolidates `/index.html` and cache-busting query variants under that URL. The site title, description and social text now describe the actual free browser games and apps. JSON-LD identifies the WebSite name and the six-card collection, without invented reviews, ratings or rich-result claims.

`sitemap.xml` contains the homepage and all ten game/app model destinations linked from its catalog, including Astra Hammurabi. It uses canonical URLs without cache-busting queries and actual content commit dates. Unlisted apps, images, scripts and test files are excluded. The existing `robots.txt` already permits crawling and points to this sitemap; it remains valid and unchanged.

The AGI Barometer thumbnail is now served as a visually equivalent 177,850-byte WebP instead of the 907,420-byte PNG (80.4% smaller). The original PNG remains in the repo. The homepage keeps fixed image dimensions, deferred JavaScript, lazy loading below the first cards, and a static HTML catalog.

## Keep it current

After adding or changing a catalog entry, run `python scripts/update-seo.py`. It reads the actual card names and destinations, updates JSON-LD only when the catalog changes, and rebuilds the sitemap. Check the output into the same release as the catalog edit. No service or scheduled job is required.

## Search Console

The sitemap is advertised through robots.txt for crawler discovery. It has not been submitted through an authenticated Google Search Console account in this task. Search Console can show indexing status, search impressions, clicks, and Core Web Vitals after Google processes the site. Rankings and indexing are not guaranteed by metadata or a sitemap.

References: [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [site-name structured data](https://developers.google.com/search/docs/appearance/site-names), [page experience](https://developers.google.com/search/docs/appearance/page-experience).
