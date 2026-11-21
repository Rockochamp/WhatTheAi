"""Generate every static page from seo/catalog.json: the homepage, one guide
per game, the model comparison, About, the 404 page, and the head metadata of
each edition. No build is required by the host: generated HTML is committed.

Run: python scripts/build-guides.py && python scripts/update-seo.py
"""
import json
import re
from html import escape as e
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://whatthe.ai'
CATALOG = json.loads((ROOT / 'seo/catalog.json').read_text())
ASSETS = '4'  # bump when css/site.css or js/site.js change
SHARE = '/images/whattheai-share.jpg'
REPO = 'https://github.com/Rockochamp/WhatTheAi'
NUMBERS = 'zero one two three four five six seven eight nine ten eleven twelve'.split()
FAMILIES = [('claude', 'Claude', 'Anthropic'), ('gpt', 'GPT', 'OpenAI'), ('gemini', 'Gemini', 'Google'), ('grok', 'Grok', 'xAI')]

def family(model):
    m = model.lower()
    return 'claude' if m.startswith('claude') else 'gpt' if m.startswith(('gpt', 'chatgpt')) else 'gemini' if m.startswith('gemini') else 'grok' if m.startswith('grok') else 'other'

def number(n, capital=False):
    word = NUMBERS[n] if n < len(NUMBERS) else str(n)
    return word.capitalize() if capital else word

def plural(n, word, capital=False):
    return f'{number(n, capital)} {word}{"" if n == 1 else "s"}'

VERSIONS = [(g, v) for g in CATALOG for v in g['versions']]
is_app = lambda g: not g['category'].lower().endswith('game')
verb = lambda g: 'Open' if is_app(g) else 'Play'

