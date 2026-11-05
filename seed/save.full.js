(function(){
var KEY='cashierOneClick.v1';
var norm=function(s){return (s||'').replace(/\s+/g,' ').trim();};
var toast=function(m,ms){var d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#222;color:#fff;padding:12px;border-radius:10px;font-size:16px;white-space:pre-wrap';document.body.appendChild(d);setTimeout(function(){d.remove();},ms||3000);};
var groups=function(){var out=[];document.querySelectorAll('.attribute-category-title').forEach(function(t){var g=t.parentElement.parentElement;out.push({title:norm(t.textContent),el:g});});return out;};
var rows=function(g){var out=[];g.querySelectorAll('.attribute-option-title').forEach(function(t){var r=t.closest('.px-3')||t.parentElement.parentElement.parentElement;out.push({title:norm(t.textContent),el:r});});return out;};
var rowState=function(r){var i=r.querySelector('input[type=radio],input[type=checkbox]');if(i)return {input:i,n:i.checked?1:0};var e=r.querySelector('[data-testid^="quantityCounter-edit"]');return {n:e?parseInt(e.textContent,10)||0:0,plus:r.querySelector('[data-testid^="quantityCounter-plus"]'),minus:function(){return r.querySelector('[data-testid^="quantityCounter-minus"]');}};};
var tap=function(el){if(!el)return;if(el.click&&!(el instanceof SVGElement))el.click();else el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));};

if(window.__coRec){toast('記錄中：已記住 '+window.__coRec.length+' 份。\n要重新開始請重新整理頁面。');return;}
if(!confirm('開始記錄常點餐點？\n（會覆蓋上次存的）\n接著照平常選好餐點按「加入購物車」，每一份都會被記住。'))return;
var list=[];window.__coRec=list;
var snap=function(){var title=norm((document.querySelector('.modal.show .modal-title, .modal.show h5, .modal.show .modal-header')||{}).textContent);
 var opts={};groups().forEach(function(g){var sel=[];rows(g.el).forEach(function(r){var n=rowState(r.el).n;for(var k=0;k<n;k++)sel.push(r.title);});opts[g.title]=sel;});
 var q=document.querySelector('[data-testid^="attributeQuantityEditor-edit"]');var c=document.querySelector('textarea[data-testid=comment]');
 return {item:window.__coLastItem||title,qty:q?parseInt(q.textContent,10)||1:1,comment:c?c.value:'',options:opts};};
document.addEventListener('click',function(e){var m=e.target.closest&&e.target.closest('[data-testid^="menuItems-item"]');if(m){var t=m.querySelector('div[style*="web-text-md"]');window.__coLastItem=norm(t?t.textContent:m.textContent.split('$')[0]);}
 var b=e.target.closest&&e.target.closest('[data-testid=attributeCTALayout]');if(b&&/加入購物車/.test(b.textContent)){var s=snap();list.push(s);localStorage.setItem(KEY,JSON.stringify({savedAt:new Date().toISOString(),items:list},null,1));toast('已記住第 '+list.length+' 份：'+s.item+' x'+s.qty);}
},true);
toast('記錄開始！請照常點餐，按「加入購物車」就會記住。',4000);
})();
