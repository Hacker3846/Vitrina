/* ALFIYA — общий модуль цен.
   Один код для каталога (index.html), страницы акций (promotions.html) и админки (admin.html):
   хранение условий, расчёт цены корзины, тексты и проверка формы.

   Документ в базе (kind:"shop-promotion", v:2):
   {
     mode:      "discount" | "combo" | "gift"
                  discount — простая скидка (без условий)
                  combo    — скидка, если клиент купил что-то другое (условия)
                  gift     — подарок за покупку (условия)
     name, desc, active, start, end
     conds:     [{sel, types, minMl, minQty}]   условия «клиент купил…» (для combo и gift)
     condLogic: "any" (ИЛИ — достаточно одного) | "all" (И — нужны все)
     scope:     sel — на что действует скидка
     vt:        "percent" | "amount"
     rows:      [{types, ml, to, val}]          строки скидки: вариант, объём от/до, размер
     gift:      текст подарка
   }
   sel   = {all, brands[], groups[], perfumes[]}   — «любой аромат» / бренды / группы / отдельные ароматы
   types = подмножество ["oil","orig-pour","orig-sealed"]; пусто = любой вариант
   Старые акции (без v:2) читаются и превращаются в эту модель автоматически. */
(function(g){
"use strict";
var TYPES=["oil","orig-pour","orig-sealed"];
var TYPE_NAME={"oil":"Масляный","orig-pour":"Оригинал на разлив","orig-sealed":"Оригинал запечатанный"};
var MINUS="−";

/* ---------- приведение данных ---------- */
var arr=function(a){return Array.isArray(a)?a.filter(function(x){return x!==""&&x!=null}).map(String):[]};
var num=function(v){v=Number(v);return isFinite(v)&&v>0?v:0};
function selN(s){s=s||{};return{all:!!s.all,brands:arr(s.brands),groups:arr(s.groups),perfumes:arr(s.perfumes)}}
function typesN(a){a=Array.isArray(a)?a:[];var r=TYPES.filter(function(t){return a.indexOf(t)>=0});return r.length===TYPES.length?[]:r}
function condN(c){c=c||{};return{sel:selN(c.sel),types:typesN(c.types),minMl:num(c.minMl),minQty:Math.max(1,Math.floor(num(c.minQty))||1)}}
function rowN(r){r=r||{};var ml=num(r.ml),to=num(r.to);if(to&&to<ml)to=ml;return{types:typesN(r.types),ml:ml,to:to,val:num(r.val)}}
function selEmpty(s){return!s.all&&!s.brands.length&&!s.groups.length&&!s.perfumes.length}

/* Любой документ акции (новый или старый) → единая модель */
function norm(raw){
 if(!raw)return null;
 var o={id:raw.id,name:String(raw.name||""),desc:String(raw.desc||""),active:raw.active!==false,start:raw.start||"",end:raw.end||"",ts:raw.ts||0};
 var mode="discount",conds=[],scope=selN(),rows=[],logic=raw.condLogic==="all"?"all":"any",vt=raw.vt==="amount"?"amount":"percent",gift=String(raw.gift||"");
 var tiers=function(a){return(a||[]).map(function(t){return rowN({ml:t.ml,val:t.val})})};
 if(raw.v>=2){
  mode=raw.mode==="gift"||raw.mode==="combo"?raw.mode:"discount";
  conds=(raw.conds||[]).map(condN);scope=selN(raw.scope);rows=(raw.rows||[]).map(rowN)}
 else if(raw.mode){                       /* прежний формат: trigger / targets / scope / minMl / tiers */
  mode=raw.mode;var all=!!raw.all,mn=num(raw.minMl);
  if(mode==="gift"){conds=[condN({sel:all?{all:true}:{perfumes:raw.scope},minMl:mn})]}
  else if(mode==="combo"){
   conds=[condN({sel:{perfumes:raw.trigger?[raw.trigger]:[]},minMl:mn})];
   scope=selN({perfumes:arr(raw.targets).filter(function(i){return i!==String(raw.trigger)})});rows=tiers(raw.tiers)}
  else{scope=all?selN({all:true}):selN({perfumes:raw.scope});rows=tiers(raw.tiers)}}
 else{                                    /* самый старый формат: type, ml, percent */
  mode=raw.type==="discount"?"discount":"gift";
  if(mode==="discount"){scope=selN({all:true});rows=[rowN({ml:raw.ml,val:raw.percent})]}
  else conds=[condN({sel:{all:true},minMl:raw.ml})]}
 rows=rows.filter(function(r){return r.val>0}).sort(function(a,b){return a.ml-b.ml||a.val-b.val});
 return Object.assign(o,{v:2,mode:mode,conds:conds,condLogic:logic,scope:scope,vt:vt,rows:rows,gift:mode==="gift"?gift:""})}

/* ---------- расчёт ---------- */
function matchSel(s,p){return!!(s.all||s.perfumes.indexOf(String(p.id))>=0||s.brands.indexOf(String(p.brandId))>=0||s.groups.indexOf(String(p.groupId))>=0)}
function condMet(c,x,env){return matchSel(c.sel,x.p)&&(!c.types.length||c.types.indexOf(x.t)>=0)&&(!c.minMl||env.vol(x)>=c.minMl)}
/* Условие выполняют ДРУГИЕ позиции корзины (не та, на которую считаем скидку) */
function condsOk(pr,L,self,env){
 if(!pr.conds.length)return true;
 var test=function(c){var q=0;for(var i=0;i<L.length;i++){var y=L[i];if(y!==self&&condMet(c,y,env))q+=y.q}return q>=c.minQty};
 return pr.condLogic==="all"?pr.conds.every(test):pr.conds.some(test)}
function cut(pr,r,base){return pr.vt==="amount"?Math.min(r.val,base):Math.round(base*Math.min(r.val,100)/100)}
/* Из всех подходящих строк берётся самая выгодная. Строка с объёмом (от/до) работает только для флаконов: у запечатанного объёма нет. */
function bestRow(pr,x,env){
 var v=env.vol(x),base=env.base(x),best=null,bd=0;
 pr.rows.forEach(function(r){
  if(r.types.length&&r.types.indexOf(x.t)<0)return;
  if((r.ml||r.to)&&!v)return;
  if(r.ml&&v<r.ml)return;if(r.to&&v>r.to)return;
  var d=cut(pr,r,base);if(d>bd){bd=d;best=r}});
 return best?{row:best,d:bd}:null}
/* L — позиции корзины {p, t, q, …}; env — {vol(x): объём флакона в мл (0 у запечатанного), base(x): цена позиции без доплаты за флакон}.
   Проставляет x.d (скидка за 1 шт.), x.pm (акция), x.pr (сработавшая строка). Возвращает акции-подарки. Скидки не суммируются — действует самая выгодная. */
function apply(L,promos,env){
 var G=[];L.forEach(function(x){x.d=0;x.pm=null;x.pr=null});
 (promos||[]).forEach(function(pr){
  if(pr.mode==="gift"){if(pr.gift&&pr.conds.length&&condsOk(pr,L,null,env))G.push(pr);return}
  L.forEach(function(x){
   if(!matchSel(pr.scope,x.p))return;
   var b=bestRow(pr,x,env);if(!b||b.d<=x.d||!condsOk(pr,L,x,env))return;
   x.d=b.d;x.pm=pr;x.pr=b.row})});
 return G}

function isLive(p,now){
 var d=new Date(now||Date.now());d.setHours(0,0,0,0);
 return p.active!==false&&(!p.start||new Date(p.start+"T00:00:00")<=d)&&(!p.end||new Date(p.end+"T23:59:59")>=d)}
/* F = {getDocs, query, where}; col — коллекция Firestore. Возвращает нормализованные акции, самые новые — первыми. */
function load(F,col){
 return F.getDocs(F.query(col,F.where("kind","==","shop-promotion"))).then(function(s){
  return s.docs.map(function(d){return norm(Object.assign({id:d.id},d.data()))}).sort(function(a,b){return(b.ts||0)-(a.ts||0)})})}
function resolve(sel,P){return P.filter(function(p){return matchSel(sel,p)})}

/* ---------- тексты ---------- */
function typeLabel(types){
 if(!types.length)return"";
 if(types.length===2&&types.indexOf("orig-pour")>=0&&types.indexOf("orig-sealed")>=0)return"оригинал (на разлив и запечатанный)";
 return types.map(function(t){return TYPE_NAME[t].toLowerCase()}).join(" или ")}
function volText(r){
 if(r.ml&&r.to)return r.ml===r.to?r.ml+" мл":"от "+r.ml+" до "+r.to+" мл";
 if(r.ml)return"от "+r.ml+" мл";if(r.to)return"до "+r.to+" мл";return""}
function valText(pr,val,cur){return MINUS+val+(pr.vt==="amount"?" "+cur:"%")}
function selParts(s,N){
 if(s.all)return["любой аромат"];
 var a=[],q=function(f,ids){return ids.map(function(i){return"«"+f(i)+"»"})};
 if(s.brands.length)a.push((s.brands.length>1?"бренды ":"бренд ")+q(N.brand,s.brands).join(", "));
 if(s.groups.length)a.push((s.groups.length>1?"группы ":"группа ")+q(N.group,s.groups).join(", "));
 if(s.perfumes.length){var n=q(N.perfume,s.perfumes);a.push((n.length>1?"ароматы ":"аромат ")+n.slice(0,5).join(", ")+(n.length>5?" и ещё "+(n.length-5):""))}
 return a}
function selText(s,N){return selParts(s,N).join("; ")||"…"}
function condText(c,N){
 var a=[selText(c.sel,N)],t=typeLabel(c.types);
 if(t)a.push(t);if(c.minMl)a.push("от "+c.minMl+" мл");if(c.minQty>1)a.push("от "+c.minQty+" шт.");
 return a.join(", ")}
function rowText(pr,r,cur){
 var a=[typeLabel(r.types),volText(r)].filter(Boolean).join(", ")||"любой вариант и объём";
 return a+" — "+valText(pr,r.val,cur)}
function condsText(p,N){
 var cs=p.conds.map(function(c){return condText(c,N)});
 if(!cs.length)return"";
 if(cs.length===1)return"При покупке: "+cs[0];
 return"При покупке: "+cs.map(function(c,i){return"("+(i+1)+") "+c}).join(p.condLogic==="all"?" — И — ":" — ИЛИ — ")}
/* Одна строка-описание для списка в админке и предпросмотра */
function summary(p,N,cur){
 var c=condsText(p,N),rows=p.rows.map(function(r){return rowText(p,r,cur)}).join("; ")||"…";
 if(p.mode==="gift")return(c?c+" → ":"")+"подарок «"+(p.gift||"…")+"»";
 return(c?c+" → скидка":"Скидка")+" на "+selText(p.scope,N)+": "+rows}

/* Описание по строкам для предпросмотра: [{k:"cond|scope|row|gift|sep", h:заголовок, t:текст}] */
function lines(p,N,cur){
 var a=[],all=p.condLogic==="all";
 p.conds.forEach(function(c,i){
  if(i)a.push({k:"sep",h:"",t:all?"И":"ИЛИ"});
  a.push({k:"cond",h:p.conds.length>1?"Условие "+(i+1):"Клиент покупает",t:condText(c,N)})});
 if(p.mode==="gift")a.push({k:"gift",h:"Подарок",t:p.gift||"…"});
 else{a.push({k:"scope",h:"Скидка на",t:selText(p.scope,N)});
  p.rows.forEach(function(r,i){a.push({k:"row",h:i?"":"Размер скидки",t:rowText(p,r,cur)})})}
 return a}

/* ---------- проверка формы (админка) ---------- */
function validate(d){
 if(!d.name)return"Укажите название акции";
 if(d.start&&d.end&&d.end<d.start)return"Дата окончания раньше даты начала";
 if(d.mode!=="discount"){
  if(!d.conds.length)return"Добавьте хотя бы одно условие";
  for(var i=0;i<d.conds.length;i++)if(selEmpty(d.conds[i].sel))return"Условие "+(i+1)+": выберите аромат, бренд, группу или «Все ароматы»"}
 if(d.mode==="gift")return d.gift?"":"Укажите подарок";
 if(selEmpty(d.scope))return"Выберите, на что действует скидка: ароматы, бренды, группы или «Все ароматы»";
 if(!d.rows.length)return"Добавьте хотя бы одну строку скидки (размер больше 0)";
 if(d.vt==="percent"&&d.rows.some(function(r){return r.val>100}))return"Скидка в процентах не может быть больше 100";
 return""}
function warnings(d){
 var w=[],has=function(t){return t.indexOf("orig-sealed")>=0};
 /* условие с явным набором «запечатанный + другой вариант» и порогом по мл: на запечатанных порог не сработает */
 var ci=[];d.conds.forEach(function(c,i){if(c.minMl&&c.types.length>1&&has(c.types))ci.push(i+1)});
 if(ci.length)w.push("Условие "+ci.join(", ")+": у запечатанных флаконов нет объёма, поэтому порог по мл на них не сработает. Если запечатанные тоже нужны — сделайте для них отдельное условие.");
 /* строки с объёмом работают только для флаконов; предупреждаем, только если запечатанным не досталось ни одной строки */
 var vol=d.rows.some(function(r){return(r.ml||r.to)&&(!r.types.length||has(r.types))});
 var sealedRow=d.rows.some(function(r){return!r.ml&&!r.to&&(!r.types.length||has(r.types))});
 if(vol&&!sealedRow)w.push("Запечатанные флаконы объёма не имеют, поэтому строки с «от … мл» на них не действуют — скидки на запечатанные не будет. Если она нужна, добавьте строку «Оригинал запечатанный».");
 return w}

/* ---------- сообщение в WhatsApp ---------- */
/* Приписка у позиции со скидкой: размер, сумма без скидки, название. full — сумма по позиции без скидки */
function note(x,money,full){
 if(!x.d||!x.pm)return"";
 var s=x.pm.vt==="amount"||!x.pr?MINUS+money(x.d):MINUS+x.pr.val+"%";
 return" (со скидкой "+s+", без скидки "+money(full)+"; акция «"+x.pm.name+"»)"}
function orderTail(G){return G.length?"\n\n"+G.map(function(p){return"Подарок по акции «"+p.name+"»: "+p.gift}).join("\n"):""}

g.AlfPricing={TYPES:TYPES,TYPE_NAME:TYPE_NAME,norm:norm,apply:apply,isLive:isLive,load:load,resolve:resolve,matchSel:matchSel,selEmpty:selEmpty,
 typeLabel:typeLabel,volText:volText,valText:valText,selParts:selParts,selText:selText,condText:condText,rowText:rowText,summary:summary,lines:lines,
 validate:validate,warnings:warnings,note:note,orderTail:orderTail}
})(typeof window!=="undefined"?window:globalThis);
