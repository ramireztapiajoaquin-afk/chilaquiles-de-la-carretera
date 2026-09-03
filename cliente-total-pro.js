(function(){
  const path=(location.pathname||'').toLowerCase();
  const isClient=path==='/'||path.endsWith('/index.html');
  if(!isClient)return;

  const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

  function updatePaidSummary(order){
    if(order?.estado!=='cobrado')return;
    const thankYou=document.getElementById('paymentThankYou');
    if(!thankYou)return;

    const consumo=Number(order?.total_cuenta||0);
    const propina=Number(order?.propina||0);
    const total=Number(order?.total_pagado ?? (consumo+propina));
    const personas=Math.max(1,Number(order?.personas_dividir||1));
    const methodLabels={efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia'};
    const payment=methodLabels[String(order?.forma_pago||'').toLowerCase()]||'Pago confirmado';

    const label=[...thankYou.querySelectorAll('div')].find(x=>x.childElementCount===0&&x.textContent.trim()==='TOTAL PAGADO');
    const card=label?.parentElement;
    if(!card)return;

    card.dataset.cuentaProCliente='1';
    card.innerHTML=`
      <div style="display:grid;grid-template-columns:${propina>0?'1fr 1fr':'1fr'};gap:8px;margin-bottom:11px">
        <div style="background:#fff;border:1px solid #e5ded4;border-radius:13px;padding:9px">
          <div style="font-size:10px;font-weight:900;letter-spacing:.07em;color:#756d64">CONSUMO</div>
          <div style="font-size:18px;font-weight:950;color:#302b26;margin-top:2px">${money(consumo)}</div>
        </div>
        ${propina>0?`<div style="background:#fff;border:1px solid #e5ded4;border-radius:13px;padding:9px">
          <div style="font-size:10px;font-weight:900;letter-spacing:.07em;color:#756d64">PROPINA</div>
          <div style="font-size:18px;font-weight:950;color:#0e4f88;margin-top:2px">${money(propina)}</div>
        </div>`:''}
      </div>
      <div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#756d64">TOTAL PAGADO</div>
      <div style="font-size:32px;font-weight:950;color:#176c44;margin:2px 0">${money(total)}</div>
      <div style="font-size:13px;color:#756d64">${payment} · Mesa ${String(order?.numero_mesa||'')}</div>
      ${personas>1?`<div style="font-size:12px;color:#5f6e79;margin-top:8px;background:#eef4f8;border-radius:10px;padding:7px 9px">Referencia: ${personas} personas · ${money(total/personas)} c/u</div>`:''}`;
  }

  function install(){
    if(typeof window.renderOrderTracking!=='function')return false;
    if(window.renderOrderTracking.__clienteTotalPro)return true;
    const original=window.renderOrderTracking;
    const wrapped=function(order){
      const result=original.apply(this,arguments);
      if(order?.estado==='cobrado'){
        setTimeout(()=>updatePaidSummary(order),40);
        setTimeout(()=>updatePaidSummary(order),250);
      }
      return result;
    };
    wrapped.__clienteTotalPro=true;
    window.renderOrderTracking=wrapped;
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    install();
    if(tries>=60)clearInterval(timer);
  },250);

  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(install,500);
    setTimeout(install,1500);
  },{once:true});
})();
