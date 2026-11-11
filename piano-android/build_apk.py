from pathlib import Path
import subprocess,zipfile,hashlib,os,sys,shutil,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent
sdk=root.parent/'android-build-tools';build=sdk/'build-tools/android-15';platform=next((sdk/'platform').glob('*/android.jar'));java=os.environ.get('PIANO_JAVA') or shutil.which('java');
if not java:raise RuntimeError('Set PIANO_JAVA to a Java executable.');
key=root/'signing/release.pk8';cert=root/'signing/release.pem'
if not key.is_file() or not cert.is_file():raise RuntimeError('Existing release.pk8 and release.pem are required. An upgrade build must never generate a replacement signing certificate.')
manifest=ET.parse(root/'native/AndroidManifest.xml').getroot()
version=manifest.attrib['{http://schemas.android.com/apk/res/android}versionName']
if len((root/'native/assets/index.html').read_bytes())>8000000:raise RuntimeError('Packaged HTML exceeds native asset limit')
out=root/'build';out.mkdir(exist_ok=True)
classes=out/'classes';classes.mkdir(exist_ok=True);dex=out/'dex';dex.mkdir(exist_ok=True)
def run(args):subprocess.run([str(a) for a in args],check=True)
run([sys.executable,root/'web/build.py'])
if len((root/'native/assets/index.html').read_bytes())>8000000:raise RuntimeError('Packaged HTML exceeds native asset limit')
run([java,'-jar',sdk/'ecj.jar','-source','1.8','-target','1.8','-proc:none','-nowarn','-encoding','UTF-8','-classpath',platform,'-d',classes,*sorted((root/'native/src').rglob('*.java'))])
run([java,'-cp',build/'lib/d8.jar','com.android.tools.r8.D8','--min-api','29','--lib',platform,'--output',dex,*sorted(classes.rglob('*.class'))])
unsigned=out/'unsigned.apk';aligned=out/'aligned.apk'
run([build/('aapt.exe' if os.name=='nt' else 'aapt'),'package','-f','-M',root/'native/AndroidManifest.xml','-S',root/'native/res','-A',root/'native/assets','-I',platform,'-F',unsigned])
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as z:
 for p in dex.glob('*.dex'):z.write(p,p.name)
run([build/('zipalign.exe' if os.name=='nt' else 'zipalign'),'-f','4',unsigned,aligned])
output=root.parent/f'deliverables/五线谱识谱_平板适配版_{version}.apk';output.parent.mkdir(exist_ok=True)
run([java,'-jar',build/'lib/apksigner.jar','sign','--key',key,'--cert',cert,'--v4-signing-enabled','false','--out',output,aligned])
run([java,'-jar',build/'lib/apksigner.jar','verify','--verbose','--print-certs',output])
run([build/('zipalign.exe' if os.name=='nt' else 'zipalign'),'-c','4',output])
with zipfile.ZipFile(output) as z:
 if z.read('assets/index.html')!=(root/'native/assets/index.html').read_bytes():raise RuntimeError('APK HTML differs from build artifact')
print('APK:',output.name,'bytes:',output.stat().st_size,'sha256:',hashlib.sha256(output.read_bytes()).hexdigest())
