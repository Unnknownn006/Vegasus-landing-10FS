/* Motion is opt-in: the .js class is only added when the browser can do
   IntersectionObserver, so a failed script leaves the page fully visible
   instead of stuck at opacity 0. */
(() => {
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js");

  const io = new IntersectionObserver((entries) => {
    for (const e of entries){
      if (!e.isIntersecting) continue;
      e.target.dataset.in = "true";
      io.unobserve(e.target);          // reveal once, don't re-trigger on scroll back
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
})();

/* Pin correction. On iOS and Android the visual viewport shrinks and grows
   as the toolbar hides, and a fixed bar drifts with it. Measuring the gap
   each frame and feeding it back as --vv keeps the bar welded to the
   bottom of what the user can actually see. */
(() => {
  const vv = window.visualViewport;
  if (!vv) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--vv", gap + "px");
  };
  const queue = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  vv.addEventListener("resize", queue);
  vv.addEventListener("scroll", queue);
  window.addEventListener("orientationchange", queue);
  update();
})();

/* ============================================================
   ВТОРОЙ ЭКРАН — для того, кто ушёл по кнопке и вернулся.

   Единственное условие показа: человек нажал CLAIM и ушёл на
   сайт. Только тогда в localStorage появляется отметка, и любой
   следующий заход или перезагрузка поднимают экран — текст
   «You left them on the table» имеет смысл ровно в этом случае.

   Просто открыть страницу и обновить её — экрана не будет.

   SHOW_ON_EXIT включает дополнительный показ по попытке уйти
   со страницы (курсор за верхнюю кромку окна на десктопе, резкий
   скролл вверх на тач-устройствах). По умолчанию выключено:
   человек ещё ничего не забирал, и текст ему не подходит.
   ============================================================ */
(() => {
  const el = document.getElementById("exit");
  if (!el) return;

  const SHOW_ON_EXIT = false;    // показ по попытке уйти, до клика по кнопке

  const LEFT_KEY   = "vegasus:fs5:left";   // ушёл по кнопке CLAIM
  const SHOW_DELAY = 900;                  // дать странице отрисоваться
  const ARM_DELAY  = 6000;                 // не дёргать сразу после загрузки

  /* Браузер восстанавливает позицию прокрутки после перезагрузки,
     и до появления слоя человек видел середину лендинга, а слой
     затем накрывал её рывком. Возвращаемся к началу сами. */
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}

  /* В приватном режиме Safari и при запрете сторонних данных
     обращение к localStorage бросает исключение — тогда работаем
     без памяти, а не роняем скрипт. */
  const store = (() => {
    try { const s = window.localStorage; s.setItem("__t", "1"); s.removeItem("__t"); return s; }
    catch (e) { return null; }
  })();
  const read  = k => { try { return store && store.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { store && store.setItem(k, v); } catch (e) {} };

  const card = el.querySelector(".exit__card");
  let open = false, armed = false, timers = [];

  const show = () => {
    if (open) return;
    open = true;
    teardown();
    window.scrollTo(0, 0);
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("exit-open");
    document.body.classList.add("exit-open");
    if (card) card.focus({ preventScroll: true });
  };

  const teardown = () => {
    timers.forEach(clearTimeout);
    timers = [];
    document.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("scroll", onScroll);
  };

  /* курсор вышел за верхнюю кромку окна: relatedTarget пуст только
     когда он покинул страницу, а не перешёл на соседний элемент */
  function onMouseOut(e){
    if (!armed || e.relatedTarget || e.clientY > 4) return;
    show();
  }

  /* палец: быстрый рывок вверх после прокрутки — жест «ухожу» */
  let lastY = window.scrollY, deepest = 0;
  function onScroll(){
    const y = window.scrollY;
    deepest = Math.max(deepest, y);
    if (armed && deepest > 400 && lastY - y > 80) show();
    lastY = y;
  }

  if (read(LEFT_KEY)) {
    timers.push(setTimeout(show, SHOW_DELAY));
  } else if (SHOW_ON_EXIT) {
    timers.push(setTimeout(() => { armed = true; }, ARM_DELAY));
    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* отметку ставим в момент клика, а не при выгрузке страницы:
     браузер может не успеть записать её перед переходом */
  document.querySelectorAll(".cta").forEach(a => {
    a.addEventListener("click", () => write(LEFT_KEY, String(Date.now())));
  });
})();
