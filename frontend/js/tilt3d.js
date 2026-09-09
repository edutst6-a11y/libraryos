// Lightweight 3D tilt-on-hover for cards -- call attachTilt() after any DOM
// swap that adds new .stat-card / .panel elements.
function attachTilt(selector = ".stat-card, .panel, .diagram-frame, .membership-card, .bdp-panel, .bdp-slide") {
  document.querySelectorAll(selector).forEach(el => {
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = "1";
    let raf = null;
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateZ(4px)`;
      });
    });
    el.addEventListener("mouseleave", () => {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "perspective(900px) rotateX(0) rotateY(0) translateZ(0)";
    });
  });
}
