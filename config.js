window.APP_CONFIG = {
  SUPABASE_URL: "https://wufftcheeyznuaymplyf.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_1OgzXVDtS7aKSICG58Owtg_er1PKy2O",
  DEFAULT_SLUG: "chilaquiles-de-la-carretera",
  IMAGE_BUCKET: "menu-images",
  VIDEO_BUCKET: "menu-videos",
  AUDIO_BUCKET: "menu-audio",
  VOICE_BUCKET: "menu-voice"
};

// Arranque inmediato de Punto Azul en el menú público.
// Evita que dispositivos móviles alcancen a pintar por unos segundos el logo/nombre anterior
// mientras terminan de cargar la hoja de tema y el branding animado.
(function preventLegacyBrandFlash(){
  const path=(location.pathname||'').toLowerCase();
  const isPublicMenu=path==='/' || path.endsWith('/index.html');
  if(!isPublicMenu)return;

  const style=document.createElement('style');
  style.id='puntoAzulBootGuard';
  style.textContent=`
    #premiumCover{
      background:radial-gradient(circle at 50% 15%,rgba(34,108,180,.28),transparent 38%),linear-gradient(155deg,#020408 0%,#071426 48%,#03060b 100%)!important;
      color:#f4f7fb!important;
    }
    #premiumLogo{display:none!important}
    #premiumCard,.premium-card{
      background:linear-gradient(145deg,rgba(6,15,28,.92),rgba(3,7,13,.90))!important;
      border-color:rgba(206,216,227,.40)!important;
    }
    #premiumTitle{color:#f2f5f8!important;text-shadow:0 2px 18px rgba(58,132,203,.24)!important}
    #premiumSubtitle,.premium-note{color:#b9c4d0!important}
    .premium-kicker{color:#cbd3dc!important}
    .premium-chip{color:#e8edf3!important;background:rgba(10,35,64,.66)!important;border-color:rgba(193,205,217,.24)!important}
    .premium-enter{background:linear-gradient(135deg,#123e6d,#1f67a8 56%,#76889b 145%)!important;color:#fff!important;border:1px solid rgba(222,230,238,.75)!important}
  `;
  document.head.appendChild(style);

  const title=document.getElementById('premiumTitle');
  if(title)title.textContent='Punto Azul Restaurante';
  const subtitle=document.getElementById('premiumSubtitle');
  if(subtitle)subtitle.textContent='Cocina contemporánea, servicio ágil y una experiencia con estilo.';
  const kicker=document.querySelector('.premium-kicker');
  if(kicker)kicker.textContent='Menú digital premium';
  const note=document.querySelector('.premium-note');
  if(note)note.textContent='Toca para entrar al menú completo';
})();

// Seguridad adicional: el panel de Meseros es exclusivo para personal con rol "mesero".
// Esto evita que un Administrador aparezca como quien tomó una orden.
(function enforceMeseroOnlyPanel(){
  if(!/\/meseros\.html$/i.test(location.pathname)) return;

  let guardClient = null;
  let checking = false;

  function setBlocked(blocked, message=''){
    let style = document.getElementById('meseroOnlyRoleGuardStyle');
    if(blocked){
      if(!style){
        style = document.createElement('style');
        style.id = 'meseroOnlyRoleGuardStyle';
        style.textContent = '#appView{display:none!important}#loginView{display:grid!important}';
        document.head.appendChild(style);
      }
      const status = document.getElementById('loginStatus');
      if(status){
        status.innerHTML = '<div class="status err">'+message+'</div>';
      }
    }else if(style){
      style.remove();
    }
  }

  async function verifyRole(){
    if(checking || !window.supabase || !window.APP_CONFIG) return;
    checking = true;
    try{
      guardClient = guardClient || window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
      const {data:{session}} = await guardClient.auth.getSession();
      if(!session){
        setBlocked(false);
        return;
      }
      const {data:staff,error} = await guardClient
        .from('meseros')
        .select('rol,activo')
        .eq('user_id',session.user.id)
        .maybeSingle();
      if(error) return;

      if(!staff || staff.activo !== true || staff.rol !== 'mesero'){
        setBlocked(true,'⛔ Este acceso es exclusivo para MESEROS. Usa la cuenta personal del mesero.');
      }else{
        setBlocked(false);
      }
    }catch(error){
      console.error('Role guard:',error);
    }finally{
      checking = false;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    verifyRole();
    setTimeout(verifyRole,300);
    setTimeout(verifyRole,1000);
    if(window.supabase){
      guardClient = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
      guardClient.auth.onAuthStateChange(()=>setTimeout(verifyRole,0));
    }
  },{once:true});

  window.addEventListener('pageshow',()=>setTimeout(verifyRole,0));
})();

