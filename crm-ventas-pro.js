(function(){
  if(!/\/meseros\.html$/i.test(location.pathname))return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function ensureStyles(){
    if(document.getElementById('crmVentasProStyles'))return;
    const style=document.createElement('style');
    style.id='crmVentasProStyles';
    style.textContent=`
      .crm-ventas-box{margin-top:16px;padding:14px;background:#f3f8fc;border:1px solid #c8dbe9;border-radius:16px}
      .crm-ventas-title{font-size:12px;font-weight:950;color:#465866;letter-spacing:.05em;margin-bottom:8px}
      .crm-ventas-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
      .crm-ventas-input{width:100%;border:1px solid #b9c7d3;border-radius:12px;padding:11px 12px;background:#fff}
      .crm-ventas-btn{border:0;border-radius:12px;padding:11px 14px;background:#0e4f88;color:#fff;font-weight:900;cursor:pointer}
      .crm-ventas-btn.secondary{background:#e5edf3;color:#24415a}
      .crm-ventas-status{min-height:18px;margin-top:8px;font-size:12px;color:#607180}
      .crm-ventas-found{margin-top:9px;padding:10px 11px;border:1px solid #bdd8ef;background:#fff;border-radius:12px;display:flex;justify-content:space-between;gap:10px;align-items:center}
      .crm-ventas-found b{color:#071a2f}.crm-ventas-found small{display:block;color:#607180;margin-top:2px}
      @media(max-width:600px){.crm-ventas-row{grid-template-columns:1fr}.crm-ventas-found{align-items:flex-start;flex-direction:column}.crm-ventas-found .crm-ventas-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installChargeHook(){
    if(typeof window.chargeOrder!=='function')return false;
    if(window.chargeOrder.__crmVentasPro)return true;
    if(!window.chargeOrder.__cuentaPro)return false;
    const previous=window.chargeOrder;
    const wrapped=(id,method)=>{
      window.__crmVentasProOrderId=id;
      const out=previous(id,method);
      const backdrop=document.getElementById('cuentaProBackdrop');
      if(backdrop)backdrop.dataset.crmOrderId=id;
      return out;
    };
    wrapped.__cuentaPro=true;
    wrapped.__crmVentasPro=true;
    window.chargeOrder=wrapped;
    return true;
  }

  async function showAssignedState(box,orderId){
    if(typeof sb==='undefined'||!sb||!orderId)return;
    try{
      const {data,error}=await sb.from('pedidos').select('cliente_id').eq('id',orderId).maybeSingle();
      if(error)throw error;
      if(data?.cliente_id){
        const status=box.querySelector('[data-crm-status]');
        status.textContent='✓ Esta cuenta ya tiene un cliente de lealtad asignado.';
        status.style.color='#176c44';
      }
    }catch(_){/* no interrumpir el cobro */}
  }

  function injectLoyalty(){
    const backdrop=document.getElementById('cuentaProBackdrop');
    if(!backdrop||backdrop.querySelector('[data-crm-ventas-pro]'))return;
    const body=backdrop.querySelector('.cuenta-pro-body');
    if(!body)return;
    const orderId=backdrop.dataset.crmOrderId||window.__crmVentasProOrderId;
    if(!orderId)return;
    backdrop.dataset.crmOrderId=orderId;
    ensureStyles();

    const box=document.createElement('div');
    box.className='crm-ventas-box';
    box.dataset.crmVentasPro='1';
    box.innerHTML=`
      <div class="crm-ventas-title">💎 CLIENTE DE LEALTAD · OPCIONAL</div>
      <div class="crm-ventas-row">
        <label style="font-size:11px;color:#607180;font-weight:900">TELÉFONO DEL CLIENTE
          <input class="crm-ventas-input" data-crm-phone inputmode="tel" placeholder="55...">
        </label>
        <button type="button" class="crm-ventas-btn" data-crm-search>BUSCAR</button>
      </div>
      <div class="crm-ventas-status" data-crm-status>Si participa en lealtad, busca su teléfono antes de liquidar.</div>
      <div data-crm-result></div>`;

    const paybox=body.querySelector('.cuenta-pro-paybox');
    if(paybox)body.insertBefore(box,paybox);
    else body.appendChild(box);

    const phone=box.querySelector('[data-crm-phone]');
    const search=box.querySelector('[data-crm-search]');
    const status=box.querySelector('[data-crm-status]');
    const result=box.querySelector('[data-crm-result]');

    async function searchClient(){
      const tel=phone.value.trim();
      if(tel.replace(/\D/g,'').length<7){status.textContent='Escribe un teléfono válido.';status.style.color='#a1261d';return;}
      search.disabled=true;status.textContent='Buscando cliente…';status.style.color='#607180';result.innerHTML='';
      try{
        const {data,error}=await sb.rpc('buscar_cliente_lealtad',{p_telefono:tel});
        if(error)throw error;
        const client=Array.isArray(data)?data[0]:data;
        if(!client){status.textContent='Cliente no encontrado. Puedes crearlo después en CRM PRO.';status.style.color='#9a6611';return;}
        status.textContent='Cliente encontrado.';status.style.color='#176c44';
        result.innerHTML=`<div class="crm-ventas-found"><div><b>${esc(client.nombre)}</b><small>${Number(client.puntos||0)} puntos disponibles</small></div><button type="button" class="crm-ventas-btn secondary" data-crm-assign>ASIGNAR A ESTA CUENTA</button></div>`;
        result.querySelector('[data-crm-assign]').addEventListener('click',async e=>{
          const btn=e.currentTarget;btn.disabled=true;status.textContent='Asignando cliente…';status.style.color='#607180';
          try{
            const currentOrderId=backdrop.dataset.crmOrderId||orderId;
            const {data:before,error:beforeError}=await sb.from('pedidos').select('id,estado,cliente_id').eq('id',currentOrderId).maybeSingle();
            if(beforeError)throw beforeError;
            if(!before||before.estado!=='entregado')throw new Error('La cuenta ya no está disponible para asignar cliente.');

            const {error:assignError}=await sb.rpc('asignar_cliente_pedido_lealtad',{p_pedido_id:currentOrderId,p_cliente_id:client.cliente_id});
            if(assignError)throw assignError;

            const {data:verified,error:verifyError}=await sb.from('pedidos').select('cliente_id').eq('id',currentOrderId).maybeSingle();
            if(verifyError)throw verifyError;
            if(!verified||verified.cliente_id!==client.cliente_id)throw new Error('La asignación no se confirmó. Intenta nuevamente.');

            status.textContent=`✓ ${client.nombre} asignado. Los puntos se sumarán automáticamente al liquidar.`;status.style.color='#176c44';
            btn.textContent='ASIGNADO ✓';
          }catch(err){status.textContent='No se pudo asignar: '+err.message;status.style.color='#a1261d';btn.disabled=false;}
        });
      }catch(err){status.textContent='No se pudo buscar: '+err.message;status.style.color='#a1261d';}
      finally{search.disabled=false;}
    }

    search.addEventListener('click',searchClient);
    phone.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchClient();}});
    showAssignedState(box,orderId);
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;installChargeHook();if(tries>=80)clearInterval(timer)},250);
  const observer=new MutationObserver(()=>{
    installChargeHook();
    injectLoyalty();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>{installChargeHook();injectLoyalty();},{once:true});
})();