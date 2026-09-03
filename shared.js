
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
    panel.classList.add('hidden');
    const menu=document.getElementById('menu');
    if(menu) menu.scrollIntoView({behavior:'smooth',block:'start'});
  });
  actions.prepend(button);
}

document.addEventListener('DOMContentLoaded',()=>{
  enableRepeatOrdering();
  enableKeepOrderingButton();
},{once:true});

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