def meta(title, description, path, image=None, schema=None, language='en'):
    url = ORIGIN + ('/' if path == '/index.html' else path)
    locale = {'de': 'de_DE', 'de-CH': 'de_CH'}.get(language, 'en_US')
    tags = [f'<title>{e(title)}</title>', f'<meta name="description" content="{e(description, quote=True)}" />',
        f'<link rel="canonical" href="{url}" />', '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="What the Ai" />',
        f'<meta property="og:title" content="{e(title, quote=True)}" />',
        f'<meta property="og:description" content="{e(description, quote=True)}" />',
        f'<meta property="og:url" content="{url}" />',
        f'<meta property="og:locale" content="{locale}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{e(title, quote=True)}" />',
        f'<meta name="twitter:description" content="{e(description, quote=True)}" />']
    if image:
        tags += [f'<meta property="og:image" content="{ORIGIN + image}" />', f'<meta name="twitter:image" content="{ORIGIN + image}" />']
    if schema:
        tags += ['<script type="application/ld+json" id="page-structured-data">' + json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c') + '</script>']
    return '\n'.join(tags)

def breadcrumbs(name, path, parent=None):
    parts = [('What the Ai', '/')]
    if parent: parts.append(parent)
    parts.append((name, path))
    return {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':i+1,'name':n,'item':ORIGIN+p} for i,(n,p) in enumerate(parts)]}

def software(g, name, url, description, image, language='en'):
    """Schema.org description of a game or app. Facts only: no ratings, no reviews."""
    game = not is_app(g)
    out = {'@type': 'VideoGame' if game else 'WebApplication', 'name': name, 'url': ORIGIN + url, 'description': description,
           'image': ORIGIN + image.split('?')[0], 'inLanguage': language, 'isAccessibleForFree': True,
           'applicationCategory': 'GameApplication' if game else 'BrowserApplication', 'operatingSystem': 'Any (web browser)',
           'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'publisher': {'@id': ORIGIN + '/#publisher'}}
    if game:
        out.update({'genre': g['category'].replace(' game', '').strip().capitalize(), 'gamePlatform': 'Web browser', 'playMode': 'SinglePlayer'})
    return out

METHODOLOGY = """<section id="methodology"><h2>Methodology and limitations</h2>
<p>The Grokbot Edition uses one formula for every lab and for the combined total: <code>max(0, 1 − latest / peak)</code>, called the hiring-drop index. It loads live listing counts from <a href="/apps/agi_barometer/grokbot/data/listings.json">listings.json</a>, each with a source URL and retrieval time. Labs without a verified latest count show “no data” and are left out of the combined index. Earlier Q1–Q3 points come from the older editions and remain unverified.</p>
<p>The Claude Fable 5.2 edition uses the same per-lab formula and the same recorded counts. Its dial shows one minus the labs’ latest counts added together over their highest counts added together. Tapping the glass asks the public job-board feeds of OpenAI, Anthropic and xAI for today’s totals from your browser; Google DeepMind and Meta have no feed a browser can read, so they keep their recorded counts. Live readings are stored only in your browser.</p>
<p>The Gemini 3.1 Pro edition calculates <code>max(0, 100 × (1 − Q2 / Q1))</code> for each lab. The Flash edition uses <code>max(0, 100 × (1 − Q3 / max(Q1, Q2, Q3)))</code>. Its combined gauge applies the same decline-from-peak idea to the quarterly totals.</p>
<p>These formulas express a percentage decline in the stored inputs. They are not calibrated against AGI outcomes, do not establish causation and do not estimate a reliable arrival date.</p>
<p>The Flash screen originally labelled a June 22, 2026 cutoff while including Q3 2026 values. That timing is inconsistent with a completed Q3 observation. The values remain unchanged for reproducibility; their provenance and timing are unverified.</p>
<h3>Stored inputs, not a live feed</h3><div class="table-wrap"><table><caption>Values embedded in the source; Q1 and Q2 are shared by both editions.</caption><thead><tr><th scope="col">Lab label</th><th scope="col">Q1</th><th scope="col">Q2</th><th scope="col">Q3 (Flash)</th></tr></thead><tbody><tr><th scope="row">OpenAI</th><td>452</td><td>660</td><td>712</td></tr><tr><th scope="row">Anthropic</th><td>309</td><td>431</td><td>374</td></tr><tr><th scope="row">DeepMind</th><td>102</td><td>92</td><td>25</td></tr><tr><th scope="row">xAI</th><td>285</td><td>247</td><td>211</td></tr></tbody></table></div>
<p>Before using this as a research dashboard, the dataset needs dated source URLs, an explanation of how listings were counted, consistent observation windows and a way to distinguish open roles from actual hires. Neither version currently supplies those things.</p></section>"""

THEME_SCRIPT = """<script>
(() => {
  let saved;
  try { saved = localStorage.getItem("darkMode"); } catch {}
  const dark = saved === "true" || (saved !== "false" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark-mode", dark);
})();
</script>"""
ANALYTICS = """<!-- Cloudflare Web Analytics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"7e23bb1be08e4d83bb66013aab939d1e"}'></script>
"""
PLAY_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.6 6z" /></svg>'
TOGGLE = '<button class="theme-toggle" id="darkModeToggle" type="button" aria-label="Switch to dark mode" aria-pressed="false" hidden><svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" /></svg><svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg></button>'

def shell(head, body, current='', analytics=False, footer_more=True, path=''):
    links = [('/#games', 'Games and apps'), ('/models.html', 'Compare models'), ('/about.html', 'About')]
    nav = ''.join('<a href="%s"%s>%s</a>' % (href, ' aria-current="page"' if href == current else '', label) for href, label in links)
    more = ''.join('<li><a href="%s">%s</a></li>' % (g['hub'], e(g['name'])) for g in CATALOG if g['hub'] != path)
    more = '<nav aria-label="All games and apps"><h2>All games and apps</h2><ul>%s</ul></nav>' % more if footer_more else ''
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#eef0f7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0c0e1c" media="(prefers-color-scheme: dark)" />
{head}
<link rel="icon" type="image/x-icon" href="/images/favicon.ico?v=1.2" />
<link rel="preload" href="/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
{THEME_SCRIPT}
<link rel="stylesheet" href="/css/site.css?v={ASSETS}" />
<script defer src="/js/site.js?v={ASSETS}"></script>
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>
<header class="site-header">
<a class="brand" href="/" aria-label="What the Ai home"><img id="spin-emoji" src="/images/favicon.ico?v=1.2" alt="" width="30" height="30" /><span class="visually-hidden">What the Ai</span><span id="dynamic-title" aria-hidden="true">What the Ai</span></a>
<nav aria-label="Main">{nav}</nav>
{TOGGLE}
</header>
<main id="content" tabindex="-1">
{body}
</main>
<footer class="site-footer">
{more}
<div class="foot-line"><p>© <span id="copyright-year">2026</span> What the Ai. Made and maintained by <a href="https://github.com/Rockochamp">Rockochamp</a>.</p><p><a href="/about.html">About and data use</a> <a href="/models.html">Compare models</a> <a href="{REPO}">Source on GitHub</a> <a href="https://jam.pieter.com" target="_blank" rel="noopener noreferrer">Vibe Jam 2025<span class="visually-hidden"> (opens in a new tab)</span></a></p></div>
</footer>
{ANALYTICS if analytics else ''}</body>
</html>
"""

def page(title, description, path, body, image=None, extra=None, kind='CollectionPage', current='', crumb=None):
    name = crumb or title.split(' | ')[0]
    schema = {'@context':'https://schema.org','@graph':[
        {'@type':kind,'@id':ORIGIN+path+'#page','url':ORIGIN+path,'name':title,'description':description,'inLanguage':'en','isPartOf':{'@id':ORIGIN+'/#website'}, **(extra or {})},
        breadcrumbs(name,path)]}
    crumbs = f'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>{e(name)}</span></nav>\n'
    return shell(meta(title, description, path, image, schema), crumbs + body, current=current, path=path)

def chips(g, labelled_by):
    out = []
    for i, v in enumerate(g['versions']):
        out.append('<li><a class="%s" href="%s" data-thumb="%s">%s%s</a></li>' % ('chip first' if i == 0 else 'chip', v['path'], e(v['thumb'], quote=True), PLAY_ICON if i == 0 else '', e(v['model'])))
    return f'<ul class="versions" aria-labelledby="{labelled_by}">' + ''.join(out) + '</ul>'

def shot(v):
    return '<a class="shot" href="%s" tabindex="-1" aria-hidden="true"><img src="%s" alt="" width="480" height="480" loading="lazy" decoding="async" /></a>' % (v['path'], e(v['thumb'], quote=True))

def family_groups():
    groups = [(key, label, maker, [(g, v) for g, v in VERSIONS if family(v['model']) == key]) for key, label, maker in FAMILIES]
    groups = [f for f in groups if f[3]]
    names = [label for _, label, _, _ in groups]
    return groups, ', '.join(names[:-1]) + ' and ' + names[-1]

def home():
    groups, listed = family_groups()
    title = 'What the Ai — Free AI-Built Browser Games, Compared by Model'
    description = f'Play {number(len(CATALOG))} free browser games and apps, each built by several AI models: {listed}. No download, no account. Pick a version and compare.'
    star = max(CATALOG, key=lambda g: len({v['thumb'] for v in g['versions']}))
    seen, strip = set(), []
    for v in star['versions']:
        if v['thumb'] in seen: continue
        seen.add(v['thumb'])
        strip.append('<li><a href="%s"><img src="%s" alt="" width="480" height="480" decoding="async" /><span>%s</span></a></li>' % (v['path'], e(v['thumb'], quote=True), e(v['model'])))
    cards = []
    for i, g in enumerate(CATALOG):
        first = g['versions'][0]
        n = len(g['versions'])
        cards.append(f"""<article class="game-item" data-game-id="{g['id']}" style="--c: {g['color']}">
<a class="game-link" id="game-link-{g['id']}" href="{first['path']}" tabindex="-1" aria-hidden="true"><span class="thumbnail"><img src="{e(first['thumb'], quote=True)}" alt="" width="480" height="480" decoding="async" loading="{'eager' if i < 3 else 'lazy'}" /></span></a>
<p class="kind">{e(g['category'])}</p>
<h2 class="game-title">{e(g['name'])}</h2>
<p class="game-description">{e(g['card'])}</p>
<p class="built" id="built-{g['id']}">Built {'once' if n == 1 else 'twice' if n == 2 else number(n) + ' times'}. Pick a version:</p>
{chips(g, 'built-%d' % g['id'])}
<a class="guide-link" href="{g['hub']}">How to {'use it' if is_app(g) else 'play'} and how the versions differ</a>
</article>""")
    fam = ''.join('<li><a href="/models.html#%s"><strong>%s</strong><span>%s across %s</span></a></li>' % (key, label, plural(len(items), 'edition', True), plural(len({g['id'] for g, _ in items}), 'title')) for key, label, _, items in groups)
    body = f"""<section class="hero" aria-labelledby="catalog-title">
<div class="hero-text">
<h1 id="catalog-title">The same games, built by different AIs</h1>
<p class="lead">What the Ai is a free arcade of browser games and small apps. Each idea was handed to several AI models, mostly as a single prompt, and every version they built is here to play.</p>
<p class="facts">{number(len(CATALOG), True)} titles, {len(VERSIONS)} versions, {number(len(groups))} model families. Nothing to download and no account.</p>
<p class="hero-links"><a class="button" href="#games">Browse the games</a><a href="/models.html">Compare by model</a></p>
</div>
<figure class="strip" style="--c: {star['color']}">
<figcaption><a href="{star['hub']}">{e(star['name'])}</a>, one game as {number(len(strip))} models built it</figcaption>
<ol>{''.join(strip)}</ol>
</figure>
</section>
<section class="grid" id="games" aria-label="Games and apps">
{chr(10).join(cards)}
</section>
<section class="families" aria-labelledby="families-title">
<h2 id="families-title">Compare by model</h2>
<p>Every edition carries the name of the model that built it. See everything one model family made, next to the others.</p>
<ul>{fam}</ul>
</section>
<section class="answers" aria-labelledby="answers-title">
<h2 id="answers-title">Good to know</h2>
<div>
<h3>Is it free?</h3>
<p>Yes. Every game and app opens in your browser, on a phone or a computer. There is nothing to install and no account to make.</p>
<h3>What does “built by an AI model” mean here?</h3>
<p>The code of each edition, and usually its artwork and sound, was generated by the model named on it. Most started from a single prompt; some were refined with follow-up requests. The labels describe the editions in this collection. They are not benchmark scores.</p>
<h3>Which version should I try first?</h3>
<p>The first one listed under each title is the newest. Each guide, such as the one for <a href="{CATALOG[0]['hub']}">{e(CATALOG[0]['name'])}</a>, explains the controls and what the other versions do differently.</p>
<h3>Are scores and posts shared?</h3>
<p>Some games have a shared leaderboard and the opinion board is public, so a nickname, score or post can be seen by other visitors. Everything else stays in your browser. <a href="/about.html">Read about data use</a>.</p>
<h3>Can I read the code?</h3>
<p>All of it is public in the <a href="{REPO}">GitHub repository</a>, one folder per edition.</p>
</div>
</section>"""
    head = meta(title, description, '/index.html', SHARE)
    head = head.replace('<meta property="og:image"', '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n<meta property="og:image"', 1)
    # scripts/update-seo.py fills this in from the cards above
    head += '\n<script type="application/ld+json" id="site-structured-data">{}</script>'
    (ROOT/'index.html').write_text(shell(head, body, analytics=True, footer_more=False))

def guide(g):
    versions = g['versions']
    app = is_app(g)
    n = len(versions)
    rows = ''.join('<li>%s<div><h3><a href="%s">%s</a></h3><p>%s</p></div></li>' % (shot(v), v['path'], e(v['model']), e(v['detail'])) for v in versions)
    methodology = METHODOLOGY if g['id'] == 6 else ''
    body = f"""<section class="hero guide-hero" style="--c: {g['color']}"><div class="hero-text"><p class="kind">{e(g['category'])}, built {'once' if n == 1 else 'twice' if n == 2 else number(n) + ' times'}</p><h1>{e(g['name'])}</h1><p class="lead">{e(g['summary'])}</p><p class="hero-links"><a class="button" href="{versions[0]['path']}">{PLAY_ICON}{verb(g)} the {e(versions[0]['model'])} edition</a><a href="#versions">Compare all versions</a></p></div><figure class="cover"><img src="{e(g['image'], quote=True)}" alt="" width="960" height="960" decoding="async" /></figure></section>
<section class="overview"><h2>What is {e(g['name'])}?</h2><p>{e(g['intro'])}</p></section>
<section id="versions" style="--c: {g['color']}"><h2>Choose a version</h2><p>Each one opens that edition directly. These describe the implementations in this collection; they are not rankings of the underlying AI models.</p><ol class="version-list">{rows}</ol></section>
<div class="columns"><section><h2>{'How to use it' if app else 'How to play'}</h2><ol>{''.join('<li>'+e(x)+'</li>' for x in g['controls'])}</ol></section><section><h2>{'Before you begin' if app else 'A few useful tips'}</h2>{''.join('<p>'+e(x)+'</p>' for x in g['tips'])}</section></div>
{methodology}
<section><h2>Free to try in your browser</h2><p>No installation or account is needed. The interactive {'board needs JavaScript and an internet connection' if g['id']==4 else 'experience needs JavaScript'}. Browser storage and network access may be used for preferences, records or shared features. <a href="/about.html">Read about the project and its data use</a>.</p><p class="byline">Guide maintained by <a href="https://github.com/Rockochamp">Rockochamp</a>. Updated {e(g.get('updated', 'October 2, 2026'))}. <a href="{REPO}/tree/main{g['hub'].rsplit('/',1)[0]}">View this title’s source</a>.</p></section>"""
    extra = {'about': software(g, g['name'], g['hub'], g['summary'], g['image']),
             'mainEntity': {'@type':'ItemList','numberOfItems':n,'itemListElement':[{'@type':'ListItem','position':i+1,'name':g['name']+' — '+v['model'],'url':ORIGIN+v['path']} for i,v in enumerate(versions)]}}
    (ROOT/g['hub'].lstrip('/')).write_text(page(g['name']+' Guide & Versions | What the Ai', g['summary']+' Learn the controls and choose a model version.', g['hub'], body, g['image'], extra, crumb=g['name']))

def editions():
    """Metadata only: every edition's scripts, styles and body stay exactly as they are."""
    for g, v in VERSIONS:
        path = ROOT/v['path'].lstrip('/')
        content = path.read_text()
        head, body = content.split('</head>', 1)
        head = re.sub(r'<title\b[^>]*>[\s\S]*?</title>\s*', '', head, flags=re.I)
        head = re.sub(r'<meta\b(?=[^>]*(?:name\s*=\s*[\'\"](?:description|twitter:[^\'\"]+)[\'\"]|property\s*=\s*[\'\"]og:[^\'\"]+[\'\"]))[^>]*>\s*', '', head, flags=re.I)
        head = re.sub(r'<link\b(?=[^>]*rel\s*=\s*[\'\"]canonical[\'\"])[^>]*>\s*', '', head, flags=re.I)
        # Replace JSON-LD only, never executable scripts.
        head = re.sub(r'<script\b[^>]*type=[\'\"]application/ld\+json[\'\"][^>]*>[\s\S]*?</script>\s*', '', head, flags=re.I)
        lang = v.get('language', 'de' if v['path']=='/games/BananaSurvivors/game.html' else 'en')
        title = g['name']+' — '+v['model']+' | What the Ai'
        image = v.get('image', g['image'])
        entity = software(g, g['name']+' — '+v['model'], v['path'], v['description'], image, lang)
        entity['isPartOf'] = {'@type':'CollectionPage','@id':ORIGIN+g['hub']+'#page','name':g['name'],'url':ORIGIN+g['hub']}
        schema = {'@context':'https://schema.org','@graph':[entity, breadcrumbs(v['model'], v['path'], (g['name'], g['hub']))]}
        head = head.rstrip()+'\n'+meta(title, v['description'], v['path'], image, schema, lang)+'\n'
        path.write_text(head+'</head>'+body)

def models():
    groups, listed = family_groups()
    head_cells = ''.join(f'<th scope="col"><a href="#{key}">{label}</a></th>' for key, label, _, _ in groups)
    rows = ''
    for g in CATALOG:
        cells = ''
        for key, _, _, _ in groups:
            mine = [v for v in g['versions'] if family(v['model']) == key]
            cells += '<td>' + (''.join('<a href="%s">%s</a>' % (v['path'], e(v['model'])) for v in mine) or '<span class="none">none</span>') + '</td>'
        rows += '<tr style="--c: %s"><th scope="row"><a href="%s">%s</a><span>%s</span></th>%s</tr>' % (g['color'], g['hub'], e(g['name']), e(g['category']), cells)
    sections = ''
    for key, label, maker, items in groups:
        labels = sorted({v['model'] for _, v in items})
        lis = ''.join('<li style="--c: %s">%s<div><h3><a href="%s">%s</a></h3><p class="kind">%s</p><p>%s</p></div></li>' % (g['color'], shot(v), v['path'], e(g['name']), e(v['model']), e(v['detail'])) for g, v in items)
        sections += f'<section id="{key}" class="family"><h2>{label} editions</h2><p>{plural(len(items), "edition", True)} in this collection {"carries" if len(items) == 1 else "carry"} a {label} label ({maker}): {e(", ".join(labels))}.</p><ol class="version-list">{lis}</ol></section>\n'
    body = f"""<section class="hero plain"><div class="hero-text"><h1>Compare AI models by the games they built</h1><p class="lead">{number(len(CATALOG), True)} ideas, {len(VERSIONS)} playable editions, grouped by the model family that wrote them: {listed}. Open two versions of the same game and see what each model made of it.</p></div></section>
<section aria-labelledby="matrix-title"><h2 id="matrix-title">Every title by model family</h2><div class="table-wrap"><table class="matrix"><thead><tr><th scope="col">Title</th>{head_cells}</tr></thead><tbody>{rows}</tbody></table></div>
<p class="note">The model names are the labels each edition carries in this collection. Editions can include later edits and follow different rules, so this is not a controlled same-prompt test, a benchmark or an endorsement by any model provider. <a href="/about.html">How to compare fairly</a>.</p></section>
{sections}"""
    extra = {'mainEntity': {'@type':'ItemList','numberOfItems':len(VERSIONS),'itemListElement':[{'@type':'ListItem','position':i+1,'name':g['name']+' — '+v['model'],'url':ORIGIN+v['path']} for i,(g,v) in enumerate(VERSIONS)]}}
    (ROOT/'models.html').write_text(page('Compare AI Models by the Games They Built | What the Ai', f'See what {listed} each made of the same game ideas: {len(VERSIONS)} free, playable browser editions listed by model family.', '/models.html', body, SHARE, extra, current='/models.html', crumb='Compare models'))

def about():
    by_id = {g['id']: g for g in CATALOG}
    eg = lambda i, text: '<a href="%s">the %s %s</a>' % (by_id[i]['hub'], number(len(by_id[i]['versions'])), text)
    body = f"""<section class="hero plain"><div class="hero-text"><h1>Small ideas, different AI takes</h1><p class="lead">What the Ai is a free collection of AI-built browser games and apps, maintained by Rockochamp. It exists to make one thing easy: playing what different models built from the same idea.</p><p class="hero-links"><a class="button" href="/#games">Browse the collection</a><a href="/models.html">Compare by model</a></p></div></section>
<section><h2>What you can try</h2><p>The collection holds {number(len(CATALOG))} titles in {len(VERSIONS)} editions: arcade, rhythm, strategy, survival, racing and adventure games, a life simulation, an anonymous discussion board and an experimental dashboard. Choose a model name to open its edition, or read a guide to compare controls and features first.</p><p>The model names describe the editions as labelled in this repository. They are not independent benchmark scores, endorsements by model providers or evidence that one model is universally better. Versions can include later edits and different rules; do not assume a controlled same-prompt comparison.</p></section>
<section><h2>Who is behind it?</h2><p><a href="https://github.com/Rockochamp">Rockochamp</a> maintains the project and its public <a href="{REPO}">GitHub repository</a>. You can inspect the code, read the history and <a href="{REPO}/issues">report a bug or suggest an improvement</a>. The guides describe features present in the code and are updated alongside the collection.</p><p>AI-generated artwork and music are part of the experiments too. Several game folders document their artwork, sound and implementation in their README files.</p></section>
<section><h2>Playing, storage and public contributions</h2><p>The games and apps are free to open without an account. JavaScript powers their interactive features. Browser storage can retain preferences, drafts, votes or scores on your device; clearing it can reset those features.</p><p>Some games use Firebase for shared rankings. The opinion board uses it for public posts, replies and votes. Nicknames, scores and contributions can be visible to other visitors. Avoid posting private or identifying information. The homepage includes Cloudflare Web Analytics, and some editions load fonts or libraries from external services.</p><p>Scoreboards are casual, client-driven features. They are not verified competition results. The <a href="/apps/agi_barometer/index.html#methodology">AGI Barometer’s fixed inputs and assumptions</a> should be read before interpreting its gauges.</p></section>
<section><h2>How to compare fairly</h2><p>Try the same type of task in each edition: a short survival run, a ten-year reign or a conversation thread. Compare the clarity of controls, feedback and recovery from mistakes. Different mechanics and separate leaderboards mean raw scores are often not directly comparable.</p><p>For concrete differences, start with {eg(1, 'Cosmic Dodge editions')}, {eg(5, 'combat styles of Banana Survivors')} or {eg(4, 'interfaces for Yes! I Said It.')} The <a href="/models.html">model comparison</a> lists every edition by model family.</p></section>"""
    (ROOT/'about.html').write_text(page('About What the Ai | AI Games & Browser Experiments', 'Meet the What the Ai project: free AI-built games and apps maintained by Rockochamp. Learn how versions differ, inspect the source and understand shared features.', '/about.html', body, SHARE, kind='AboutPage', current='/about.html', crumb='About'))

def not_found():
    picks = ''.join('<li><a href="%s">%s</a></li>' % (g['hub'], e(g['name'])) for g in CATALOG)
    body = f"""<section class="hero plain"><div class="hero-text"><h1>That page is not here</h1><p class="lead">The address may have changed, or the game may have moved to a new edition. Everything that exists is one step from the homepage.</p><p class="hero-links"><a class="button" href="/">Go to the games</a><a href="/models.html">Compare by model</a></p></div></section>
<section><h2>All titles</h2><ul class="plain-list">{picks}</ul></section>"""
    head = '<title>Page not found | What the Ai</title>\n<meta name="robots" content="noindex" />'
    (ROOT/'404.html').write_text(shell(head, body, footer_more=False))

def build():
    home()
    for g in CATALOG: guide(g)
    editions()
    models()
    about()
    not_found()
    print(f'Built the homepage, {len(CATALOG)} guides, model comparison, About, 404 and metadata for {len(VERSIONS)} versions.')

if __name__=='__main__': build()
