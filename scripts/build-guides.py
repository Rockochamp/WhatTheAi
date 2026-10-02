"""Generate static guides and per-version head metadata from seo/catalog.json.
No build is required by the host: generated HTML is committed to the repo.
"""
import json
import re
from html import escape as e
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://whatthe.ai'
CATALOG = json.loads((ROOT / 'seo/catalog.json').read_text())

def meta(title, description, path, image=None, schema=None, language='en'):
    url = ORIGIN + path
    tags = [f'<title>{e(title)}</title>', f'<meta name="description" content="{e(description, quote=True)}" />',
        f'<link rel="canonical" href="{url}" />', '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="What the Ai" />',
        f'<meta property="og:title" content="{e(title, quote=True)}" />',
        f'<meta property="og:description" content="{e(description, quote=True)}" />',
        f'<meta property="og:url" content="{url}" />',
        f'<meta property="og:locale" content="{"de_DE" if language == "de" else "en_US"}" />',
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

def page(title, description, path, body, image=None, extra=None, kind='CollectionPage'):
    schema={'@context':'https://schema.org','@graph':[
        {'@type':kind,'@id':ORIGIN+path+'#page','url':ORIGIN+path,'name':title,'description':description,'inLanguage':'en','isPartOf':{'@id':ORIGIN+'/#website'}, **(extra or {})},
        breadcrumbs(title.split(' | ')[0],path)]}
    return f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
{meta(title, description, path, image, schema)}
<link rel="icon" href="/images/favicon.ico" /><link rel="stylesheet" href="/css/guides.css?v=1" />
</head><body>
<a class="skip-link" href="#content">Skip to content</a>
<header class="site-header"><a class="brand" href="/">What the Ai<span>Play. Explore. Compare.</span></a><nav aria-label="Main navigation"><a href="/#game-grid">Games &amp; apps</a><a href="/about.html">About the project</a></nav></header>
<main id="content"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true"> / </span><span>{e(title.split(' | ')[0])}</span></nav>
{body}
</main><footer><p>Made and maintained by <a href="https://github.com/Rockochamp">Rockochamp</a>. <a href="https://github.com/Rockochamp/WhatTheAi">Explore the source on GitHub</a>.</p><p>More to try: {' · '.join(f'<a href="{g["hub"]}">{e(g["name"])}</a>' for g in CATALOG if g['hub'] != path)}</p></footer>
</body></html>
'''

def build():
    for g in CATALOG:
        versions=g['versions']
        links=''.join(f'<tr><th scope="row"><a href="{v["path"]}">{e(v["model"])}</a></th><td>{e(v["detail"])}</td></tr>' for v in versions)
        methodology=''
        if g['id']==6:
            methodology='''<section id="methodology"><h2>Methodology and limitations</h2>
<p>The Gemini 3.1 Pro edition calculates <code>max(0, 100 × (1 − Q2 / Q1))</code> for each lab. The Flash edition uses <code>max(0, 100 × (1 − Q3 / max(Q1, Q2, Q3)))</code>. Its combined gauge applies the same decline-from-peak idea to the quarterly totals.</p>
<p>These formulas express a percentage decline in the stored inputs. They are not calibrated against AGI outcomes, do not establish causation and do not estimate a reliable arrival date.</p>
<p>The Flash screen originally labelled a June 22, 2026 cutoff while including Q3 2026 values. That timing is inconsistent with a completed Q3 observation. The values remain unchanged for reproducibility; their provenance and timing are unverified.</p>
<h3>Stored inputs, not a live feed</h3><div class="table-wrap"><table><caption>Values embedded in the source; Q1 and Q2 are shared by both editions.</caption><thead><tr><th scope="col">Lab label</th><th scope="col">Q1</th><th scope="col">Q2</th><th scope="col">Q3 (Flash)</th></tr></thead><tbody><tr><th scope="row">OpenAI</th><td>452</td><td>660</td><td>712</td></tr><tr><th scope="row">Anthropic</th><td>309</td><td>431</td><td>374</td></tr><tr><th scope="row">DeepMind</th><td>102</td><td>92</td><td>25</td></tr><tr><th scope="row">xAI</th><td>285</td><td>247</td><td>211</td></tr></tbody></table></div>
<p>Before using this as a research dashboard, the dataset needs dated source URLs, an explanation of how listings were counted, consistent observation windows and a way to distinguish open roles from actual hires. Neither version currently supplies those things.</p></section>'''
        body=f'''<section class="hero"><p class="eyebrow">{e(g['category'])} · {len(versions)} versions</p><h1>{e(g['name'])}</h1><p class="lead">{e(g['summary'])}</p><a class="play-button" href="{versions[0]['path']}">{'Open' if g['id'] in (4,6) else 'Play'} {e(versions[0]['model'])} <span aria-hidden="true">↗</span></a><a class="secondary" href="#versions">Compare all versions</a></section>
<section class="overview"><h2>What is {e(g['name'])}?</h2><p>{e(g['intro'])}</p></section>
<div class="columns"><section><h2>{'How to use it' if g['id'] in (4,6) else 'How to play'}</h2><ol>{''.join('<li>'+e(x)+'</li>' for x in g['controls'])}</ol></section><section><h2>{'Before you begin' if g['id'] in (4,6) else 'A few useful tips'}</h2>{''.join('<p>'+e(x)+'</p>' for x in g['tips'])}</section></div>
<section id="versions"><h2>Choose a version</h2><p>Each link opens that edition directly. These are descriptions of the implementations in this project, not rankings of the underlying AI models.</p><div class="table-wrap"><table><thead><tr><th scope="col">Version</th><th scope="col">What to expect</th></tr></thead><tbody>{links}</tbody></table></div></section>
{methodology}
<section><h2>Free to try in your browser</h2><p>No installation or account is needed. The interactive {'board needs JavaScript and an internet connection' if g['id']==4 else 'experience needs JavaScript'}. Browser storage and network access may be used for preferences, records or shared features. <a href="/about.html">Read about the project and its data use</a>.</p><p class="byline">Guide maintained by <a href="https://github.com/Rockochamp">Rockochamp</a> · Updated October 2, 2026 · <a href="https://github.com/Rockochamp/WhatTheAi/tree/main{g['hub'].rsplit('/',1)[0]}">View this experience’s source</a></p></section>'''
        extra={'mainEntity':{'@type':'ItemList','numberOfItems':len(versions),'itemListElement':[{'@type':'ListItem','position':i+1,'name':g['name']+' — '+v['model'],'url':ORIGIN+v['path']} for i,v in enumerate(versions)]}}
        (ROOT/g['hub'].lstrip('/')).write_text(page(g['name']+' Guide & Versions | What the Ai',g['summary']+' Learn the controls and choose a model version.',g['hub'],body,g['image'],extra))
        for v in versions:
            path=ROOT/v['path'].lstrip('/')
            content=path.read_text()
            head,body=content.split('</head>',1)
            # Metadata only: preserve all scripts/styles and the game body exactly.
            head=re.sub(r'<title\b[^>]*>[\s\S]*?</title>\s*','',head,flags=re.I)
            head=re.sub(r'<meta\b(?=[^>]*(?:name\s*=\s*[\'\"](?:description|twitter:[^\'\"]+)[\'\"]|property\s*=\s*[\'\"]og:[^\'\"]+[\'\"]))[^>]*>\s*','',head,flags=re.I)
            head=re.sub(r'<link\b(?=[^>]*rel\s*=\s*[\'\"]canonical[\'\"])[^>]*>\s*','',head,flags=re.I)
            # Replace JSON-LD only, never executable scripts.
            head=re.sub(r'<script\b[^>]*type=[\'\"]application/ld\+json[\'\"][^>]*>[\s\S]*?</script>\s*','',head,flags=re.I)
            lang='de' if v['path']=='/games/BananaSurvivors/game.html' else 'en'
            title=g['name']+' — '+v['model']+' | What the Ai'
            entity={'@type':'VideoGame' if g['category'].endswith('game') else 'WebApplication','name':g['name']+' — '+v['model'],'url':ORIGIN+v['path'],'description':v['description'],'inLanguage':lang,'isAccessibleForFree':True}
            schema={'@context':'https://schema.org','@graph':[entity,breadcrumbs(v['model'],v['path'],(g['name'],g['hub']))]}
            head=head.rstrip()+'\n'+meta(title,v['description'],v['path'],g['image'],schema,lang)+'\n'
            path.write_text(head+'</head>'+body)
    about='''<section class="hero"><p class="eyebrow">The project</p><h1>Small ideas. Different AI takes.</h1><p class="lead">What the Ai is a free collection of AI-built browser games and apps, maintained by Rockochamp.</p><a class="play-button" href="/#game-grid">Explore the collection ↗</a></section>
<section><h2>What you can try</h2><p>The collection includes arcade, rhythm, strategy and survival games, an anonymous discussion board and an experimental dashboard. Choose a model label to open its implementation, or read a guide to compare the controls and features first.</p><p>The model names describe the editions as labelled in this repository. They are not independent benchmark scores, endorsements by model providers or evidence that one model is universally better. Versions can include later edits and different rules; do not assume a controlled same-prompt comparison.</p></section>
<section><h2>Who is behind it?</h2><p><a href="https://github.com/Rockochamp">Rockochamp</a> maintains the project and its public <a href="https://github.com/Rockochamp/WhatTheAi">GitHub repository</a>. You can inspect the code, read the history and <a href="https://github.com/Rockochamp/WhatTheAi/issues">report a bug or suggest an improvement</a>. The guides describe features present in the code and are updated alongside the collection.</p><p>AI-generated artwork and music are part of the experiments too. Several game folders document their artwork, sound and implementation in their README files.</p></section>
<section><h2>Playing, storage and public contributions</h2><p>The games and apps are free to open without an account. JavaScript powers their interactive features. Browser storage can retain preferences, drafts, votes or scores on your device; clearing it can reset those features.</p><p>Some games use Firebase for shared rankings. The opinion board uses it for public posts, replies and votes. Nicknames, scores and contributions can be visible to other visitors. Avoid posting private or identifying information. The site also includes Cloudflare Web Analytics, and some editions load fonts or libraries from external services.</p><p>Scoreboards are casual, client-driven features. They are not verified competition results. The <a href="/apps/agi_barometer/index.html#methodology">AGI Barometer’s fixed inputs and assumptions</a> should be read before interpreting its gauges.</p></section>
<section><h2>How to compare fairly</h2><p>Try the same type of task in each edition: a short survival run, a ten-year reign or a conversation thread. Compare the clarity of controls, feedback and recovery from mistakes. Different mechanics and separate leaderboards mean raw scores are often not directly comparable.</p><p>For concrete differences, start with <a href="/games/cosmic_dodge/index.html">the four Cosmic Dodge editions</a>, <a href="/games/BananaSurvivors/index.html">Banana Survivors’ three combat styles</a> or <a href="/apps/yes_i_said_it/index.html">the two interfaces for Yes! I Said It.</a></p></section>'''
    (ROOT/'about.html').write_text(page('About What the Ai | AI Games & Browser Experiments','Meet the What the Ai project: free AI-built games and apps maintained by Rockochamp. Learn how versions differ, inspect the source and understand shared features.','/about.html',about,'/images/CosmicDodge.webp',kind='AboutPage'))
    print('Built 6 static guides, About page and metadata for 15 versions.')

if __name__=='__main__': build()