// El panel de Administración solo puede mantenerse abierto con una sesión de rol "admin".
// Si quedó activa una sesión de Mesero, Cocina o Caja al cambiar de panel, se cierra antes de permitir ediciones o subidas.
(function enforceAdminOnlyPanel(){
  if(!/\/admin\.html$/i.test(location.pathname)) return;

  let guardClient = null;
  let checking = false;

  function setAdminBlocked(blocked,message=''){
    let style=document.getElementById('adminOnlyRoleGuardStyle');
    if(blocked){
      if(!style){
        style=document.createElement('style');
        style.id='adminOnlyRoleGuardStyle';
        style.textContent='#app{display:none!important}#login{display:grid!important}';
        document.head.appendChild(style);
      }
      const status=document.getElementById('loginStatus');
      if(status && message){
        status.innerHTML='<div class="status err">'+message+'</div>';
      }
    }else if(style){
      style.remove();
    }
  }

  async function verifyAdminRole(){
    if(checking || !window.supabase || !window.APP_CONFIG)return;
    checking=true;
    try{
      guardClient=guardClient||window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
      const {data:{session}}=await guardClient.auth.getSession();
      if(!session){
        setAdminBlocked(false);
        return;
      }
      const {data:staff,error}=await guardClient
        .from('meseros')
        .select('rol,activo')
        .eq('user_id',session.user.id)
        .maybeSingle();
      if(error)return;

      if(!staff || staff.activo!==true || staff.rol!=='admin'){
        setAdminBlocked(true,'⛔ La sesión anterior no es de Administrador. Inicia sesión con la cuenta ADMIN.');
        await guardClient.auth.signOut();
      }else{
        setAdminBlocked(false);
      }
    }catch(error){
      console.error('Admin role guard:',error);
    }finally{
      checking=false;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    verifyAdminRole();
    setTimeout(verifyAdminRole,350);
    setTimeout(verifyAdminRole,1200);
    if(window.supabase){
      guardClient=window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
      guardClient.auth.onAuthStateChange(()=>setTimeout(verifyAdminRole,0));
    }
  },{once:true});

  window.addEventListener('pageshow',()=>setTimeout(verifyAdminRole,0));
})();

// Carga el módulo del video final de pago tanto en Administración como en el menú del cliente.
(function loadPaymentFlowModule(){
  if(document.querySelector('script[data-payment-flow]'))return;
  const script=document.createElement('script');
  script.src='payment-flow.js?v=1';
  script.defer=true;
  script.dataset.paymentFlow='1';
  document.head.appendChild(script);
})();

// Branding Punto Azul: se carga como capa externa SOLO en el menú público.
// No altera la lógica de carga del menú ni las operaciones con Supabase.
(function loadPuntoAzulBranding(){
  const path=(location.pathname||'').toLowerCase();
  const isPublicMenu=path==='/' || path.endsWith('/index.html');
  if(!isPublicMenu)return;

  if(!document.querySelector('link[data-punto-azul-theme]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='punto-azul-theme.css?v=3';
    link.dataset.puntoAzulTheme='1';
    document.head.appendChild(link);
  }

  if(!document.querySelector('script[data-punto-azul-brand]')){
    const script=document.createElement('script');
    script.src='punto-azul-brand.js?v=3';
    script.defer=true;
    script.dataset.puntoAzulBrand='1';
    document.head.appendChild(script);
  }
})();

// Total final del cliente: consumo + propina + referencia de división de cuenta.
(function loadClienteTotalPro(){
  const path=(location.pathname||'').toLowerCase();
  const isPublicMenu=path==='/' || path.endsWith('/index.html');
  if(!isPublicMenu || document.querySelector('script[data-cliente-total-pro]'))return;
  const script=document.createElement('script');
  script.src='cliente-total-pro.js?v=1';
  script.defer=true;
  script.dataset.clienteTotalPro='1';
  document.head.appendChild(script);
})();

// Tema Punto Azul para paneles operativos. Es únicamente presentación visual.
(function loadPuntoAzulStaffTheme(){
  const path=(location.pathname||'').toLowerCase();
  const isStaff=['/meseros.html','/cocina.html','/caja.html','/dueno.html'].some(x=>path.endsWith(x));
  if(!isStaff)return;

  if(!document.querySelector('link[data-punto-azul-staff-theme]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='punto-azul-staff.css?v=1';
    link.dataset.puntoAzulStaffTheme='1';
    document.head.appendChild(link);
  }

  if(!document.querySelector('script[data-punto-azul-staff-brand]')){
    const script=document.createElement('script');
    script.src='punto-azul-staff.js?v=1';
    script.defer=true;
    script.dataset.puntoAzulStaffBrand='1';
    document.head.appendChild(script);
  }
})();