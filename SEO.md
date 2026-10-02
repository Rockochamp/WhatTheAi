# Search visibility and maintenance

The public catalogue now links to six static guides, all fifteen model editions and an About page. `sitemap.xml` contains 23 canonical URLs. `/index.html` and homepage query variants retain the canonical `https://whatthe.ai/`; game cache parameters are excluded from their canonical URLs. The unlisted school app remains outside the catalogue and sitemap.

Every listed edition has a unique title and description, canonical, Open Graph/Twitter metadata and descriptive JSON-LD. The homepage describes the collection and points its structured list to the guides. The guides provide actual controls, implementation differences, public source links and related experiences. Structured data contains no invented ratings, reviews or awards.

All versions are ordinary HTML links in the homepage's native “All versions” disclosures, available with or without JavaScript. The existing play links, model dropdowns, game engines, records, local storage keys and discussion backend are preserved. GPT-6.1 Sol Medium remains the default Yes! I Said It. edition and Gemini 2.5 Pro remains selectable.

The AGI guides and dashboard copy explain that the stored inputs are unverified examples and the formulas are not calibrated AGI probabilities. Calculations, numeric inputs and interactive controls remain unchanged. No source provenance was invented for those numbers.

## Performance

Catalogue thumbnails live in `images/thumbs/`, resized to at most 480 pixels and encoded as WebP at quality 78. The five raster images on the default homepage total 289,278 bytes, down from 1,440,030 bytes (79.9% smaller). The Sol SVG remains 718 bytes. All 12 thumbnail variants total 413,036 bytes, down from 1,839,546 bytes. Original images and in-game assets remain intact. Explicit image dimensions, deferred homepage JavaScript and existing lazy loading are preserved. These byte savings are not a claim of measured field Core Web Vitals.

## Updating the catalogue

1. Update `seo/catalog.json` with descriptions grounded in the implementation, controls and real model routes. Keep the homepage cards/options consistent.
2. Run `python scripts/build-guides.py`. It generates the six guides, About page and per-version head metadata, preserving executable scripts, styles and bodies. The guides and About text templates live in this script.
3. Run `python scripts/update-seo.py` to update homepage JSON-LD and the sitemap. It reads actual card links, uses guide destinations for the catalogue, and uses content modification dates from Git.
4. Run `python tests/seo_test.py` and `node --test tests/*.test.mjs`. Check the homepage model options, mobile layout, guide links and any changed app in a browser.
5. Commit the generated HTML and sitemap. Hosting needs no new build step or dependencies.

For new thumbnails, use the same WebP settings and update both the homepage image and its option's `data-thumbnail`. Metadata uses the original social-preview artwork. Bump the homepage CSS query when changing its styles.

## Search Console and production follow-up

`robots.txt` allows crawling and advertises the sitemap. Authenticated Google Search Console access is not available through this repository connection; no domain verification or sitemap submission has been claimed. In the verified domain property, submit `https://whatthe.ai/sitemap.xml`, inspect the homepage and representative guides, then monitor indexing, impressions, clicks and Core Web Vitals. Record a baseline and compare equivalent date ranges after Google recrawls.

Check both `/` and `/index.html` after deployment: a previously cached root response can lag behind the current HTML file. A hosting/CDN cache purge requires the relevant hosting account. Do not add provider-specific redirects or headers without confirming the host. Rankings, rich results and indexing are not guaranteed.

References: [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
