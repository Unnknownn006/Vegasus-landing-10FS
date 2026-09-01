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
