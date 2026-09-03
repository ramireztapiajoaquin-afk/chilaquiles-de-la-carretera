(function(){
  const isMeseros=/\/meseros\.html$/i.test(location.pathname);
  if(!isMeseros)return;

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function money(n){
    return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  }
  function uid(){
    if(window.crypto?.randomUUID)return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);
    });
  }

  function ensureStyles(){
    if(document.getElementById('cuentaProStyles'))return;
    const style=document.createElement('style');
    style.id='cuentaProStyles';
    style.textContent=`
      .cuenta-pro-backdrop{position:fixed;inset:0;z-index:100050;background:rgba(0,7,15,.72);display:grid;place-items:end center;padding:16px;backdrop-filter:blur(8px)}
      .cuenta-pro-card{width:min(620px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#fff,#f5f8fb);border:1px solid #aebdcb;border-radius:24px 24px 14px 14px;box-shadow:0 -22px 70px rgba(0,0,0,.36);color:#142333}
      .cuenta-pro-head{padding:18px 18px 14px;background:linear-gradient(135deg,#071a2f,#0e4f88);color:#fff;border-radius:23px 23px 0 0}
      .cuenta-pro-head h2{margin:0;font-size:22px}.cuenta-pro-head p{margin:5px 0 0;color:#cbd8e3;font-size:13px}
      .cuenta-pro-body{padding:18px}.cuenta-pro-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px}
      .cuenta-pro-total{background:#fff;border:1px solid #d4dee7;border-radius:14px;padding:12px;text-align:center}.cuenta-pro-total span{display:block;font-size:10px;color:#6c7a86;font-weight:900;letter-spacing:.05em}.cuenta-pro-total b{display:block;font-size:20px;color:#071a2f;margin-top:2px}
      .cuenta-pro-section{margin-top:16px}.cuenta-pro-section-title{font-size:12px;font-weight:950;color:#465866;letter-spacing:.05em;margin-bottom:8px}
      .cuenta-pro-chips{display:flex;gap:8px;flex-wrap:wrap}.cuenta-pro-chip{border:1px solid #b9c7d3;background:#fff;color:#17334d;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer}.cuenta-pro-chip.active{background:#0e4f88;color:#fff;border-color:#0e4f88;box-shadow:0 6px 16px rgba(14,79,136,.22)}
      .cuenta-pro-custom{width:120px;border:1px solid #b9c7d3;border-radius:12px;padding:10px 12px;background:#fff}
      .cuenta-pro-split{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cuenta-pro-step{width:42px;height:42px;border:1px solid #b9c7d3;border-radius:12px;background:#fff;color:#0e4f88;font-size:22px;font-weight:900}.cuenta-pro-personas{min-width:78px;text-align:center;font-size:20px;font-weight:950;color:#071a2f}
      .cuenta-pro-per-person{margin-top:10px;background:#eaf2f8;border:1px solid #c8d8e5;border-radius:14px;padding:12px;text-align:center}.cuenta-pro-per-person span{font-size:11px;color:#627483;font-weight:900}.cuenta-pro-per-person b{display:block;font-size:24px;color:#0e4f88;margin-top:2px}
      .cuenta-pro-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:18px}.cuenta-pro-btn{border:0;border-radius:14px;padding:14px;font-weight:950;cursor:pointer}.cuenta-pro-cancel{background:#e8edf2;color:#324656}.cuenta-pro-confirm{background:linear-gradient(135deg,#0e4f88,#1765a4);color:#fff;box-shadow:0 8px 20px rgba(14,79,136,.25)}.cuenta-pro-confirm:disabled{opacity:.6;cursor:wait}
      .cuenta-pro-status{min-height:20px;margin-top:10px;text-align:center;font-size:12px;font-weight:850;color:#61717f}.cuenta-pro-method{display:inline-block;margin-top:6px;padding:5px 9px;border-radius:999px;background:#ffffff20;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase}
      @media(max-width:560px){.cuenta-pro-backdrop{padding:8px}.cuenta-pro-card{border-radius:20px 20px 10px 10px}.cuenta-pro-head{border-radius:19px 19px 0 0}.cuenta-pro-totals{grid-template-columns:1fr 1fr}.cuenta-pro-total:last-child{grid-column:1/-1}.cuenta-pro-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function fetchOpenTable(orderId){
    if(typeof sb==='undefined'||!sb)throw new Error('No hay conexión con el sistema.');
    const {data:base,error:baseError}=await sb.from('pedidos')
      .select('id,restaurant_id,numero_mesa,total')
      .eq('id',orderId).eq('estado','entregado').maybeSingle();
    if(baseError)throw baseError;
    if(!base)throw new Error('Ese consumo ya no está pendiente de cobro.');

    const {data:pending,error:pendingError}=await sb.from('pedidos')
      .select('id,total')
      .eq('restaurant_id',base.restaurant_id)
      .eq('numero_mesa',base.numero_mesa)
      .eq('estado','entregado')
      .order('created_at',{ascending:true});
    if(pendingError)throw pendingError;
    if(!pending?.length)throw new Error('No hay consumos pendientes de cobro en esta mesa.');

    return {
      base,
      pending,
      subtotal:pending.reduce((sum,p)=>sum+Number(p.total||0),0)
    };
  }

  function openCheckout(orderId,method){
    ensureStyles();
    const old=document.getElementById('cuentaProBackdrop');
    if(old)old.remove();

    const backdrop=document.createElement('div');
    backdrop.id='cuentaProBackdrop';
    backdrop.className='cuenta-pro-backdrop';
    backdrop.innerHTML=`<div class="cuenta-pro-card"><div class="cuenta-pro-head"><h2>💳 Cuenta PRO</h2><p id="cuentaProHeader">Calculando cuenta…</p><span class="cuenta-pro-method">${esc(method)}</span></div><div class="cuenta-pro-body"><div id="cuentaProLoading" class="cuenta-pro-status">Consultando consumos pendientes…</div></div></div>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove()});

    fetchOpenTable(orderId).then(({base,pending,subtotal})=>{
      let tipPercent=0;
      let customTip=null;
      let people=1;
      const body=backdrop.querySelector('.cuenta-pro-body');
      backdrop.querySelector('#cuentaProHeader').textContent=`Mesa ${base.numero_mesa} · ${pending.length} consumo${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'}`;
      body.innerHTML=`
        <div class="cuenta-pro-totals">
          <div class="cuenta-pro-total"><span>CONSUMO</span><b id="cpSubtotal">${money(subtotal)}</b></div>
          <div class="cuenta-pro-total"><span>PROPINA</span><b id="cpTip">${money(0)}</b></div>
          <div class="cuenta-pro-total"><span>TOTAL A COBRAR</span><b id="cpGrand">${money(subtotal)}</b></div>
        </div>
        <div class="cuenta-pro-section"><div class="cuenta-pro-section-title">PROPINA</div><div class="cuenta-pro-chips">
          <button type="button" class="cuenta-pro-chip active" data-tip="0">Sin propina</button>
          <button type="button" class="cuenta-pro-chip" data-tip="10">10%</button>
          <button type="button" class="cuenta-pro-chip" data-tip="15">15%</button>
          <button type="button" class="cuenta-pro-chip" data-tip="20">20%</button>
          <input id="cpCustomTip" class="cuenta-pro-custom" type="number" min="0" step="1" placeholder="$ Otra">
        </div></div>
        <div class="cuenta-pro-section"><div class="cuenta-pro-section-title">DIVIDIR MONTO ENTRE</div><div class="cuenta-pro-split"><button type="button" id="cpMinus" class="cuenta-pro-step">−</button><div id="cpPeople" class="cuenta-pro-personas">1 persona</div><button type="button" id="cpPlus" class="cuenta-pro-step">+</button></div><div class="cuenta-pro-per-person"><span>MONTO POR PERSONA</span><b id="cpPerPerson">${money(subtotal)}</b></div></div>
        <div class="cuenta-pro-actions"><button type="button" id="cpCancel" class="cuenta-pro-btn cuenta-pro-cancel">CANCELAR</button><button type="button" id="cpConfirm" class="cuenta-pro-btn cuenta-pro-confirm">CONFIRMAR COBRO</button></div>
        <div id="cpStatus" class="cuenta-pro-status"></div>`;

      const tipAmount=()=>{
        if(customTip!==null)return Math.max(0,Number(customTip)||0);
        return Math.round((subtotal*(tipPercent/100))*100)/100;
      };
      const update=()=>{
        const tip=tipAmount(),grand=subtotal+tip;
        body.querySelector('#cpTip').textContent=money(tip);
        body.querySelector('#cpGrand').textContent=money(grand);
        body.querySelector('#cpPeople').textContent=people+(people===1?' persona':' personas');
        body.querySelector('#cpPerPerson').textContent=money(grand/people);
      };

      body.querySelectorAll('[data-tip]').forEach(btn=>btn.addEventListener('click',()=>{
        body.querySelectorAll('[data-tip]').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        tipPercent=Number(btn.dataset.tip||0);
        customTip=null;
        body.querySelector('#cpCustomTip').value='';
        update();
      }));
      body.querySelector('#cpCustomTip').addEventListener('input',e=>{
        body.querySelectorAll('[data-tip]').forEach(x=>x.classList.remove('active'));
        customTip=e.target.value===''?0:Math.max(0,Number(e.target.value)||0);
        update();
      });
      body.querySelector('#cpMinus').addEventListener('click',()=>{people=Math.max(1,people-1);update()});
      body.querySelector('#cpPlus').addEventListener('click',()=>{people=Math.min(50,people+1);update()});
      body.querySelector('#cpCancel').addEventListener('click',()=>backdrop.remove());
      body.querySelector('#cpConfirm').addEventListener('click',async()=>{
        const button=body.querySelector('#cpConfirm');
        const status=body.querySelector('#cpStatus');
        button.disabled=true;
        status.textContent='Registrando cobro…';
        try{
          const latest=await fetchOpenTable(orderId);
          const tip=tipAmount();
          const now=new Date().toISOString();
          const accountId=uid();
          const ids=latest.pending.map(p=>p.id);
          const {error}=await sb.from('pedidos').update({
            estado:'cobrado',
            forma_pago:method,
            cobrado_at:now,
            updated_at:now,
            cuenta_id:accountId,
            propina:tip,
            personas_dividir:people
          }).in('id',ids).eq('estado','entregado');
          if(error)throw error;
          status.textContent=`✓ Cobro registrado · Total ${money(latest.subtotal+tip)}`;
          status.style.color='#176c44';
          setTimeout(async()=>{
            backdrop.remove();
            if(typeof refreshAll==='function')await refreshAll(false);
          },550);
        }catch(error){
          console.error('Cuenta PRO:',error);
          status.textContent='No se pudo registrar el cobro: '+error.message;
          status.style.color='#a1261d';
          button.disabled=false;
        }
      });
      update();
    }).catch(error=>{
      const body=backdrop.querySelector('.cuenta-pro-body');
      body.innerHTML=`<div class="cuenta-pro-status" style="color:#a1261d">${esc(error.message)}</div><div class="cuenta-pro-actions"><button type="button" class="cuenta-pro-btn cuenta-pro-cancel" onclick="document.getElementById('cuentaProBackdrop')?.remove()">CERRAR</button></div>`;
    });
  }

  function install(){
    if(typeof window.chargeOrder!=='function')return false;
    if(window.chargeOrder.__cuentaPro)return true;
    const wrapped=function(id,method){return openCheckout(id,method)};
    wrapped.__cuentaPro=true;
    window.chargeOrder=wrapped;
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    install();
    if(tries>=40)clearInterval(timer);
  },250);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100),{once:true});
})();