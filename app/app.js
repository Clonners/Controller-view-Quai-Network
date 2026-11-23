/* Kataribe · app instalable (estandar/app, APP-PAQUETE.md, estándar §20). La misma pieza en el panel y en el Portal.
   - Registra el service worker mínimo (sw.js: no guarda nada ni atiende pedidos). Es lo único que pide a la red.
   - El aviso «instalar» (O35): discreto, en su renglón antes del contenido (no tapa nada); al cerrarlo no vuelve.
   - La entrada del ser (O36): sólo al abrir la app instalada, una vez por sesión. Una apertura: el ser al doble en el centro de la
     pantalla hace su gesto y viaja a su lugar en el pie; dura (hilos + 3) compases de 1/3 s (§10.4). Se corta con cualquier
     toque, tecla, rueda o desplazamiento; con «reducir movimiento» o sin programa no aparece. Por eso va en la cabeza sin «defer».
   - Las barras del sistema (O37): <meta name="theme-color"> sigue al tema efectivo de la página. La cabeza de la marca trae dos
     con media prefers-color-scheme (los papeles de la marca, para antes de que haya programa); si el tema se elige a mano (el sol
     o la luna), el que manda es uno más, sin media, primero, con el papel que la página tiene pintado de verdad.
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
  // Una apertura (O36): al abrir la app instalada, la pantalla es del ser hasta que llega a su lugar.
  //   1. app.js va en la cabeza sin «defer»: corre antes de que la página tenga nada que pintar y marca <html data-ka-entrada>;
  //      app.css esconde entonces el cuerpo (visibility), así que el primer cuadro es el papel del sitio, sin la página a medio
  //      armar. La página carga detrás igual que siempre; nada espera a la entrada.
  //   2. Cuando el ser está, una capa del tamaño de la pantalla lo dibuja con su cuerpo en el centro, al doble (T2; normal si al doble
  //      no entra) y hace el gesto del sitio (repertorio §10.3): un compás para despertarse con los ojos cerrados, uno por hilo
  //      de izquierda a derecha mirándolo, uno contento.
  //   3. Un compás más, el viaje: el ser va a su lugar (el de .k-pj, en el pie) achicándose, el papel se aclara y la página se ve.
  //   Dura hilos + 3 compases (§10.4); al terminar no queda nada. Se dibuja con el mismo dibujo del ser (Ser5.dibujar) y sus
  //   nudos de verdad: no le pide gestos al motor ni anota ninguna causa.
  //   Cualquier toque, tecla, rueda o desplazamiento, o dejar la pestaña, la corta en el acto. El toque que la corta no llega a lo
  //   que estaba debajo (no se tocó nada que no se veía): la capa lo recibe y se va cuando ese toque termina.
  const HACE = {
    panel: (h, i, k) => ({ largos: h.map((x, j) => (j === i ? x.largo - 1 : x.largo)) }),       // «llega un bloque»: la ola
    portal: (h, i, k) => ({ largos: h.map((x, j) => (j === i ? x.largo + 1 : x.largo)), ojos: 'atentos' }), // «revisa cada cuenta»: el tirón
  };
  const cuadro = (Ser, f, base, k) => {
    const n = f.hilos.length, cx = (f.w - 1) / 2, p = { marca: base.marca, nudos: base.nudos };
    if (k === 0) return Object.assign(p, { ojos: 'cerrados' });
    if (k > n) return Object.assign(p, { ojos: 'contentos', boca: '‿' });
    const i = k - 1;
    return Object.assign(p, { mira: Math.sign(f.cols[i] - cx) }, (HACE[SITIO] || HACE.panel)(f.hilos, i, k));
  };
  // el papel de la página: el fondo del cuerpo y, si es transparente, el de <html> (lo pinta la hoja del sitio, no este programa)
  const opaco = (c) => !!c && !/^transparent$|rgba\(.*,\s*0\)$/.test(c);
  const fondo = () => {
    const bd = document.body ? getComputedStyle(document.body).backgroundColor : '', ht = getComputedStyle(document.documentElement).backgroundColor;
    return opaco(bd) ? bd : opaco(ht) ? ht : '';
  };

  // ---------------------------------------------------------------------------------------------- las barras del sistema (O37)
  // El navegador pinta sus barras con el primer theme-color que aplica (sin media, o con media que se cumple). Los dos con media
  // siguen al tema del sistema; este, sin media y primero, sigue al tema que la página tiene de verdad, también el elegido a mano.
  // Se escribe en #rrggbb (el papel tal como lo pinta la hoja) y sólo si cambió; sin papel opaco no se pone nada.
  const hex = (c) => { const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*1)?\)$/.exec(c); return m ? '#' + m.slice(1).map((x) => (+x).toString(16).padStart(2, '0')).join('') : c; };
  let barra = null;
  const barras = () => {
    const c = fondo(); if (!c) return;
    const v = hex(c);
    if (!barra) {
      barra = document.createElement('meta'); barra.name = 'theme-color'; barra.dataset.ka = '';
      const h = document.head || document.documentElement, pri = h.querySelector('meta[name="theme-color"]');
      h.insertBefore(barra, pri || null);
    }
    if (barra.content !== v) barra.content = v;
  };
  const seguir = () => { try { barras(); } catch (e) { /* sin barras propias: quedan las de la cabeza */ } };
  const tema = new MutationObserver(seguir);
  tema.observe(document.documentElement, { attributes: true });
  const conCuerpo = () => { if (document.body) tema.observe(document.body, { attributes: true }); seguir(); };
  if (document.body) conCuerpo(); else document.addEventListener('DOMContentLoaded', conCuerpo);
  addEventListener('load', seguir);
  if (window.matchMedia) { const q = matchMedia('(prefers-color-scheme: dark)'); if (q.addEventListener) q.addEventListener('change', seguir); else if (q.addListener) q.addListener(seguir); }
  const entrar = () => {
    if (!instalada() || quieto() || document.hidden || leer('sessionStorage', ENTRADA)) return;
    anotar('sessionStorage', ENTRADA, '1');
    const raiz = document.documentElement;
    raiz.setAttribute('data-ka-entrada', '');
    let capa = null, viva = true, raf = 0, plazo = 0, ubicar = null;
    const EV = ['pointerdown', 'keydown', 'wheel', 'scroll'], TOQUE = ['click', 'auxclick', 'pointercancel', 'contextmenu', 'pointerdown'];
    const fin = () => {
      if (!viva) return; viva = false; cancelAnimationFrame(raf);
      EV.forEach((e) => removeEventListener(e, cortar, true)); document.removeEventListener('visibilitychange', fin);
      document.removeEventListener('DOMContentLoaded', sinSer);
      raiz.removeAttribute('data-ka-entrada');
      if (capa && capa.dataset.cortada === undefined) capa.remove();
    };
    // el toque que corta cae sobre la capa: se deja de ver en el acto y se va cuando el toque termina (click, o el navegador lo toma)
    const soltar = () => { TOQUE.forEach((e) => removeEventListener(e, soltar, true)); if (capa) capa.remove(); };
    const cortar = (e) => {
      if (!viva) return;
      if (e.type === 'pointerdown' && capa) { capa.dataset.cortada = ''; TOQUE.forEach((t) => addEventListener(t, soltar, { capture: true })); }
      fin();
    };
    // un sitio sin ser (Ser5 llega con los programas de la página, también los «defer»): nada que esperar, la página se ve ya
    const sinSer = () => { if (!window.Ser5) fin(); };
    document.addEventListener('DOMContentLoaded', sinSer);
    EV.forEach((e) => addEventListener(e, cortar, { capture: true, passive: true })); document.addEventListener('visibilitychange', fin);
    // espera al ser: como mucho un compás después de que la página terminó de cargar; si no está, o está quieto, no hay entrada
    const listo = () => {
      if (!viva) return;
      const Ser = window.Ser5, f = Ser && Ser.pj && Ser.pj.f, el = document.querySelector('.k-pj');
      if (Ser && (Ser.QUIETO || (Ser.est && Ser.est.estatica))) return fin();
      if (f && el && Ser.B && Ser.dibujar && document.body) return empezar(Ser, f, el);
      if (document.readyState === 'complete') { if (!plazo) plazo = performance.now() + COMPAS; else if (performance.now() > plazo) return fin(); }
      raf = requestAnimationFrame(() => { try { listo(); } catch (e) { fin(); } });
    };
    const empezar = (Ser, f, el) => {
      const cs = getComputedStyle(el), base = (Ser.pj && Ser.pj.p) || {};
      const pasos = f.hilos.length + 3;
      capa = document.createElement('div'); capa.className = 'ka-entrada'; capa.setAttribute('aria-hidden', 'true');
      capa.dataset.sitio = SITIO; capa.dataset.pasos = String(pasos); capa.dataset.compas = String(COMPAS);
      const dib = document.createElement('div'); dib.className = 'ka-entrada-ser'; capa.append(dib);
      const papel = fondo();
      if (papel) capa.style.backgroundColor = papel;
      const st = dib.style;
      st.fontFamily = cs.fontFamily; st.fontWeight = cs.fontWeight; st.color = cs.color;
      ['--ambar', '--gris'].forEach((v) => { const x = cs.getPropertyValue(v); if (x) st.setProperty(v, x.trim()); });
      // la caja del ser, como la mide el ser (cajaPj): a lo ancho su dibujo (el primer hijo de .k-pj: el bloque ocupa la línea
      // entera mientras la hoja del ser no está), a lo alto .k-pj. El dibujo tiene más columnas que el cuerpo (las del cuerpo
      // son las f.w primeras; después, el lugar de la marca): lo que va al centro de la capa es el cuerpo.
      const caja = () => { const a = (el.firstElementChild || el).getBoundingClientRect(), b = el.getBoundingClientRect();
        return { left: a.left, top: b.top, width: a.width, height: b.height }; };
      const cols = Ser.B.arte(Ser.dibujar(f, cuadro(Ser, f, base, 0))).w;
      // al doble (T2: .k-2x) si entra en la capa con el cuerpo en el centro; si no, a tamaño normal. Se mide en cada cuadro hasta
      // el viaje (la hoja del ser, la letra o la ventana pueden llegar o cambiar después del primero) y se escribe sólo si cambió
      let medida = '';
      ubicar = () => {
        const r = caja(), p = capa.getBoundingClientRect(), tam = parseFloat(cs.fontSize), fila = parseFloat(cs.lineHeight);
        const c = r.width / cols, ala = Math.max(f.w / 2, cols - f.w / 2) * c;
        const x = 2 * 2 * ala <= p.width && 2 * r.height <= p.height ? 2 : 1;
        const m = [x, r.width, r.height, tam, fila].join(' ');
        if (m === medida) return; medida = m;
        capa.dataset.tam = x === 2 ? 'doble' : 'normal';
        st.width = r.width * x + 'px'; st.height = r.height * x + 'px'; st.fontSize = tam * x + 'px'; st.lineHeight = Number.isFinite(fila) ? fila * x + 'px' : 'normal';
        st.left = (cols - f.w) / 2 * c * x + 'px';
      };
      document.body.append(capa);
      ubicar();
      const viaje = () => {
        // un compás: del centro a su lugar en el pie, del tamaño de la apertura al suyo; el papel se aclara y la página aparece
        ubicar = null; raiz.removeAttribute('data-ka-entrada');
        const a = dib.getBoundingClientRect(), r = caja(), s = a.width ? r.width / a.width : 1;
        capa.dataset.viaje = [r.left, r.top, r.width, r.height].map(Math.round).join(' ');
        if (dib.animate) {
          dib.animate([{ transform: 'none' }, { transform: `translate(${r.left - a.left}px, ${r.top - a.top}px) scale(${s})` }], { duration: COMPAS, easing: 'ease', fill: 'forwards' });
          capa.animate([{ backgroundColor: getComputedStyle(capa).backgroundColor }, { backgroundColor: 'transparent' }], { duration: COMPAS, easing: 'ease', fill: 'forwards' });
        }
      };
      const t0 = performance.now();
      let ultimo = -1;
      const paso = () => {
        if (!viva) return;
        try {
          if (ubicar) ubicar();
          const k = Math.floor((performance.now() - t0) / COMPAS);
          if (k >= pasos) return fin();
          if (k !== ultimo) {
            ultimo = k; capa.dataset.paso = String(k);
            if (k < pasos - 1) dib.innerHTML = Ser.B.arte(Ser.dibujar(f, cuadro(Ser, f, base, k))).h; else viaje();
          }
        } catch (e) { return fin(); }
        raf = requestAnimationFrame(paso);
      };
      paso();
    };
    try { listo(); } catch (e) { fin(); }
  };
  try { entrar(); } catch (e) { document.documentElement.removeAttribute('data-ka-entrada'); }
})();
