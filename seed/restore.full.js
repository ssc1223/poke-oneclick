(function(){
var KEY='cashierOneClick.v1';
var norm=function(s){return (s||'').replace(/\s+/g,' ').trim();};
var toast=function(m,ms){var d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#222;color:#fff;padding:12px;border-radius:10px;font-size:16px;white-space:pre-wrap';document.body.appendChild(d);setTimeout(function(){d.remove();},ms||3000);};
var groups=function(){var out=[];document.querySelectorAll('.attribute-category-title').forEach(function(t){var g=t.parentElement.parentElement;out.push({title:norm(t.textContent),el:g});});return out;};
var rows=function(g){var out=[];g.querySelectorAll('.attribute-option-title').forEach(function(t){var r=t.closest('.px-3')||t.parentElement.parentElement.parentElement;out.push({title:norm(t.textContent),el:r});});return out;};
var rowState=function(r){var i=r.querySelector('input[type=radio],input[type=checkbox]');if(i)return {input:i,n:i.checked?1:0};var e=r.querySelector('[data-testid^="quantityCounter-edit"]');return {n:e?parseInt(e.textContent,10)||0:0,plus:r.querySelector('[data-testid^="quantityCounter-plus"]'),minus:function(){return r.querySelector('[data-testid^="quantityCounter-minus"]');}};};
var tap=function(el){if(!el)return;if(el.click&&!(el instanceof SVGElement))el.click();else el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));};

var CONFIG=null;
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
var until=async function(f,ms){var t=Date.now();while(Date.now()-t<(ms||8000)){var v=f();if(v)return v;await sleep(150);}return null;};
var cfg=(typeof CONFIG!=='undefined'&&CONFIG)||JSON.parse(localStorage.getItem(KEY)||'null');
if(!cfg||!cfg.items||!cfg.items.length){toast('還沒有存過常點餐點，請先用「存餐點」書籤記錄。',5000);return;}
(async function(){
 var ok=[],bad=[];
 for(var i=0;i<cfg.items.length;i++){var it=cfg.items[i];
  var ack=[].slice.call(document.querySelectorAll('button')).find(function(b){return /我知道了/.test(b.textContent)&&b.offsetParent;});if(ack){tap(ack);await sleep(400);}
  var card=[].slice.call(document.querySelectorAll('[data-testid^="menuItems-item"]')).find(function(m){var t=m.querySelector('div[style*="web-text-md"]');return t&&norm(t.textContent)===norm(it.item);});
  if(!card){bad.push(it.item+'（菜單找不到）');continue;}
  tap(card);
  var cta=await until(function(){var b=document.querySelector('[data-testid=attributeCTALayout]');return b&&b.offsetParent?b:null;});
  if(!cta){bad.push(it.item+'（選項視窗沒開）');continue;}
  await sleep(500);var miss=[];
  var gs=groups();
  for(var gt in it.options){var want=it.options[gt].map(norm);var g=gs.find(function(x){return x.title===norm(gt);});
   if(!g){if(want.length)miss.push('['+gt+']');continue;}
   var rs=rows(g.el);
   want.forEach(function(w){if(!rs.some(function(r){return r.title===w;}))miss.push(gt+':'+w);});
   // 先取消不要的勾選/數量
   for(var r of rs){var need=want.filter(function(w){return w===r.title;}).length;var s=rowState(r.el);
    if(s.input){if(s.input.type==='checkbox'&&s.input.checked&&!need){tap(s.input);await sleep(80);}}
    else{var guard=0;while(rowState(r.el).n>need&&guard++<20){tap(rowState(r.el).minus());await sleep(80);}}}
   for(var r2 of rs){var need2=want.filter(function(w){return w===r2.title;}).length;if(!need2)continue;var s2=rowState(r2.el);
    if(s2.input){if(!s2.input.checked){tap(s2.input);await sleep(80);}}
    else{var g2=0;while(rowState(r2.el).n<need2&&g2++<20){tap(rowState(r2.el).plus);await sleep(80);}}}
  }
  var qe=document.querySelector('[data-testid^="attributeQuantityEditor-add"]');var g3=0;
  while(qe&&(parseInt((document.querySelector('[data-testid^="attributeQuantityEditor-edit"]')||{}).textContent,10)||1)<(it.qty||1)&&g3++<20){tap(qe);await sleep(100);}
  var c=document.querySelector('textarea[data-testid=comment]');if(c&&it.comment){var set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(c,it.comment);c.dispatchEvent(new Event('input',{bubbles:true}));}
  await sleep(200);tap(document.querySelector('[data-testid=attributeCTALayout]'));
  var closed=await until(function(){var b=document.querySelector('[data-testid=attributeCTALayout]');return !(b&&b.offsetParent);},5000);
  if(!closed){bad.push(it.item+'（無法加入，可能有必選項沒選到'+(miss.length?'：'+miss.join('、'):'')+'）');break;}
  ok.push(it.item+' x'+(it.qty||1)+(miss.length?'（找不到：'+miss.join('、')+'）':''));await sleep(700);
 }
 toast('已加入購物車：\n'+(ok.join('\n')||'無')+(bad.length?'\n\n⚠ 失敗：\n'+bad.join('\n'):'')+'\n\n請自行檢查購物車再結帳。',8000);
})();
})();
