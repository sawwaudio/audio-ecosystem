"""Install the local approval desk for the current macOS login."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

import desk
from render import LIBRARY, OPTIONS

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', required=True, type=Path)
    p.add_argument('--ffmpeg', required=True, type=Path)
    p.add_argument('--node', required=True, type=Path)
    p.add_argument('--node-modules', required=True, type=Path)
    p.add_argument('--chrome', required=True, type=Path)
    p.add_argument('--samples', type=Path)
    a = p.parse_args()
    home = Path.home()
    state = desk.STATE
    app = state / 'engine'
    library = state / 'library'
    app.mkdir(exist_ok=True,parents=True,mode=0o700)
    source = Path(__file__).resolve().parent
    for file in source.iterdir():
        if file.is_file():shutil.copy2(file,app/file.name)
    shutil.copy2(a.ffmpeg,app/'ffmpeg')
    ids = set().union(*(entry[1] for entry in LIBRARY.values()),*OPTIONS.values())
    (library/'data').mkdir(exist_ok=True,parents=True)
    shutil.copy2(a.root/'data/recording_licenses.json',library/'data')
    for sub in ('original','compat','pcm'):
        dest=library/'audio'/sub
        dest.mkdir(exist_ok=True,parents=True)
        for file in (a.root/'audio'/sub).glob('*'):
            if file.stem in ids:shutil.copy2(file,dest)
    if a.samples:
        today=dt.datetime.now(desk.JST).date()
        with desk.db() as c:
            for offset,kind in enumerate(('nature','morphology','make')):
                day=str(today+dt.timedelta(days=offset))
                if c.execute('select 1 from jobs where day=?',(day,)).fetchone():continue
                folder=state/day
                folder.mkdir(exist_ok=True)
                for ext in ('.mp4','.json','.txt','-cover.jpg'):
                    shutil.copy2(a.samples/(kind+ext),folder)
                report=json.loads((folder/(kind+'.json')).read_text())
                desk.enqueue(c,day,kind,report['seed'],folder)
    env={'SAE_ROOT':str(library),'FFMPEG':str(app/'ffmpeg'),'PATH':str(a.node.resolve().parent)+':/usr/bin:/bin','CHROME':str(a.chrome),'NODE_PATH':str(a.node_modules),'REELS_STATE':str(state),'PYTHONUNBUFFERED':'1'}
    name='com.sawwaudio.reels'
    plist=home/'Library/LaunchAgents'/(name+'.plist')
    plist.parent.mkdir(parents=True,exist_ok=True)
    with plist.open('wb') as f:
        plistlib.dump(dict(Label=name,ProgramArguments=[sys.executable,str(app/'desk.py')],EnvironmentVariables=env,RunAtLoad=True,KeepAlive=True,ThrottleInterval=30,StandardOutPath=str(state/'desk.log'),StandardErrorPath=str(state/'desk.log')),f)
    domain='gui/'+str(os.getuid())
    if subprocess.run(['launchctl','print',domain+'/'+name],capture_output=True).returncode==0:
        subprocess.run(['launchctl','bootout',domain+'/'+name],check=True)
    subprocess.run(['launchctl','bootstrap',domain,str(plist)],check=True)

if __name__=='__main__':main()
