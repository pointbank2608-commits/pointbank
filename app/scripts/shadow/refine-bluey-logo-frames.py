"""Refine reviewed logo candidates at native frame timestamps, never rounded seconds."""
import subprocess,json,re,sys
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(sys.argv[1] if len(sys.argv)>1 else 'output/animation-solo/boundary-review');template=np.array(Image.open(root/'logo-template.jpg').resize((160,90)).crop((48,0,112,26))).astype(np.float32)
for src in ['kioBK0l8w5w','gk73udXY__E','mNt8QH-fyyY']:
 groups=json.loads((root/f'{src}-logos.json').read_text());out=[]
 for i,g in enumerate(groups):
  begin=max(0,g['start']-.7)
  r=subprocess.run(['ffmpeg','-hide_banner','-loglevel','info','-ss',str(begin),'-i',str(root/'media'/f'{src}.mkv'),'-t','1.6','-vf','scale=160:90,crop=64:26:48:0,showinfo','-an','-pix_fmt','rgb24','-fps_mode','passthrough','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,creationflags=0x08000000)
  frames=np.frombuffer(r.stdout,dtype=np.uint8).reshape(-1,26,64,3).astype(np.float32);times=[float(t) for t in re.findall(r'pts_time:([\d.e+-]+)',r.stderr.decode(errors='replace'))]
  times=[t for t in times if t<1.6]
  if len(frames)!=len(times):raise Exception(f'Decoded timestamp/frame mismatch {len(frames)} vs {len(times)} {times[:3]} {times[-3:]}')
  match=[n for n,f in enumerate(frames) if float(np.mean((f-template)**2))<700]
  if not match:raise Exception('Logo refinement lost original frame')
  out.append({**g,'id':f'logo-{i}','time':round(begin+times[match[0]],3),'method':'decoded-original-logo-pixels','fpsPrecision':1/(len(frames)/1.6)})
 (root/f'{src}-logos-refined.json').write_text(json.dumps(out,indent=2));print(src,'refined',len(out),flush=True)
