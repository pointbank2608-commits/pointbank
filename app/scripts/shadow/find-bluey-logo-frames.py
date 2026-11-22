"""Source-specific BLUEY title-transition candidates. Semantic review still required."""
import subprocess,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(sys.argv[1] if len(sys.argv)>1 else 'output/animation-solo/boundary-review');sample=root/'logo-template.jpg'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss','405.5','-i',str(root/'media/kioBK0l8w5w.mkv'),'-frames:v','1','-y',str(sample)],check=True,creationflags=0x08000000)
roi=(48,0,112,26);template=np.array(Image.open(sample).resize((160,90)).crop(roi)).astype(np.float32)
for src in ['kioBK0l8w5w','gk73udXY__E','mNt8QH-fyyY']:
 p=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-i',str(root/'media'/f'{src}.mkv'),'-vf','fps=5,scale=160:90,crop=64:26:48:0','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,creationflags=0x08000000)
 times=[];i=0
 while True:
  b=p.stdout.read(64*26*3)
  if len(b)<64*26*3:break
  a=np.frombuffer(b,dtype=np.uint8).reshape(26,64,3).astype(np.float32);mse=float(np.mean((a-template)**2))
  if mse<700:times.append(i/5)
  i+=1
 p.wait();groups=[]
 for t in times:
  if not groups or t-groups[-1][-1]>.5:groups.append([t])
  else:groups[-1].append(t)
 result=[{'start':g[0]-.1,'end':g[-1]+.1,'sampleCount':len(g)}for g in groups if len(g)>=2]
 (root/f'{src}-logos.json').write_text(json.dumps(result,indent=2));print(src,'logo intervals',len(result),json.dumps(result),flush=True)
