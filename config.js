window.APP_CONFIG = {
  SUPABASE_URL: "https://wufftcheeyznuaymplyf.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_1OgzXVDtS7aKSICG58Owtg_er1PKy2O",
  DEFAULT_SLUG: "chilaquiles-de-la-carretera",
  IMAGE_BUCKET: "menu-images",
  VIDEO_BUCKET: "menu-videos",
  AUDIO_BUCKET: "menu-audio",
  VOICE_BUCKET: "menu-voice"
};

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
    link.href='punto-azul-theme.css?v=2';
    link.dataset.puntoAzulTheme='1';
    document.head.appendChild(link);
  }

  if(!document.querySelector('script[data-punto-azul-brand]')){
    const script=document.createElement('script');
    script.src='punto-azul-brand.js?v=2';
    script.defer=true;
    script.dataset.puntoAzulBrand='1';
    document.head.appendChild(script);
  }
})();