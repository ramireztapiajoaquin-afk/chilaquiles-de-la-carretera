(function(){
  if(!/\/caja\.html$/i.test(location.pathname))return;

  const safeText=s=>typeof safe==='function'?safe(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const mx=n=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  let proPayments=[];
  let proPromotions=[];

  function accountGroups(){
    const map=new Map();
    sales.forEach(s=>{
      const legacy=`${s.numero_mesa||''}|${s.cobrado_at||''}|${s.forma_pago||''}`;
      const key=s.cuenta_id?`cuenta:${s.cuenta_id}`:`legacy:${legacy}`;
      if(!map.has(key))map.set(key,{key,cuenta_id:s.cuenta_id||null,numero_mesa:s.numero_mesa,cobrado_at:s.cobrado_at,forma_pago:s.forma_pago,orders:[],subtotal:0,descuento:0,promocion:null,propina:0,personas:1,total:0,mesero_ids:new Set(),payments:[]});
      const g=map.get(key);g.orders.push(s);g.subtotal+=Number(s.total||0);g.propina=Math.max(g.propina,Number(s.propina||0));g.personas=Math.max(g.personas,Number(s.personas_dividir||1));if(s.mesero_id)g.mesero_ids.add(s.mesero_id);
    });
    for(const g of map.values()){
      if(g.cuenta_id){
        g.payments=proPayments.filter(p=>p.cuenta_id===g.cuenta_id);
        const promo=proPromotions.find(p=>p.cuenta_id===g.cuenta_id);
        if(promo){g.descuento=Number(promo.descuento||0);g.promocion=promo.promocion||promo.codigo||'Promoción';}
      }
      g.total=Math.max(0,g.subtotal-g.descuento)+g.propina;
    }
    return Array.from(map.values()).sort((a,b)=>new Date(b.cobrado_at)-new Date(a.cobrado_at));
  }

  async function loadProPayments(){
    const ids=[...new Set((sales||[]).map(s=>s.cuenta_id).filter(Boolean))];
    proPayments=[];proPromotions=[];
    if(!ids.length||typeof sb==='undefined'||!sb)return;
    const [{data:payments,error:payError},{data:promos,error:promoError}]=await Promise.all([
      sb.from('pagos_cuenta').select('cuenta_id,monto,forma_pago,created_at').in('cuenta_id',ids),
      sb.rpc('consultar_promociones_cuentas_staff',{p_cuentas:ids})
    ]);
    if(!payError)proPayments=payments||[];
    if(!promoError)proPromotions=promos||[];
  }

  function methodAmount(g,method){
    if(g.payments?.length)return g.payments.filter(p=>p.forma_pago===method).reduce((a,p)=>a+Number(p.monto||0),0);
    return g.forma_pago===method?Number(g.total||0):0;
  }
  function totalByMethod(accounts,method){return accounts.reduce((sum,g)=>sum+methodAmount(g,method),0)}
  function tipsTotal(accounts){return accounts.reduce((sum,g)=>sum+Number(g.propina||0),0)}
  function discountsTotal(accounts){return accounts.reduce((sum,g)=>sum+Number(g.descuento||0),0)}
  function paymentLabel(g){
    if(!g.payments?.length)return g.forma_pago||'Sin registrar';
    const grouped={};g.payments.forEach(p=>grouped[p.forma_pago]=(grouped[p.forma_pago]||0)+Number(p.monto||0));
    const parts=Object.entries(grouped).map(([m,v])=>`${m}: ${mx(v)}`);
    return parts.length>1?'Mixto · '+parts.join(' / '):parts[0]||g.forma_pago;
  }

  function installHeader(){const row=document.querySelector('.table-wrap thead tr');if(!row||row.dataset.cajaPro==='1')return;row.dataset.cajaPro='1';row.innerHTML='<th>HORA</th><th>MESA</th><th>CONSUMOS</th><th>MESERO</th><th>FORMA DE PAGO</th><th>CONSUMO</th><th>DESCUENTO</th><th>PROPINA</th><th>TOTAL COBRADO</th><th>TICKET</th>'}
  function addMetrics(){const metrics=document.querySelector('.metrics');if(!metrics)return;if(!document.getElementById('tipsTotal')){const card=document.createElement('div');card.className='metric';card.innerHTML='<b id="tipsTotal">$0.00</b><span>PROPINAS</span>';metrics.appendChild(card)}if(!document.getElementById('discountsTotal')){const card=document.createElement('div');card.className='metric';card.innerHTML='<b id="discountsTotal">$0.00</b><span>DESCUENTOS</span>';metrics.appendChild(card)}}

  function install(){
    if(typeof render!=='function'||typeof groupedAccounts!=='function'||typeof printAccount!=='function'||typeof printCut!=='function'||typeof loadSales!=='function')return false;
    if(window.__cajaProInstalled)return true;window.__cajaProInstalled=true;installHeader();addMetrics();groupedAccounts=accountGroups;

    const originalLoadSales=loadSales;
    loadSales=async function(){await originalLoadSales();await loadProPayments();render()};

    render=function(){
      installHeader();addMetrics();const accounts=accountGroups();const grand=accounts.reduce((a,g)=>a+Number(g.total||0),0);
      $('salesTotal').textContent=mx(grand);$('orderCount').textContent=accounts.length;$('cashTotal').textContent=mx(totalByMethod(accounts,'efectivo'));$('cardTotal').textContent=mx(totalByMethod(accounts,'tarjeta'));$('transferTotal').textContent=mx(totalByMethod(accounts,'transferencia'));const tipMetric=document.getElementById('tipsTotal');if(tipMetric)tipMetric.textContent=mx(tipsTotal(accounts));const discountMetric=document.getElementById('discountsTotal');if(discountMetric)discountMetric.textContent=mx(discountsTotal(accounts));
      $('salesRows').innerHTML=accounts.map(g=>`<tr><td>${new Date(g.cobrado_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</td><td><b>Mesa ${safeText(g.numero_mesa)}</b></td><td><span class="account-count">${g.orders.length} pedido${g.orders.length===1?'':'s'}</span></td><td>${safeText(g.mesero_ids.has(profile.id)?(profile.nombre||'Mesero'):'Equipo')}</td><td><span class="method">${safeText(paymentLabel(g))}</span></td><td>${mx(g.subtotal)}</td><td>${g.descuento?`<b>-${mx(g.descuento)}</b><br><small>${safeText(g.promocion||'')}</small>`:mx(0)}</td><td><b>${mx(g.propina)}</b></td><td class="account-total">${mx(g.total)}</td><td><button class="btn ticket" onclick="printAccount('${encodeURIComponent(g.key)}')">IMPRIMIR CUENTA</button></td></tr>`).join('');$('empty').classList.toggle('hidden',accounts.length>0);
    };

    printAccount=function(encodedKey){
      const key=decodeURIComponent(encodedKey),g=accountGroups().find(x=>x.key===key);if(!g)return;const its=accountItems(g),perPerson=g.personas>1?g.total/g.personas:g.total;
      $('printArea').innerHTML=`<div style="text-align:center"><h2>${safeText(restaurant?.name||'Restaurante')}</h2><p>Cuenta de mesa</p></div><hr><p><b>Mesa:</b> ${safeText(g.numero_mesa)}<br><b>Pedidos incluidos:</b> ${g.orders.length}<br><b>Fecha:</b> ${new Date(g.cobrado_at).toLocaleString('es-MX')}<br><b>Pago:</b> ${safeText(paymentLabel(g))}</p><hr>${its.map(i=>`<div style="display:flex;justify-content:space-between;gap:8px"><span>${Number(i.cantidad)}× ${safeText(i.producto)}</span><b>${mx(Number(i.cantidad)*Number(i.precio))}</b></div>`).join('')}<hr><div style="display:flex;justify-content:space-between"><span>Consumo</span><b>${mx(g.subtotal)}</b></div>${g.descuento?`<div style="display:flex;justify-content:space-between"><span>Descuento · ${safeText(g.promocion||'Promoción')}</span><b>-${mx(g.descuento)}</b></div>`:''}<div style="display:flex;justify-content:space-between"><span>Propina</span><b>${mx(g.propina)}</b></div><h2 style="display:flex;justify-content:space-between"><span>TOTAL PAGADO</span><span>${mx(g.total)}</span></h2>${g.personas>1?`<p style="text-align:center">Dividido entre ${g.personas}: <b>${mx(perPerson)} por persona</b></p>`:''}<p style="text-align:center">¡Gracias por su preferencia!</p>`;$('printArea').classList.remove('hidden');window.print();setTimeout(()=>$('printArea').classList.add('hidden'),300)
    };

    printCut=function(){
      const accounts=accountGroups(),total=accounts.reduce((a,g)=>a+Number(g.total||0),0),tips=tipsTotal(accounts),discounts=discountsTotal(accounts);
      $('printArea').innerHTML=`<div style="text-align:center"><h2>${safeText(restaurant?.name||'Restaurante')}</h2><p>Corte de caja · ${safeText($('dateFilter').value)}</p></div><hr><p>Cuentas cobradas: <b>${accounts.length}</b><br>Pedidos incluidos: <b>${sales.length}</b></p><p>Efectivo: <b>${mx(totalByMethod(accounts,'efectivo'))}</b><br>Tarjeta: <b>${mx(totalByMethod(accounts,'tarjeta'))}</b><br>Transferencia: <b>${mx(totalByMethod(accounts,'transferencia'))}</b></p><p>Descuentos aplicados: <b>${mx(discounts)}</b><br>Propinas incluidas: <b>${mx(tips)}</b></p><hr><h2>Total cobrado: ${mx(total)}</h2>`;$('printArea').classList.remove('hidden');window.print();setTimeout(()=>$('printArea').classList.add('hidden'),300)
    };

    setTimeout(async()=>{await loadProPayments();render()},50);return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>=40)clearInterval(timer)},250);document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100),{once:true});
})();