/* ============================================================
   LE FEUILLETON · étagère des saisons (3D Coverflow de 21st),
   filtres par saison, tri, recherche dans les textes,
   saisons dépliables (Proximity Accordion), reprendre la lecture
   ============================================================ */
(() => {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sansAccents = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ── Reprendre ma lecture ── */
  try {
    const lecture = JSON.parse(localStorage.getItem('cvigne-lecture') || 'null');
    const bloc = document.querySelector('[data-reprendre]');
    if (lecture && bloc) {
      const lien = bloc.querySelector('[data-reprendre-lien]');
      lien.href = lecture.url;
      lien.querySelector('.reprendre-num').textContent = `Épisode ${lecture.numero}`;
      lien.querySelector('.reprendre-titre').textContent = lecture.titre;
      bloc.hidden = false;
    }
  } catch (e) { /* stockage indisponible */ }

  /* ── L'étagère des saisons ── */
  const etagere = document.querySelector('[data-etagere]');
  if (etagere) {
    const scene = etagere.querySelector('[data-etagere-scene]');
    const volumes = [...scene.querySelectorAll('.volume')];
    const points = [...etagere.querySelectorAll('[data-etagere-point]')];
    const fond = etagere.querySelector('[data-etagere-fond]');
    let actuel = Math.max(0, volumes.findIndex(v => v.hasAttribute('data-volume-actuel'))); // l'étape en cours

    function placer() {
      const ecart = Math.min(innerWidth * 0.26, 290);
      volumes.forEach((v, i) => {
        const d = i - actuel, a = Math.abs(d), sens = Math.sign(d);
        const visible = a <= 2;
        v.style.setProperty('--x', `${sens * (a === 1 ? ecart : ecart * 1.75)}px`);
        v.style.setProperty('--s', a === 0 ? 1 : a === 1 ? 0.84 : 0.68);
        v.style.setProperty('--r', `${-sens * (a === 1 ? 24 : 38)}deg`);
        v.style.zIndex = 30 - a * 10;
        v.style.opacity = visible ? (a === 0 ? 1 : a === 1 ? 0.7 : 0.38) : 0;
        v.style.filter = a === 0 ? 'none' : `brightness(${a === 1 ? 0.75 : 0.55})`;
        v.style.pointerEvents = visible ? 'auto' : 'none';
        v.tabIndex = a === 0 ? 0 : -1;
        v.setAttribute('aria-hidden', a === 0 ? 'false' : 'true');
      });
      points.forEach((p, i) => p.setAttribute('aria-current', String(i === actuel)));
      fond.style.setProperty('--couleur-fond', getComputedStyle(volumes[actuel]).getPropertyValue('--couleur'));
    }
    const aller = i => { actuel = Math.max(0, Math.min(volumes.length - 1, i)); placer(); };

    volumes.forEach((v, i) => v.addEventListener('click', e => { if (i !== actuel) { e.preventDefault(); e.stopPropagation(); aller(i); } }));
    points.forEach((p, i) => p.addEventListener('click', () => aller(i)));
    etagere.querySelector('[data-etagere-prec]').addEventListener('click', () => aller(actuel - 1));
    etagere.querySelector('[data-etagere-suiv]').addEventListener('click', () => aller(actuel + 1));
    scene.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); aller(actuel - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); aller(actuel + 1); }
    });
    let departX = 0;
    scene.addEventListener('touchstart', e => { departX = e.touches[0].clientX; }, { passive: true });
    scene.addEventListener('touchend', e => {
      const ecart = e.changedTouches[0].clientX - departX;
      if (Math.abs(ecart) > 45) aller(actuel + (ecart < 0 ? 1 : -1));
    });
    window.addEventListener('resize', placer);
    placer();
  }

  /* ── Sommaire : filtres, tri, recherche ── */
  const zone = document.querySelector('[data-feuilleton]');
  if (!zone) return;
  const liste = zone.querySelector('[data-saisons-liste]');
  const blocs = [...liste.querySelectorAll('.saison-bloc')];
  const filtres = [...zone.querySelectorAll('[data-filtre]')];
  const tris = [...zone.querySelectorAll('[data-tri]')];
  const champ = zone.querySelector('[data-recherche]');
  const resultats = zone.querySelector('[data-resultats]');
  let filtre = 'tout', index = null;

  // Ouverture et fermeture des saisons (d'après Proximity Accordion de 21st) :
  // la hauteur s'ouvre d'abord, la liste arrive ensuite ; à la fermeture,
  // la liste s'efface vite, puis la saison se replie.
  blocs.forEach(bloc => {
    const resume = bloc.querySelector('summary');
    const contenu = [...bloc.children].filter(el => el !== resume && !el.classList.contains('survol-pilule'));
    let anim = null;
    resume.addEventListener('click', e => {
      if (reduit) return;
      e.preventDefault();
      const ouvert = bloc.open && !bloc.classList.contains('se-ferme');
      const depart = bloc.offsetHeight;
      anim?.cancel();
      contenu.forEach(el => el.getAnimations().forEach(a => a.cancel()));
      if (!ouvert) {
        bloc.classList.remove('se-ferme');
        bloc.open = true;
        const arrivee = bloc.scrollHeight;
        anim = bloc.animate([{ height: depart + 'px' }, { height: arrivee + 'px' }], { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' });
        contenu.forEach(el => el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 90, easing: 'ease-out', fill: 'backwards' }));
      } else {
        bloc.classList.add('se-ferme');
        contenu.forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }));
        anim = bloc.animate([{ height: depart + 'px' }, { height: resume.offsetHeight + 'px' }], { duration: 420, delay: 60, easing: 'cubic-bezier(.22,1,.36,1)' });
        anim.onfinish = () => {
          bloc.open = false;
          bloc.classList.remove('se-ferme');
          contenu.forEach(el => el.getAnimations().forEach(a => a.cancel()));
        };
      }
    });

    // Pilule de survol : elle rejoint l'épisode le plus proche du curseur,
    // même dans l'espace entre deux lignes, avec un petit ressort.
    // Quand la souris revient, elle apparaît sur place au lieu de glisser
    // depuis son ancienne position.
    const ol = bloc.querySelector('.episodes-liste');
    const pilule = document.createElement('span');
    pilule.className = 'survol-pilule';
    bloc.append(pilule);
    let visible = false;
    ol.addEventListener('mousemove', e => {
      let proche = null, ecart = Infinity;
      ol.querySelectorAll('li:not([hidden])').forEach(li => {
        const r = li.getBoundingClientRect();
        const d = Math.abs(e.clientY - (r.top + r.height / 2));
        if (d < ecart) { ecart = d; proche = li; }
      });
      if (!proche) return;
      if (!visible) pilule.classList.add('sans-glisse');
      pilule.style.top = ol.offsetTop + proche.offsetTop + 'px';
      pilule.style.height = proche.offsetHeight + 'px';
      if (!visible) { pilule.offsetHeight; pilule.classList.remove('sans-glisse'); visible = true; }
      pilule.style.opacity = 1;
      ol.querySelectorAll('li.proche').forEach(li => li !== proche && li.classList.remove('proche'));
      proche.classList.add('proche');
    });
    ol.addEventListener('mouseleave', () => {
      pilule.style.opacity = 0; visible = false;
      ol.querySelectorAll('li.proche').forEach(li => li.classList.remove('proche'));
    });
  });

  function appliquer() {
    const q = champ.value.trim();
    const motif = sansAccents(q);
    const cherche = motif.length >= 2 && index;
    let trouves = 0;
    blocs.forEach(bloc => {
      const dansFiltre = filtre === 'tout' || bloc.dataset.saison === filtre;
      let visibles = 0;
      bloc.querySelectorAll('li[data-episode]').forEach(li => {
        li.querySelector('.ep-extrait')?.remove();
        let montre = dansFiltre;
        if (montre && cherche) {
          const ep = index.get(+li.dataset.episode);
          const pos = ep ? ep.cherche.indexOf(motif) : -1;
          montre = pos !== -1 || (ep && ep.titre.includes(motif));
          if (pos !== -1) li.querySelector('a').append(extraitTrouve(ep, pos, motif.length));
        }
        li.hidden = !montre;
        if (montre) visibles++;
      });
      bloc.hidden = !dansFiltre || (cherche && visibles === 0);
      if (cherche && visibles) bloc.open = true;
      trouves += visibles;
    });
    if (filtre !== 'tout') blocs.forEach(b => { if (!b.hidden) b.open = true; });
    resultats.textContent = cherche
      ? (trouves ? `${trouves} épisode${trouves > 1 ? 's' : ''} pour « ${q} »` : `Aucun épisode ne parle de « ${q} ».`)
      : '';
  }

  // Extrait autour du mot trouvé, avec le mot surligné
  function extraitTrouve(ep, pos, longueur) {
    const debut = Math.max(0, pos - 60), fin = Math.min(ep.x.length, pos + longueur + 80);
    const span = document.createElement('span');
    span.className = 'ep-extrait';
    const mark = document.createElement('mark');
    mark.textContent = ep.x.slice(pos, pos + longueur);
    span.append((debut ? '…' : '') + ep.x.slice(debut, pos), mark, ep.x.slice(pos + longueur, fin) + (fin < ep.x.length ? '…' : ''));
    return span;
  }

  async function chargerIndex() {
    if (index) return;
    try {
      const donnees = await (await fetch('/cvigne-apercu/recherche.json')).json();
      // Le retrait des accents garde la même longueur : les positions restent valables pour l'extrait
      index = new Map(donnees.map(ep => [ep.n, { ...ep, cherche: sansAccents(ep.x), titre: sansAccents(ep.t) }]));
    } catch (e) { resultats.textContent = 'La recherche est indisponible pour le moment.'; }
  }

  /* Filtres (d'après Filterable Blog Index de 21st) : une pastille glisse
     d'un filtre à l'autre ; les saisons qui sortent s'effacent d'abord, puis
     celles qui restent glissent jusqu'à leur nouvelle place au lieu de sauter. */
  const groupeFiltres = filtres[0]?.parentElement;
  const pastille = document.createElement('span');
  pastille.className = 'filtre-pastille';
  pastille.setAttribute('aria-hidden', 'true');
  if (groupeFiltres) {
    groupeFiltres.prepend(pastille);
    groupeFiltres.classList.add('avec-pastille');
  }
  function placerPastille(sansGlisse) {
    const actif = filtres.find(x => x.getAttribute('aria-pressed') === 'true');
    if (!actif) return;
    if (sansGlisse) pastille.classList.add('sans-glisse');
    pastille.style.transform = `translate(${actif.offsetLeft}px, ${actif.offsetTop}px)`;
    pastille.style.width = actif.offsetWidth + 'px';
    pastille.style.height = actif.offsetHeight + 'px';
    if (sansGlisse) { pastille.offsetHeight; pastille.classList.remove('sans-glisse'); }
  }
  placerPastille(true);
  window.addEventListener('resize', () => placerPastille(true));
  document.fonts?.ready.then(() => placerPastille(true));

  let jeton = 0;
  function changerFiltre(nouveau) {
    const n = ++jeton;
    const garde = b => nouveau === 'tout' || b.dataset.saison === nouveau;
    if (reduit) { filtre = nouveau; appliquer(); return; }
    blocs.forEach(b => b.getAnimations().forEach(a => a.cancel()));
    const avant = new Map(blocs.filter(b => !b.hidden).map(b => [b, b.getBoundingClientRect().top]));
    const partants = blocs.filter(b => !b.hidden && !garde(b));
    const sorties = partants.map(b => b.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(.985)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}));
    // Au plus tard après 260 ms : si les animations sont suspendues (onglet en arrière-plan), le filtre s'applique quand même.
    Promise.race([Promise.all(sorties), new Promise(r => setTimeout(r, 260))]).then(() => {
      if (n !== jeton) return; // un autre filtre a été choisi entre-temps
      filtre = nouveau;
      appliquer();
      partants.forEach(b => b.getAnimations().forEach(a => a.cancel()));
      blocs.filter(b => !b.hidden).forEach((b, i) => {
        // Une saison restée hors de l'écran n'attend pas l'apparition au défilement
        b.classList.remove('attente');
        const dy = avant.has(b) ? avant.get(b) - b.getBoundingClientRect().top : 0;
        // Elle glisse si elle vient d'un endroit visible ; venue de loin, elle apparaît sur place
        if (avant.has(b) && Math.abs(dy) < innerHeight * 0.6) {
          if (Math.abs(dy) > 1) b.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' });
        } else {
          b.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 60 + i * 50, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        }
      });
    });
  }

  filtres.forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    filtres.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    placerPastille(false);
    changerFiltre(b.dataset.filtre);
  }));

  tris.forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    tris.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    // On inverse l'ordre des saisons et des épisodes
    blocs.reverse().forEach(bloc => {
      liste.append(bloc);
      const ol = bloc.querySelector('.episodes-liste');
      [...ol.querySelectorAll('li')].reverse().forEach(li => ol.append(li));
    });
  }));

  /* ── Palette de résultats (d'après Command Search de 21st) ──
     Une liste déroulante sous le champ : les épisodes trouvés, groupés par
     saison, avec le mot surligné. Une seule surbrillance glisse d'un résultat
     à l'autre (souris ou flèches), Entrée ouvre l'épisode, Échap referme.
     La liste du sommaire reste filtrée comme avant : la palette est un raccourci. */
  const palette = zone.querySelector('[data-palette]');
  const paletteListe = zone.querySelector('[data-palette-liste]');
  const effacer = zone.querySelector('[data-recherche-effacer]');
  const nomSaison = id => (filtres.find(b => b.dataset.filtre === id)?.firstChild.textContent || '').trim();
  const pilulePalette = document.createElement('span');
  pilulePalette.className = 'palette-pilule';
  pilulePalette.setAttribute('aria-hidden', 'true');
  let options = [], active = -1;

  function surligner(texte, motif) {
    const frag = document.createDocumentFragment();
    const pos = sansAccents(texte).indexOf(motif);
    if (pos === -1 || !motif) { frag.append(texte); return frag; }
    const mark = document.createElement('mark');
    mark.textContent = texte.slice(pos, pos + motif.length);
    frag.append(texte.slice(0, pos), mark, texte.slice(pos + motif.length));
    return frag;
  }

  function remplirPalette() {
    const q = champ.value.trim(), motif = sansAccents(q);
    paletteListe.replaceChildren();
    options = []; active = -1;
    if (motif.length < 2 || !index) { fermerPalette(); return; }
    const trouves = [...index.values()]
      .filter(ep => (filtre === 'tout' || ep.s === filtre) && (ep.titre.includes(motif) || ep.cherche.includes(motif)))
      .sort((a, b) => (b.titre.includes(motif) - a.titre.includes(motif)) || b.n - a.n)
      .slice(0, 8);
    if (!trouves.length) {
      const vide = document.createElement('p');
      vide.className = 'palette-vide';
      vide.textContent = `Aucun épisode ne parle de « ${q} ».`;
      paletteListe.append(vide);
    }
    // Regroupe par saison, dans l'ordre où chaque saison apparaît (un seul intertitre par saison)
    const groupes = new Map();
    trouves.forEach(ep => groupes.set(ep.s, [...(groupes.get(ep.s) || []), ep]));
    let saison = null;
    [...groupes.values()].flat().forEach(ep => {
      if (ep.s !== saison) {
        saison = ep.s;
        const t = document.createElement('p');
        t.className = 'palette-groupe';
        t.textContent = nomSaison(ep.s);
        paletteListe.append(t);
      }
      const a = document.createElement('a');
      a.href = ep.u; a.id = `palette-ep-${ep.n}`;
      a.className = 'palette-option'; a.setAttribute('role', 'option'); a.tabIndex = -1;
      const num = document.createElement('span'); num.className = 'palette-num'; num.textContent = ep.n;
      const titre = document.createElement('span'); titre.className = 'palette-titre'; titre.append(surligner(ep.t, motif));
      a.append(num, titre);
      const pos = ep.cherche.indexOf(motif);
      if (pos !== -1 && !ep.titre.includes(motif)) {
        const ex = document.createElement('span'); ex.className = 'palette-extrait';
        const debut = Math.max(0, pos - 30);
        ex.append(surligner((debut ? '…' : '') + ep.x.slice(debut, pos + motif.length + 50) + '…', motif));
        a.append(ex);
      }
      a.addEventListener('mouseenter', () => activer(options.indexOf(a)));
      paletteListe.append(a);
      options.push(a);
    });
    paletteListe.prepend(pilulePalette);
    palette.hidden = false;
    champ.setAttribute('aria-expanded', 'true');
    pilulePalette.classList.add('sans-glisse');
    activer(options.length ? 0 : -1);
    pilulePalette.offsetHeight; pilulePalette.classList.remove('sans-glisse');
  }

  function activer(i) {
    options[active]?.setAttribute('aria-selected', 'false');
    active = i;
    const a = options[i];
    if (!a) { pilulePalette.style.opacity = 0; champ.removeAttribute('aria-activedescendant'); return; }
    a.setAttribute('aria-selected', 'true');
    champ.setAttribute('aria-activedescendant', a.id);
    pilulePalette.style.transform = `translateY(${a.offsetTop}px)`;
    pilulePalette.style.height = a.offsetHeight + 'px';
    pilulePalette.style.opacity = 1;
    const haut = a.offsetTop, bas = haut + a.offsetHeight;
    if (haut < paletteListe.scrollTop) paletteListe.scrollTop = haut - 8;
    else if (bas > paletteListe.scrollTop + paletteListe.clientHeight) paletteListe.scrollTop = bas - paletteListe.clientHeight + 8;
  }

  function fermerPalette() {
    palette.hidden = true;
    champ.setAttribute('aria-expanded', 'false');
    champ.removeAttribute('aria-activedescendant');
  }

  champ.addEventListener('keydown', e => {
    if (palette.hidden) return;
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); activer((active + 1) % options.length); }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); activer((active - 1 + options.length) % options.length); }
    else if (e.key === 'Enter' && options[active]) { e.preventDefault(); location.href = options[active].href; }
    else if (e.key === 'Escape') { e.preventDefault(); fermerPalette(); }
  });
  champ.addEventListener('focus', () => { if (champ.value.trim().length >= 2 && index) remplirPalette(); });
  document.addEventListener('pointerdown', e => { if (!zone.querySelector('.recherche').contains(e.target)) fermerPalette(); });
  effacer.addEventListener('click', () => {
    champ.value = ''; effacer.hidden = true;
    appliquer(); fermerPalette(); champ.focus();
  });

  let delai;
  champ.addEventListener('input', () => {
    effacer.hidden = !champ.value;
    clearTimeout(delai);
    delai = setTimeout(async () => { await chargerIndex(); appliquer(); remplirPalette(); }, 160);
  });
  champ.addEventListener('focus', chargerIndex, { once: true });

  /* Des exemples se tapent seuls dans le champ vide (Command Search) */
  if (!reduit) {
    const exemples = ['Clarence', 'Branaire-Ducru', 'Lucien', 'caviar', 'Naples', 'Saint-Émilion'];
    let i = 0, lettre = 0, efface = false;
    const taper = () => {
      if (document.activeElement === champ || champ.value) { champ.placeholder = 'Rechercher'; setTimeout(taper, 1200); return; }
      const mot = exemples[i];
      lettre += efface ? -1 : 1;
      champ.placeholder = `Rechercher « ${mot.slice(0, lettre)} »`;
      if (!efface && lettre === mot.length) { efface = true; setTimeout(taper, 1600); return; }
      if (efface && lettre === 0) { efface = false; i = (i + 1) % exemples.length; }
      setTimeout(taper, efface ? 40 : 90);
    };
    setTimeout(taper, 1200);
  }
})();
