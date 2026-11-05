(function(){
/*COMMON*/
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
