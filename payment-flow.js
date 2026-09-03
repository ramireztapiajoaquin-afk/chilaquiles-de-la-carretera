(function(){
  const isAdmin=location.pathname.endsWith('/admin.html')||location.pathname.endsWith('admin.html');
  const isClient=location.pathname==='/'||location.pathname.endsWith('/index.html')||location.pathname.endsWith('index.html');

  function waitFor(test,done,tries=80){
    let n=0;
    const timer=setInterval(()=>{
      n++;
      try{
        if(test()){
          clearInterval(timer);
          done();
        }else if(n>=tries){
          clearInterval(timer);
        }
      }catch(e){
        if(n>=tries)clearInterval(timer);
      }
    },250);
  }

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function setupAdminPaymentVideo(){
    waitFor(
      ()=>typeof restaurant!=='undefined'&&restaurant?.id&&typeof sb!=='undefined'&&sb,
      ()=>{
        if(document.getElementById('paymentThanksVideoSettings'))return;
        const anchor=document.querySelector('.voice-settings')||document.querySelector('.whatsapp-settings')||document.querySelector('.brand-settings');
        if(!anchor)return;

        const box=document.createElement('div');
        box.id='paymentThanksVideoSettings';
        box.className='voice-settings';
        box.style.marginTop='18px';
        anchor.insertAdjacentElement('afterend',box);

        async function saveUrl(url){
          const {error}=await sb.rpc('actualizar_video_despedida',{
            p_restaurant_id:restaurant.id,
            p_url:url||null
          });
          if(error)throw error;
          restaurant.payment_thanks_video_url=url||null;
        }

        function render(){
          const url=restaurant.payment_thanks_video_url||'';
          box.innerHTML=`
            <h3>✨ Video final después del pago</h3>
            <div style="font-size:13px;color:#6f6f6f;margin-bottom:10px;line-height:1.45">Se reproducirá automáticamente cuando la cuenta quede cobrada y, al terminar, aparecerá el mensaje final de agradecimiento.</div>
            <div id="paymentThanksVideoPreview">${url?`<video src="${esc(url)}" controls muted playsinline style="width:100%;max-height:260px;background:#000;border-radius:14px;object-fit:contain"></video>`:'<div style="padding:18px;border:1px dashed #bbb;border-radius:14px;text-align:center;color:#777">Todavía no hay video final configurado.</div>'}</div>
            <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:10px">
              <label class="upload-label" style="font-size:13px;cursor:pointer">${url?'Cambiar video':'Subir video'}
                <input id="paymentThanksVideoInput" type="file" accept="video/mp4,video/webm" style="display:none">
              </label>
              ${url?'<button id="removePaymentThanksVideo" class="btn danger" type="button">Quitar video</button>':''}
            </div>
            <div id="paymentThanksVideoStatus" style="font-size:12px;margin-top:8px;color:#666">Recomendado: MP4, 8 segundos, horizontal 16:9, máximo 10 MB.</div>`;

          const input=document.getElementById('paymentThanksVideoInput');
          input?.addEventListener('change',async()=>{
            const file=input.files?.[0];
            if(!file)return;
            const status=document.getElementById('paymentThanksVideoStatus');
            if(!['video/mp4','video/webm'].includes(file.type)){
              status.textContent='Usa un archivo MP4 o WebM.';
              status.style.color='#a1261d';
              input.value='';
              return;
            }
            if(file.size>10*1024*1024){
              status.textContent='El video supera 10 MB.';
              status.style.color='#a1261d';
              input.value='';
              return;
            }
            status.textContent='Subiendo video…';
            status.style.color='#176c44';
            input.disabled=true;
            try{
              const ext=(file.name.split('.').pop()||'mp4').toLowerCase();
              const path=`${restaurant.id}/payment-thanks-${Date.now()}.${ext}`;
              const {error:uploadError}=await sb.storage.from(APP_CONFIG.VIDEO_BUCKET).upload(path,file,{
                cacheControl:'3600',upsert:false,contentType:file.type
              });
              if(uploadError)throw uploadError;
              const {data}=sb.storage.from(APP_CONFIG.VIDEO_BUCKET).getPublicUrl(path);
              const url=data?.publicUrl;
              if(!url)throw new Error('No se pudo obtener la URL pública del video.');
              await saveUrl(url);
              render();
              const newStatus=document.getElementById('paymentThanksVideoStatus');
              if(newStatus){
                newStatus.textContent='✓ Video final guardado correctamente.';
                newStatus.style.color='#176c44';
              }
            }catch(e){
              status.textContent='No se pudo guardar el video: '+e.message;
              status.style.color='#a1261d';
              input.disabled=false;
            }
          });

          document.getElementById('removePaymentThanksVideo')?.addEventListener('click',async()=>{
            if(!confirm('¿Quitar el video final después del pago?'))return;
            const status=document.getElementById('paymentThanksVideoStatus');
            status.textContent='Quitando video…';
            try{
              await saveUrl(null);
              render();
            }catch(e){
              status.textContent='No se pudo quitar: '+e.message;
              status.style.color='#a1261d';
            }
          });
        }

        render();
      }
    );
  }

  function createPaidVideoOverlay(url,orderId,onDone){
    let finished=false;
    let fallback=null;
    const finish=()=>{
      if(finished)return;
      finished=true;
      if(fallback)clearTimeout(fallback);
      sessionStorage.setItem('paymentIntroPlayed:'+orderId,'1');
      overlay.classList.add('is-leaving');
      setTimeout(()=>{
        overlay.remove();
        onDone();
      },320);
    };

    let style=document.getElementById('paymentIntroStyle');
    if(!style){
      style=document.createElement('style');
      style.id='paymentIntroStyle';
      style.textContent=`
        .payment-intro-overlay{position:fixed;inset:0;z-index:100000;background:#000;display:grid;place-items:center;opacity:0;animation:paymentIntroIn .35s ease forwards}
        .payment-intro-overlay video{width:100vw;height:100vh;object-fit:contain;background:#000}
        .payment-intro-overlay.is-leaving{animation:paymentIntroOut .32s ease forwards}
        @keyframes paymentIntroIn{to{opacity:1}}
        @keyframes paymentIntroOut{to{opacity:0}}
      `;
      document.head.appendChild(style);
    }

    const overlay=document.createElement('div');
    overlay.className='payment-intro-overlay';
    overlay.innerHTML='<video playsinline preload="auto"></video>';
    document.body.appendChild(overlay);
    const video=overlay.querySelector('video');
    video.src=url;
    video.currentTime=0;
    video.addEventListener('ended',finish,{once:true});
    video.addEventListener('error',finish,{once:true});

    const attempt=video.play();
    if(attempt&&typeof attempt.catch==='function'){
      attempt.catch(()=>{
        video.muted=true;
        video.play().catch(finish);
      });
    }
    fallback=setTimeout(finish,11000);
  }

  function setupClientPaymentIntro(){
    waitFor(
      ()=>typeof renderOrderTracking==='function',
      ()=>{
        window.setTimeout(()=>{
          if(typeof renderOrderTracking!=='function')return;
          const original=renderOrderTracking;
          if(original.__paymentIntroVideo)return;

          const wrapped=function(order){
            original(order);
            if(order?.estado!=='cobrado')return;

            let videoUrl='';
            try{
              if(typeof currentRestaurant!=='undefined')videoUrl=currentRestaurant?.payment_thanks_video_url||'';
            }catch(e){}
            if(!videoUrl)return;

            const key='paymentIntroPlayed:'+order.id;
            if(sessionStorage.getItem(key)==='1')return;
            if(document.querySelector('.payment-intro-overlay'))return;

            const panel=document.getElementById('orderTracking');
            const thankYou=document.getElementById('paymentThankYou');
            if(thankYou)thankYou.classList.add('hidden');
            if(panel)panel.classList.add('hidden');

            createPaidVideoOverlay(videoUrl,order.id,()=>{
              if(panel)panel.classList.remove('hidden');
              if(thankYou)thankYou.classList.remove('hidden');
            });
          };
          wrapped.__paymentIntroVideo=true;
          window.renderOrderTracking=wrapped;
        },200);
      }
    );
  }

  function start(){
    if(isAdmin)setupAdminPaymentVideo();
    if(isClient)setupClientPaymentIntro();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();
