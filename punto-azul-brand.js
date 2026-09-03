(function(){
  const path=(location.pathname||'').toLowerCase();
  const isPublicMenu=path==='/' || path.endsWith('/index.html');
  if(!isPublicMenu)return;

  const VIDEO_FILE='Crear_animación_logo_PUNTO_AZUL_202609030948.mp4';
  const VIDEO_SRC=encodeURI(VIDEO_FILE);

  document.body.classList.add('punto-azul-theme');
  document.title='Punto Azul Restaurante';

  const safePlay=(video)=>{
    if(!video)return;
    video.muted=true;
    video.loop=true;
    video.playsInline=true;
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    const p=video.play();
    if(p&&typeof p.catch==='function')p.catch(()=>{});
  };

  function makeVideo(className){
    const video=document.createElement('video');
    video.className=className;
    video.src=VIDEO_SRC;
    video.autoplay=true;
    video.muted=true;
    video.loop=true;
    video.playsInline=true;
    video.preload='auto';
    video.controls=false;
    video.disablePictureInPicture=true;
    video.setAttribute('aria-label','Logo animado Punto Azul Restaurante');
    video.addEventListener('loadeddata',()=>safePlay(video),{once:true});
    return video;
  }

  function applyBrand(){
    const title=document.getElementById('premiumTitle');
    if(title) title.textContent='Punto Azul Restaurante';

    const subtitle=document.getElementById('premiumSubtitle');
    if(subtitle) subtitle.textContent='Cocina contemporánea, servicio ágil y una experiencia con estilo.';

    const kicker=document.querySelector('.premium-kicker');
    if(kicker) kicker.textContent='Menú digital premium';

    const premiumLogo=document.getElementById('premiumLogo');
    if(premiumLogo && !document.querySelector('.punto-azul-logo-video')){
      premiumLogo.insertAdjacentElement('afterend',makeVideo('punto-azul-logo-video'));
    }

    const menuHero=document.querySelector('.menu-hero');
    if(menuHero){
      const h1=menuHero.querySelector('h1');
      if(h1) h1.textContent='Punto Azul Restaurante';
      if(!menuHero.querySelector('.punto-azul-menu-video')){
        const video=makeVideo('punto-azul-menu-video');
        menuHero.insertBefore(video,menuHero.firstChild);
      }
    }

    document.querySelectorAll('[data-restaurant-name]').forEach(el=>{
      el.textContent='Punto Azul Restaurante';
    });

    document.querySelectorAll('.public-voice-text strong').forEach(el=>{
      el.textContent='🎙️ Conoce Punto Azul Restaurante';
    });

    document.querySelectorAll('.menu-footer').forEach(el=>{
      el.textContent='¡GRACIAS POR SU PREFERENCIA! · Punto Azul Restaurante';
    });

    document.querySelectorAll('.punto-azul-logo-video,.punto-azul-menu-video').forEach(safePlay);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
  }else{
    applyBrand();
  }

  // shared.js puede reinyectar nombre/logo desde Supabase después de cargar.
  // Reaplicamos únicamente el branding visible, sin tocar datos ni lógica.
  window.addEventListener('load',()=>{
    applyBrand();
    setTimeout(applyBrand,500);
    setTimeout(applyBrand,1600);
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      document.querySelectorAll('.punto-azul-logo-video,.punto-azul-menu-video').forEach(safePlay);
    }
  });
})();
