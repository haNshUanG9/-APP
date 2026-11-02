from pathlib import Path
import subprocess,zipfile,hashlib,os,sys,shutil
root=Path(__file__).resolve().parent
sdk=root.parent/'android-build-tools';build=sdk/'build-tools/android-15';platform=next((sdk/'platform').glob('*/android.jar'));java=os.environ.get('PIANO_JAVA') or shutil.which('java');
if not java:raise RuntimeError('Set PIANO_JAVA to a Java executable.');
out=root/'build';out.mkdir(exist_ok=True)
classes=out/'classes';classes.mkdir(exist_ok=True);dex=out/'dex';dex.mkdir(exist_ok=True)
def run(args):subprocess.run([str(a) for a in args],check=True)
run([sys.executable,root/'web/build.py'])
run([java,'-jar',sdk/'ecj.jar','-source','1.8','-target','1.8','-proc:none','-nowarn','-encoding','UTF-8','-classpath',platform,'-d',classes,*sorted((root/'native/src').rglob('*.java'))])
run([java,'-cp',build/'lib/d8.jar','com.android.tools.r8.D8','--min-api','29','--lib',platform,'--output',dex,*sorted(classes.rglob('*.class'))])
unsigned=out/'unsigned.apk';aligned=out/'aligned.apk'
run([build/('aapt.exe' if os.name=='nt' else 'aapt'),'package','-f','-M',root/'native/AndroidManifest.xml','-S',root/'native/res','-A',root/'native/assets','-I',platform,'-F',unsigned])
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as z:
 for p in dex.glob('*.dex'):z.write(p,p.name)
run([build/('zipalign.exe' if os.name=='nt' else 'zipalign'),'-f','4',unsigned,aligned])
key=root/'signing/release.pk8';cert=root/'signing/release.pem'
if not key.exists():
 run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048','-out',root/'signing/private.pem'])
 run(['openssl','req','-new','-x509','-key',root/'signing/private.pem','-out',cert,'-days','10000','-subj','/CN=Piano Staff Trainer/O=Local Practice/C=CN'])
 run(['openssl','pkcs8','-topk8','-inform','PEM','-outform','DER','-in',root/'signing/private.pem','-out',key,'-nocrypt'])
 (root/'signing/private.pem').unlink()
output=root.parent/'deliverables/五线谱识谱_简约谱台版_1.5.7.apk';output.parent.mkdir(exist_ok=True)
run([java,'-jar',build/'lib/apksigner.jar','sign','--key',key,'--cert',cert,'--v4-signing-enabled','false','--out',output,aligned])
run([java,'-jar',build/'lib/apksigner.jar','verify','--verbose','--print-certs',output])
run([build/('zipalign.exe' if os.name=='nt' else 'zipalign'),'-c','4',output])
print('APK:',output.name,'bytes:',output.stat().st_size,'sha256:',hashlib.sha256(output.read_bytes()).hexdigest())
