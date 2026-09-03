
function cfgReady(){
  return window.APP_CONFIG && APP_CONFIG.SUPABASE_URL?.startsWith("https://") &&
    APP_CONFIG.SUPABASE_ANON_KEY?.startsWith("sb_publishable_");
}
function getSlug(){return new URLSearchParams(location.search).get("slug")||APP_CONFIG.DEFAULT_SLUG}
function eh(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(v){v=String(v??"").trim();return !v?"":(v.includes("$")?v:"$"+v)}
function makeClient(){return supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY)}
function renderMenu(container,restaurant,categories){
  container.innerHTML="";
  document.querySelectorAll("[data-restaurant-name]").forEach(x=>x.textContent=restaurant?.name||"Chilaquiles de la Carretera");
  document.querySelectorAll("[data-restaurant-logo]").forEach(img=>{
    if(restaurant?.logo_url){
      img.src=restaurant.logo_url;
      img.alt=restaurant?.name||"Logo";
      img.classList.remove("hidden");
      img.closest(".menu-hero")?.classList.add("has-logo");
    }else{
      img.removeAttribute("src");
      img.classList.add("hidden");
      img.closest(".menu-hero")?.classList.remove("has-logo");
    }
  });
  categories.filter(c=>c.visible!==false && !c._delete).forEach(cat=>{
    const products=(cat.products||[]).filter(p=>p.visible!==false && !p._delete);
    if(!products.length)return;
    const sec=document.createElement("section");
    sec.className="section";
    sec.innerHTML=`<div class="section-title">${eh(cat.name)}</div>`;
    products.forEach(p=>{
      const card=document.createElement("div"); card.className="menu-item-card";
      let media = "";
      if(p.video_url){
        media = `<video class="item-video" src="${eh(p.video_url)}" ${p.image_url?`poster="${eh(p.image_url)}"`:""} autoplay muted loop playsinline preload="auto"></video>`;
      } else if(p.image_url){
        media = `<img class="item-thumb" src="${eh(p.image_url)}" alt="${eh(p.name)}" loading="lazy">`;
      } else {
        media = `<div class="item-noimg">🌶️</div>`;
      }
      const price=p.promo_price
        ? `<span class="old">${money(eh(p.price))}</span><span class="promo">${money(eh(p.promo_price))}</span>`
        : money(eh(p.price));
      card.innerHTML=`<div class="media-stack">${media}</div><div class="item-info"><div class="item-line">
        <span>${eh(p.name)}${p.available===false?`<span class="sold">AGOTADO</span>`:""}</span>
        <span class="dots"></span><span class="price">${price}</span></div>
        <button class="add-cart-btn" ${p.available===false?"disabled":""}
          onclick="addToCart(${JSON.stringify(p).replace(/"/g,'&quot;')})">
          ${p.available===false?"Agotado":"Agregar al pedido"}
        </button>
      </div>`;
      sec.appendChild(card);
    });
    container.appendChild(sec);
  });
  setTimeout(activateContinuousVideos, 0);
}

function activateContinuousVideos(){
  const videos = document.querySelectorAll("video.item-video");
  videos.forEach(v => {
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(()=>{});
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("canplay", tryPlay, { once:true });
    v.addEventListener("ended", () => {
      try { v.currentTime = 0; } catch(e) {}
      tryPlay();
    });
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const v = entry.target;
        if (entry.isIntersecting) {
          v.muted = true;
          const p = v.play();
          if (p && typeof p.catch === "function") p.catch(()=>{});
        }
      });
    }, { threshold: 0.15 });
    videos.forEach(v => io.observe(v));
  }
}

// En el menú público, un pedido confirmado NO cierra la mesa.
// Después de cada envío vuelve a habilitar el botón para permitir consumos adicionales.
function enableRepeatOrdering(){
  const button=document.getElementById('confirmOrderBtn');
  if(!button)return;

  const resetAfterSuccess=()=>{
    if(button.textContent.trim()==='PEDIDO CONFIRMADO'){
      window.setTimeout(()=>{
        button.disabled=false;
        button.textContent='➕ AGREGAR OTRO PEDIDO';
        button.setAttribute('aria-label','Agregar otro pedido a la misma mesa');
      },700);
    }
  };

  const observer=new MutationObserver(resetAfterSuccess);
  observer.observe(button,{childList:true,subtree:true,characterData:true});
  resetAfterSuccess();
}

