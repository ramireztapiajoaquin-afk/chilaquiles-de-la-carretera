(function(){
  const path=(location.pathname||'').toLowerCase();
  const enabled=['/meseros.html','/cocina.html','/caja.html','/dueno.html'].some(x=>path.endsWith(x));
  if(!enabled)return;

  // Cuenta PRO se añade como módulo externo únicamente en Meseros.
  // No modifica el HTML ni la lógica original del panel.
  if(path.endsWith('/meseros.html') && !document.querySelector('script[data-cuenta-pro]')){
    const script=document.createElement('script');
    script.src='cuenta-pro.js?v=3';
    script.defer=true;
    script.dataset.cuentaPro='1';
    document.head.appendChild(script);
  }

  // CRM Ventas PRO añade identificación opcional de cliente a Cuenta PRO.
  if(path.endsWith('/meseros.html') && !document.querySelector('script[data-crm-ventas-pro]')){
    const script=document.createElement('script');
    script.src='crm-ventas-pro.js?v=2';
    script.defer=true;
    script.dataset.crmVentasPro='1';
    document.head.appendChild(script);
  }

  // Promociones Ventas PRO añade promociones elegibles a Cuenta PRO.
  if(path.endsWith('/meseros.html') && !document.querySelector('script[data-promociones-ventas-pro]')){
    const script=document.createElement('script');
    script.src='promociones-ventas-pro.js?v=1';
    script.defer=true;
    script.dataset.promocionesVentasPro='1';
    document.head.appendChild(script);
  }

  // Caja PRO amplía únicamente el historial/corte para mostrar consumo, descuentos, propina y total cobrado.
  if(path.endsWith('/caja.html') && !document.querySelector('script[data-caja-pro]')){
    const script=document.createElement('script');
    script.src='caja-pro.js?v=3';
    script.defer=true;
    script.dataset.cajaPro='1';
    document.head.appendChild(script);
  }

  document.body.classList.add('punto-azul-staff');
  document.title=document.title.replace(/Chilaquiles de la Carretera/gi,'Punto Azul Restaurante');

  function replaceText(root){
    const walker=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      const p=n.parentElement;
      if(!p || ['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(p.tagName))return;
      if(/Chilaquiles de la Carretera/i.test(n.nodeValue||'')){
        n.nodeValue=(n.nodeValue||'').replace(/Chilaquiles de la Carretera/gi,'Punto Azul Restaurante');
      }
    });
  }

  function ensureDashboardProLink(){
    if(!path.endsWith('/dueno.html'))return;
    const links=document.querySelector('.links');
    if(!links || links.querySelector('[data-dashboard-pro-link]'))return;
    const a=document.createElement('a');
    a.className='link';
    a.href='dashboard-pro.html';
    a.dataset.dashboardProLink='1';
    a.innerHTML='<span>📊</span>Dashboard Ejecutivo PRO';
    links.insertBefore(a,links.firstChild);
  }

  function ensureInventoryProLink(){
    if(!path.endsWith('/dueno.html'))return;
    const links=document.querySelector('.links');
    if(!links || links.querySelector('[data-inventario-pro-link]'))return;
    const a=document.createElement('a');
    a.className='link';
    a.href='inventario-pro.html';
    a.dataset.inventarioProLink='1';
    a.innerHTML='<span>📦</span>Inventario PRO';
    const dashboard=links.querySelector('[data-dashboard-pro-link]');
    if(dashboard && dashboard.nextSibling)links.insertBefore(a,dashboard.nextSibling);
    else links.insertBefore(a,links.firstChild);
  }

  function ensurePurchasesProLink(){
    if(!path.endsWith('/dueno.html'))return;
    const links=document.querySelector('.links');
    if(!links || links.querySelector('[data-compras-pro-link]'))return;
    const a=document.createElement('a');
    a.className='link';
    a.href='compras-pro.html';
    a.dataset.comprasProLink='1';
    a.innerHTML='<span>🛒</span>Compras PRO';
    const inventory=links.querySelector('[data-inventario-pro-link]');
    if(inventory && inventory.nextSibling)links.insertBefore(a,inventory.nextSibling);
    else links.appendChild(a);
  }

  function ensureCrmProLink(){
    if(!path.endsWith('/dueno.html'))return;
    const links=document.querySelector('.links');
    if(!links || links.querySelector('[data-crm-pro-link]'))return;
    const a=document.createElement('a');
    a.className='link';
    a.href='crm-pro.html';
    a.dataset.crmProLink='1';
    a.innerHTML='<span>💎</span>CRM PRO · Lealtad';
    const purchases=links.querySelector('[data-compras-pro-link]');
    if(purchases && purchases.nextSibling)links.insertBefore(a,purchases.nextSibling);
    else links.appendChild(a);
  }

  function ensurePromotionsProLink(){
    if(!path.endsWith('/dueno.html'))return;
    const links=document.querySelector('.links');
    if(!links || links.querySelector('[data-promociones-pro-link]'))return;
    const a=document.createElement('a');
    a.className='link';
    a.href='promociones-pro.html';
    a.dataset.promocionesProLink='1';
    a.innerHTML='<span>🎟️</span>Promociones PRO';
    const crm=links.querySelector('[data-crm-pro-link]');
    if(crm && crm.nextSibling)links.insertBefore(a,crm.nextSibling);
    else links.appendChild(a);
  }

  function forceBrand(){
    replaceText(document.body);
    ['restaurantName','restaurant'].forEach(id=>{
      const el=document.getElementById(id);
      if(el && el.textContent!=='Punto Azul Restaurante'){
        el.textContent='Punto Azul Restaurante';
      }
    });

    const brand=document.querySelector('.brand strong,.top b,.topbar .brand strong');
    if(brand && !brand.querySelector('.punto-azul-panel-mark')){
      const mark=document.createElement('span');
      mark.className='punto-azul-panel-mark';
      mark.textContent='PUNTO AZUL';
      brand.appendChild(mark);
    }
    ensureDashboardProLink();
    ensureInventoryProLink();
    ensurePurchasesProLink();
    ensureCrmProLink();
    ensurePromotionsProLink();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',forceBrand,{once:true});
  }else{
    forceBrand();
  }

  window.addEventListener('load',()=>{
    forceBrand();
    setTimeout(forceBrand,400);
    setTimeout(forceBrand,1200);
  });

  const observer=new MutationObserver(()=>{
    window.clearTimeout(observer._t);
    observer._t=window.setTimeout(forceBrand,50);
  });
  if(document.documentElement){
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }
})();