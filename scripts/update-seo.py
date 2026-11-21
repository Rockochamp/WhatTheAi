"""Rebuild homepage JSON-LD and sitemap from the actual, static game catalog.

Run after changing the homepage catalog: python scripts/update-seo.py
Only linked public game/app entrypoints are included; no asset or test URLs.
"""
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://whatthe.ai'

class Catalog(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards = []
        self.routes = set()
        self.card = None
        self.in_title = False

    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if tag == 'article' and 'data-game-id' in a:
            self.card = {'name': '', 'url': ''}
            self.cards.append(self.card)
        if tag == 'a' and a.get('href') in ('/about.html', '/models.html'):
            self.routes.add(a['href'])
        if self.card is not None:
            if tag == 'h2' and a.get('class') == 'game-title':
                self.in_title = True
            if tag == 'a' and a.get('class') in ('game-link', 'guide-link'):
                self.card['url'] = ORIGIN + urlsplit(a['href']).path
            link = a.get('value') if tag == 'option' else a.get('href', '')
            if link and link.startswith(('/games/', '/apps/')):
                self.routes.add(urlsplit(link).path)

    def handle_endtag(self, tag):
        if tag == 'h2':
            self.in_title = False
        if tag == 'article':
            self.card = None

    def handle_data(self, text):
        if self.in_title and self.card is not None:
            self.card['name'] += text

def last_modified(path):
    """Prefer a real content commit date; newly edited pages use today's date."""
    changed = subprocess.check_output(['git', 'status', '--porcelain', '--', path], cwd=ROOT, text=True)
    if changed.strip():
        return date.today().isoformat()
    value = subprocess.check_output(['git', 'log', '-1', '--format=%cs', '--', path], cwd=ROOT, text=True).strip()
    return value or date.today().isoformat()

def build():
    page = ROOT / 'index.html'
    content = page.read_text(encoding='utf-8')
    catalog = Catalog()
    catalog.feed(content)
    assert catalog.cards and all(c['name'].strip() and c['url'] for c in catalog.cards)
    described = re.search(r'<meta name="description" content="([^"]*)"', content)
    description = described.group(1).replace('&amp;', '&') if described else 'Free browser games and apps built by different AI models.'
    data = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'name': 'What the Ai', 'alternateName': ['whatthe.ai', 'WhatTheAi'], 'url': ORIGIN + '/', 'description': description, 'inLanguage': 'en', 'publisher': {'@id': ORIGIN + '/#publisher'}},
            {'@type': 'Organization', '@id': ORIGIN + '/#publisher', 'name': 'What the Ai', 'url': ORIGIN + '/', 'founder': {'@type': 'Person', 'name': 'Rockochamp', 'url': 'https://github.com/Rockochamp'}, 'sameAs': ['https://github.com/Rockochamp/WhatTheAi']},
            {'@type': 'CollectionPage', '@id': ORIGIN + '/#catalog', 'url': ORIGIN + '/', 'name': 'Free AI-built browser games and apps, compared by model', 'isPartOf': {'@id': ORIGIN + '/#website'}, 'description': description, 'inLanguage': 'en', 'isAccessibleForFree': True,
             'about': [{'@type': 'Thing', 'name': 'Browser games'}, {'@type': 'Thing', 'name': 'AI-generated software'}, {'@type': 'Thing', 'name': 'Large language model comparison'}],
             'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(catalog.cards), 'itemListElement': [
                {'@type': 'ListItem', 'position': i + 1, 'name': ' '.join(card['name'].split()), 'url': card['url']} for i, card in enumerate(catalog.cards)
            ]}}
        ]
    }
    pattern = r'(<script type="application/ld\+json" id="site-structured-data">)([\s\S]*?)(</script>)'
    matches = list(re.finditer(pattern, content))
    assert len(matches) == 1, 'Keep exactly one site-structured-data script in index.html'
    # Preserve formatting and modification dates when the catalog is unchanged.
    if json.loads(matches[0][2]) != data:
        content = re.sub(pattern, lambda m: m[1] + '\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n' + m[3], content)
        page.write_text(content, encoding='utf-8', newline='\n')

    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    sitemap = ET.Element('{' + namespace + '}urlset')
    routes = ['/'] + sorted(catalog.routes)
    for route in routes:
        file = 'index.html' if route == '/' else route.lstrip('/')
        assert (ROOT / file).is_file(), f'Missing sitemap destination: {file}'
        node = ET.SubElement(sitemap, 'url')
        ET.SubElement(node, 'loc').text = ORIGIN + route
        ET.SubElement(node, 'lastmod').text = last_modified(file)
    ET.indent(sitemap, space='  ')
    (ROOT / 'sitemap.xml').write_bytes(ET.tostring(sitemap, encoding='utf-8', xml_declaration=True) + b'\n')
    print(f'Updated structured data for {len(catalog.cards)} cards and sitemap for {len(routes)} canonical URLs.')

if __name__ == '__main__':
    build()
