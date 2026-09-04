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
   Второй экран — модалка-возвращалка.

   Условие показа ровно одно: человек НАЖАЛ кнопку и ушёл на сайт.
   Простая перезагрузка лендинга модалку не вызывает — только
   возврат после клика по CTA.

   Хранение — по принципу промо-слота: отметка живёт в localStorage,
   по времени не сбрасывается, сброс для QA — ?reset=1.
   ============================================================ */
(() => {
  const KEY = "vegasus_bb10_state";

  const screen2 = document.getElementById("screen2");
  if (!screen2) return;

  /* Хранилище может быть недоступно: приватный режим, отключённые
     куки. Откатываемся на sessionStorage, дальше — на память. */
  const pick = () => {
    for (const get of [() => localStorage, () => sessionStorage]) {
      try {
        const s = get(), probe = "__vg";
        s.setItem(probe, "1");
        if (s.getItem(probe) === "1") { s.removeItem(probe); return s; }
      } catch {}
    }
    let box = null;
    return { getItem: () => box, setItem: (k, v) => { box = v; }, removeItem: () => { box = null; } };
  };
  const store = pick();

  const read = () => { try { return JSON.parse(store.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (patch) => {
    try { store.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch {}
  };

  const q = new URLSearchParams(location.search);

  /* ---------- QA-сброс ---------- */
  if (q.has("reset")) {
    try { store.removeItem(KEY); } catch {}
    document.documentElement.classList.remove("s2-on");
  }

  /* ---------- отметка ухода ----------
     Ставится на КАЖДУЮ кнопку страницы, включая кнопку внутри самой
     модалки. Запись синхронная, поэтому успевает лечь до перехода. */
  document.querySelectorAll("a.cta").forEach((a) => {
    a.addEventListener("click", () => save({ clicked: Date.now() }));
  });

  const shouldShow = () => q.has("screen2") || Boolean(read().clicked);

  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;

    document.documentElement.classList.add("s2-on");

    /* Страницу возвращаем в начало ДО блокировки скролла: браузер
       восстанавливает позицию прокрутки, и за модалкой оказывался
       низ лендинга вместо hero. */
    window.scrollTo(0, 0);

    screen2.hidden = false;
    document.body.classList.add("s2-open");
    screen2.focus({ preventScroll: true });
  };

  if (shouldShow()) show();

  /* Возврат кнопкой «Назад»: страница поднимается из bfcache и скрипты
     заново не выполняются, поэтому показ дублируется здесь. */
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && shouldShow()) show();
  });
})();