// El seguimiento no debe bloquear el menú. Inserta un botón grande para volver a pedir.
function enableKeepOrderingButton(){
  const panel=document.getElementById('orderTracking');
  if(!panel || panel.querySelector('[data-keep-ordering]'))return;
  const actions=panel.querySelector('.service-actions');
  if(!actions)return;

  const button=document.createElement('button');
  button.type='button';
  button.dataset.keepOrdering='true';
  button.className='service-btn';
  button.textContent='➕ SEGUIR PIDIENDO';
  button.style.width='100%';
  button.style.background='#176c44';
  button.style.color='#fff';
  button.style.fontWeight='900';
  button.style.marginBottom='8px';
  button.style.minHeight='48px';
  button.addEventListener('click',()=>{
    sessionStorage.setItem('trackingPanelDismissed','1');
    panel.classList.add('hidden');
    const menu=document.getElementById('menu');
    if(menu) menu.scrollIntoView({behavior:'smooth',block:'start'});
  });
  actions.prepend(button);
}

// Evita que el refresco automático de 4 segundos vuelva a abrir el seguimiento
// mientras el cliente está navegando y agregando más productos.
function keepTrackingPanelDismissed(){
  const panel=document.getElementById('orderTracking');
  if(!panel)return;

  window.setTimeout(()=>{
    if(typeof window.renderOrderTracking==='function'){
      const originalRender=window.renderOrderTracking;
      window.renderOrderTracking=function(order){
        originalRender(order);
        if(sessionStorage.getItem('trackingPanelDismissed')==='1'){
          panel.classList.add('hidden');
        }
      };
    }

    if(typeof window.closeOrderTracking==='function'){
      const originalClose=window.closeOrderTracking;
      window.closeOrderTracking=function(){
        sessionStorage.setItem('trackingPanelDismissed','1');
        originalClose();
      };
    }

    if(typeof window.startOrderTracking==='function'){
      const originalStart=window.startOrderTracking;
      window.startOrderTracking=function(orderId){
        sessionStorage.removeItem('trackingPanelDismissed');
        return originalStart(orderId);
      };
    }

    if(sessionStorage.getItem('trackingPanelDismissed')==='1'){
      panel.classList.add('hidden');
    }
  },0);
}

document.addEventListener('DOMContentLoaded',()=>{
  enableRepeatOrdering();
  enableKeepOrderingButton();
  keepTrackingPanelDismissed();
},{once:true});

// Muestra al cliente el total acumulado de todos los pedidos de su cuenta de mesa.
function enableClientRunningTotal(){
  const panel=document.getElementById('orderTracking');
  if(!panel)return;
  window.setTimeout(()=>{
    if(typeof window.renderOrderTracking!=='function')return;
    const originalRender=window.renderOrderTracking;
    if(originalRender.__clientRunningTotal)return;

    const wrapped=function(order){
      originalRender(order);
      const steps=document.getElementById('trackingSteps');
      const actions=panel.querySelector('.service-actions');
      if(!steps || !actions)return;

      let box=document.getElementById('tableAccountTotal');
      if(!box){
        box=document.createElement('div');
        box.id='tableAccountTotal';
        box.style.margin='14px 0 12px';
        box.style.padding='15px 14px';
        box.style.borderRadius='16px';
        box.style.background='#fff7df';
        box.style.border='2px solid #e0ad22';
        box.style.textAlign='center';
        box.style.boxShadow='0 8px 20px rgba(0,0,0,.08)';
        actions.parentNode.insertBefore(box,actions);
      }

      const total=Number(order?.total_cuenta||0);
      const count=Number(order?.pedidos_cuenta||0);
      const paid=order?.estado==='cobrado';
      const label=paid?'TOTAL PAGADO DE LA MESA':'TOTAL ACTUAL DE TU MESA';
      const amount=total.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
      box.innerHTML=`<div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#756d64">${label}</div>
        <div style="font-size:30px;font-weight:950;color:#176c44;margin:3px 0">${amount}</div>
        <div style="font-size:12px;color:#756d64">${count} pedido${count===1?'':'s'} en esta cuenta</div>`;
      box.classList.toggle('hidden',order?.estado==='cancelado');
    };
    wrapped.__clientRunningTotal=true;
    window.renderOrderTracking=wrapped;
  },0);
}

