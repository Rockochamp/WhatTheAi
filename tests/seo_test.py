"""Offline checks for public discovery paths and generated SEO files."""
import json
from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urljoin,urlsplit
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://whatthe.ai'
class Page(HTMLParser):
    def __init__(self,text):
        super().__init__();self.meta={};self.links=[];self.canonicals=[];self.options=[];self.ids=[];self.titles=[];self.schemas=[];self.h1=0;self.capture=None;self.buffer='';self.noscript=0;self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='noscript':self.noscript+=1
        if a.get('id'):self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='meta':self.meta.setdefault(a.get('name',a.get('property','')),[]).append(a.get('content',''))
        if tag=='link' and a.get('rel')=='canonical':self.canonicals.append(a['href'])
        if tag=='a' and not self.noscript:self.links.append(a.get('href',''))
        if tag=='option':self.options.append(a.get('value',''))
        if tag=='title' or (tag=='script' and a.get('type')=='application/ld+json'):self.capture=tag;self.buffer=''
    def handle_data(self,s):
        if self.capture:self.buffer+=s
    def handle_endtag(self,tag):
        if tag=='noscript':self.noscript-=1
        if tag==self.capture:
            if tag=='title':self.titles.append(self.buffer)
            else:self.schemas.append(json.loads(self.buffer))
            self.capture=None

def local(route):return ROOT/('index.html' if route=='/' else route.lstrip('/'))
class DiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads((ROOT/'seo/catalog.json').read_text())
        cls.urls=[n.text for n in ET.parse(ROOT/'sitemap.xml').findall('.//{*}loc')]
        cls.pages={url:Page(local(urlsplit(url).path).read_text()) for url in cls.urls}
    def test_all_public_versions_and_guides_in_sitemap(self):
        expected={ORIGIN+'/',ORIGIN+'/about.html'}
        for g in self.catalog:
            expected.add(ORIGIN+g['hub']);expected.update(ORIGIN+v['path'] for v in g['versions'])
        self.assertEqual(set(self.urls),expected);self.assertEqual(len(self.urls),len(expected))
    def test_unique_complete_metadata(self):
        titles=[];descriptions=[]
        for url,p in self.pages.items():
            with self.subTest(url=url):
                self.assertEqual(p.canonicals,[url]);self.assertEqual(len(p.titles),1);self.assertTrue(p.titles[0].strip())
                self.assertEqual(len(p.meta.get('description',[])),1);self.assertTrue(p.meta['description'][0].strip())
                self.assertEqual(p.meta['og:url'],[url]);self.assertNotIn('noindex',' '.join(p.meta.get('robots',[])))
                self.assertTrue(p.schemas);self.assertEqual(len(p.ids),len(set(p.ids)))
                titles+=p.titles;descriptions+=p.meta['description']
        self.assertEqual(len(titles),len(set(titles)));self.assertEqual(len(descriptions),len(set(descriptions)))
    def test_every_model_has_an_ordinary_homepage_link(self):
        home=self.pages[ORIGIN+'/'];links={urlsplit(x).path for x in home.links}
        for option in home.options:self.assertIn(urlsplit(option).path,links)
        for g in self.catalog:
            self.assertIn(g['hub'],links)
            for v in g['versions']:self.assertIn(v['path'],links)
        self.assertEqual(home.h1,1)
    def test_guides_have_working_navigation_and_single_heading(self):
        paths=['/about.html']+[g['hub'] for g in self.catalog]
        for path in paths:
            p=self.pages[ORIGIN+path];self.assertEqual(p.h1,1)
            for link in p.links:
                dest=urlsplit(urljoin(ORIGIN+path,link))
                if dest.netloc!='whatthe.ai':continue
                self.assertTrue(local(dest.path).is_file(),link)
                if dest.fragment:self.assertIn(dest.fragment,self.pages[ORIGIN+dest.path].ids,link)
    def test_reachable_without_javascript(self):
        seen=set();pending=[ORIGIN+'/']
        while pending:
            url=pending.pop()
            if url in seen or url not in self.pages:continue
            seen.add(url)
            pending += [urljoin(url,x).split('#')[0].split('?')[0] for x in self.pages[url].links]
        self.assertEqual(seen,set(self.urls))
if __name__=='__main__':unittest.main()
