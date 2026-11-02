/* ============================================================
   ACCUEIL · « Ouvrir le livre » (d'après le composant Book de 21st)
   Le livre posé sur la table se redresse, la couverture s'ouvre,
   on plonge dans la première page, qui devient le papier du site.
   Sans GSAP ou avec « réduire les animations » : une entrée fixe.
   ============================================================ */
(() => {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduit || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ── 1. L'entrée ── */
  const section = document.querySelector('[data-ouverture]');
  if (section) {
    const scene = section.querySelector('.livre3d');
    const corps = section.querySelector('[data-livre]');
    const couverture = section.querySelector('[data-couverture]');
    const ombre = section.querySelector('[data-ombre]');
    const papier = section.querySelector('[data-papier]');
    const texte = section.querySelector('[data-ouverture-texte]');
    const indice = section.querySelector('[data-indice]');
    const titre = section.querySelector('[data-ecrire]');
    if (titre) titre.dataset.manuel = '1';

    section.classList.add('ouverture-animee');
    const largeur = () => scene.offsetWidth;
    const hauteur = () => scene.offsetHeight;
    // Échelle pour que la page du livre remplisse tout l'écran
    const remplir = () => Math.max(innerWidth / largeur(), innerHeight / hauteur()) * 1.15;
    // Livre ouvert : la double page doit tenir dans l'écran (téléphone)
    const tenir = () => Math.min(1, (innerWidth * 0.94) / (largeur() * 2));

    gsap.set(corps, { rotationX: 58, rotationZ: -16, rotationY: 0, y: () => hauteur() * 0.06, scale: 0.82, transformOrigin: '50% 50%' });
    gsap.set(ombre, { opacity: 0.9, scaleX: 1.1 });
    gsap.set(texte, { autoAlpha: 0, y: 30 });

    let texteMontre = false;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.9, invalidateOnRefresh: true,
        onUpdate: () => {
          const t = tl.time();
          section.classList.toggle('texte-papier', t > 3.35);
          const montrer = t > 3.6;
          if (montrer !== texteMontre) { texteMontre = montrer; titre?.classList.toggle('ecrit', montrer); }
        }
      }
    });
    tl.to(indice, { autoAlpha: 0, duration: 0.25 }, 0)
      // le livre se redresse face au lecteur
      .to(corps, { rotationX: 0, rotationZ: 0, rotationY: -10, y: 0, scale: 1, duration: 1, ease: 'power2.out' }, 0)
      .to(ombre, { opacity: 0.55, scaleX: 0.95, duration: 1 }, 0)
      // la couverture s'ouvre, le livre glisse pour centrer la double page
      .to(couverture, { rotationY: -168, duration: 1.3 }, 1)
      .to(corps, { x: () => largeur() / 2 * tenir(), scale: tenir, rotationY: 0, duration: 1.3 }, 1)
      // on plonge dans la première page
      .to(corps, { scale: remplir, x: 0, duration: 1.3, ease: 'power3.in' }, 2.35)
      .to(ombre, { opacity: 0, duration: 0.6 }, 2.35)
      .to(papier, { opacity: 1, duration: 0.45, ease: 'none' }, 3.2)
      .to(texte, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 3.55)
      .to({}, { duration: 0.7 });
  }

  /* ── 2. La carte du voyage (d'après Text Along Path de 21st) ──
     Le trait se dessine au défilement et le texte glisse derrière la
     plume : il entre par le début du chemin, suit la pointe du trait,
     puis se pose à la fin du trajet, entièrement lisible. */
  const voyage = document.querySelector('[data-voyage]');
  if (voyage) {
    const trajet = voyage.querySelector('[data-trajet]');
    const texteChemin = voyage.querySelector('[data-texte-chemin]');
    const longueur = trajet.getTotalLength();
    const texte = texteChemin.getComputedTextLength();
    const repos = Math.max(0, longueur - texte - longueur * 0.075); // position finale : le texte s'arrête avant l'étiquette de Naples
    const placer = p => {
      const debut = Math.min(p * longueur - texte, repos);
      texteChemin.setAttribute('startOffset', (debut / longueur * 100).toFixed(2) + '%');
    };
    gsap.set(trajet, { strokeDasharray: longueur, strokeDashoffset: longueur });
    const plume = { p: 0 };
    placer(0);
    // le texte lit la même progression lissée que le trait : ils restent collés
    gsap.timeline({ scrollTrigger: { trigger: voyage, start: 'top 75%', end: 'bottom 45%', scrub: 1 } })
      .to(trajet, { strokeDashoffset: 0, ease: 'none' }, 0)
      .to(plume, { p: 1, ease: 'none', onUpdate: () => placer(plume.p) }, 0);
  }

  /* ── 3. La citation s'éclaire mot après mot ── */
  const citation = document.querySelector('.citation [data-mots]');
  if (citation) {
    const mots = citation.textContent.trim().split(/\s+/);
    const lisible = document.createElement('span');
    lisible.className = 'visuellement-cache';
    lisible.textContent = citation.textContent.trim();
    citation.replaceChildren(...mots.flatMap((m, i) => {
      const s = document.createElement('span');
      s.className = 'mot'; s.setAttribute('aria-hidden', 'true'); s.textContent = m;
      return i ? [document.createTextNode(' '), s] : [s];
    }));
    citation.prepend(lisible);
    const spans = citation.querySelectorAll('.mot');
    // Editorial Testimonial : le grand numéro glisse en entrant, la signature
    // et son trait attendent que la phrase soit entièrement lue
    const bloc = citation.closest('.citation');
    bloc.classList.add('citation-animee');
    const lire = self => {
      const n = Math.round(self.progress * spans.length);
      spans.forEach((s, i) => s.classList.toggle('lu', i < n));
      bloc.classList.toggle('lue', n === spans.length);
    };
    ScrollTrigger.create({
      trigger: bloc, start: 'top 85%', once: true,
      onEnter: () => bloc.classList.add('visible')
    });
    ScrollTrigger.create({
      trigger: citation, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: lire, onRefresh: lire
    });
  }
})();
