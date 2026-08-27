
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
