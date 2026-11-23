/* Kataribe · app instalable (estandar/app, APP-PAQUETE.md, estándar §20). La misma pieza en el panel y en el Portal.
   - Registra el service worker mínimo (sw.js: no guarda nada ni atiende pedidos). Es lo único que pide a la red.
   - El aviso «instalar» (O35): discreto, en su renglón antes del contenido (no tapa nada); al cerrarlo no vuelve.
   - La entrada del ser (O36): sólo al abrir la app instalada, una vez por sesión; dura (hilos + 2) compases de 1/3 s (§10.4);
     se corta con cualquier toque, tecla, rueda o desplazamiento (si cambia el tamaño de la ventana, la capa se vuelve a poner sobre el ser); con «reducir movimiento» o sin programa no aparece.
   No lee ni escribe nada del sitio: ni /api, ni montos, ni la sesión. Sólo dos marcas propias: localStorage «kataribe-app-aviso»
   y sessionStorage «kataribe-app-entrada». */
(() => {
  'use strict';
  const S = document.currentScript, D = (S && S.dataset) || {}, SITIO = D.sitio || '', SW = D.sw || '';
  const COMPAS = 1000 / 3;                                         // §10.4 «un solo compás»: el ser se mueve de a tercios de segundo
  const AVISO = 'kataribe-app-aviso', ENTRADA = 'kataribe-app-entrada';
  const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
  const leer = (st, k) => { try { return window[st].getItem(k); } catch (e) { return null; } };
  const anotar = (st, k, v) => { try { window[st].setItem(k, v); } catch (e) { /* sin almacenamiento: vale sólo por esta vez */ } };
  const instalada = () => mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)') || navigator.standalone === true;
  const quieto = () => mm('(prefers-reduced-motion: reduce)');

  // ---------------------------------------------------------------------------------------------- el service worker
  if (SW && 'serviceWorker' in navigator && window.isSecureContext) {
    addEventListener('load', () => { navigator.serviceWorker.register(SW, { updateViaCache: 'none' }).catch(() => {}); });
  }

  // ---------------------------------------------------------------------------------------------- el aviso «instalar»
  const TX = {
    es: { t: 'Kataribe se puede instalar: queda un acceso directo a esta página.', i: 'En el iPhone: Compartir y después «Agregar a inicio».', si: 'Instalar', no: 'No, gracias', x: 'Cerrar', r: 'Instalar la app' },
    en: { t: 'Kataribe can be installed: a shortcut straight to this page.', i: 'On iPhone: Share, then «Add to Home Screen».', si: 'Install', no: 'No, thanks', x: 'Close', r: 'Install the app' },
    pt: { t: 'O Kataribe pode ser instalado: fica um atalho direto para esta página.', i: 'No iPhone: Compartilhar e depois «Adicionar à Tela de Início».', si: 'Instalar', no: 'Não, obrigado', x: 'Fechar', r: 'Instalar o app' },
    ru: { t: 'Kataribe можно установить: ярлык прямо на эту страницу.', i: 'На iPhone: «Поделиться», затем «На экран „Домой“».', si: 'Установить', no: 'Нет, спасибо', x: 'Закрыть', r: 'Установить приложение' },
    ja: { t: 'Kataribe はインストールできます。このページへのショートカットです。', i: 'iPhone では「共有」から「ホーム画面に追加」。', si: 'インストール', no: '今はしない', x: '閉じる', r: 'アプリをインストール' },
    zh: { t: '可以安装 Kataribe：一个直达此页的快捷方式。', i: '在 iPhone 上：点「分享」，再点「添加到主屏幕」。', si: '安装', no: '不用了', x: '关闭', r: '安装应用' },
  };
  const tx = () => TX[(document.documentElement.lang || '').slice(0, 2).toLowerCase()] || TX.en;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let pedido = null, aviso = null, modo = '';
  const sePuedeAvisar = () => !instalada() && leer('localStorage', AVISO) !== 'no';
  const cerrar = () => { anotar('localStorage', AVISO, 'no'); if (aviso) aviso.remove(); aviso = null; pedido = null; };
  const boton = (k, f) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.addEventListener('click', f); return b; };
  const rotular = () => {
    if (!aviso) return;
    const x = tx();
    aviso.setAttribute('aria-label', x.r);
    aviso.querySelector('.ka-aviso-t').textContent = modo === 'ios' ? x.t + ' ' + x.i : x.t;
    aviso.querySelectorAll('button').forEach((b) => { b.textContent = x[b.dataset.k]; });
  };
  // el contenido del panel lo arma el programa del ser después de cargar: se espera a que exista <main>, sin plazo (el aviso no apura nada)
  const conMain = (f) => {
    const m = document.querySelector('main'); if (m) return f(m);
    const o = new MutationObserver(() => { const n = document.querySelector('main'); if (n) { o.disconnect(); f(n); } });
    o.observe(document.documentElement, { childList: true, subtree: true });
  };
  const mostrar = (m) => {
    if (aviso || !sePuedeAvisar()) return;
    modo = m;
    conMain((main) => {
      if (aviso || !sePuedeAvisar()) return;
      aviso = document.createElement('aside'); aviso.className = 'ka-aviso'; aviso.dataset.sitio = SITIO; aviso.dataset.modo = m;
      const p = document.createElement('p'); p.className = 'ka-aviso-t';
      const bs = document.createElement('div'); bs.className = 'ka-aviso-b';
      if (m === 'ios') bs.append(boton('x', cerrar));
      else bs.append(boton('si', () => { const e = pedido; cerrar(); if (e) e.prompt().catch(() => {}); }), boton('no', cerrar));
      aviso.append(p, bs);
      main.parentNode.insertBefore(aviso, main);
      rotular();
    });
  };
  new MutationObserver(rotular).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; mostrar('pedido'); });
  addEventListener('appinstalled', cerrar);
  if (IOS && !('BeforeInstallPromptEvent' in window)) mostrar('ios');

  // ---------------------------------------------------------------------------------------------- la entrada del ser
  // Lo que hace en cada sitio (repertorio §10.3), un hilo por compás, de izquierda a derecha, con los ojos cerrados al empezar y
  // contentos al terminar:
  //   panel  «llega un bloque»: la ola; cada hilo se encoge y el ser lo mira.
  //   portal «revisa cada cuenta»: el tirón; cada hilo se estira y el ser lo mira con ojos atentos.
  // Se dibuja con el mismo dibujo del ser (Ser5.dibujar) y sus nudos de verdad, en una capa propia encima del ser: no le pide gestos
  // al motor (no anota ninguna causa falsa) y no toca nada más de la página.
  const HACE = {
    panel: (h, i, k) => ({ largos: h.map((x, j) => (j === i ? x.largo - 1 : x.largo)) }),
    portal: (h, i, k) => ({ largos: h.map((x, j) => (j === i ? x.largo + 1 : x.largo)), ojos: 'atentos' }),
  };
  const cuadro = (Ser, f, base, k) => {
    const n = f.hilos.length, cx = (f.w - 1) / 2, p = { marca: base.marca, nudos: base.nudos };
    if (k === 0) return Object.assign(p, { ojos: 'cerrados' });
    if (k > n) return Object.assign(p, { ojos: 'contentos', boca: '‿' });
    const i = k - 1;
    return Object.assign(p, { mira: Math.sign(f.cols[i] - cx) }, (HACE[SITIO] || HACE.panel)(f.hilos, i, k));
  };
  const entrar = () => {
    if (!instalada() || quieto() || document.hidden || leer('sessionStorage', ENTRADA)) return;
    let capa = null, viva = true, raf = 0, t0 = 0, ultimo = -1, plazo = 0;
    // lo que hace la persona la corta; que la ventana cambie de tamaño (el teléfono lo hace solo al abrir) sólo la vuelve a poner sobre el ser
    const EV = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    let ubicar = null;
    const salir = () => {
      if (!viva) return; viva = false; cancelAnimationFrame(raf);
      EV.forEach((e) => removeEventListener(e, salir, true)); document.removeEventListener('visibilitychange', salir);
      removeEventListener('resize', reubicar);
      if (capa) capa.remove();
    };
    const reubicar = () => { if (ubicar) ubicar(); };
    EV.forEach((e) => addEventListener(e, salir, { capture: true, passive: true })); document.addEventListener('visibilitychange', salir);
    addEventListener('resize', reubicar, { passive: true });
    // espera al ser: como mucho un compás después de que la página terminó de cargar; si no está, no hay entrada
    const listo = () => {
      if (!viva) return;
      const Ser = window.Ser5, f = Ser && Ser.pj && Ser.pj.f, el = document.querySelector('.k-pj');
      if (f && el && Ser.B && Ser.dibujar && !Ser.QUIETO && !(Ser.est && Ser.est.estatica)) return empezar(Ser, f, el);
      if (document.readyState === 'complete') { if (!plazo) plazo = performance.now() + COMPAS; else if (performance.now() > plazo) return salir(); }
      raf = requestAnimationFrame(listo);
    };
    const empezar = (Ser, f, el) => {
      anotar('sessionStorage', ENTRADA, '1');
      const cs = getComputedStyle(el), bd = getComputedStyle(document.body), base = (Ser.pj && Ser.pj.p) || {};
      const pasos = f.hilos.length + 2;
      capa = document.createElement('div'); capa.className = 'ka-entrada'; capa.setAttribute('aria-hidden', 'true');
      capa.dataset.sitio = SITIO; capa.dataset.pasos = String(pasos); capa.dataset.compas = String(COMPAS);
      const st = capa.style;
      ubicar = () => { const r = el.getBoundingClientRect(); st.left = r.left + 'px'; st.top = r.top + 'px'; st.width = r.width + 'px'; st.height = r.height + 'px'; };
      ubicar();
      st.fontFamily = cs.fontFamily; st.fontSize = cs.fontSize; st.lineHeight = cs.lineHeight; st.fontWeight = cs.fontWeight; st.color = cs.color;
      const fondo = bd.backgroundColor && !/rgba\(.*,\s*0\)|transparent/.test(bd.backgroundColor) ? bd.backgroundColor : getComputedStyle(document.documentElement).backgroundColor;
      st.backgroundColor = fondo;
      ['--ambar', '--gris'].forEach((v) => { const x = cs.getPropertyValue(v); if (x) st.setProperty(v, x.trim()); });
      document.body.append(capa);
      t0 = performance.now();
      const paso = () => {
        if (!viva) return;
        const k = Math.floor((performance.now() - t0) / COMPAS);
        if (k >= pasos) return salir();
        if (k !== ultimo) { ultimo = k; capa.dataset.paso = String(k); capa.innerHTML = Ser.B.arte(Ser.dibujar(f, cuadro(Ser, f, base, k))).h; }
        raf = requestAnimationFrame(paso);
      };
      paso();
    };
    listo();
  };
  entrar();
})();
