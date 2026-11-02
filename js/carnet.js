/* ============================================================
   EMILIEN GOUTU · script commun à toutes les pages
   Sommaire plein écran, titres qui s'écrivent, apparitions,
   rideau entre deux pages, envoi des formulaires
   ============================================================ */
(() => {
  const html = document.documentElement;
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── En-tête : fond au défilement, se cache en descendant ── */
  const entete = document.querySelector('[data-entete]');
  let dernierY = 0;
  function majEntete() {
    const y = window.scrollY;
    entete.classList.toggle('defile', y > 40);
    const ouvert = html.classList.contains('sommaire-ouvert');
    entete.classList.toggle('cache', !ouvert && y > 500 && y > dernierY + 4);
    if (y < dernierY - 4) entete.classList.remove('cache');
    dernierY = y;
  }
  if (entete) { majEntete(); window.addEventListener('scroll', majEntete, { passive: true }); }

  /* ── Sommaire plein écran (Immersive Full Screen Navigation) ── */
  const bouton = document.querySelector('[data-ouvrir-sommaire]');
  const sommaire = document.querySelector('[data-sommaire]');
  function ouvrirSommaire(ouvrir) {
    if (!sommaire) return;
    bouton.setAttribute('aria-expanded', String(ouvrir));
    bouton.querySelector('.bouton-sommaire-texte').textContent = ouvrir ? 'Fermer' : 'Sommaire';
    html.classList.toggle('sommaire-ouvert', ouvrir);
    if (ouvrir) {
      sommaire.hidden = false;
      sommaire.classList.remove('ferme');
      html.style.overflow = 'hidden';
      requestAnimationFrame(() => requestAnimationFrame(() => sommaire.classList.add('ouvert')));
      setTimeout(() => sommaire.querySelector('a')?.focus({ preventScroll: true }), 350);
    } else {
      sommaire.classList.add('ferme');
      sommaire.classList.remove('ouvert');
      html.style.overflow = '';
      setTimeout(() => {
        if (sommaire.classList.contains('ouvert')) return;
        sommaire.hidden = true;
        sommaire.classList.remove('ferme');
      }, reduit ? 0 : 800);
      bouton.focus({ preventScroll: true });
    }
  }
  // Les saisons de la colonne de droite montent une à une
  sommaire?.querySelectorAll('.sommaire-saisons li').forEach((li, i) => li.style.setProperty('--i', i));
  // Titres du sommaire : chaque lettre roule au survol (lecteurs d'écran : le titre entier)
  if (sommaire && !reduit) {
    sommaire.querySelectorAll('.sommaire-titre').forEach(titre => {
      const texte = titre.textContent;
      const cache = document.createElement('span');
      cache.className = 'visuellement-cache';
      cache.textContent = texte;
      const roule = document.createElement('span');
      roule.className = 'roule';
      roule.setAttribute('aria-hidden', 'true');
      let c = 0;
      texte.split(' ').forEach((mot, i) => {
        if (i) roule.append(' ');
        const m = document.createElement('span');
        m.className = 'roule-mot';
        [...mot].forEach(lettre => {
          const l = document.createElement('span');
          l.className = 'roule-c';
          l.textContent = lettre;
          l.style.setProperty('--c', c++);
          m.append(l);
        });
        roule.append(m);
      });
      titre.replaceChildren(cache, roule);
    });
    sommaire.querySelector('.sommaire-liste')?.classList.add('sommaire-roule');
  }
  bouton?.addEventListener('click', () => ouvrirSommaire(bouton.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && html.classList.contains('sommaire-ouvert')) ouvrirSommaire(false);
    // Garde le focus dans le sommaire ouvert
    if (e.key === 'Tab' && html.classList.contains('sommaire-ouvert')) {
      const focusables = [bouton, ...sommaire.querySelectorAll('a')];
      const i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });

  /* ── Titres qui s'écrivent mot à mot (Text Reveal) ── */
  function decouperMots(el) {
    let n = 0;
    const parcourir = noeud => {
      [...noeud.childNodes].forEach(enfant => {
        if (enfant.nodeType === 3) {
          // Espaces ordinaires seulement : les espaces insécables (« C. Vigné », « suite : ») restent dans le mot
          const morceaux = enfant.textContent.split(/([ \t\n\r]+)/);
          const frag = document.createDocumentFragment();
          morceaux.forEach(m => {
            if (!m) return;
            if (/^[ \t\n\r]+$/.test(m)) { frag.appendChild(document.createTextNode(' ')); return; }
            const mot = document.createElement('span');
            mot.className = 'mot';
            const interieur = document.createElement('span');
            interieur.textContent = m;
            interieur.style.setProperty('--m', n++);
            mot.appendChild(interieur);
            frag.appendChild(mot);
          });
          enfant.replaceWith(frag);
        } else if (enfant.nodeType === 1 && enfant.tagName !== 'BR') parcourir(enfant);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    parcourir(el);
    [...el.children].forEach(c => c.setAttribute('aria-hidden', 'true'));
  }
  window.decouperMots = decouperMots;

  const titres = document.querySelectorAll('[data-ecrire]');
  if (reduit || !('IntersectionObserver' in window)) {
    titres.forEach(t => t.classList.add('ecrit'));
  } else {
    titres.forEach(decouperMots);
    const obs = new IntersectionObserver(entrees => entrees.forEach(e => {
      if (!e.isIntersecting || e.target.dataset.manuel) return;
      e.target.classList.add('ecrit');
      obs.unobserve(e.target);
    }), { threshold: 0.3 });
    titres.forEach(t => {
      // Déjà à l'écran au chargement : on écrit tout de suite (meilleur affichage pour Google)
      if (!t.dataset.manuel && t.getBoundingClientRect().top < innerHeight) {
        requestAnimationFrame(() => t.classList.add('ecrit'));
      } else obs.observe(t);
    });
  }

  /* ── Apparitions douces au défilement et signature tracée ── */
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entrees => entrees.forEach(e => {
      if (!e.isIntersecting) return;
      if (e.target.matches('.signature-trait')) e.target.classList.add('trace');
      else e.target.classList.replace('attente', 'vu');
      obs.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    // Ce qui est déjà à l'écran au chargement reste visible tout de suite (rien ne clignote)
    if (!reduit) document.querySelectorAll('[data-apparait]').forEach(el => {
      if (el.getBoundingClientRect().top > innerHeight * 0.92) { el.classList.add('attente'); obs.observe(el); }
    });
    // Personnages : les cartes visibles à l'ouverture montent aussi, en cascade (une toutes les 100 ms)
    if (!reduit && document.body.classList.contains('page-personnages')) {
      document.querySelectorAll('.personnage[data-apparait]:not(.attente)').forEach((el, k) => {
        el.style.setProperty('--i', k + 2);
        el.classList.add('vu');
      });
    }
    document.querySelectorAll('.signature-trait').forEach(el => obs.observe(el));
  }

  /* ── Collage du livre : léger décalage au défilement ── */
  const collages = document.querySelectorAll('[data-collage]');
  if (collages.length && !reduit) {
    let attente = false;
    const bouger = () => {
      attente = false;
      collages.forEach(c => {
        const r = c.getBoundingClientRect();
        const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        if (Math.abs(p) > 1.2) return;
        c.querySelector('.collage-couverture').style.transform = `rotate(-3deg) translateY(${p * -30}px)`;
        c.querySelector('.collage-portrait').style.transform = `rotate(5deg) translateY(${p * 40}px)`;
      });
    };
    window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(bouger); } }, { passive: true });
    bouger();
  }

  /* ── Rideau entre deux pages (d'après Block Transition, Hyperiux sur 21st) ── */
  const rideau = document.querySelector('[data-rideau]');
  if (rideau && !reduit) {
    // Arrivée : la page est déjà couverte (script du <head>), les volets se rouvrent de bas en haut
    if (html.classList.contains('rideau-arrivee')) {
      try { sessionStorage.removeItem('cvigne-rideau'); } catch (e) { /* rien */ }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        rideau.classList.add('leve');
        html.classList.remove('rideau-arrivee');
        setTimeout(() => rideau.classList.remove('leve'), 1100);
      }));
    }

    document.addEventListener('click', e => {
      const lien = e.target.closest('a[href]');
      if (!lien || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (lien.target === '_blank' || lien.hasAttribute('download')) return;
      const url = new URL(lien.href, location.href);
      if (url.origin !== location.origin || /\.(xml|json|txt)$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      if (html.classList.contains('sommaire-ouvert')) html.style.overflow = '';
      html.classList.add('quitte');
      rideau.classList.add('ferme');
      try { sessionStorage.setItem('cvigne-rideau', '1'); } catch (err) { /* rien */ }
      setTimeout(() => { location.href = url.href; }, 940);
    });
    // Retour arrière depuis le cache du navigateur : on rouvre tout
    window.addEventListener('pageshow', ev => {
      if (!ev.persisted) return;
      rideau.classList.remove('ferme', 'leve');
      html.classList.remove('quitte', 'rideau-arrivee');
    });
  }

  /* ── Formulaires : contact et e-mail du nouvel épisode ── */
  document.querySelectorAll('form[data-envoi]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const action = form.getAttribute('action');
      const merci = form.parentElement.querySelector('.lettre-merci, .contact-merci') || form.nextElementSibling;
      const boutonEnvoi = form.querySelector('[type="submit"]');
      const local = ['localhost', '127.0.0.1'].includes(location.hostname);
      // En local, pas de PHP : le formulaire est validé mais rien n'est envoyé
      if (!action || (local && /.php$/.test(action))) {
        if (!local) { alert("Ce formulaire n'est pas encore branché. Merci de réessayer bientôt."); return; }
        console.info('[aperçu local] Formulaire valide, aucun envoi : le service sera branché à la mise en ligne.');
      } else {
        // 24/10 (21st Newsletter Signup Card) : le bouton dit qu'il envoie, l'erreur s'affiche dans la carte
        const erreur = form.parentElement.querySelector('.lettre-erreur');
        const texteBouton = boutonEnvoi.textContent;
        boutonEnvoi.disabled = true;
        boutonEnvoi.textContent = 'Envoi…';
        if (erreur) erreur.textContent = '';
        try {
          const rep = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
          if (!rep.ok) throw new Error(rep.status);
        } catch (err) {
          boutonEnvoi.disabled = false;
          boutonEnvoi.textContent = texteBouton;
          const message = "L'envoi n'a pas abouti. Merci de réessayer dans un instant.";
          if (erreur) erreur.textContent = message; else alert(message);
          return;
        }
      }
      // Passage animé : le formulaire s'efface en remontant, puis le merci arrive et sa coche se trace
      const montrerMerci = () => {
        form.hidden = true;
        if (merci) { merci.hidden = false; merci.focus?.({ preventScroll: true }); }
      };
      if (reduit || !form.classList.contains('lettre-form')) montrerMerci();
      else { form.classList.add('part'); setTimeout(montrerMerci, 260); }
    });
  });
})();
