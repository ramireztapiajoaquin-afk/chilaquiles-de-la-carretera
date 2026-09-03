(function(){
  if(!/\/meseros\.html$/i.test(location.pathname))return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

  function ensureStyles(){
    if(document.getElementById('promoVentasProStyles'))return;
    const style=document.createElement('style');
    style.id='promoVentasProStyles';
    style.textContent=`
      .promo-ventas-box{margin-top:12px;padding:14px;background:#fff8ea;border:1px solid #ead3a5;border-radius:16px}
      .promo-ventas-title{font-size:12px;font-weight:950;color:#6f5319;letter-spacing:.05em;margin-bottom:8px}
      .promo-ventas-btn{border:0;border-radius:12px;padding:10px 13px;background:#9b6b10;color:#fff;font-weight:900;cursor:pointer}
      .promo-ventas-btn:disabled{opacity:.55;cursor:wait}.promo-ventas-status{margin-top:8px;font-size:12px;color:#715d38}
      .promo-ventas-list{display:grid;gap:8px;margin-top:9px}.promo-ventas-item{background:#fff;border:1px solid #ead9b7;border-radius:12px;padding:10px;display:flex;justify-content:space-between;gap:10px;align-items:center}
      .promo-ventas-item b{color:#513a0c}.promo-ventas-item small{display:block;color:#7b6c4e;margin-top:3px}.promo-ventas-applied{background:#edf8f1;border-color:#b9dec7}.promo-ventas-applied .promo-ventas-title{color:#176c44}
      @media(max-width:600px){.promo-ventas-item{align-items:flex-start;flex-direction:column}.promo-ventas-item .promo-ventas-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function currentPromo(orderId){
    const {data,error}=await sb.rpc('consultar_promocion_cuenta',{p_pedido_id:orderId});
    if(error)throw error;
    return data||{descuento:0};
  }

  function inject(){
    if(typeof sb==='undefined'||!sb)return;
    const backdrop=document.getElementById('cuentaProBackdrop');
    if(!backdrop||backdrop.querySelector('[data-promo-ventas-pro]'))return;
    const body=backdrop.querySelector('.cuenta-pro-body');
    if(!body)return;
    const orderId=window.__crmVentasProOrderId;
    if(!orderId)return;
    ensureStyles();

    const box=document.createElement('div');
    box.className='promo-ventas-box';
    box.dataset.promoVentasPro='1';
    box.innerHTML=`<div class="promo-ventas-title">🎟️ PROMOCIÓN · OPCIONAL</div><button type="button" class="promo-ventas-btn" data-promo-load>VER PROMOCIONES ELEGIBLES</button><div class="promo-ventas-status" data-promo-status>Aplica una promoción antes del primer pago.</div><div class="promo-ventas-list" data-promo-list></div>`;
    const crmBox=body.querySelector('[data-crm-ventas-pro]');
    const paybox=body.querySelector('.cuenta-pro-paybox');
    if(crmBox)crmBox.after(box);else if(paybox)body.insertBefore(box,paybox);else body.appendChild(box);

    const loadBtn=box.querySelector('[data-promo-load]');
    const status=box.querySelector('[data-promo-status]');
    const list=box.querySelector('[data-promo-list]');

    async function loadPromos(){
      loadBtn.disabled=true;status.textContent='Consultando promociones…';list.innerHTML='';
      try{
        const applied=await currentPromo(orderId);
        if(Number(applied?.descuento||0)>0){
          box.classList.add('promo-ventas-applied');
          status.textContent=`✓ ${applied.nombre||'Promoción'} aplicada · descuento ${money(applied.descuento)}`;
          loadBtn.textContent='PROMOCIÓN APLICADA ✓';
          return;
        }
        const {data:order,error:orderError}=await sb.from('pedidos').select('cliente_id').eq('id',orderId).maybeSingle();
        if(orderError)throw orderError;
        if(!order?.cliente_id){status.textContent='Primero asigna un cliente de lealtad a esta cuenta.';return;}
        const {data,error}=await sb.rpc('promociones_eligibles_pedido',{p_pedido_id:orderId});
        if(error)throw error;
        if(!data?.length){status.textContent='No hay promociones ACTIVAS y elegibles para este cliente.';return;}
        status.textContent=`${data.length} promoción${data.length===1?'':'es'} disponible${data.length===1?'':'s'}.`;
        list.innerHTML=data.map(p=>`<div class="promo-ventas-item"><div><b>${esc(p.nombre)}</b><small>${esc(p.codigo||'Sin código')} · descuento ${money(p.descuento_estimado)}</small></div><button type="button" class="promo-ventas-btn" data-apply-promo="${esc(p.promocion_id)}">APLICAR</button></div>`).join('');
        list.querySelectorAll('[data-apply-promo]').forEach(btn=>btn.addEventListener('click',async()=>{
          btn.disabled=true;status.textContent='Aplicando promoción…';
          try{
            const {data:appliedData,error:applyError}=await sb.rpc('aplicar_promocion_pedido',{p_pedido_id:orderId,p_promocion_id:btn.dataset.applyPromo});
            if(applyError)throw applyError;
            const verify=await currentPromo(orderId);
            if(!(Number(verify?.descuento||0)>0))throw new Error('La promoción no quedó guardada.');
            status.textContent=`✓ ${verify.nombre||'Promoción'} aplicada · descuento ${money(verify.descuento)}`;
            status.style.color='#176c44';
            const method=(backdrop.querySelector('.cuenta-pro-method')?.textContent||'efectivo').trim().toLowerCase();
            setTimeout(()=>{backdrop.remove();if(typeof window.chargeOrder==='function')window.chargeOrder(orderId,method);},450);
          }catch(err){status.textContent='No se pudo aplicar: '+err.message;status.style.color='#a1261d';btn.disabled=false;}
        }));
      }catch(err){status.textContent='No se pudieron consultar promociones: '+err.message;status.style.color='#a1261d';}
      finally{if(!box.classList.contains('promo-ventas-applied'))loadBtn.disabled=false;}
    }

    loadBtn.addEventListener('click',loadPromos);
    currentPromo(orderId).then(p=>{if(Number(p?.descuento||0)>0){box.classList.add('promo-ventas-applied');status.textContent=`✓ ${p.nombre||'Promoción'} aplicada · descuento ${money(p.descuento)}`;loadBtn.textContent='PROMOCIÓN APLICADA ✓';loadBtn.disabled=true;}}).catch(()=>{});
  }

  const observer=new MutationObserver(inject);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',inject,{once:true});
})();