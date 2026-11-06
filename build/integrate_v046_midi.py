"""v0.46：build/src_midi.js（Web MIDI）と build/src_i18n.js を index.html に埋め込む（再実行可能）。
- /*<ae-midi>*/ … /*</ae-midi>*/ の区間を src_midi.js の内容で置き換える（無ければ /*<ae-studio>*/ の直前に入れる）。
- <script id="ae-i18n"> の中身を src_i18n.js と同じにする。"""
import pathlib,sys
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text(encoding='utf-8')
midi=(root/'build/src_midi.js').read_text(encoding='utf-8')
block='/*<ae-midi>*/\n'+midi.rstrip('\n')+'\n/*</ae-midi>*/\n'
if '/*<ae-midi>*/' in html:
    a=html.index('/*<ae-midi>*/');b=html.index('/*</ae-midi>*/')+len('/*</ae-midi>*/\n')
    html=html[:a]+block+html[b:]
else:
    i=html.index('/*<ae-studio>*/');html=html[:i]+block+html[i:]
tag='<script id="ae-i18n">';a=html.index(tag)+len(tag);b=html.index('</script>',a)
html=html[:a]+(root/'build/src_i18n.js').read_text(encoding='utf-8')+html[b:]
(root/'index.html').write_text(html,encoding='utf-8')
print('ok')
