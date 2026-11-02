/* ============================================================
   SAISON · la chronologie se remplit au défilement
   (d'après Growth Story Timeline de 21st)
   ============================================================ */
(() => {
  const chrono = document.querySelector('[data-chronologie]');
  if (!chrono) return;
  const plein = chrono.querySelector('[data-chronologie-plein]');
  const ligne = plein.parentElement;
  const etapes = chrono.querySelectorAll('[data-etape]');
  const tete = chrono.querySelector('[data-chronologie-tete]');
  let attente = false;
  function maj() {
    attente = false;
    const r = ligne.getBoundingClientRect();
    const centre = innerHeight * 0.6;
    const p = Math.min(1, Math.max(0, (centre - r.top) / r.height));
    plein.style.transform = `scaleY(${p})`;
    // La tête suit le remplissage, visible seulement pendant la traversée
    if (tete) tete.style.transform = `translateY(${p * r.height}px)`;
    chrono.classList.toggle('en-cours', p > 0 && p < 1);
    etapes.forEach(e => e.classList.toggle('atteinte', e.getBoundingClientRect().top + 30 < centre));
  }
  window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
  maj();
})();
