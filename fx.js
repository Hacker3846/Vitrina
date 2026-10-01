/* Две темы: «new» (лунная синева, по умолчанию) и «old» (золото). Выбор запоминается.
   Файлы старой темы называются old-*.webp.
   Если картинка не загрузилась из файла, берём её копию из БД (её кладёт админка из ZIP) и подставляем
   через CSS-переменную. Если нет и в БД, включается CSS-замена (классы no-bg / no-ed / no-cn на <html>).
   Проверка повторяется при каждой смене темы и поворота экрана. */
(()=>{const h=document.documentElement,m=()=>document.querySelector('meta[name=theme-color]');
let ask;const ready=new Promise(r=>ask=r),cache={};
window.dbImgSet=f=>ask(f);   // страница с Firebase отдаёт сюда функцию key -> dataURL | null
const fromDb=k=>cache[k]??=Promise.race([ready.then(f=>f(k)),new Promise(r=>setTimeout(()=>r(null),10000))]).catch(()=>null);
const PROPS=['--wall-l','--wall-p','--edge','--corner','--smoke'];
const check=()=>{const th=h.dataset.theme,p=th=='old'?'old-':'',por=matchMedia('(orientation:portrait)').matches;
 h.classList.remove('no-bg','no-ed','no-cn');PROPS.forEach(x=>h.style.removeProperty(x));
 const probe=(key,prop,cls)=>{const i=new Image();i.onerror=()=>fromDb(key).then(d=>{if(th!=h.dataset.theme)return;
   if(d)h.style.setProperty(prop,`url("${d}")`);else if(cls)h.classList.add(cls)});i.src=key+'.webp'};
 probe(p+'bg-pc','--wall-l',!por&&'no-bg');probe(p+'bg-phone','--wall-p',por&&'no-bg');
 probe(p+'edge-t','--edge','no-ed');probe(p+'corner','--corner','no-cn');
 if(th!='old')probe('smoke','--smoke',0)};
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
