# Search visibility and maintenance

## What the site tells a search engine

What the Ai is a free arcade of browser games and small apps in which each idea was built several times by different AI models. Every page says so in plain text:

- **Homepage** (`/`): one `h1`, a paragraph stating what the site is, and one block per title with its category, a one-line description and an ordinary link to every edition, labelled with the model's name. Below that, a "Compare by model" section and five short answers to the questions people ask first (is it free, what "built by an AI model" means, which version to try, what is shared, where the code is).
- **Guides** (`/games/<title>/index.html`, `/apps/<title>/index.html`): what the title is, every edition with its artwork and a description of how it differs, controls and tips.
- **Model comparison** (`/models.html`): a table of every title against the four model families (Claude, GPT, Gemini, Grok) and a section per family listing its editions. This is the page for searches such as "games made by Claude" or "GPT vs Gemini game".
- **About** (`/about.html`): who maintains the project, data use, and how to compare fairly.
- **Editions**: each keeps its own page, with a unique title, description, canonical URL, Open Graph and Twitter tags.

Structured data states facts only. The homepage carries `WebSite`, `Organization` and a `CollectionPage` with an `ItemList` of the guides. Each guide is a `CollectionPage` about a `VideoGame` or `WebApplication` (free, runs in a web browser) with an `ItemList` of its editions and a `BreadcrumbList`. Each edition is a `VideoGame` or `WebApplication` with a `BreadcrumbList`. There are no ratings, reviews or awards, because none exist.

`sitemap.xml` lists the homepage, About, the model comparison, every guide and every edition. `robots.txt` allows crawling and points to the sitemap. `/index.html` and query variants resolve to the canonical `https://whatthe.ai/`. `404.html` is marked `noindex`. The unlisted school app stays out of the catalogue and the sitemap.

Every link works without JavaScript. Scripts only add the theme switch, the typing brand and thumbnail previews.

## Performance

One stylesheet (`css/site.css`) and one deferred script (`js/site.js`) serve the homepage, guides, model comparison and About. Two fonts are self-hosted from `/fonts` with `font-display: swap`; the display font is preloaded. Thumbnails live in `images/thumbs/`, at most 480 pixels wide, WebP. All images carry explicit dimensions; images below the first row load lazily. Nothing here is a claim about measured field Core Web Vitals.

## Updating the catalogue

`seo/catalog.json` is the single source for the homepage, guides, model comparison, About and every edition's metadata.

1. Edit `seo/catalog.json`. A title needs `id`, `name`, `hub`, `category`, `summary`, `card` (the line on the homepage), `color` (the block behind its artwork), `intro`, `controls`, `tips`, `image` and `versions`. A version needs `model`, `path`, `thumb`, `detail` and `description`, and may set `image` and `language`. The first version listed is the default. Describe what the code does; do not invent features.
2. Run `python scripts/build-guides.py`. It writes `index.html`, the guides, `models.html`, `about.html`, `404.html` and the head metadata of each edition. Edition scripts, styles and bodies are never touched. The page templates live in this script.
3. Run `python scripts/update-seo.py`. It fills in the homepage's structured data from the cards and rebuilds `sitemap.xml` with modification dates from Git.
4. Run `python tests/seo_test.py` and `node --test tests/*.test.mjs`, then look at the homepage and a guide in a browser, in light and dark mode and at phone width.
5. Commit the generated HTML and the sitemap. The host needs no build step.

Model families are worked out from the start of the model label (`Claude…`, `GPT…`/`ChatGPT…`, `Gemini…`, `Grok…`) in `family()` in the build script. When changing `css/site.css` or `js/site.js`, bump `ASSETS` in the build script so browsers fetch the new files. The share image `images/whattheai-share.jpg` (1200×630) is a screenshot of the homepage hero; retake it when the hero changes.

## What only the site owner can do

- **Google Search Console.** Nothing in this repository can verify the domain or submit a sitemap. In the verified property, submit `https://whatthe.ai/sitemap.xml`, request indexing for the homepage and `/models.html`, and check the Page indexing and Enhancements reports after the next crawl. Bing Webmaster Tools accepts the same sitemap.
- **Cache.** After a deploy, check both `/` and `/index.html`; a cached root can lag behind. Purging needs the hosting or CDN account.
- **Measurement.** Record impressions, clicks and average position for the homepage before and after, over equal date ranges. Rankings, rich results and indexing are never guaranteed.
- **Analytics.** Cloudflare Web Analytics is on the homepage only, as before. Adding it to guides is a one-line change in `shell()` if wanted; the About page's data-use paragraph should then be updated to match.

References: [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
