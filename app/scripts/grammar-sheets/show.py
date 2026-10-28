import json,sys
pts={p['id']:p for p in json.load(open('app/src/data/grammarPoints.json',encoding='utf-8'))}
order=json.load(open('/tmp/order.json'))
start,end=int(sys.argv[1]),int(sys.argv[2])
done=set()
import glob
for f in glob.glob('app/src/data/grammarSheets/bank/*.json'):
    for it in json.load(open(f,encoding='utf-8')): done.add(it['id'])
todo=[o for o in order if o[1] not in done][start:end]
for u,i,stage,grade in todo:
    p=pts[i]
    print(f"## {i} | {p['name']} | {stage} {grade} | unit {u}")
    print(' rule:',' / '.join(p.get('rule') or []))
    for e,t in zip(p['examples'],p['translations']): print('  ',e,'=>',t)
    for x in p.get('pitfalls') or []: print('  X',x['wrong'],'->',x['right'],'|',x['why'])
