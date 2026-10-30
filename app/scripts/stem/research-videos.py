"""Refresh public YouTube metadata for the existing STEM shortlist; no API key."""
import concurrent.futures, json, re, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/stem-paper-bridges'
OUT.mkdir(parents=True,exist_ok=True)
rows=json.loads((ROOT/'output/stem-research/shortlist.json').read_text(encoding='utf-8'))
def get(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request,timeout=25) as response:
        return response.read().decode()
def check(row):
    item=dict(row)
    item['checkedAt']='2026-10-30'
    item['verification']='Public metadata only; full audiovisual review and physical classroom trial not completed.'
    try:
        meta=json.loads(get('https://www.youtube.com/oembed?url='+urllib.parse.quote(row['url'],safe='')+'&format=json'))
        item.update(title=meta['title'],channel=meta['author_name'],metadataOK=True)
    except Exception as error:
        item.update(metadataOK=False,metadataError=str(error))
    try:
        html=get(row['url'])
        match=re.search(r'ytInitialPlayerResponse\s*=\s*',html)
        if match:
            data=json.JSONDecoder().raw_decode(html[match.end():])[0]
            item['embedAllowed']=data.get('playabilityStatus',{}).get('playableInEmbed')
            item['playabilityStatus']=data.get('playabilityStatus',{}).get('status')
            length=data.get('videoDetails',{}).get('lengthSeconds')
            if length:item['durationSeconds']=int(length)
    except Exception as error:
        item['playerError']=str(error)
    return item
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    checked=list(pool.map(check,rows))
(OUT/'video-candidates.json').write_text(json.dumps(checked,ensure_ascii=False,indent=2),encoding='utf-8')
for row in checked:
    print(row['topic'],row.get('metadataOK'),row.get('embedAllowed'),row.get('durationSeconds'))
