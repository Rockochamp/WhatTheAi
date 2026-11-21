whatthe.ai gives you a chance to play almost only singel prompt Ai generated browser games 100% free - no login required!

## How the site is put together

The homepage, the guides, the model comparison and the About page are generated from `seo/catalog.json` by `python scripts/build-guides.py` followed by `python scripts/update-seo.py`. There is no build step on the host; the generated HTML is committed. See [SEO.md](SEO.md) for the details and for what to do in Google Search Console.

Tests: `node --test tests/*.test.mjs` and `python tests/seo_test.py`.
