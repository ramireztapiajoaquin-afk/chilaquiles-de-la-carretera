(function(){
  const money=n=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
  function addStyles(){
    if(document.getElementById('decision-pro-style'))return;
    const st=document.createElement('style');
    st.id='decision-pro-style';
    st.textContent=`.decision-center-pro{margin-top:16px;position:relative;overflow:hidden}.decision-center-pro:before{content:"";position:absolute;right:-90px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(87,199,255,.22),transparent 68%);pointer-events:none}.decision-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.decision-card{position:relative;overflow:hidden;border-radius:22px;padding:16px;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.055));border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 50px rgba(0,0,0,.2)}.decision-card:after{content:"";position:absolute;right:-44px;bottom:-58px;width:130px;height:130px;border-radius:50%;background:rgba(87,199,255,.12)}.decision-card .decision-icon{font-size:25px}.decision-card span{display:block;color:#aebed0;font-size:10px;font-weight:950;letter-spacing:.08em;margin-top:9px}.decision-card b{display:block;font-size:22px;margin-top:5px;letter-spacing:-.03em}.decision-card small{display:block;color:#91a3b8;font-weight:800;margin-top:5px}.decision-text{display:grid;gap:10px;margin-top:14px}.decision-line{padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#dbe7f5}.decision-line strong{color:#fff}.decision-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:950;letter-spacing:.05em;margin-bottom:6px}.decision-badge.green{background:rgba(66,211,146,.15);color:#9affca;border:1px solid rgba(66,211,146,.28)}.decision-badge.yellow{background:rgba(244,201,93,.14);color:#ffe6a3;border:1px solid rgba(244,201,93,.3)}.decision-badge.red{background:rgba(255,107,107,.14);color:#ffd6d6;border:1px solid rgba(255,107,107,.28)}@media(max-width:1160px){.decision-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.decision-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }
  function readRows(){
    return Array.from(document.querySelectorAll('#profitAdvancedRows tr')).map(tr=>{
      const td=Array.from(tr.children).map(x=>x.textContent.trim());
      return {producto:td[1]||'',precio:num(td[2]),costo:num(td[3]),utilidad:num(td[4]),margen:num(td[5]),unidades:num(td[6]),ganancia:num(td[7]),reco:td[8]||''};
    }).filter(x=>x.producto);
  }
  function ensureSection(){
    let sec=document.getElementById('decisionCenterPro');
    if(sec)return sec;
    const ref=document.querySelector('#profitProActions')?.closest('section')||document.querySelector('#predictionNarrative')?.closest('section');
    sec=document.createElement('section');
    sec.id='decisionCenterPro';
    sec.className='panel decision-center-pro';
    sec.innerHTML='<h3>🧠 Centro de Decisiones PRO</h3><div class="panel-body"><div id="decisionCards" class="decision-grid"></div><div id="decisionText" class="decision-text"></div></div>';
    if(ref&&ref.parentNode)ref.parentNode.insertBefore(sec,ref.nextSibling); else document.querySelector('.wrap')?.appendChild(sec);
    return sec;
  }
  function badge(type,text){return `<span class="decision-badge ${type}">${text}</span>`}
  function render(){
    addStyles();
    ensureSection();
    const rows=readRows();
    const cards=document.getElementById('decisionCards');
    const text=document.getElementById('decisionText');
    if(!cards||!text)return;
    if(!rows.length){
      cards.innerHTML='<div class="decision-card"><div class="decision-icon">⏳</div><span>ESPERANDO VENTAS</span><b>Sin datos</b><small>Se activará al cobrar pedidos</small></div>';
      text.innerHTML='<div class="decision-line">Todavía no hay información suficiente para generar decisiones automáticas.</div>';
      return;
    }
    const topMargin=[...rows].sort((a,b)=>b.margen-a.margen)[0];
    const topProfit=[...rows].sort((a,b)=>b.ganancia-a.ganancia)[0];
    const lowMargin=rows.filter(x=>x.margen>0&&x.margen<45).sort((a,b)=>a.margen-b.margen);
    const highMargin=rows.filter(x=>x.margen>=65).sort((a,b)=>b.margen-a.margen);
    const invAlert=num(document.getElementById('inventoryAlerts')?.textContent||'0');
    const deltaText=document.getElementById('salesDelta')?.textContent||'';
    const salesDown=/▼/.test(deltaText);
    const mainAction=invAlert>0?'Comprar insumos':salesDown?'Recuperar ventas':highMargin[0]?('Impulsar '+highMargin[0].producto):(topProfit?('Mantener '+topProfit.producto):'Mantener operación');
    cards.innerHTML=[
      ['✅','ACCIÓN PRINCIPAL',mainAction,invAlert>0?'Inventario primero':salesDown?'Ventas abajo':'Aprovechar margen','good'],
      ['💰','MÁS GANANCIA',topProfit.producto,money(topProfit.ganancia)+' total','good'],
      ['🚀','MAYOR MARGEN',topMargin.producto,topMargin.margen.toFixed(1)+'% margen','good'],
      ['⚠️','A REVISAR',lowMargin.length?lowMargin[0].producto:'Sin riesgo',lowMargin.length?lowMargin[0].margen.toFixed(1)+'% margen':'Márgenes sanos',lowMargin.length?'warn':'good']
    ].map(c=>`<div class="decision-card"><div class="decision-icon">${c[0]}</div><span>${c[1]}</span><b class="${c[4]}">${esc(c[2])}</b><small>${esc(c[3])}</small></div>`).join('');
    const lines=[];
    if(highMargin[0])lines.push(`${badge('green','IMPULSAR')} Promociona <strong>${esc(highMargin[0].producto)}</strong>: margen ${highMargin[0].margen.toFixed(1)}%, utilidad por unidad ${money(highMargin[0].utilidad)}.`);
    if(topProfit)lines.push(`${badge('green','MANTENER')} <strong>${esc(topProfit.producto)}</strong> es el que más dinero deja en total: ${money(topProfit.ganancia)}.`);
    if(lowMargin.length)lines.push(`${badge('yellow','REVISAR')} <strong>${esc(lowMargin[0].producto)}</strong> tiene margen bajo (${lowMargin[0].margen.toFixed(1)}%). Conviene revisar costo, porción o precio.`);
    else lines.push(`${badge('green','RENTABILIDAD SANA')} No hay productos vendidos con margen menor a 45% en este periodo.`);
    if(invAlert>0)lines.push(`${badge('red','INVENTARIO')} Hay ${invAlert} alerta(s) de inventario. Prioridad: revisar Compras PRO antes de impulsar ventas.`);
    else lines.push(`${badge('green','INVENTARIO ESTABLE')} No hay compras urgentes detectadas por el semáforo actual.`);
    if(salesDown)lines.push(`${badge('yellow','VENTAS')} Las ventas van abajo contra el periodo anterior. Conviene activar una promoción o empujar el producto con mejor margen.`);
    text.innerHTML=lines.map(x=>`<div class="decision-line">${x}</div>`).join('');
  }
  let t=null;function schedule(){clearTimeout(t);t=setTimeout(render,250)}
  document.addEventListener('DOMContentLoaded',schedule);
  window.addEventListener('load',()=>{schedule();setTimeout(schedule,1200);setTimeout(schedule,3000)});
  const obs=new MutationObserver(schedule);
  obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
