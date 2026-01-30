(function(){
  function qs(sel){ return document.querySelector(sel); }

  function open(){ document.body.classList.add('sidebar-open'); }
  function close(){ document.body.classList.remove('sidebar-open'); }
  function toggle(){ document.body.classList.toggle('sidebar-open'); }

  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t) return;

    var btn = t.closest && t.closest('[data-action="toggle-sidebar"]');
    if (btn){
      e.preventDefault();
      toggle();
      return;
    }

    var overlay = t.closest && t.closest('.drawer-overlay');
    if (overlay){
      close();
      return;
    }

    var closeBtn = t.closest && t.closest('[data-action="close-sidebar"]');
    if (closeBtn){
      e.preventDefault();
      close();
      return;
    }
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') close();
  });

  // Ensure overlay exists on pages that use the sidebar drawer.
  if (!qs('.drawer-overlay')){
    var d = document.createElement('div');
    d.className = 'drawer-overlay';
    document.body.appendChild(d);
  }
})();
