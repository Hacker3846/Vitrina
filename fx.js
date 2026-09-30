const FX=(()=>{const rm=matchMedia('(prefers-reduced-motion:reduce)').matches,seen=new Set();
document.querySelectorAll('.frame').forEach(b=>['tl','tr','bl','br'].forEach(c=>{const i=document.createElement('i');i.className='cn '+c;b.prepend(i)}));
return{enter(sel,all){let i=0;document.querySelectorAll(sel).forEach(el=>{
 if(!all){const k=el.dataset.id;if(seen.has(k))return;seen.add(k)}
 if(!rm&&el.animate)el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:400,delay:i++*50,easing:'ease-out',fill:'backwards'})})}}})();
