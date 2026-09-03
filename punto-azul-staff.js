(function(){
  const path=(location.pathname||'').toLowerCase();
  const enabled=['/meseros.html','/cocina.html','/caja.html','/dueno.html'].some(x=>path.endsWith(x));
  if(!enabled)return;

  document.body.classList.add('punto-azul-staff');
  document.title=document.title.replace(/Chilaquiles de la Carretera/gi,'Punto Azul Restaurante');

  function replaceText(root){
    const walker=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      const p=n.parentElement;
      if(!p || ['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(p.tagName))return;
      if(/Chilaquiles de la Carretera/i.test(n.nodeValue||'')){
        n.nodeValue=(n.nodeValue||'').replace(/Chilaquiles de la Carretera/gi,'Punto Azul Restaurante');
      }
    });
  }

  function forceBrand(){
    replaceText(document.body);
    ['restaurantName','restaurant'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.textContent='Punto Azul Restaurante';
    });

    const brand=document.querySelector('.brand strong,.top b,.topbar .brand strong');
    if(brand && !brand.querySelector('.punto-azul-panel-mark')){
      const mark=document.createElement('span');
      mark.className='punto-azul-panel-mark';
      mark.textContent='PUNTO AZUL';
      brand.appendChild(mark);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',forceBrand,{once:true});
  }else{
    forceBrand();
  }

  window.addEventListener('load',()=>{
    forceBrand();
    setTimeout(forceBrand,400);
    setTimeout(forceBrand,1200);
  });

  const observer=new MutationObserver(()=>{
    window.clearTimeout(observer._t);
    observer._t=window.setTimeout(forceBrand,40);
  });
  if(document.documentElement){
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }
})();
