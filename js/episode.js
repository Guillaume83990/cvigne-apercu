/* ============================================================
   ÉPISODE · barre de lecture (Reading Progress) et marque-page
   ============================================================ */
(() => {
  const article = document.querySelector('[data-episode-page]');
  const texte = article?.querySelector('.episode-texte');
  const plein = document.querySelector('[data-lecture-plein]');
  const reste = document.querySelector('[data-lecture-reste]');
  const resteTexte = reste?.querySelector('[data-lecture-texte]');
  if (!article || !texte) return;

  const minutes = +article.dataset.minutes || 1;
  const suivant = article.querySelector('.episode-nav-suiv');
  let enregistre = -1;

  function marquePage(p) {
    // À la fin d'un épisode, on garde l'épisode suivant comme marque-page
    const fini = p > 0.95 && suivant;
    const cle = fini ? 2 : p > 0.15 ? 1 : 0;
    if (cle === 0 || cle === enregistre) return;
    enregistre = cle;
    const lecture = fini
      ? { url: suivant.getAttribute('href'), numero: +article.dataset.numero + 1, titre: suivant.querySelector('span:last-child').textContent }
      : { url: location.pathname, numero: +article.dataset.numero, titre: article.dataset.titre };
    try { localStorage.setItem('cvigne-lecture', JSON.stringify(lecture)); } catch (e) { /* navigation privée */ }
  }

  let attente = false;
  function maj() {
    attente = false;
    const r = texte.getBoundingClientRect();
    const total = r.height - innerHeight * 0.5;
    const p = Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / Math.max(total, 1)));
    plein.style.transform = `scaleX(${p})`;
    const restantes = Math.ceil(minutes * (1 - p));
    reste.classList.toggle('visible', scrollY > 240);
    reste.classList.toggle('fini', p >= 0.99);
    // « Épisode lu » et sa coche sont déjà dans la page : seul le temps restant change
    if (p < 0.99) resteTexte.textContent = restantes <= 1 && p > 0.5 ? "Moins d'une minute" : `${restantes} min restante${restantes > 1 ? 's' : ''}`;
    marquePage(p);
  }
  window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
  window.addEventListener('resize', maj);
  maj();
})();

/* ============================================================
   ÉPISODE · « Au menu de cet épisode » (3D Flip Card)
   La carte se pose sur une petite pile de cartons qui s'écartent
   au survol ; un bouton la retourne : au dos, les accords.
   Sans JS, ou sans aucun accord : la carte simple reste telle quelle.
   ============================================================ */
(() => {
  const carte = document.querySelector('.au-menu');
  if (!carte) return;
  const lignes = [...carte.querySelectorAll('.au-menu-liste li')].map(li => ({
    plat: li.querySelector('.au-menu-plat')?.textContent || '',
    accord: li.querySelector('.au-menu-accord')?.textContent || ''
  }));
  if (!lignes.some(l => l.accord)) return;

  const el = (tag, cls, texte) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte) n.textContent = texte;
    return n;
  };

  // Recto : les plats seuls ; verso : chaque plat et son accord
  const recto = el('div', 'carte-face carte-recto');
  recto.append(el('p', 'surtitre', 'Au menu de cet épisode'));
  const listeRecto = el('ul', 'au-menu-liste');
  lignes.forEach(l => { const li = el('li'); li.append(el('span', 'au-menu-plat', l.plat)); listeRecto.append(li); });
  const versAccords = el('button', 'carte-retourner', 'Voir les accords');
  versAccords.type = 'button';
  recto.append(listeRecto, versAccords);

  const verso = el('div', 'carte-face carte-verso');
  verso.append(el('p', 'surtitre', 'Les accords'));
  const listeVerso = el('ul', 'au-menu-liste');
  lignes.forEach(l => {
    const li = el('li');
    li.append(el('span', 'carte-verso-plat', l.plat));
    if (l.accord) li.append(el('span', 'au-menu-accord', l.accord));
    listeVerso.append(li);
  });
  const versMenu = el('button', 'carte-retourner', 'Revenir au menu');
  versMenu.type = 'button';
  verso.append(listeVerso, versMenu);

  const pivot = el('div', 'carte-pivot');
  pivot.append(recto, verso);
  const pile = el('div', 'carte-pile');
  pile.setAttribute('aria-hidden', 'true');
  pile.append(el('span', 'carte-feuille'), el('span', 'carte-feuille'));

  carte.replaceChildren(pile, pivot);
  carte.classList.add('carte-menu');
  verso.inert = true;

  function retourner(versLeDos) {
    carte.classList.toggle('retournee', versLeDos);
    recto.inert = versLeDos;
    verso.inert = !versLeDos;
    // Le focus suit la face visible, une fois la carte à mi-course
    setTimeout(() => (versLeDos ? versMenu : versAccords).focus({ preventScroll: true }), 300);
  }
  versAccords.addEventListener('click', () => retourner(true));
  versMenu.addEventListener('click', () => retourner(false));
})();
