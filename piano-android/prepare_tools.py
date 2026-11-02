"""Download and verify the Android compiler tools for the current host."""
from pathlib import Path
import hashlib, urllib.request, zipfile, os, sys, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent.parent/'android-build-tools'
root.mkdir(exist_ok=True)
host='windows' if os.name=='nt' else 'linux'
def fetch(url,p):
    print('Download:',p.name,flush=True)
    with urllib.request.urlopen(url,timeout=60) as source,p.open('wb') as out:
        while chunk:=source.read(1024*1024):out.write(chunk)
def archive(package,folder):
    repository=ET.fromstring(urllib.request.urlopen('https://dl.google.com/android/repository/repository2-1.xml',timeout=60).read())
    pkg=next(x for x in repository if x.tag.endswith('remotePackage') and x.attrib.get('path')==package)
    archives=pkg.find('archives').findall('archive')
    a=next(a for a in archives if a.findtext('host-os')==host or a.find('host-os') is None)
    spec=a.find('complete');name=spec.findtext('url');check=spec.find('checksum');p=root/name
    if not p.exists():fetch('https://dl.google.com/android/repository/'+name,p)
    if hashlib.new(check.attrib.get('type','sha1'),p.read_bytes()).hexdigest()!=check.text:raise ValueError('Checksum mismatch: '+name)
    dest=root/folder;dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(p) as z:
        for info in z.infolist():
            target=(dest/info.filename).resolve()
            if dest.resolve() not in target.parents:raise ValueError('Unsafe archive path')
        z.extractall(dest)
    if host=='linux':
        for name in ['aapt','aapt2','d8','zipalign','apksigner']:os.chmod(dest/'android-15'/name,0o755)
archive('build-tools;35.0.0','build-tools')
archive('platforms;android-35','platform')
p=root/'ecj.jar'
if not p.exists():fetch('https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.33.0/ecj-3.33.0.jar',p)
if hashlib.sha256(p.read_bytes()).hexdigest()!='f7686c4960cf70c2ebc5c500a73a8cfc04541b730c18f1c5c21329889b137f45':raise ValueError('ECJ checksum mismatch')
print('Build tools ready.',flush=True)
