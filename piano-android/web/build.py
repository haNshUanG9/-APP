from pathlib import Path
import subprocess,re,json,base64,hashlib
root=Path(__file__).resolve().parent
samples=root/'samples/salamander'
manifest=json.loads((samples/'manifest.json').read_text(encoding='utf-8'))
bank={}
for sample in manifest['samples']:
 data=(samples/sample['file']).read_bytes()
 if hashlib.sha256(data).hexdigest()!=sample['sha256']:raise RuntimeError('Piano sample integrity failure: '+sample['file'])
 bank[str(sample['midi'])]=base64.b64encode(data).decode('ascii')
script='\n'.join((root/name).read_text(encoding='utf-8').replace('__GLYPHS__',(root/'glyphs.json').read_text(encoding='utf-8')).replace('__PIANO_SAMPLES__',json.dumps(bank,separators=(',',':'))) for name in ['core.js','midi-core.js','rhythm-core.js','learning-core.js','foundation-bank.js','foundation-core.js','coach-core.js','hint-core.js','hint-ui.js','study-core.js','song-core.js','song-guidance-core.js','song-learning.js','song-bank.js','tablet-notation.js','piano-audio.js','app.js','studio-ui.js','study-ui.js','rhythm-ui.js','midi-ui.js','coach-ui.js','foundation-ui.js','song-guidance.js','song-ui.js','tablet-live.js'])
compiled=subprocess.run(['node',str(root/'compile.cjs')],input=script,text=True,encoding='utf-8',capture_output=True,check=True).stdout
engraver=subprocess.run(['node',str(root/'compile.cjs'),'--compact'],input=(root/'vendor/osmd.min.js').read_text(encoding='utf-8'),text=True,encoding='utf-8',capture_output=True,check=True).stdout
script=(root/'compat.js').read_text(encoding='utf-8')+'\n'+engraver+'\n'+(root/'vendor/fflate.min.js').read_text(encoding='utf-8')+'\n'+compiled
css=(root/'base.css').read_text(encoding='utf-8')+'\n'+(root/'tablet.css').read_text(encoding='utf-8')+'\n'+(root/'study.css').read_text(encoding='utf-8')+'\n'+(root/'workspace.css').read_text(encoding='utf-8')+'\n'+(root/'midi.css').read_text(encoding='utf-8')+'\n'+(root/'learning.css').read_text(encoding='utf-8')+'\n'+(root/'hints.css').read_text(encoding='utf-8')+'\n'+(root/'studio.css').read_text(encoding='utf-8')+'\n'+(root/'coach.css').read_text(encoding='utf-8')+'\n'+(root/'foundation.css').read_text(encoding='utf-8')
def inset(match):
 parts=match[1].split();parts=(parts*4)[:4] if len(parts)==1 else ([parts[0],parts[1],parts[0],parts[1]] if len(parts)==2 else [parts[0],parts[1],parts[2],parts[1]] if len(parts)==3 else parts)
 return ';'.join(f'{key}:{value}' for key,value in zip(['top','right','bottom','left'],parts))
css=re.sub(r'(?<![\w-])inset:([^;}]+)',inset,css)
def rgba(match):
 h=match[1];return 'rgba(%d,%d,%d,%.4f)'%(int(h[:2],16),int(h[2:4],16),int(h[4:6],16),int(h[6:8],16)/255)
css=re.sub(r'#([0-9a-fA-F]{8})(?![0-9a-fA-F])',rgba,css)
css+='\n'+(root/'song.css').read_text(encoding='utf-8')+'\n'+(root/'tablet-live.css').read_text(encoding='utf-8')+'\n'+(root/'song-guidance.css').read_text(encoding='utf-8')
html=(root/'shell.html').read_text(encoding='utf-8').replace('__STYLE__',css).replace('__SCRIPT__',script)
html=html.replace('<style>','<script>'+(root/'startup.js').read_text(encoding='utf-8')+'</script><style>',1)
out=root.parent/'native/assets/index.html';out.write_bytes(html.encode('utf-8'))
for filename in ['OSMD-LICENSE.txt','OSMD-THIRD-PARTY-NOTICES.txt','FFLATE-LICENSE.txt']:
 (out.parent/filename).write_bytes((root/'vendor'/filename).read_bytes())
(out.parent/'SALAMANDER-NOTICE.txt').write_bytes((samples/'NOTICE.txt').read_bytes())
(out.parent/'SALAMANDER-README.txt').write_bytes((samples/'README.upstream.txt').read_bytes())
print('Built offline compatible HTML:',len(html.encode()),'bytes')