document.addEventListener('DOMContentLoaded',enableClientRunningTotal,{once:true});

// En Meseros, cobrar desde cualquier consumo entregado cierra todos los consumos
// entregados pendientes de esa misma mesa en una sola acción y con la misma forma de pago.
function enableOpenTableCheckout(){
  if(!location.pathname.endsWith('/meseros.html'))return;
  window.setTimeout(()=>{
    window.chargeOrder=async function(id,method){
      try{
        if(typeof sb==='undefined' || !sb)return alert('No hay conexión con Caja.');
        const {data:base,error:baseError}=await sb.from('pedidos')
          .select('id,restaurant_id,numero_mesa,total')
          .eq('id',id).eq('estado','entregado').maybeSingle();
        if(baseError||!base)return alert('No se encontró el consumo entregado.');

        const {data:pending,error:pendingError}=await sb.from('pedidos')
          .select('id,total')
          .eq('restaurant_id',base.restaurant_id)
          .eq('numero_mesa',base.numero_mesa)
          .eq('estado','entregado');
        if(pendingError)return alert('No se pudo consultar la cuenta de la mesa: '+pendingError.message);
        if(!pending?.length)return alert('No hay consumos pendientes de cobro en esta mesa.');

        const total=pending.reduce((sum,p)=>sum+Number(p.total||0),0);
        if(!confirm(`Mesa ${base.numero_mesa}: ${pending.length} consumo(s) por $${total.toFixed(0)}. ¿Confirmar cobro por ${method.toUpperCase()} y cerrar la cuenta?`))return;

        const now=new Date().toISOString();
        const ids=pending.map(p=>p.id);
        const {error}=await sb.from('pedidos').update({
          estado:'cobrado',forma_pago:method,cobrado_at:now,updated_at:now
        }).in('id',ids).eq('estado','entregado');
        if(error)return alert('No se pudo registrar el cobro: '+error.message);
        if(typeof refreshAll==='function')await refreshAll(false);
      }catch(error){
        console.error(error);
        alert('No se pudo cerrar la cuenta de la mesa.');
      }
    };
  },0);
}

document.addEventListener('DOMContentLoaded',enableOpenTableCheckout,{once:true});

