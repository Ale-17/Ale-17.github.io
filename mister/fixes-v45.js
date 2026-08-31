(()=>{
'use strict';

function patch(root=document){
  root.querySelectorAll?.('.v44-head p').forEach(node=>node.remove());
  root.querySelectorAll?.('.v44-player').forEach(node=>{
    node.removeAttribute('data-v38-player-id');
    delete node.dataset.v38PlayerId;
  });
}

function init(){
  patch();
  const content=document.querySelector('#sheetContent');
  if(content){
    new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType===1)patch(node);
        }
      }
      patch(content);
    }).observe(content,{childList:true,subtree:true,attributes:true,attributeFilter:['data-v38-player-id']});
  }
  window.addEventListener('fantasy:ready',()=>requestAnimationFrame(()=>patch(content||document)));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
