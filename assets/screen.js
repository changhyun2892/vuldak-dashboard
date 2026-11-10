/* =====================================================================
   메인 스크린 (screen.html) — 발표용 관제 화면
   · 데이터는 기존 대시보드와 같은 data/*.csv를 d3.csv로 직접 읽는다 (숫자 하드코딩 없음).
   · 단위 변환은 각 행의 unit 컬럼을 보고 억원으로 바꾼다 (KRW ÷1e8, KRW_thousand ÷1e5, KRW_million ÷100).
   · CSV를 못 읽으면 가짜 값으로 채우지 않고 해당 패널에 오류 문구를 표시한다.
   · 해외 판매법인 매출(foreign_entities)과 면스낵 수출(segments)은 서로 더하거나 나누지 않는다.
   ===================================================================== */
(function(){
'use strict';
function showGlobeErr(msg){const e=document.getElementById('globeErr');if(!e)return;e.style.display='block';e.innerHTML='<b style="color:#E0574F">지구본 오류</b><br>'+String(msg).replace(/</g,'&lt;');}
window.addEventListener('error',ev=>{ if(window.__globeInit && !window.__globeOK) showGlobeErr((ev.message||'')+(ev.filename?' @ '+ev.filename.split('/').pop()+':'+ev.lineno:'')); });
const ENTITY_GEO = {
  '미국':{lat:39.8,lng:-98.6,country:'United States of America',anchor:'left'},
  '중국':{lat:35.9,lng:104.2,country:'China',anchor:'left-down'},
  '일본':{lat:36.2,lng:138.3,country:'Japan',anchor:'below'},
  '인도네시아':{lat:-2.5,lng:118.0,country:'Indonesia',anchor:'right'},
  '유럽':{lat:50.0,lng:10.0,country:null,anchor:'left'}
};
const KOREA = {lat:37.57,lng:126.98};
const YEARS = [2023,2024,2025];
const C = {cyan:'#4FC3F7',blue:'#2F80D8',orange:'#F2A03D',green:'#7CC36A',red:'#E0574F',text:'#E8F0F7',sub:'#9FB3C8',unit:'#D98A4A'};
const NUMF='Barlow Semi Condensed';
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (v,d=0)=>v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = v=>v>=300?`${((v+100)/100).toFixed(1)}배`:(v>=0?'+':'')+v.toFixed(1)+'%';
const joEok = v=>{const j=Math.floor(v/10000),e=Math.round(v-j*10000);return j?`${j}조 ${fmt(e)}억원`:`${fmt(e)}억원`;};
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const $ = id=>document.getElementById(id);

let DATA = null;
const UNIT_DIV = {KRW:1e8, KRW_thousand:1e5, KRW_million:100};
function toEok(v, unit, file){
  if(v===''||v==null) return null;                      // 빈 값은 0이 아니라 null (예: 2023 유럽 = 설립 전)
  const d=UNIT_DIV[unit]; if(!d) throw new Error(`${file}: 알 수 없는 단위 "${unit}"`);
  const n=+v; if(!isFinite(n)) throw new Error(`${file}: 숫자가 아닌 값 "${v}"`);
  return n/d;
}
const DATA_ERR = {};
async function loadCSV(f){
  try{ return await d3.csv('data/'+f, {cache:'no-cache'}); }
  catch(e){ DATA_ERR[f]=e&&e.message||String(e); console.error('CSV 로드 실패', f, e); return null; }
}
function need(ok, msg){ if(!ok) throw new Error(msg); }
async function loadScreenData(){
  const files=['financials.csv','calculated_metrics.csv','quarterly_financials.csv','segments.csv','foreign_entities.csv','production.csv','search_monthly.csv'];
  const [fin,cm,qf,seg,fe,prod,sm]=await Promise.all(files.map(loadCSV));
  const D={};
  if(fin){
    D.annual={SY:{},NS:{}};
    fin.forEach(r=>{
      if(!(r.company_id in D.annual)) return;
      if(r.metric!=='revenue' && r.metric!=='operating_profit') return;
      const y=+r.year; if(!YEARS.includes(y)) return;
      const o=(D.annual[r.company_id][y] ??= {});
      o[r.metric==='revenue'?'rev':'op']=toEok(r.value,r.unit,'financials.csv');
    });
  }
  if(cm){
    D.margin={SY:{},NS:{}}; D.exportShare={SY:{}};
    cm.forEach(r=>{
      if(!(r.company_id in D.margin)) return;
      const y=+r.year;
      D.margin[r.company_id][y]=+r.operating_margin_pct;
      if(r.company_id==='SY' && r.noodle_export_share_pct!=='') D.exportShare.SY[y]=+r.noodle_export_share_pct;
    });
  }
  if(qf){
    const rows=c=>qf.filter(r=>r.company_id===c).sort((a,b)=>a.period.localeCompare(b.period));
    const sy=rows('SY'), ns=rows('NS');
    D.quarters=sy.map(r=>r.period.replace('-',''));                 // 2023-Q1 → 2023Q1
    D.qSY={rev:sy.map(r=>toEok(r.revenue,r.unit,'quarterly_financials.csv')),
           op:sy.map(r=>toEok(r.operating_profit,r.unit,'quarterly_financials.csv')),
           margin:sy.map(r=>+r.operating_margin_pct)};
    D.qNS={op:sy.map(s=>{ const n=ns.find(r=>r.period===s.period); return n?toEok(n.operating_profit,n.unit,'quarterly_financials.csv'):null; })};
  }
  if(seg){
    D.noodleExport={};
    seg.filter(r=>r.segment==='면스낵' && (r.company_id||'SY')==='SY').forEach(r=>{ D.noodleExport[+r.year]=toEok(r.exports,r.unit,'segments.csv'); });
  }
  if(fe){
    D.entities={};
    fe.filter(r=>(r.company_id||'SY')==='SY').forEach(r=>{
      if(!ENTITY_GEO[r.entity]){ console.warn('지구본 좌표가 없는 법인은 건너뜀:', r.entity); return; }
      (D.entities[r.entity] ??= {})[+r.year]=toEok(r.revenue,r.unit,'foreign_entities.csv');
    });
  }
  if(prod){
    D.plants2025=prod.filter(r=>+r.year===2025 && r.product==='면류' && (r.company_id||'SY')==='SY' && r.reported_time_utilization_pct!=='')
      .map(r=>({name:`${r.factory} 면류`, v:+r.reported_time_utilization_pct})).sort((a,b)=>b.v-a.v);
  }
  if(sm){
    const q=sm.filter(r=>r.query==='buldak');
    D.months=[...new Set(q.filter(r=>r.region==='Worldwide'||r.region==='US').map(r=>r.month.slice(0,7)))].sort();
    const ser=reg=>D.months.map(m=>{ const r=q.find(x=>x.region===reg && x.month.slice(0,7)===m); return r?+r.index:null; });
    D.searchWW=ser('Worldwide'); D.searchUS=ser('US');
  }
  return D;
}

/* ---------- stage scaling ---------- */
const stage=$('stage');
function fit(){
  const s=Math.min(innerWidth/1920,innerHeight/1080);
  stage.style.transform=`translate(${(innerWidth-1920*s)/2}px,${(innerHeight-1080*s)/2}px) scale(${s})`;
}
fit(); addEventListener('resize',fit);

/* ---------- clock ---------- */
function tick(){const d=new Date();const z=n=>String(n).padStart(2,'0');$('clock').firstChild.nodeValue=`${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;}
tick(); setInterval(tick,1000);

/* ---------- count-up helper ---------- */
function countUp(el,to,{from=0,dur=900,dec=0}={}){
  if(REDUCED){el.textContent=fmt(to,dec);return;}
  const t0=performance.now();
  (function step(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);
    el.textContent=fmt(from+(to-from)*e,dec); if(k<1) requestAnimationFrame(step);})(t0);
}

/* =====================================================================
   KPI
   ===================================================================== */
let company='SY';
function renderKpi(){
  need(DATA.annual&&DATA.margin, 'financials.csv / calculated_metrics.csv를 불러오지 못했습니다');
  const a=DATA.annual[company], m=DATA.margin[company];
  const name=company==='SY'?'삼양식품':'농심';
  $('kpiTitle').textContent=`${name} 핵심 지표 · 2025`;
  const g=(x,y)=>(x/y-1)*100;
  const rows=[
    {lab:'매출액',val:a[2025].rev,dec:1,u:'억원',chg:g(a[2025].rev,a[2024].rev),type:'pct'},
    {lab:'영업이익',val:a[2025].op,dec:1,u:'억원',chg:g(a[2025].op,a[2024].op),type:'pct'},
    {lab:'영업이익률',val:m[2025],dec:1,u:'%',chg:+(m[2025]-m[2024]).toFixed(1),type:'pp'},
    company==='SY'
      ? {lab:'면스낵 수출 비중',val:DATA.exportShare.SY[2025],dec:1,u:'%',chg:+(DATA.exportShare.SY[2025]-DATA.exportShare.SY[2024]).toFixed(1),type:'pp',foot:'면스낵 사업 안의 비중 · 전사 해외비중 아님'}
      : {lab:'면스낵 수출 비중',val:null,u:'',type:'na',foot:'사이트 데이터에 같은 기준 값 없음'}
  ];
  $('kpis').innerHTML=rows.map((r,i)=>{
    const b=r.type==='na'?'<span class="badge na">해당 없음</span>'
      :`<span class="badge ${r.chg>=0?'up':'down'}">${r.chg>=0?'▲':'▼'} ${Math.abs(r.chg).toFixed(1)}${r.type==='pp'?'%p':'%'}</span>`;
    const v=r.val==null?'<span style="color:var(--sub);font-size:32px">–</span>':`<span class="num" id="kv${i}">0</span><span class="u">${r.u}</span>`;
    return `<div class="kpi"><div class="lab">${r.lab}</div><div class="val">${v}</div>${b}${r.foot?`<div class="foot">${r.foot}</div>`:''}</div>`;
  }).join('');
  rows.forEach((r,i)=>{ if(r.val!=null) countUp($('kv'+i),r.val,{dec:r.dec,dur:800}); });
  const x=a[2025].rev/a[2023].rev;
  $('kpiInsight').textContent= company==='SY'
    ? `2023년 대비 매출 ${x.toFixed(1)}배 · 영업이익 ${(a[2025].op/a[2023].op).toFixed(1)}배`
    : `2023년 대비 매출 ${pct((x-1)*100)} · 영업이익률 ${m[2025].toFixed(1)}%`;
}

/* =====================================================================
   ECharts 공통
   ===================================================================== */
const charts=[];
function mk(id){const c=echarts.init($(id),null,{renderer:'canvas'});charts.push(c);return c;}
const axisTxt={color:C.sub,fontSize:15,fontFamily:NUMF};
const tip={trigger:'axis',backgroundColor:'rgba(10,22,40,.95)',borderColor:C.cyan,textStyle:{color:'#fff',fontSize:16}};

function initQuarterlyOp(){
  need(DATA.qSY&&DATA.qNS, 'quarterly_financials.csv를 불러오지 못했습니다');
  const ch=mk('qopChart'); const Q=DATA.quarters.map(q=>q.slice(2).replace('Q',' Q'));
  const last=(arr,color)=>arr.map((v,i)=>i===arr.length-1?{value:v,label:{show:true,position:'right',color,fontSize:18,fontWeight:600,fontFamily:NUMF,formatter:p=>fmt(p.value)}}:v);
  ch.setOption({
    animationDuration:1200,
    grid:{left:64,right:62,top:38,bottom:28},
    legend:{top:0,textStyle:{color:C.text,fontSize:16},itemWidth:16,itemHeight:10,data:['삼양식품','농심']},
    tooltip:{...tip,axisPointer:{type:'shadow'},valueFormatter:v=>fmt(v)+'억원'},
    xAxis:{type:'value',axisLabel:{...axisTxt,fontSize:14},splitLine:{show:false},axisLine:{show:true,lineStyle:{color:'rgba(169,189,208,.4)',width:1.5}},splitNumber:3},
    yAxis:{type:'category',data:Q,axisLabel:{...axisTxt,fontSize:14,fontFamily:'Noto Sans KR'},axisTick:{show:false},axisLine:{lineStyle:{color:'rgba(169,189,208,.4)',width:1.5}}},
    series:[
      {name:'삼양식품',type:'bar',barWidth:8,barGap:'40%',itemStyle:{color:C.red,borderRadius:[0,3,3,0]},data:last(DATA.qSY.op,C.red)},
      {name:'농심',type:'bar',barWidth:8,itemStyle:{color:C.blue,borderRadius:[0,3,3,0]},data:last(DATA.qNS.op,C.blue)}
    ]
  });
  const i=DATA.qSY.op.findIndex((v,k)=>v>DATA.qNS.op[k]);
  $('qopInsight').textContent=`${DATA.quarters[i].replace('Q',' Q')}부터 삼양이 농심을 앞섬`;
}

function initPlantGauges(){
  need(DATA.plants2025&&DATA.plants2025.length, 'production.csv를 불러오지 못했습니다');
  const ch=mk('plantChart');
  const colorOf=v=>v>=80?C.cyan:v>=60?C.orange:C.red;
  ch.setOption({series:DATA.plants2025.map((p,i)=>({
    type:'gauge',center:[`${18+i*32}%`,'52%'],radius:'86%',startAngle:225,endAngle:-45,min:0,max:100,
    progress:{show:true,roundCap:false,width:10,itemStyle:{color:colorOf(p.v)}},
    axisLine:{lineStyle:{width:10,color:[[1,'rgba(255,255,255,.08)']]}},
    splitNumber:20,axisTick:{show:true,distance:-22,length:4,splitNumber:1,lineStyle:{color:'rgba(159,179,200,.35)',width:1}},
    pointer:{show:false},splitLine:{show:false},axisLabel:{show:false},
    title:{offsetCenter:[0,'82%'],color:C.sub,fontSize:17,fontWeight:500},
    detail:{offsetCenter:[0,'0%'],formatter:'{value}%',color:'#fff',fontSize:38,fontWeight:600,fontFamily:NUMF},
    animationDuration:1600,
    data:[{value:p.v,name:p.name}]
  }))});
  const top=[...DATA.plants2025].sort((a,b)=>b.v-a.v)[0];
  $('plantInsight').textContent=`최고 ${top.name} ${top.v}% · 밀양은 2025 하반기 2공장 가동으로 산정기준 변경`;
}

function dial(id,v,color){
  const ch=mk(id);
  ch.setOption({series:[{type:'gauge',center:['50%','66%'],radius:'92%',min:0,max:30,splitNumber:3,startAngle:200,endAngle:-20,
    // 트랙: 20% 이상 구간만 아주 옅은 그린으로 표시 (업계 상위 수익성 기준선)
    axisLine:{lineStyle:{width:8,color:[[20/30,'rgba(255,255,255,.08)'],[1,'rgba(124,195,106,.28)']]}},
    progress:{show:true,width:8,itemStyle:{color}},
    axisTick:{show:false},
    splitLine:{distance:-8,length:8,lineStyle:{color:'rgba(159,179,200,.55)',width:1}},
    axisLabel:{distance:12,color:C.sub,fontSize:13,fontFamily:NUMF,formatter:x=>x+'%'},
    pointer:{show:false},anchor:{show:false},title:{show:false},
    detail:{offsetCenter:[0,'-6%'],formatter:x=>x.toFixed(1)+'{u|%}',color:'#fff',fontSize:40,fontWeight:600,fontFamily:NUMF,
      rich:{u:{fontSize:18,color:C.unit,fontFamily:'Noto Sans KR',padding:[0,0,6,2]}}},
    animationDuration:1600,animationEasing:'cubicOut',
    data:[{value:v}]}]});
}
function initMarginGauges(){
  need(DATA.margin, 'calculated_metrics.csv를 불러오지 못했습니다');
  dial('dialSY',DATA.margin.SY[2025],C.red); dial('dialNS',DATA.margin.NS[2025],C.blue);
  $('profitInsight').textContent=`삼양 영업이익률, 농심의 ${(DATA.margin.SY[2025]/DATA.margin.NS[2025]).toFixed(1)}배`;
}

function initQuarterlyRevenue(){
  need(DATA.qSY, 'quarterly_financials.csv를 불러오지 못했습니다');
  const ch=mk('qrevChart'); const Q=DATA.quarters.map(q=>q.endsWith('Q1')?q.slice(0,4):'');
  ch.setOption({
    animationDuration:1200,
    grid:{left:56,right:46,top:34,bottom:30},
    legend:{top:0,textStyle:{color:C.text,fontSize:15},itemWidth:14,itemHeight:9},
    tooltip:{...tip,formatter:ps=>DATA.quarters[ps[0].dataIndex]+'<br>'+ps.map(p=>`${p.marker}${p.seriesName} ${p.seriesIndex?p.value.toFixed(1)+'%':fmt(p.value)+'억원'}`).join('<br>')},
    xAxis:{type:'category',data:Q,axisLabel:{...axisTxt,interval:0},axisTick:{show:false},axisLine:{lineStyle:{color:'rgba(169,189,208,.4)',width:1.5}}},
    yAxis:[{type:'value',splitNumber:3,axisLabel:{...axisTxt,fontSize:14,formatter:v=>fmt(v)},splitLine:{lineStyle:{color:'rgba(169,189,208,.12)'}}},
           {type:'value',min:0,max:30,splitNumber:3,axisLabel:{...axisTxt,fontSize:14,formatter:'{value}%'},splitLine:{show:false}}],
    series:[
      {name:'매출액(억원)',type:'bar',barWidth:12,itemStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:C.blue},{offset:1,color:'rgba(61,155,240,.35)'}]},borderRadius:[3,3,0,0]},data:DATA.qSY.rev},
      {name:'영업이익률(%)',type:'line',yAxisIndex:1,smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:3,color:C.green},itemStyle:{color:C.green},data:DATA.qSY.margin}
    ]
  });
}

function initSearchTrend(){
  need(DATA.searchWW&&DATA.months&&DATA.months.length, 'search_monthly.csv를 불러오지 못했습니다');
  const ch=mk('searchChart');
  const peakI=DATA.searchWW.indexOf(Math.max(...DATA.searchWW)); const peakM=DATA.months[peakI];
  const area=(c,a)=>({type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:c.replace(')',`,${a})`).replace('rgb','rgba')},{offset:1,color:'rgba(0,0,0,0)'}]});
  ch.setOption({
    animationDuration:1600,
    grid:{left:40,right:18,top:40,bottom:30},
    legend:{top:0,textStyle:{color:C.text,fontSize:15},itemWidth:16,itemHeight:9},
    tooltip:{...tip},
    xAxis:{type:'category',data:DATA.months,boundaryGap:false,axisTick:{show:false},
      axisLabel:{...axisTxt,interval:0,formatter:(v,i)=>v.endsWith('-01')?v.slice(0,4):''},axisLine:{lineStyle:{color:'rgba(169,189,208,.4)',width:1.5}}},
    yAxis:{type:'value',min:0,max:100,splitNumber:2,axisLabel:{...axisTxt,fontSize:14},splitLine:{lineStyle:{color:'rgba(169,189,208,.12)'}}},
    series:[
      {name:'전 세계',type:'line',smooth:true,symbol:'none',lineStyle:{width:2.5,color:C.cyan},
       areaStyle:{color:area('rgb(79,195,247)',.32)},data:DATA.searchWW,
       markLine:{symbol:'none',silent:true,lineStyle:{type:'dashed',color:C.orange,width:1.5},label:{show:false},data:[{xAxis:peakM}]},
       markPoint:{symbol:'circle',symbolSize:12,itemStyle:{color:C.orange,borderColor:'#fff',borderWidth:2},
         label:{show:true,position:'left',distance:10,color:'#fff',fontSize:16,fontWeight:500,formatter:`최고점 ${peakM}`},
         data:[{coord:[peakM,DATA.searchWW[peakI]]}]}},
      {name:'미국',type:'line',smooth:true,symbol:'none',lineStyle:{width:3,color:C.orange},
       areaStyle:{color:'rgba(242,160,61,.10)'},data:DATA.searchUS}
    ]
  });
  $('searchInsight').textContent=`전 세계 관심도, 2023-01 대비 ${(DATA.searchWW[DATA.searchWW.length-1]/DATA.searchWW[0]).toFixed(1)}배 (지수)`;
}

/* =====================================================================
   3D 지구본 (globe.gl)
   ===================================================================== */
let TOPO = null;
let globe=null, playing=true, token=0, sceneIdx=0, idleTimer=null, userHold=false;
let maxEnt=1, maxExp=1;   // 데이터를 읽은 뒤 boot에서 계산
const st={points:[],arcs:[],rings:[],labels:[],polys:[]};
let countryFeat={};

function entRows(y){
  return Object.entries(DATA.entities).map(([k,o])=>({k,v:o[y],prev:o[y-1]??null}))
    .filter(r=>r.v!=null).sort((a,b)=>b.v-a.v);
}
function growth(r){return r.prev?((r.v/r.prev-1)*100):null}

function renderRank(y,activeK,shown){
  $('hudRankY').textContent=y;
  $('rankRows').innerHTML=entRows(y).map((r,i)=>{
    const g=growth(r); const isNew=r.prev==null && y>2023;
    const cls=(r.k===activeK?'active':'')+(shown&&!shown.has(r.k)?' wait':'');
    return `<div class="rrow ${cls}"><span class="rk">${i+1}</span><span class="nm">${r.k}</span><span class="rv num">${fmt(r.v)}억</span>
      <span class="rg num" style="color:${g==null?C.sub:g>=0?C.green:C.red}">${isNew?'NEW':g==null?'–':pct(g)}</span></div>`;
  }).join('');
}

function setTimeline(y){document.querySelectorAll('.tl-dot').forEach(d=>d.classList.toggle('on',+d.dataset.y===y));}

function koreaPoint(y){return {kind:'kr',lat:KOREA.lat,lng:KOREA.lng,alt:0.15+0.45*(DATA.noodleExport[y]/maxExp),color:C.cyan,r:0.32,
  label:`<b>대한민국</b><br>${y} 면스낵 수출 ${fmt(DATA.noodleExport[y])}억원`};}
function entPoint(k,y){const v=DATA.entities[k][y];const g=ENTITY_GEO[k];
  return {kind:'ent',k,lat:g.lat,lng:g.lng,alt:0.04+0.32*(v/maxEnt),color:C.orange,r:0.28,label:tipHtml(k,y)};}
function tipHtml(k,y){const v=DATA.entities[k][y],p=DATA.entities[k][y-1];
  return `<b>한국 → ${k}</b><br>${y} 판매법인 매출 ${fmt(v)}억원`+(p!=null?`<br>${y-1} ${fmt(p)}억원 · ${pct((v/p-1)*100)}`:'');}
function arcOf(k,y){const v=DATA.entities[k][y];const g=ENTITY_GEO[k];
  return {k,startLat:KOREA.lat,startLng:KOREA.lng,endLat:g.lat,endLng:g.lng,stroke:0.5+1.3*(v/maxEnt),label:tipHtml(k,y)};}
function labelOf(k,y,animate){const g=ENTITY_GEO[k];return {k,y,lat:g.lat,lng:g.lng,animate};}

function sync(){
  if(!globe) return;
  globe.pointsData([...st.points]).arcsData([...st.arcs]).ringsData([...st.rings]).htmlElementsData([...st.labels]).polygonsData([...st.polys]);
}
function polyFor(k){const n=ENTITY_GEO[k].country;return n&&countryFeat[n]?{k,f:countryFeat[n],kind:'ent'}:null;}

function midView(a,b,extra=0){
  const toR=Math.PI/180, toD=180/Math.PI;
  const [la1,lo1,la2,lo2]=[a.lat*toR,a.lng*toR,b.lat*toR,b.lng*toR];
  const x=Math.cos(la1)*Math.cos(lo1)+Math.cos(la2)*Math.cos(lo2), y=Math.cos(la1)*Math.sin(lo1)+Math.cos(la2)*Math.sin(lo2), z=Math.sin(la1)+Math.sin(la2);
  const d=Math.acos(Math.min(1,Math.sin(la1)*Math.sin(la2)+Math.cos(la1)*Math.cos(la2)*Math.cos(lo2-lo1)));
  return {lat:Math.atan2(z,Math.hypot(x,y))*toD-14,lng:Math.atan2(y,x)*toD,altitude:Math.min(3.2,1.5+d*1.15+extra)};
}
function view(p,ms){ if(globe) globe.pointOfView(p,REDUCED?0:ms); }

function burst(lat,lng,color,ms=2600){
  const r={lat,lng,color,maxR:5,speed:4,period:600};
  st.rings.push(r); sync();
  setTimeout(()=>{st.rings=st.rings.filter(x=>x!==r);sync();},ms);
}
const krRing={lat:KOREA.lat,lng:KOREA.lng,color:C.cyan,maxR:6,speed:3,period:900};

function clearScene(){st.points=[];st.arcs=[];st.labels=[];st.polys=[{kind:'kr',f:countryFeat['South Korea']}];st.rings=[krRing];sync();}

/* 연도 장면을 즉시 최종 상태로 (gotoYear / reduced motion) */
function staticYear(y){
  clearScene();
  st.points=[koreaPoint(y),...entRows(y).map(r=>entPoint(r.k,y))];
  st.arcs=entRows(y).map(r=>arcOf(r.k,y));
  st.labels=entRows(y).map(r=>labelOf(r.k,y,false));
  st.polys.push(...entRows(y).map(r=>polyFor(r.k)).filter(Boolean));
  sync();
  $('hudYearV').textContent=y; $('expV').textContent=fmt(DATA.noodleExport[y]);
  renderRank(y,null,null); setTimeline(y);
  view({lat:12,lng:105,altitude:2.8},1200);
}

async function guard(t,ms){await sleep(ms); if(t!==token) throw 'cancel'; while(!playing||userHold){await sleep(150); if(t!==token) throw 'cancel';}}

async function sceneIntro(t){
  clearScene(); setTimeline(null);
  $('hudYearV').textContent='2023'; $('expV').textContent='0'; renderRank(2023,null,new Set());
  view({lat:15,lng:-170,altitude:3.5},0);
  await guard(t,300);
  view({lat:KOREA.lat-20,lng:KOREA.lng+4,altitude:1.8},2200);
  await guard(t,1400);
  st.points=[{...koreaPoint(2023),alt:0.01}]; sync();
  await guard(t,50);
  st.points=[koreaPoint(2023)]; sync(); burst(KOREA.lat,KOREA.lng,C.cyan,2000);
  $('caption').textContent='불닭, 대한민국에서 세계로'; $('caption').classList.add('show');
  await guard(t,2400);
  $('caption').classList.remove('show');
}

async function sceneYear(y,t){
  setTimeline(y);
  st.arcs=[]; st.labels=[]; st.polys=[{kind:'kr',f:countryFeat['South Korea']}]; st.points=st.points.filter(p=>p.kind==='kr'); sync();
  const by=$('bigYear'); by.textContent=y; by.classList.remove('show'); void by.offsetWidth; by.classList.add('show');
  await guard(t,900);
  $('hudYearV').textContent=y;
  const prevExp=y>2023?DATA.noodleExport[y-1]:0;
  countUp($('expV'),DATA.noodleExport[y],{from:prevExp,dur:1400});
  // 지난 해 장면 정리, 한국 기둥 성장
  st.arcs=[]; st.labels=[]; st.polys=[{kind:'kr',f:countryFeat['South Korea']}];
  st.points=[koreaPoint(y)]; sync(); burst(KOREA.lat,KOREA.lng,C.cyan,1800);
  view({lat:KOREA.lat-20,lng:KOREA.lng+4,altitude:1.9},1000);
  const rows=entRows(y); const shown=new Set();
  renderRank(y,null,shown);
  await guard(t,1300);
  for(const r of rows){
    const g=ENTITY_GEO[r.k];
    view(midView(KOREA,g),1200);
    renderRank(y,r.k,shown);
    st.arcs.push(arcOf(r.k,y)); sync();
    await guard(t,1300);
    shown.add(r.k);
    st.points.push(entPoint(r.k,y));
    const pf=polyFor(r.k); if(pf) st.polys.push(pf);
    st.labels.push(labelOf(r.k,y,true)); sync();
    burst(g.lat,g.lng,C.orange,2600);
    renderRank(y,r.k,shown);
    await guard(t,r.prev==null&&y>2023?1700:900);
  }
  renderRank(y,null,shown);
  view({lat:12,lng:105,altitude:2.8},1500);
  await guard(t,3200);
}

async function sceneOutro(t){
  setTimeline(2025);
  st.arcs=st.arcs.map(a=>({...a,stroke:a.stroke*1.4,bright:true})); sync();
  $('caption').textContent=`2025 면스낵 수출 ${joEok(DATA.noodleExport[2025])} · 해외 판매법인 ${entRows(2025).length}곳`;
  $('caption').classList.add('show');
  globe.controls().autoRotate=true; globe.controls().autoRotateSpeed=0.6;
  try{ await guard(t,5200);} finally{ globe.controls().autoRotate=false; $('caption').classList.remove('show'); }
}

const SCENES=[sceneIntro,t=>sceneYear(2023,t),t=>sceneYear(2024,t),t=>sceneYear(2025,t),sceneOutro];
let runningToken=-1;
async function runFrom(i){
  const t=++token; runningToken=t;
  try{
    for(let k=i;;k=(k+1)%SCENES.length){ sceneIdx=k; await SCENES[k](t); }
  }catch(e){ if(e!=='cancel') console.error(e); }
}
function setPlaying(p){playing=p; $('playBtn').textContent=p?'❚❚':'▶';}
function playGlobe(){ if(REDUCED) return; setPlaying(true); if(runningToken!==token) runFrom(Math.max(1,Math.min(3,sceneIdx))); }
function pauseGlobe(){ setPlaying(false); }
function gotoYear(y){ token++; setPlaying(false); sceneIdx=YEARS.indexOf(y)+1;
  $('caption').classList.remove('show'); $('bigYear').classList.remove('show'); if(globe) globe.controls().autoRotate=false;
  staticYear(y); }
function restartGlobe(){ setPlaying(true); runFrom(0); }

function initExportGlobe(){
  window.__globeInit=true;
  const el=$('globe');
  need(DATA.entities&&DATA.noodleExport, 'foreign_entities.csv / segments.csv를 불러오지 못했습니다');
  const hasGL=(()=>{try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl')));}catch(e){return false;}})();
  if(typeof Globe!=='function'){ showGlobeErr('globe.gl 라이브러리를 불러오지 못했습니다'); return initGlobeFallback(); }
  if(!TOPO){ showGlobeErr('지도 데이터(assets/geo/countries-110m.json)를 불러오지 못했습니다'); return initGlobeFallback(); }
  if(typeof topojson==='undefined'){ showGlobeErr('topojson 라이브러리를 불러오지 못했습니다'); return initGlobeFallback(); }
  if(!hasGL){ showGlobeErr('이 브라우저에서 WebGL을 쓸 수 없어 막대 차트로 대신 표시합니다'); return initGlobeFallback(); }
  const feats=topojson.feature(TOPO,TOPO.objects.countries).features.filter(f=>f.properties.name!=='Antarctica');
  // 110m 데이터의 면적 0짜리 조각(북한 등)이 h3 계산을 깨뜨리므로 제거
  feats.forEach(f=>{ if(f.geometry.type==='MultiPolygon') f.geometry.coordinates=f.geometry.coordinates.filter(poly=>new Set(poly[0].map(pt=>pt.join(','))).size>=3); });
  feats.forEach(f=>countryFeat[f.properties.name]=f);
  const W=el.clientWidth,H=el.clientHeight;
  globe=Globe({animateIn:false})(el)
    .width(W).height(H)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true).atmosphereColor('#3E9BD8').atmosphereAltitude(0.14)
    .showGraticules(false)
    .hexPolygonsData(feats).hexPolygonResolution(3).hexPolygonMargin(0.5).hexPolygonUseDots(true)
    .hexPolygonColor(f=>f.properties.name==='South Korea'?C.cyan:'rgba(150,185,215,0.42)')
    .polygonsData([]).polygonGeoJsonGeometry(d=>d.f.geometry).polygonAltitude(0.006)
    .polygonCapColor(d=>d.kind==='kr'?'rgba(79,195,247,0.22)':'rgba(255,255,255,0.05)')
    .polygonSideColor(()=>'rgba(0,0,0,0)').polygonStrokeColor(d=>d.kind==='kr'?'rgba(79,195,247,.95)':'rgba(242,160,61,.9)').polygonsTransitionDuration(600)
    .pointsData([]).pointAltitude('alt').pointColor('color').pointRadius('r').pointsMerge(false).pointsTransitionDuration(REDUCED?0:900)
    .pointLabel('label')
    .arcsData([]).arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
    .arcStroke('stroke').arcAltitudeAutoScale(0.45)
    .arcColor(d=>d.bright?['rgba(150,220,255,1)','rgba(255,255,255,1)']:['rgba(79,195,247,0.9)','rgba(255,255,255,0.85)'])
    .arcDashLength(0.35).arcDashGap(0.15).arcDashInitialGap(()=>1).arcDashAnimateTime(REDUCED?0:1800)
    .arcsTransitionDuration(REDUCED?0:1200).arcLabel('label')
    .ringsData([krRing]).ringColor(d=>tt=>d.color===C.cyan?`rgba(79,195,247,${0.8*(1-tt)})`:`rgba(242,160,61,${0.8*(1-tt)})`)
    .ringMaxRadius('maxR').ringPropagationSpeed('speed').ringRepeatPeriod('period')
    .htmlElementsData([]).htmlAltitude(0.02)
    .htmlElement(d=>{
      const v=DATA.entities[d.k][d.y], p=DATA.entities[d.k][d.y-1];
      const isNew=p==null&&d.y>2023;
      const g=p!=null?(v/p-1)*100:null;
      const wrap=document.createElement('div'); wrap.style.cssText='width:0;height:0;position:relative;pointer-events:none';
      const div=document.createElement('div'); div.className='glabel '+(ENTITY_GEO[d.k].anchor||'right'); wrap.appendChild(div);
      div.innerHTML=`<div class="n">${d.k}${isNew?'<span class="new">NEW</span>':''}</div>
        <div class="v num"><span class="cv">${fmt(d.animate?0:v)}</span><span class="u">억원</span></div>
        ${g!=null?`<div class="g num" style="color:${g>=0?C.green:C.red}">전년 대비 ${pct(g)}</div>`:''}`;
      if(d.animate) countUp(div.querySelector('.cv'),v,{dur:1000});
      return wrap;
    });
  if(globe.htmlElementVisibilityModifier) globe.htmlElementVisibilityModifier((el,vis)=>{el.style.opacity=vis?1:0;});
  const mat=globe.globeMaterial(); mat.color.set('#0D2033'); if(mat.emissive){mat.emissive.set('#0b2238');mat.emissiveIntensity=0.25;} mat.shininess=4;
  window.__globe=globe;
  window.__globeOK=true;
  globe.renderer().domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showGlobeErr('그래픽(WebGL) 연결이 끊겼습니다. 새로고침(F5) 해주세요.');});
  const ctr=globe.controls(); ctr.minDistance=100*2.2; ctr.maxDistance=100*5; ctr.enablePan=false;
  ctr.addEventListener('start',()=>{userHold=true; clearTimeout(idleTimer);});
  ctr.addEventListener('end',()=>{clearTimeout(idleTimer); idleTimer=setTimeout(()=>{userHold=false;},6000);});
  globe.renderer().setPixelRatio(Math.min(2,devicePixelRatio||1));
  document.addEventListener('visibilitychange',()=>{ if(!globe) return; document.hidden?globe.pauseAnimation():globe.resumeAnimation(); });

  if(REDUCED){ setPlaying(false); staticYear(2025); }
  else { restartGlobe(); }
}

function initGlobeFallback(){
  if(!DATA||!DATA.entities) return;
  const fb=$('globeFallback'); fb.style.display='block';
  ['hudYear','hudRank','hudExport','hudTimeline'].forEach(id=>$(id).style.display='none');
  const ch=mk('globeFallback'); const rows=entRows(2025);
  ch.setOption({grid:{left:110,right:80,top:30,bottom:30},xAxis:{type:'value',axisLabel:axisTxt,splitLine:{lineStyle:{color:'rgba(169,189,208,.12)'}}},
    yAxis:{type:'category',inverse:true,data:rows.map(r=>r.k),axisLabel:{...axisTxt,fontSize:20,color:'#fff'}},
    series:[{type:'bar',barWidth:22,itemStyle:{color:C.red},label:{show:true,position:'right',color:'#fff',fontSize:18,formatter:p=>fmt(p.value)+'억원'},data:rows.map(r=>r.v)}]});
}

/* =====================================================================
   발표 모드
   ===================================================================== */
function toggleFS(){
  try{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else document.exitFullscreen().catch(()=>{});
  }catch(e){}
}
function setCompany(c){
  company=c;
  document.querySelectorAll('#coToggle button').forEach(b=>b.classList.toggle('on',b.dataset.co===c));
  $('hudNS').style.display=c==='NS'?'block':'none';
  renderKpi();
}
function initPresenterKeys(){
  $('fsBtn').onclick=toggleFS;
  document.querySelectorAll('#coToggle button').forEach(b=>b.onclick=()=>setCompany(b.dataset.co));
  $('playBtn').onclick=()=>playing?pauseGlobe():playGlobe();
  document.querySelectorAll('.tl-dot').forEach(d=>d.onclick=()=>gotoYear(+d.dataset.y));
  addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT') return;
    const k=e.key;
    if(k==='f'||k==='F'){toggleFS();}
    else if(k===' '){e.preventDefault(); playing?pauseGlobe():playGlobe();}
    else if(k==='1'||k==='2'||k==='3'){gotoYear(YEARS[+k-1]);}
    else if(k==='ArrowRight'||k==='ArrowLeft'){
      const cur=Math.min(3,Math.max(1,sceneIdx)); const n=Math.min(3,Math.max(1,cur+(k==='ArrowRight'?1:-1)));
      gotoYear(YEARS[n-1]);}
    else if(k==='s'||k==='S'){setCompany(company==='SY'?'NS':'SY');}
    else if(k==='r'||k==='R'){ if(!REDUCED) restartGlobe(); }
    else if(k==='?'||k==='/'){$('help').classList.toggle('show');}
    else if(k==='Escape'){$('help').classList.remove('show');}
  });
  let ct; const show=()=>{document.body.classList.remove('hide-cursor');clearTimeout(ct);ct=setTimeout(()=>document.body.classList.add('hide-cursor'),3000);};
  addEventListener('mousemove',show); show();
}
/* ---------- boot ---------- */
function safe(fn,id){
  try{ fn(); }
  catch(e){ console.error(e); if(id&&$(id)) $(id).innerHTML='<div class="err">데이터를 불러오지 못했습니다<br><small>'+String(e&&e.message||e).replace(/</g,'&lt;')+'</small></div>'; }
}
(async function boot(){
  initPresenterKeys();
  try{ DATA=await loadScreenData(); }
  catch(e){ console.error(e); DATA={}; }
  if(DATA.entities) maxEnt=Math.max(1,...Object.values(DATA.entities).flatMap(o=>Object.values(o).filter(v=>v!=null)));
  if(DATA.noodleExport) maxExp=Math.max(1,...Object.values(DATA.noodleExport).filter(v=>v!=null));
  safe(renderKpi,'kpis');
  safe(initQuarterlyOp,'qopChart');
  safe(initPlantGauges,'plantChart');
  safe(initMarginGauges,'dialSY');
  safe(initQuarterlyRevenue,'qrevChart');
  safe(initSearchTrend,'searchChart');
  try{ TOPO=await d3.json('assets/geo/countries-110m.json'); }catch(e){ console.error(e); TOPO=null; }
  try{ initExportGlobe(); }
  catch(e){ console.error(e); showGlobeErr(e&&e.message||e); try{ initGlobeFallback(); }catch(_){} }
  addEventListener('resize',()=>{charts.forEach(c=>c.resize());});
  // 사이트(index.html) 안 iframe으로 열렸을 때 키보드 단축키가 바로 먹도록
  addEventListener('mousedown',()=>window.focus());
})();
})();
