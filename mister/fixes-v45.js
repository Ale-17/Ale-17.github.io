(()=>{
'use strict';

function patch(root=document){
  root.querySelectorAll?.('.v44-head p').forEach(node=>node.remove());
  root.querySelectorAll?.('.v44-player[data-v44-player]').forEach(node=>{
    const id=String(node.dataset.v44Player||'').trim();
    if(id)node.dataset.v38PlayerId=id;
  });
}

function handleUnpatchedClick(event){
  const player=event.target.closest?.('.v44-player[data-v44-player]');
  if(!player||player.dataset.v38PlayerId)return;
  const id=String(player.dataset.v44Player||'').trim();
  if(!id)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  player.dataset.v38PlayerId=id;
  queueMicrotask(()=>player.click());
}

function init(){
  patch();
  window.addEventListener('click',handleUnpatchedClick,true);
  const content=document.querySelector('#sheetContent');
  if(content){
    new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType===1)patch(node);
        }
      }
      patch(content);
    }).observe(content,{childList:true,subtree:true});
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
