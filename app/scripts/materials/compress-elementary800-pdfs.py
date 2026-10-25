"""Optimize generated card artwork, then append to the unchanged uploaded workbook."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from PIL import Image
root=Path(__file__).resolve().parents[2]/'public'/'workbooks'/'elementary800'
for suffix in ['5','6','7','5-7']:
 path=root/f'verbs-level{suffix}.pdf'
 writer=PdfWriter();writer.append(PdfReader(path));seen=set()
 for page in writer.pages:
  for image in page.images:
   ref=image.indirect_reference.idnum
   if ref in seen:continue
   seen.add(ref)
   im=image.image.copy();im.thumbnail((600,600))
   if im.mode=='RGBA':
    canvas=Image.new('RGB',im.size,'white');canvas.paste(im,mask=im.getchannel('A'));im=canvas
   else:im=im.convert('RGB')
   image.replace(im,quality=86)
  page.compress_content_streams()
 writer.compress_identical_objects()
 temp=path.with_suffix('.optimized.pdf')
 with temp.open('wb') as stream:writer.write(stream)
 temp.replace(path)
 print(path.name,round(path.stat().st_size/1000000,2),'MB')
writer=PdfWriter();writer.append(PdfReader(root/'verbs-level1-4.pdf'));writer.append(PdfReader(root/'verbs-level5-7.pdf'))
with (root/'verbs-level1-7.pdf').open('wb') as stream:writer.write(stream)
assert len(writer.pages)==69
print('verbs-level1-7.pdf',round((root/'verbs-level1-7.pdf').stat().st_size/1000000,2),'MB')