// Pantalla final premium del cliente cuando la cuenta ya fue cobrada.
function enableClientPaymentThankYou(){
  const panel=document.getElementById('orderTracking');
  if(!panel)return;

  window.setTimeout(()=>{
    if(typeof window.renderOrderTracking!=='function')return;
    const originalRender=window.renderOrderTracking;
    if(originalRender.__paymentThankYou)return;

    const wrapped=function(order){
      originalRender(order);

      const paid=order?.estado==='cobrado';
      const steps=document.getElementById('trackingSteps');
      const actions=panel.querySelector('.service-actions');
      const runningTotal=document.getElementById('tableAccountTotal');
      let thankYou=document.getElementById('paymentThankYou');

      if(!paid){
        if(thankYou)thankYou.classList.add('hidden');
        if(steps)steps.classList.remove('hidden');
        if(actions && order?.estado!=='cancelado')actions.classList.remove('hidden');
        if(runningTotal && order?.estado!=='cancelado')runningTotal.classList.remove('hidden');
        return;
      }

      sessionStorage.removeItem('trackingPanelDismissed');
      panel.classList.remove('hidden');
      if(steps)steps.classList.add('hidden');
      if(actions)actions.classList.add('hidden');
      if(runningTotal)runningTotal.classList.add('hidden');

      if(!thankYou){
        thankYou=document.createElement('div');
        thankYou.id='paymentThankYou';
        panel.appendChild(thankYou);
      }

      const total=Number(order?.total_cuenta||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
      const methodLabels={efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia'};
      const payment=methodLabels[String(order?.forma_pago||'').toLowerCase()]||'Pago confirmado';

      thankYou.classList.remove('hidden');
      thankYou.innerHTML=`
        <div style="text-align:center;padding:8px 2px 4px">
          <div style="width:78px;height:78px;border-radius:50%;margin:0 auto 13px;background:#176c44;color:#fff;display:grid;place-items:center;font-size:42px;font-weight:900;box-shadow:0 10px 28px rgba(23,108,68,.28);animation:clientPaidPop .55s ease both">✓</div>
          <div style="font-size:12px;font-weight:950;letter-spacing:.11em;color:#176c44">PAGO CONFIRMADO</div>
          <h2 style="font-size:27px;line-height:1.05;margin:8px 0 8px;color:#211d18">🌶️ ¡Gracias por visitarnos!</h2>
          <p style="margin:0 auto 16px;max-width:460px;color:#675f57;font-size:14px;line-height:1.55">Esperamos que hayas disfrutado cada bocado y que tu experiencia en <b>Chilaquiles de la Carretera</b> haya sido tan buena como nuestro sabor.</p>
          <div style="background:linear-gradient(145deg,#fff8e6,#fff);border:1px solid #ead7a0;border-radius:18px;padding:14px;margin:0 0 14px;box-shadow:0 8px 22px rgba(0,0,0,.06)">
            <div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#756d64">TOTAL PAGADO</div>
            <div style="font-size:32px;font-weight:950;color:#176c44;margin:2px 0">${total}</div>
            <div style="font-size:13px;color:#756d64">${payment} · Mesa ${eh(order?.numero_mesa||'')}</div>
          </div>
          <div style="font-size:14px;line-height:1.55;color:#514a43;margin:0 4px 16px">💚 Fue un gusto atenderte.<br>🚗 Que tengas un excelente camino.<br>🌶️ Siempre hay un buen momento para volver por unos chilaquiles.</div>
          <div style="font-weight:950;color:#211d18;margin-bottom:4px">¡Te esperamos muy pronto!</div>
          <div style="font-size:12px;color:#81776d;font-style:italic;margin-bottom:17px">Sabor que se disfruta. Momentos que se recuerdan.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
            <button type="button" data-paid-menu style="border:0;border-radius:14px;padding:13px 10px;background:#176c44;color:#fff;font-weight:900;cursor:pointer">🌶️ VER MENÚ</button>
            <button type="button" data-paid-finish style="border:1px solid #d7d0c8;border-radius:14px;padding:13px 10px;background:#fff;color:#302b26;font-weight:900;cursor:pointer">✓ FINALIZAR</button>
          </div>
        </div>`;

      if(!document.getElementById('clientPaidAnimationStyle')){
        const style=document.createElement('style');
        style.id='clientPaidAnimationStyle';
        style.textContent='@keyframes clientPaidPop{0%{transform:scale(.55);opacity:0}65%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}';
        document.head.appendChild(style);
      }

      thankYou.querySelector('[data-paid-menu]')?.addEventListener('click',()=>{
        panel.classList.add('hidden');
        document.getElementById('menu')?.scrollIntoView({behavior:'smooth',block:'start'});
      },{once:true});
      thankYou.querySelector('[data-paid-finish]')?.addEventListener('click',()=>{
        sessionStorage.removeItem('activeOrderId');
        sessionStorage.removeItem('trackingPanelDismissed');
        panel.classList.add('hidden');
      },{once:true});
    };

    wrapped.__paymentThankYou=true;
    window.renderOrderTracking=wrapped;
  },0);
}

document.addEventListener('DOMContentLoaded',enableClientPaymentThankYou,{once:true});
