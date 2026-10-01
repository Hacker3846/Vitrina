/* Две темы: «new» (лунная синева, по умолчанию) и «old» (золото). Выбор запоминается.
   Файлы старой темы называются old-*.webp.
   Если картинка не загрузилась из файла, берём её копию из БД (её кладёт админка из ZIP) и подставляем
   через CSS-переменную. Если нет и в БД, включается CSS-замена (классы no-bg / no-ed / no-cn на <html>).
   Картинки из БД кэшируются в IndexedDB браузера: повторные открытия не ходят в БД за каждой картинкой,
   достаточно одного чтения img-meta, чтобы понять, не обновили ли файл в админке.
   Порядок прогрева кэша: сначала тема, с которой открыли страницу (по умолчанию «new»), потом другая. */
(()=>{const h=document.documentElement,m=()=>document.querySelector('meta[name=theme-color]'),
first=h.dataset.theme=='old'?'old':'new';
let ask,mf;const ready=new Promise(r=>ask=r);
window.dbImgSet=(f,meta)=>{mf=meta;ask(f)};   // f: key -> dataURL | null;  meta: () -> {key:{t}} | null
const tout=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
/* постоянный кэш: IndexedDB, запись {d:dataURL, t:метка версии из img-meta} */
const idb=(()=>{let p;const open=()=>p??=new Promise((ok,no)=>{try{const r=indexedDB.open('vitrina-img',1);r.onupgradeneeded=()=>r.result.createObjectStore('i');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}});
 const tx=(mode,fn)=>open().then(db=>new Promise((ok,no)=>{const t=db.transaction('i',mode),q=fn(t.objectStore('i'));t.oncomplete=()=>ok(q.result);t.onerror=t.onabort=()=>no(t.error)}));
 return{get:k=>tx('readonly',s=>s.get(k)).catch(()=>null),put:(k,v)=>tx('readwrite',s=>s.put(v,k)).catch(()=>{})}})();
let mp;const meta=()=>mp??=tout(ready.then(()=>mf?mf():null),12000).catch(()=>null).then(v=>{if(!v)mp=null;return v});
const mem={},res={},miss=new Set();let used={};   // mem: key -> промис dataURL; res: готовые dataURL; miss: файла рядом с сайтом нет; used: css-переменная -> key
const css=d=>`url("${d}")`;
const put=(k,d)=>{res[k]=d;for(const p in used)if(used[p]==k)h.style.setProperty(p,css(d))};   // обновить уже показанную картинку
async function net(k){const f=await tout(ready,10000);if(!f)return null;const d=await f(k).catch(()=>null);if(!d)return null;
 meta().then(mt=>idb.put(k,{d,t:mt&&mt[k]?mt[k].t:0}));return d}
async function revalidate(k,c){const mt=await meta();if(!mt||!mt[k]||mt[k].t===c.t)return;
 const f=await ready,d=await f(k).catch(()=>null);if(!d)return;
 idb.put(k,{d,t:mt[k].t});if(d!==c.d){mem[k]=Promise.resolve(d);put(k,d)}}
const fromDb=k=>mem[k]??=(async()=>{const c=await idb.get(k);if(c&&c.d){revalidate(k,c).catch(()=>{});return c.d}return net(k)})()
 .then(d=>{if(d)res[k]=d;else delete mem[k];return d});
window.imgPut=(k,d,t)=>{mem[k]=Promise.resolve(d);idb.put(k,{d,t:t||0});put(k,d)};   // админка кладёт сюда свежезагруженное
const PROPS=['--wall-l','--wall-p','--edge','--corner','--smoke'];
const check=()=>{const th=h.dataset.theme,p=th=='old'?'old-':'',por=matchMedia('(orientation:portrait)').matches,live=()=>th==h.dataset.theme;
 h.classList.remove('no-bg','no-ed','no-cn');PROPS.forEach(x=>h.style.removeProperty(x));used={};
 const probe=(key,prop,cls)=>{
  const db=()=>fromDb(key).then(d=>{if(!live())return;if(d){used[prop]=key;h.style.setProperty(prop,css(d))}else if(cls)h.classList.add(cls)});
  if(miss.has(key)){if(res[key]){used[prop]=key;h.style.setProperty(prop,css(res[key]))}else db();return}   // уже знаем, что файла нет: без проверки и без мигания
  const i=new Image();i.onerror=()=>{miss.add(key);db()};i.src=key+'.webp'};
 probe(p+'bg-pc','--wall-l',!por&&'no-bg');probe(p+'bg-phone','--wall-p',por&&'no-bg');
 probe(p+'edge-t','--edge','no-ed');probe(p+'corner','--corner','no-cn');
 if(th!='old')probe('smoke','--smoke',0)};
/* прогрев кэша: сначала тема, с которой открыли страницу, затем вторая. В БД идём только за тем, чего нет рядом с сайтом */
const keys=th=>{const o=th=='old',p=o?'old-':'',por=matchMedia('(orientation:portrait)').matches;
 return[p+(por?'bg-phone':'bg-pc'),p+'edge-t',p+'corner',...(o?[]:['smoke']),p+(por?'bg-pc':'bg-phone')]};
const here=u=>fetch(u,{method:'HEAD'}).then(r=>r.status!=404,()=>true);   // false только при честном 404
ready.then(async()=>{for(const th of[first,first=='old'?'new':'old'])for(const k of keys(th))if(!res[k]&&!(await here(k+'.webp'))){miss.add(k);await fromDb(k)}}).catch(()=>{});
matchMedia('(orientation:portrait)').addEventListener?.('change',check);
window.setTheme=t=>{t=t=='old'?'old':'new';h.dataset.theme=t;
 if(m())m().content=t=='old'?'#120d08':'#070b16';
 document.querySelectorAll('.theme').forEach(b=>{const o=t=='old';b.setAttribute('aria-pressed',o);b.title=b.ariaLabel=o?'Новая тема':'Старая тема'});
 try{localStorage.setItem('theme',t)}catch(e){}check()};
window.toggleTheme=()=>setTheme(h.dataset.theme=='old'?'new':'old')})();
const FX=(()=>{const rm=matchMedia('(prefers-reduced-motion:reduce)').matches,seen=new Set();
document.querySelectorAll('.frame').forEach(b=>['t','b','l','r','tl','tr','bl','br'].forEach(c=>{const i=document.createElement('i');i.className=(c.length>1?'cn ':'ed ')+c;i.setAttribute('aria-hidden','true');b.prepend(i)}));
/* тлеющий огонёк на заднем плане и струя дымка */
{const e=document.createElement('div'),N=30;
e.className='ember';e.setAttribute('aria-hidden','true');
e.innerHTML='<i class="eg"></i>'+Array.from({length:N},(_,i)=>`<i class="sm" style="--i:${i};--a:${18+(i*7)%9}px;--n:${N}"><b></b></i>`).join('')+'<i class="eb"></i><i class="ef"></i>';
document.body.append(e)}
/* дымок новой темы */
{const e=document.createElement('div');e.className='smoke';e.setAttribute('aria-hidden','true');e.innerHTML='<i></i>';document.body.append(e)}
return{enter(sel,all){let i=0;document.querySelectorAll(sel).forEach(el=>{
 if(!all){const k=el.dataset.id;if(seen.has(k))return;seen.add(k)}
 if(!rm&&el.animate)el.animate([{opacity:0},{opacity:1}],{duration:380,delay:Math.min(i++*40,240),easing:'ease-out',fill:'backwards'})})}}})();
setTheme(document.documentElement.dataset.theme);
