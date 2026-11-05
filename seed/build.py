import re,urllib.parse,json
c=open('src/common.js').read()
def mk(name,cfg='var CONFIG=null;'):
  s=open(f'src/{name}.js').read().replace('/*COMMON*/',c).replace('/*CONFIG*/',cfg)
  return s
def bm(s):
  s=re.sub(r'^\s*//.*$','',s,flags=re.M); s=re.sub(r'\n\s*',' ',s)
  return 'javascript:'+urllib.parse.quote(s,safe="()!*'~;,/?:@&=+$-_.#")
out={}
for n in ['save','restore']:
  s=mk(n); open(f'{n}.full.js','w').write(s); b=bm(s); open(f'bookmarklet-{n}.txt','w').write(b); out[n]=len(b)
cfg=open('my-order.config.js').read()
s=mk('restore',cfg); open('restore-fixed.full.js','w').write(s); b=bm(s); open('bookmarklet-restore-fixed.txt','w').write(b); out['fixed']=len(b)
print(out)
