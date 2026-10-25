"""Validate actual browser printouts and render contact sheets for visual review."""
import argparse, json, subprocess
from pathlib import Path
from pypdf import PdfReader, PdfWriter
import pdfplumber
from PIL import Image, ImageDraw

parser=argparse.ArgumentParser()
parser.add_argument('--render',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[3]
report=json.loads((root/'output/worksheet-studio/ui-checks.json').read_text(encoding='utf-8-sig'))
source=root/'tmp/pdfs/worksheet-studio'
output=root/'output/pdf/worksheet-studio'
rendered=root/'output/worksheet-studio/rendered'
output.mkdir(parents=True,exist_ok=True);rendered.mkdir(parents=True,exist_ok=True)
results=[];failures=[];thumbnails=[]
for activity in report['activities']:
    activity_id=activity['id'];writer=PdfWriter();per_activity=[]
    for view in activity['audiences']:
        audience=view['audience'];path=source/f'{activity_id}-{audience}.pdf'
        reader=PdfReader(path)
        if len(reader.pages)!=view['pages']:
            failures.append({'id':activity_id,'audience':audience,'expected':view['pages'],'actual':len(reader.pages),'issue':'page count'})
        word_overflow=[]
        with pdfplumber.open(path) as pdf:
            for index,page in enumerate(pdf.pages):
                size=sorted([float(page.width),float(page.height)])
                if abs(size[0]-595.28)>2 or abs(size[1]-841.89)>2:
                    failures.append({'id':activity_id,'audience':audience,'page':index+1,'issue':'not A4','size':size})
                text=page.extract_text() or ''
                if len(text.strip())<15 or '\ufffd' in text:
                    failures.append({'id':activity_id,'audience':audience,'page':index+1,'issue':'blank or invalid text','text':text[:80]})
                if audience=='student' and ('교사용 설명' in text or '정답·예시 답안' in text):
                    failures.append({'id':activity_id,'audience':audience,'page':index+1,'issue':'teacher-only heading on student sheet'})
                for word in page.extract_words():
                    if word['x0']<1 or word['x1']>page.width-1 or word['top']<1 or word['bottom']>page.height-1:
                        word_overflow.append({'page':index+1,'word':word['text'],'bounds':[word['x0'],word['x1'],word['top'],word['bottom']]})
        if word_overflow:failures.append({'id':activity_id,'audience':audience,'issue':'text outside page','words':word_overflow[:10]})
        per_activity.append({'audience':audience,'pages':len(reader.pages)})
        for page in reader.pages:writer.add_page(page)
        if args.render:
            prefix=rendered/f'{activity_id}-{audience}'
            subprocess.run(['pdftoppm','-scale-to','650','-png',str(path),str(prefix)],check=True,capture_output=True)
            for png in sorted(rendered.glob(f'{activity_id}-{audience}-*.png')):
                thumbnails.append((f'{activity_id} / {audience} / {png.stem.rsplit("-",1)[-1]}',png))
    writer.add_metadata({'/Title':f'ClassBank - {activity_id}','/Subject':'Student sheets followed by teacher notes; edit in the ClassBank worksheet editor.'})
    with (output/f'{activity_id}.pdf').open('wb') as stream:writer.write(stream)
    results.append({'id':activity_id,'views':per_activity,'mergedPages':len(writer.pages)})

if args.render:
    for sheet_no,start in enumerate(range(0,len(thumbnails),20),1):
        canvas=Image.new('RGB',(1500,1840),'#e7edf3');draw=ImageDraw.Draw(canvas)
        for n,(title,path) in enumerate(thumbnails[start:start+20]):
            x=(n%5)*300;y=(n//5)*460
            image=Image.open(path).convert('RGB');image.thumbnail((284,421))
            canvas.paste(image,(x+(300-image.width)//2,y+24));draw.text((x+7,y+5),title,fill='#112f4e')
        canvas.save(rendered/f'contact-{sheet_no:02d}.jpg',quality=90)
result={'passed':not failures,'worksheets':len(results),'totalPdfPages':sum(r['mergedPages'] for r in results),'failures':failures,'results':results,'renderedPages':len(thumbnails)}
(root/'output/worksheet-studio/pdf-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['results']},ensure_ascii=False))
if failures:raise SystemExit(1)
