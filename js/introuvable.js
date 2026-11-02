// Page 404 · inspirée de Page Not Found (21st) : le message arrive après l'assiette,
// quelques herbes traversent la page une seule fois, des taches d'ambre filent puis ralentissent et se posent.
// Sans JS ou avec « réduire les animations » : page fixe, tout est lisible.
(() => {
  const section = document.querySelector('.introuvable');
  if (!section) return;

  // « Le feuilleton » devient « Revenir en arrière » quand on arrive d'une page du site
  const retour = section.querySelector('[data-retour]');
  let depuisLeSite = false;
  try { depuisLeSite = document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* referrer illisible */ }
  if (retour && depuisLeSite && history.length > 1) {
    retour.querySelector('span').textContent = 'Revenir en arrière';
    retour.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) return;

  // 1. Le message arrive après l'assiette (l'original attend 1,2 s ; ici 0,5 s suffit). Animation CSS : elle se joue même si l'onglet était en arrière-plan
  section.classList.add('arrivee');

  const ciel = section.querySelector('.introuvable-ciel');
  if (!ciel) return;
  const L = ciel.clientWidth, H = ciel.clientHeight;
  const etroit = innerWidth < 700;
  const hasard = (a, b) => a + Math.random() * (b - a);

  // 2. Taches d'ambre : elles arrivent de la droite très vite, puis ralentissent et se posent (comme les cercles de l'original)
  const nombre = etroit ? 16 : 30;
  for (let i = 0; i < nombre; i++) {
    const t = document.createElement('span');
    t.className = 'tache' + (i % 7 === 0 ? ' bordeaux' : '');
    const taille = hasard(3, 9);
    t.style.width = t.style.height = taille + 'px';
    ciel.appendChild(t);
    const y = hasard(.04, .96) * H, x = hasard(.05, .95) * L;
    t.animate([
      { transform: `translate(${L + hasard(20, L * .6)}px, ${y}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${x + hasard(30, 90)}px, ${y}px) scale(.9)`, opacity: .22, offset: .35 },
      { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: .16 }
    ], { duration: hasard(2600, 3800), delay: hasard(0, 300), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
  }

  // 3. Herbes et grains : ils traversent la page une fois, en tournant doucement (les silhouettes de l'original)
  const FORMES = [
    '<svg viewBox="0 0 48 48"><path d="M10 38C12 20 24 10 40 8c-2 16-12 28-30 30Z"/><path d="M10 38 30 18"/></svg>', // feuille de basilic
    '<svg viewBox="0 0 48 48"><path d="M24 44V14"/><path d="M24 30c-6-2-9-6-10-12 6 1 9 5 10 12Zm0-8c6-2 9-6 10-12-6 1-9 5-10 12Z"/></svg>', // brin de thym
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="7"/><path d="M21 21c2-1 4-1 6 1"/></svg>', // grain de poivre
    '<svg viewBox="0 0 48 48"><path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35"/></svg>' // ✦ du carnet
  ];
  const herbes = etroit ? 3 : 4;
  for (let i = 0; i < herbes; i++) {
    const h = document.createElement('span');
    h.className = 'herbe';
    h.innerHTML = FORMES[i % FORMES.length];
    ciel.appendChild(h);
    const y = (i + .5) / herbes * H * .8 + hasard(-20, 20);
    const tours = hasard(-200, -80);
    h.animate([
      { transform: `translate(${L + 60}px, ${y}px) rotate(0deg)` },
      { transform: `translate(-80px, ${y + hasard(-40, 40)}px) rotate(${tours}deg)` }
    ], { duration: hasard(9000, 14000), delay: 400 + i * 900, easing: 'linear', fill: 'both' });
  }
})();
