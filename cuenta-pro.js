(function(){
  const isMeseros=/\/meseros\.html$/i.test(location.pathname);
  if(!isMeseros)return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

  function ensureStyles(){
    if(document.getElementById('cuentaProStyles'))return;
    const style=document.createElement('style');
    style.id='cuentaProStyles';
    style.textContent=`
      .cuenta-pro-backdrop{position:fixed;inset:0;z-index:100050;background:rgba(0,7,15,.72);display:grid;place-items:end center;padding:16px;backdrop-filter:blur(8px)}
      .cuenta-pro-card{width:min(640px,100%);max-height:94vh;overflow:auto;background:linear-gradient(180deg,#fff,#f5f8fb);border:1px solid #aebdcb;border-radius:24px 24px 14px 14px;box-shadow:0 -22px 70px rgba(0,0,0,.36);color:#142333}
      .cuenta-pro-head{padding:18px;background:linear-gradient(135deg,#071a2f,#0e4f88);color:#fff;border-radius:23px 23px 0 0}.cuenta-pro-head h2{margin:0;font-size:22px}.cuenta-pro-head p{margin:5px 0 0;color:#cbd8e3;font-size:13px}
      .cuenta-pro-method{display:inline-block;margin-top:7px;padding:5px 9px;border-radius:999px;background:#ffffff20;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase}
      .cuenta-pro-body{padding:18px}.cuenta-pro-totals{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.cuenta-pro-total{background:#fff;border:1px solid #d4dee7;border-radius:14px;padding:11px;text-align:center}.cuenta-pro-total span{display:block;font-size:9px;color:#6c7a86;font-weight:900;letter-spacing:.04em}.cuenta-pro-total b{display:block;font-size:18px;color:#071a2f;margin-top:3px}
      .cuenta-pro-total.remaining{background:#eef5fb;border-color:#b8d2e5}.cuenta-pro-total.remaining b{color:#0e4f88}
      .cuenta-pro-section{margin-top:16px}.cuenta-pro-section-title{font-size:12px;font-weight:950;color:#465866;letter-spacing:.05em;margin-bottom:8px}.cuenta-pro-chips{display:flex;gap:8px;flex-wrap:wrap}.cuenta-pro-chip{border:1px solid #b9c7d3;background:#fff;color:#17334d;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer}.cuenta-pro-chip.active{background:#0e4f88;color:#fff;border-color:#0e4f88}.cuenta-pro-chip:disabled,.cuenta-pro-custom:disabled{opacity:.55;cursor:not-allowed}
      .cuenta-pro-custom{width:124px;border:1px solid #b9c7d3;border-radius:12px;padding:10px 12px;background:#fff}.cuenta-pro-split{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cuenta-pro-step{width:42px;height:42px;border:1px solid #b9c7d3;border-radius:12px;background:#fff;color:#0e4f88;font-size:22px;font-weight:900}.cuenta-pro-step:disabled{opacity:.45}.cuenta-pro-personas{min-width:88px;text-align:center;font-size:19px;font-weight:950;color:#071a2f}
      .cuenta-pro-per-person{margin-top:10px;background:#eaf2f8;border:1px solid #c8d8e5;border-radius:14px;padding:12px;text-align:center}.cuenta-pro-per-person span{font-size:11px;color:#627483;font-weight:900}.cuenta-pro-per-person b{display:block;font-size:24px;color:#0e4f88;margin-top:2px}
      .cuenta-pro-paybox{margin-top:16px;padding:14px;background:#fff;border:1px solid #d4dee7;border-radius:16px}.cuenta-pro-payline{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.cuenta-pro-payline label{font-size:11px;color:#607180;font-weight:900}.cuenta-pro-amount{width:100%;margin-top:5px;border:1px solid #b9c7d3;border-radius:12px;padding:12px;font-size:18px;font-weight:900}.cuenta-pro-full{border:1px solid #9cb6ca;border-radius:12px;background:#edf5fb;color:#0e4f88;padding:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cuenta-pro-history{margin-top:10px;font-size:11px;color:#61717f;line-height:1.5}.cuenta-pro-history b{color:#22394c}
      .cuenta-pro-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:10px;margin-top:16px}.cuenta-pro-btn{border:0;border-radius:14px;padding:14px;font-weight:950;cursor:pointer}.cuenta-pro-cancel{background:#e8edf2;color:#324656}.cuenta-pro-confirm{background:linear-gradient(135deg,#0e4f88,#1765a4);color:#fff;box-shadow:0 8px 20px rgba(14,79,136,.25)}.cuenta-pro-confirm:disabled{opacity:.6;cursor:wait}.cuenta-pro-status{min-height:20px;margin-top:10px;text-align:center;font-size:12px;font-weight:850;color:#61717f}
      @media(max-width:600px){.cuenta-pro-backdrop{padding:8px}.cuenta-pro-card{border-radius:20px 20px 10px 10px}.cuenta-pro-head{border-radius:19px 19px 0 0}.cuenta-pro-totals{grid-template-columns:1fr 1fr}.cuenta-pro-payline{grid-template-columns:1fr}.cuenta-pro-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function fetchOpenTable(orderId){
    if(typeof sb==='undefined'||!sb)throw new Error('No hay conexión con el sistema.');
    const {data:base,error:baseError}=await sb.from('pedidos')
      .select('id,restaurant_id,numero_mesa,total,cuenta_id,propina,personas_dividir')
      .eq('id',orderId).eq('estado','entregado').maybeSingle();
    if(baseError)throw baseError;
    if(!base)throw new Error('Ese consumo ya no está pendiente de cobro.');

    const {data:pending,error:pendingError}=await sb.from('pedidos')
      .select('id,total,cuenta_id,propina,personas_dividir')
      .eq('restaurant_id',base.restaurant_id)
      .eq('numero_mesa',base.numero_mesa)
      .eq('estado','entregado')
      .order('created_at',{ascending:true});
    if(pendingError)throw pendingError;
    if(!pending?.length)throw new Error('No hay consumos pendientes de cobro en esta mesa.');

    const accountRow=pending.find(x=>x.cuenta_id)||base;
    const cuentaId=accountRow?.cuenta_id||null;
    let payments=[];
    if(cuentaId){
      const {data,error}=await sb.from('pagos_cuenta').select('monto,forma_pago,created_at').eq('restaurant_id',base.restaurant_id).eq('cuenta_id',cuentaId).order('created_at');
      if(error)throw error;
      payments=data||[];
    }
    const subtotal=pending.reduce((sum,p)=>sum+Number(p.total||0),0);
    const paid=payments.reduce((sum,p)=>sum+Number(p.monto||0),0);
    const locked=paid>0;
    const propina=locked?Number(accountRow?.propina||0):0;
    const people=locked?Math.max(1,Number(accountRow?.personas_dividir||1)):1;
    return {base,pending,subtotal,payments,paid,locked,propina,people,cuentaId};
  }

  function openCheckout(orderId,method){
    ensureStyles();
    document.getElementById('cuentaProBackdrop')?.remove();
    const backdrop=document.createElement('div');
    backdrop.id='cuentaProBackdrop';
    backdrop.className='cuenta-pro-backdrop';
    backdrop.innerHTML=`<div class="cuenta-pro-card"><div class="cuenta-pro-head"><h2>💳 Cuenta PRO</h2><p id="cuentaProHeader">Calculando cuenta…</p><span class="cuenta-pro-method">${esc(method)}</span></div><div class="cuenta-pro-body"><div class="cuenta-pro-status">Consultando saldo…</div></div></div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove()});

    fetchOpenTable(orderId).then(state=>renderCheckout(backdrop,orderId,method,state)).catch(error=>{
      backdrop.querySelector('.cuenta-pro-body').innerHTML=`<div class="cuenta-pro-status" style="color:#a1261d">${esc(error.message)}</div><div class="cuenta-pro-actions"><button class="cuenta-pro-btn cuenta-pro-cancel" onclick="document.getElementById('cuentaProBackdrop')?.remove()">CERRAR</button></div>`;
    });
  }

  function renderCheckout(backdrop,orderId,method,state){
    let tipPercent=0;
    let customTip=state.locked?state.propina:null;
    let people=state.people;
    const body=backdrop.querySelector('.cuenta-pro-body');
    backdrop.querySelector('#cuentaProHeader').textContent=`Mesa ${state.base.numero_mesa} · ${state.pending.length} consumo${state.pending.length===1?'':'s'}`;

    const tipAmount=()=>state.locked?state.propina:(customTip!==null?Math.max(0,Number(customTip)||0):Math.round((state.subtotal*(tipPercent/100))*100)/100);
    const grand=()=>state.subtotal+tipAmount();
    const remaining=()=>Math.max(0,grand()-state.paid);

    body.innerHTML=`
      <div class="cuenta-pro-totals">
        <div class="cuenta-pro-total"><span>CONSUMO</span><b id="cpSubtotal"></b></div>
        <div class="cuenta-pro-total"><span>PROPINA</span><b id="cpTip"></b></div>
        <div class="cuenta-pro-total"><span>YA PAGADO</span><b id="cpPaid"></b></div>
        <div class="cuenta-pro-total remaining"><span>SALDO</span><b id="cpRemaining"></b></div>
      </div>
      <div class="cuenta-pro-section"><div class="cuenta-pro-section-title">PROPINA ${state.locked?'· FIJADA AL INICIAR PAGOS':''}</div><div class="cuenta-pro-chips">
        <button type="button" class="cuenta-pro-chip ${!state.locked?'active':''}" data-tip="0" ${state.locked?'disabled':''}>Sin propina</button>
        <button type="button" class="cuenta-pro-chip" data-tip="10" ${state.locked?'disabled':''}>10%</button>
        <button type="button" class="cuenta-pro-chip" data-tip="15" ${state.locked?'disabled':''}>15%</button>
        <button type="button" class="cuenta-pro-chip" data-tip="20" ${state.locked?'disabled':''}>20%</button>
        <input id="cpCustomTip" class="cuenta-pro-custom" type="number" min="0" step="1" placeholder="$ Otra" ${state.locked?'disabled':''} value="${state.locked?state.propina:''}">
      </div></div>
      <div class="cuenta-pro-section"><div class="cuenta-pro-section-title">DIVIDIR MONTO ENTRE</div><div class="cuenta-pro-split"><button type="button" id="cpMinus" class="cuenta-pro-step" ${state.locked?'disabled':''}>−</button><div id="cpPeople" class="cuenta-pro-personas"></div><button type="button" id="cpPlus" class="cuenta-pro-step" ${state.locked?'disabled':''}>+</button></div><div class="cuenta-pro-per-person"><span>REFERENCIA POR PERSONA</span><b id="cpPerPerson"></b></div></div>
      <div class="cuenta-pro-paybox"><div class="cuenta-pro-section-title">REGISTRAR ESTE PAGO · ${esc(method.toUpperCase())}</div><div class="cuenta-pro-payline"><label>MONTO A PAGAR<input id="cpPaymentAmount" class="cuenta-pro-amount" type="number" min="0.01" step="0.01"></label><button type="button" id="cpFull" class="cuenta-pro-full">USAR SALDO COMPLETO</button></div><div id="cpHistory" class="cuenta-pro-history"></div></div>
      <div class="cuenta-pro-actions"><button type="button" id="cpCancel" class="cuenta-pro-btn cuenta-pro-cancel">CANCELAR</button><button type="button" id="cpConfirm" class="cuenta-pro-btn cuenta-pro-confirm">REGISTRAR PAGO</button></div><div id="cpStatus" class="cuenta-pro-status"></div>`;

    const update=()=>{
      body.querySelector('#cpSubtotal').textContent=money(state.subtotal);
      body.querySelector('#cpTip').textContent=money(tipAmount());
      body.querySelector('#cpPaid').textContent=money(state.paid);
      body.querySelector('#cpRemaining').textContent=money(remaining());
      body.querySelector('#cpPeople').textContent=people+(people===1?' persona':' personas');
      body.querySelector('#cpPerPerson').textContent=money(grand()/people);
      const hist=state.payments.length?state.payments.map((p,i)=>`<div><b>Pago ${i+1}:</b> ${money(p.monto)} · ${esc(String(p.forma_pago).toUpperCase())}</div>`).join(''):'Todavía no hay pagos parciales registrados.';
      body.querySelector('#cpHistory').innerHTML=hist;
      const amount=body.querySelector('#cpPaymentAmount');
      if(!amount.value)amount.value=(state.locked?Math.min(remaining(),grand()/people):remaining()).toFixed(2);
    };

    body.querySelectorAll('[data-tip]').forEach(btn=>btn.addEventListener('click',()=>{
      body.querySelectorAll('[data-tip]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');tipPercent=Number(btn.dataset.tip||0);customTip=null;body.querySelector('#cpCustomTip').value='';body.querySelector('#cpPaymentAmount').value='';update();
    }));
    body.querySelector('#cpCustomTip').addEventListener('input',e=>{body.querySelectorAll('[data-tip]').forEach(x=>x.classList.remove('active'));customTip=e.target.value===''?0:Math.max(0,Number(e.target.value)||0);body.querySelector('#cpPaymentAmount').value='';update();});
    body.querySelector('#cpMinus').addEventListener('click',()=>{people=Math.max(1,people-1);body.querySelector('#cpPaymentAmount').value='';update();});
    body.querySelector('#cpPlus').addEventListener('click',()=>{people=Math.min(50,people+1);body.querySelector('#cpPaymentAmount').value='';update();});
    body.querySelector('#cpFull').addEventListener('click',()=>{body.querySelector('#cpPaymentAmount').value=remaining().toFixed(2)});
    body.querySelector('#cpCancel').addEventListener('click',()=>backdrop.remove());
    body.querySelector('#cpConfirm').addEventListener('click',async()=>{
      const button=body.querySelector('#cpConfirm'),status=body.querySelector('#cpStatus');
      const amount=Number(body.querySelector('#cpPaymentAmount').value||0);
      if(!(amount>0))return status.textContent='Escribe un monto válido.';
      if(amount>remaining()+0.009)return status.textContent='El monto supera el saldo pendiente.';
      button.disabled=true;status.textContent='Registrando pago…';
      try{
        const {data,error}=await sb.rpc('registrar_pago_cuenta_pro',{p_pedido_id:orderId,p_monto:amount,p_forma_pago:method,p_propina:tipAmount(),p_personas:people});
        if(error)throw error;
        if(data?.cerrada){
          status.textContent=`✓ Cuenta liquidada · Total ${money(data.total)}`;status.style.color='#176c44';
          setTimeout(async()=>{backdrop.remove();if(typeof refreshAll==='function')await refreshAll(false)},650);
        }else{
          status.textContent=`✓ Pago registrado · Resta ${money(data?.restante||0)}`;status.style.color='#176c44';
          setTimeout(()=>{backdrop.remove();if(typeof refreshAll==='function')refreshAll(false)},650);
        }
      }catch(error){console.error('Cuenta PRO:',error);status.textContent='No se pudo registrar: '+error.message;status.style.color='#a1261d';button.disabled=false;}
    });
    update();
  }

  function install(){
    if(typeof window.chargeOrder!=='function')return false;
    if(window.chargeOrder.__cuentaPro)return true;
    const wrapped=(id,method)=>openCheckout(id,method);wrapped.__cuentaPro=true;window.chargeOrder=wrapped;return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=40)clearInterval(timer)},250);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100),{once:true});
})();