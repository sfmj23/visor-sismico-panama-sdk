/* Esri Panama | Visor sismico v4 | ArcGIS Maps SDK for JavaScript 4.33 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const fmt=new Intl.DateTimeFormat('es-PA',{timeZone:'America/Panama',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const short=new Intl.DateTimeFormat('es-PA',{timeZone:'America/Panama',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
const status=$('sourceStatus');
if(typeof require!=='function'){status.textContent='No se pudo cargar ArcGIS Maps SDK. Comprueba tu conexión.';return;}
require(['esri/Map','esri/views/MapView','esri/layers/WebTileLayer','esri/layers/GraphicsLayer','esri/Graphic','esri/geometry/Point','esri/widgets/ScaleBar'],
(Map,MapView,WebTileLayer,GraphicsLayer,Graphic,Point,ScaleBar)=>{
  const esriTiles=(service,opts={})=>new WebTileLayer({urlTemplate:`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{level}/{row}/{col}`,copyright:'Esri',...opts});
  const imagery=esriTiles('World_Imagery');
  const labels=new WebTileLayer({urlTemplate:'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{level}/{row}/{col}',copyright:'Etiquetas © Esri',listMode:'hide'});
  const bases={imagery,topo:esriTiles('World_Topo_Map'),gray:esriTiles('Canvas/World_Light_Gray_Base'),streets:esriTiles('World_Street_Map')};
  const quakes=new GraphicsLayer({title:'Eventos sísmicos',listMode:'hide'});
  const map=new Map({layers:[imagery,labels,quakes]});
  const view=new MapView({container:'map',map,center:[-80.8,8.15],zoom:7,ui:{components:['attribution']},popup:{dockEnabled:false}});
  view.ui.add(new ScaleBar({view,unit:'metric',style:'line'}),'bottom-left');
  let locationGraphic=null,events=[],running=false,raf=0,last=0,progress=0,prevKey='',first=0,final=0;
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const navIcons={home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'};
  const nav=document.createElement('div');nav.className='arcgis-nav';
  const commands=[['home','Extensión inicial de Panamá',()=>view.goTo({center:[-80.8,8.15],zoom:7})],['plus','Acercar',()=>view.goTo({zoom:view.zoom+1})],['minus','Alejar',()=>view.goTo({zoom:view.zoom-1})],['locate','Localizar mi ubicación',locate]];
  for(const [key,title,fn] of commands){const b=document.createElement('button');b.type='button';b.className='arcgis-nav-button';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[key]}</svg>`;b.addEventListener('click',()=>Promise.resolve().then(fn).catch(console.error));nav.appendChild(b);}
  document.querySelector('.mapframe').appendChild(nav);
  let feedbackTimer;
  function feedback(message){const el=$('mapfeedback');el.textContent=message;el.hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>el.hidden=true,5000);}
  function locate(){if(!navigator.geolocation){feedback('Este navegador no admite geolocalización.');return;}feedback('Buscando tu ubicación…');navigator.geolocation.getCurrentPosition(async pos=>{const pt=new Point({longitude:pos.coords.longitude,latitude:pos.coords.latitude});if(locationGraphic)quakes.remove(locationGraphic);locationGraphic=new Graphic({geometry:pt,symbol:{type:'simple-marker',style:'circle',size:14,color:'#238ee8',outline:{color:'#fff',width:3}},popupTemplate:{title:'Tu ubicación aproximada'}});quakes.add(locationGraphic);await view.goTo({target:pt,zoom:11});feedback('Ubicación encontrada.');},err=>feedback(err.code===1?'Permiso de ubicación denegado.':err.code===2?'No se pudo determinar tu ubicación.':'La búsqueda tardó demasiado.'),{enableHighAccuracy:false,timeout:12000,maximumAge:60000});}
  function load(raw,sourceLabel='eventos.json · actualización manual'){if(!Array.isArray(raw))throw Error('eventos.json debe contener una lista');events=raw.map((e,i)=>({...e,_time:Date.parse(e.t),_i:i})).filter(e=>Number.isFinite(e._time)&&Number.isFinite(Number(e.x))&&Number.isFinite(Number(e.y))&&Number.isFinite(Number(e.m))).sort((a,b)=>a._time-b._time);if(!events.length)throw Error('No hay eventos válidos');first=events[0]._time;final=events.at(-1)._time;$('total').textContent=events.length;$('maxmag').textContent=Math.max(...events.map(e=>Number(e.m))).toFixed(1);const depths=events.filter(e=>e.d!==null&&e.d!==''&&Number.isFinite(Number(e.d)));$('depth').textContent=(depths.reduce((a,e)=>a+Number(e.d),0)/Math.max(depths.length,1)).toFixed(1)+' km';const daycount=new Set(events.map(e=>e.t.slice(0,10))).size;$('days').textContent=daycount+' '+(daycount===1?'día':'días');$('startdate').textContent=short.format(first);$('enddate').textContent=short.format(final);$('updated').textContent=fmt.format(final)+' (UTC−5)';status.textContent=`${events.length} eventos cargados desde ${sourceLabel} · ArcGIS Maps SDK 4.33`;progress=0;prevKey='';render(true);}
  function graphicFor(e){const m=Number(e.m),main=e._i===0&&m>=7;const fill=main?'#ef3f67':m>=6?'#ff6a58':m>=4?'#ffc04b':'#43c9f5';const radius=main?20:Math.max(7,Math.min(22,4+m*2.2));return new Graphic({geometry:new Point({longitude:Number(e.x),latitude:Number(e.y)}),symbol:{type:'simple-marker',style:'circle',size:radius*2,color:{...hexRGB(fill),a:main?.45:.32},outline:{color:main?'#ff8ca3':fill,width:main?2.2:1}},attributes:{m:e.m,t:e.t,d:e.d,s:e.s,r:e.r},popupTemplate:{title:`Magnitud ${esc(e.m)}`,content:`<div><b>Fecha:</b> ${esc(fmt.format(e._time))} (Panamá)</div><div><b>Profundidad:</b> ${esc(e.d)} km</div><div><b>Estado:</b> ${esc(e.s)}</div><div>${esc(e.r)}</div>`}});}
  function hexRGB(h){return {r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
  function render(force=false){if(!events.length)return;const now=first+(final-first)*progress;const floor=Number($('minmag').value);const visible=events.filter(e=>e._time<=now&&Number(e.m)>=floor);const key=visible.length+'|'+floor+'|'+(visible.at(-1)?._i??'');if(force||key!==prevKey){quakes.removeAll();quakes.addMany(visible.map(graphicFor));if(locationGraphic)quakes.add(locationGraphic);prevKey=key;}$('seen').textContent=visible.length+' '+(visible.length===1?'evento visible':'eventos visibles');$('clock').textContent=fmt.format(now)+' (UTC−5)';$('timeline').value=Math.round(progress*1000);$('progresspct').textContent=Math.round(progress*100)+'%';}
  function stop(){running=false;cancelAnimationFrame(raf);last=0;$('play').textContent='▶  Reproducir';}
  function tick(ts){if(!running)return;if(last)progress=Math.min(1,progress+(ts-last)/(Number($('speed').value)*1000));last=ts;render();if(progress>=1){stop();return;}raf=requestAnimationFrame(tick);}
  $('play').addEventListener('click',()=>{if(!events.length)return;if(running){stop();return;}if(progress>=1)progress=0;running=true;last=0;$('play').textContent='Ⅱ  Pausar';raf=requestAnimationFrame(tick);});
  $('reset').addEventListener('click',()=>{stop();progress=0;render(true);});
  $('timeline').addEventListener('input',e=>{stop();progress=Number(e.target.value)/1000;render(true);});
  $('minmag').addEventListener('input',e=>{$('maglabel').textContent=Number(e.target.value).toFixed(1);render(true);});
  $('basemap').addEventListener('change',e=>{const selection=e.target.value;map.removeAll();map.add(selection==='hybrid'?imagery:(bases[selection]||imagery));if(selection==='hybrid')map.add(labels);map.add(quakes);});
  // Consulta publica en ArcGIS Enterprise. La capa original permanece privada.
  const serviceUrl='https://arcgisdev.esri.pa/server/rest/services/Hosted/sismos_igc_up_public/FeatureServer/0';
  async function restQuery(params){
    const url=new URL(serviceUrl+'/query');
    for(const [key,value] of Object.entries({...params,f:'json'}))url.searchParams.set(key,String(value));
    const response=await fetch(url.toString(),{cache:'no-store'});
    if(!response.ok)throw Error('Enterprise HTTP '+response.status);
    const data=await response.json();
    if(data.error)throw Error('Enterprise: '+(data.error.message||data.error.code));
    return data;
  }
  async function loadEnterprise(){
    // Obtener IDs y consultar por lotes evita perder eventos al superar maxRecordCount.
    const idsResult=await restQuery({where:'1=1',returnIdsOnly:true});
    const ids=idsResult.objectIds;
    if(!Array.isArray(ids)||!ids.length)throw Error('El servicio no devolvio identificadores');
    const all=[];
    for(let i=0;i<ids.length;i+=200){
      const result=await restQuery({objectIds:ids.slice(i,i+200).join(','),outFields:'evento_id,fecha_hora,magnitud,profundidad_km,latitud,longitud,region,estado_revision',returnGeometry:false});
      if(!Array.isArray(result.features))throw Error('Respuesta sin eventos');
      all.push(...result.features);
    }
    if(all.length!==ids.length)throw Error(`Consulta incompleta: ${all.length} de ${ids.length}`);
    const raw=all.map(({attributes:a})=>({
      id:a.evento_id,
      t:a.fecha_hora==null?null:new Date(a.fecha_hora).toISOString(),
      m:a.magnitud,d:a.profundidad_km,x:a.longitud,y:a.latitud,
      s:a.estado_revision,r:a.region
    }));
    load(raw,'ArcGIS Enterprise · vista publica (consulta en vivo)');
  }
  async function loadFallback(){
    const response=await fetch('eventos.json',{cache:'no-store'});
    if(!response.ok)throw Error('Respaldo HTTP '+response.status);
    load(await response.json(),'eventos.json · respaldo estatico (no actualizado automaticamente)');
  }
  view.when(async()=>{
    try{await loadEnterprise();}
    catch(error){
      console.warn('No se pudo consultar Enterprise; usando respaldo:',error);
      try{await loadFallback();}
      catch(fallbackError){status.textContent='No se pudieron cargar eventos desde Enterprise ni desde eventos.json: '+fallbackError.message;console.error(fallbackError);}
    }
  }).catch(err=>{status.textContent='No se pudo inicializar el mapa ArcGIS: '+err.message;console.error(err);});
});
})();
