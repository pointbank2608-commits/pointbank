"""Inspect real Chrome printouts after check-print-course-separation.mjs."""
import json, re, shutil, subprocess
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[3]
base=root/'output/phonics-print-course';dest=base/'rendered';dest.mkdir(exist_ok=True)
renderer=shutil.which('pdftoppm')
if not renderer:raise SystemExit('Add the bundled Poppler bin directory to PATH.')
report=json.loads((base/'development-checks.json').read_text(encoding='utf-8'))
results=[];thumbs=[]
for name,expected in [('alphabet-all',report['ready']*2),('alphabet-x',2)]:
 source=base/(name+'.pdf');pdf=PdfReader(source)
 assert len(pdf.pages)==expected,(name,len(pdf.pages),expected)
 with pdfplumber.open(source) as document:
  for i,page in enumerate(document.pages):
   assert abs(page.width-595.28)<2 and abs(page.height-841.89)<2
   text=re.sub(r'\s+','',page.extract_text() or '')
   headings=['LookandSay','ReadandWrite','CircletheCorrectWord'] if i%2==0 else ['Match','CompletetheWord','Color']
   assert all(h in text for h in headings),(name,i+1,headings,text[:160])
   assert not any(t in text for t in ['1차시','2차시','슬라이드','준비중'])
   assert all(w['x0']>=-1 and w['x1']<=page.width+1 and w['top']>=-1 and w['bottom']<=page.height+1 for w in page.extract_words()),(name,i+1,'text overflow')
 for old in dest.glob(name+'-*.png'):old.unlink()
 subprocess.run([renderer,'-scale-to','900','-png',str(source),str(dest/name)],check=True,capture_output=True)
 thumbs.extend(sorted(dest.glob(name+'-*.png')))
 results.append({'file':name+'.pdf','pages':len(pdf.pages),'a4':True})
for n,start in enumerate(range(0,len(thumbs),12),1):
 canvas=Image.new('RGB',(1600,1740),'#eaf0f6');draw=ImageDraw.Draw(canvas)
 for j,path in enumerate(thumbs[start:start+12]):
  im=Image.open(path).convert('RGB');im.thumbnail((380,535));x=j%4*400;y=j//4*580
  canvas.paste(im,(x+(400-im.width)//2,y+25));draw.text((x+8,y+6),path.stem,fill='black')
 canvas.save(dest/f'contact-{n}.jpg')
(base/'pdf-checks.json').write_text(json.dumps({'passed':True,'results':results},indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'results':results}))
