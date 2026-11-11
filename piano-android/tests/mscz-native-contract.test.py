"""Native SAF/permissions contract + actual APK asset/signature inspection, no emulator/device claim."""
from pathlib import Path
import re,json,subprocess,zipfile,hashlib,xml.etree.ElementTree as E
D=Path(__file__).resolve().parents[1];R=D.parent;out=R/'deliverables/MSCZ与调号_APP本地测试_1.6.1/evidence';src=(D/'native/src/com/pianopractice/tablet/MainActivity.java').read_text(encoding='utf-8');manifest=E.parse(D/'native/AndroidManifest.xml').getroot();ns='{http://schemas.android.com/apk/res/android}'
checks={
 'packageKept':manifest.get('package')=='com.pianopractice.tablet',
 'version':manifest.get(ns+'versionName')=='1.6.1' and manifest.get(ns+'versionCode')=='18',
 'noInternetPermission':not any(e.get(ns+'name')=='android.permission.INTERNET' for e in manifest.findall('uses-permission')),
 'networkBlocked':'settings.setBlockNetworkLoads(true)' in src,
 'fileContentBlocked':all(s in src for s in ['setAllowFileAccess(false)','setAllowContentAccess(false)','setAllowFileAccessFromFileURLs(false)','setAllowUniversalAccessFromFileURLs(false)']),
 'fixedOrigin':'https://piano.offline.local/' in src and 'uri.getQuery()==null' in src,
 'SAFOpenDocument':'Intent.ACTION_OPEN_DOCUMENT' in src,
 'SAFCreateBinary':'exportBinary(String filename,String mime,String base64)' in src and 'Intent.ACTION_CREATE_DOCUMENT' in src and 'Base64.decode(json,Base64.NO_WRAP)' in src,
 'boundedIO':'readBounded(in,MAX_BYTES)' in src and 'check.length>MAX_BYTES' in src and 'payload.length>MAX_BYTES' in src,
 'pendingBinarySaved':'out.putBoolean("pendingExportBinary",pendingExportBinary)' in src,
 'pausedLifecycle':'window.PianoPause&&window.PianoPause()' in src,
}
apk=R/'deliverables/五线谱识谱_平板适配版_1.6.1.apk';old=R/'deliverables/五线谱识谱_平板适配版_1.6.0.apk'
if apk.exists():
 with zipfile.ZipFile(apk) as z:
  checks['APKAssetExact']=z.read('assets/index.html')==(D/'native/assets/index.html').read_bytes();checks['APKCRC']=z.testzip()is None;checks['NoPrivateScore']=not any(n.endswith(('.mscz','.mscx','.pk8','.pem'))for n in z.namelist());checks['dexPresent']='classes.dex'in z.namelist()
 java='G:/JetBrains Rider 2025.3.0.4/jbr/bin/java.exe';signer=R/'android-build-tools/build-tools/android-15/lib/apksigner.jar'
 def cert(p):
  r=subprocess.run([java,'-jar',str(signer),'verify','--verbose','--print-certs',str(p)],capture_output=True,text=True,encoding='utf-8',check=True)
  return re.search(r'certificate SHA-256 digest: (\w+)',r.stdout).group(1),r.stdout
 newcert,newlog=cert(apk);oldcert,_=cert(old);checks['SameUpgradeCertificate']=newcert==oldcert
else:newcert=None
r={'checks':checks,'allPassed':all(checks.values()),'certificate':newcert,'apkSHA256':hashlib.sha256(apk.read_bytes()).hexdigest()if apk.exists()else None,'scope':'native source contract + real Java build/signature/APK unzip; no physical Android SAF/USB execution'}
(out/'原生SAF与APK解包核验.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(r,ensure_ascii=False,indent=2));assert r['allPassed']
