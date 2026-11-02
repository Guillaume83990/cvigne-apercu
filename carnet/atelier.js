/* ============================================================
   LE CARNET D'ÉCRITURE de C. Vigné
   Sommaire, page d'écriture, sauvegarde automatique, brouillons,
   versions, programmation, aperçu exact. Les épisodes restent des
   fichiers Markdown (content/histoires/*.md) lus par le site.
   ============================================================ */
(() => {
  const T = window.Texte;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const AUTEUR = 'C. Vigné';

  /* ── Dates ── */
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const aujourdHui = () => iso(new Date());
  const versDate = s => new Date(s + 'T12:00:00');
  const dateLongue = s => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateMoyenne = s => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
  const heure = (t = new Date()) => `${t.getHours()} h ${String(t.getMinutes()).padStart(2, '0')}`;
  function mardiProchain() {
    const d = new Date();
    d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
    return iso(d);
  }
  const nombre = n => n.toLocaleString('fr-FR');

  /* ── Petites aides d'interface ── */
  let minuteurAnnonce;
  function annoncer(texte) {
    const a = $('[data-annonce]');
    a.textContent = texte;
    a.classList.add('visible');
    clearTimeout(minuteurAnnonce);
    minuteurAnnonce = setTimeout(() => a.classList.remove('visible'), 3600);
  }
  function confirmer(titre, texte, oui = 'Confirmer') {
    const d = $('[data-dialogue]');
    $('[data-dialogue-titre]').textContent = titre;
    $('[data-dialogue-texte]').textContent = texte;
    $('[data-dialogue-oui]').textContent = oui;
    return new Promise(ok => {
      d.addEventListener('close', () => ok(d.returnValue === 'oui'), { once: true });
      d.returnValue = '';
      d.showModal();
    });
  }
  const stock = {
    lire(cle) { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch { return null; } },
    ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch { return false; } },
    effacer(cle) { try { localStorage.removeItem(cle); } catch { /* rien */ } },
    cles(prefixe) { try { return Object.keys(localStorage).filter(k => k.startsWith(prefixe)); } catch { return []; } }
  };
  const AUTO = 'carnet-auto:';

  /* ── État ── */
  let depot = null;
  let saisons = [];
  let episodes = [];
  let courant = null;          // l'épisode ouvert dans la page d'écriture
  let reference = '';          // empreinte de la dernière version enregistrée
  let filtre = 'tout';

  /* ── Lecture des fichiers d'épisode ── */
  const titrePropre = t => String(t || '').replace(/^\s*[ÉEé]pisode\s*\d+\s*[-–—:]\s*/i, '').trim();
  function lireEpisode(fichier, texte) {
    const { data, corps } = T.lireEnTete(texte);
    const dateFichier = (fichier.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const dateChamp = /^\d{4}-\d{2}-\d{2}/.test(data.date || '') ? String(data.date).slice(0, 10) : '';
    return {
      fichier,
      titre: titrePropre(data.titre || data.title || ''),
      date: dateChamp || dateFichier,
      publie: data.publie !== false,
      saison: data.saison || '',
      image: data.image || '',
      resume: data.resume || '',
      menu: Array.isArray(data.au_menu) ? data.au_menu.map(x => (typeof x === 'string' ? { plat: x, accord: '' } : { plat: x.plat || '', accord: x.accord || '' })) : [],
      corps
    };
  }
  function statut(e) {
    if (!e.publie) return 'brouillon';
    return e.date && e.date > aujourdHui() ? 'programme' : 'publie';
  }
  // Numéros calculés comme sur le site : épisodes publiés, par date
  function numeroter() {
    const auj = aujourdHui();
    const publies = episodes.filter(e => e.publie && e.titre && e.date && e.date <= auj)
      .sort((a, b) => a.date.localeCompare(b.date) || a.fichier.localeCompare(b.fichier));
    const programmes = episodes.filter(e => e.publie && e.titre && e.date > auj)
      .sort((a, b) => a.date.localeCompare(b.date) || a.fichier.localeCompare(b.fichier));
    episodes.forEach(e => { e.numero = null; });
    publies.forEach((e, i) => { e.numero = i + 1; });
    programmes.forEach((e, i) => { e.numero = publies.length + i + 1; });
    return { publies, programmes };
  }
  function saisonDe(e) {
    if (e.saison) return saisons.find(s => s.id === e.saison) || saisons[saisons.length - 1];
    const n = e.numero;
    return (n && saisons.find(s => n >= s.debut && (s.fin == null || n <= s.fin))) || saisons[saisons.length - 1];
  }

  async function charger() {
    const [liste, s] = await Promise.all([depot.episodes(), depot.saisons()]);
    saisons = s;
    episodes = liste.map(x => lireEpisode(x.fichier, x.texte));
    numeroter();
  }

  /* ── Écrans et navigation ── */
  function montrer(nom) {
    $$('[data-ecran]').forEach(e => { e.hidden = e.dataset.ecran !== nom; });
    window.scrollTo(0, 0);
  }
  function route() {
    if (!depot) return;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (h === 'nouveau') ouvrir(null);
    else if (h.startsWith('episode/')) ouvrir(h.slice(8));
    else afficherSommaire();
  }
  window.addEventListener('hashchange', route);

  /* ════════════════ ACCUEIL ════════════════ */
  async function accueil() {
    montrer('accueil');
    const note = $('[data-accueil-note]');
    if (Depot.enLigne) return accueilEnLigne();
    if (!Depot.localPossible) {
      $('[data-accueil-texte]').textContent = 'Ce carnet s\'ouvre avec Google Chrome ou Microsoft Edge, sur l\'ordinateur.';
      $('[data-action="ouvrir-dossier"]').hidden = true;
      return;
    }
    try {
      const m = await Depot.dossierMemorise(false);
      if (m && m.aAutoriser) {
        $('[data-accueil-texte]').textContent = `Bon retour. Le carnet a besoin de votre accord pour rouvrir le dossier « ${m.nom} ».`;
        $('[data-action="reprendre-dossier"]').hidden = false;
        $('[data-action="ouvrir-dossier"]').textContent = 'Choisir un autre dossier';
      } else if (m) { demarrer(m); }
    } catch (err) { note.textContent = 'Le dossier mémorisé est introuvable. Choisissez-le de nouveau.'; }
  }
  // Sur le vrai site : la clé de connexion, collée une seule fois sur cet ordinateur
  const MESSAGE_RESEAU = 'Le carnet n\'arrive pas à joindre le site. Vérifiez la connexion à Internet, puis rechargez la page.';
  async function accueilEnLigne() {
    $('[data-action="ouvrir-dossier"]').hidden = true;
    const note = $('[data-accueil-note]');
    try {
      const d = await Depot.depotEnLigne();
      if (d) { demarrer(d); return; }
    } catch (err) {
      if (!err.statut) { $('[data-accueil-texte]').textContent = MESSAGE_RESEAU; return; }
      note.textContent = 'Votre clé ne fonctionne plus (elle a peut-être expiré). Demandez-en une nouvelle à Guillaume.';
    }
    $('[data-accueil-texte]').textContent = 'La première fois sur cet ordinateur, collez la clé de connexion que Guillaume vous a donnée. Le carnet s\'en souviendra.';
    $('[data-connexion]').hidden = false;
    $('[data-cle]').focus();
  }
  $('[data-connexion]').addEventListener('submit', async ev => {
    ev.preventDefault();
    const champ = $('[data-cle]');
    const note = $('[data-accueil-note]');
    note.textContent = 'Ouverture…';
    try {
      const d = await Depot.depotEnLigne(champ.value);
      champ.value = '';
      $('[data-connexion]').hidden = true;
      note.textContent = '';
      demarrer(d);
    } catch (err) {
      note.textContent = err.statut ? 'Cette clé n\'ouvre pas le carnet. Vérifiez qu\'elle est copiée en entier, sans espace.' : MESSAGE_RESEAU;
    }
  });
  $('[data-action="ouvrir-dossier"]').addEventListener('click', async () => {
    const note = $('[data-accueil-note]');
    try { demarrer(await Depot.choisirDossier()); }
    catch (err) {
      if (err && err.name === 'AbortError') return;
      note.textContent = 'Ce dossier ne semble pas être celui du site : il doit contenir « content/histoires ». Choisissez le dossier « Emilien Goutu ».';
    }
  });
  $('[data-action="reprendre-dossier"]').addEventListener('click', async () => {
    try { const m = await Depot.dossierMemorise(true); if (m && !m.aAutoriser) demarrer(m); }
    catch { $('[data-accueil-note]').textContent = 'Impossible de rouvrir le dossier. Choisissez-le de nouveau.'; }
  });

  async function demarrer(d) {
    depot = d;
    try { await charger(); }
    catch (err) {
      const message = d.type === 'github' ? 'Le carnet n\'a pas pu lire vos épisodes en ligne. Rechargez la page dans un instant.' : 'Le carnet n\'a pas pu lire les épisodes de ce dossier.';
      depot = null; montrer('accueil'); $('[data-accueil-note]').textContent = message; return;
    }
    route();
  }

  /* ════════════════ SOMMAIRE ════════════════ */
  function afficherSommaire() {
    montrer('sommaire');
    document.title = 'Le carnet d\'écriture · Emilien Goutu';
    const h = new Date().getHours();
    $('[data-salut]').textContent = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
    const { publies, programmes } = numeroter();
    const brouillons = episodes.filter(e => !e.publie);
    const prochain = programmes[0];
    $('[data-resume]').textContent = [
      `${publies.length} épisode${publies.length > 1 ? 's' : ''} en ligne`,
      prochain ? `prochain : « ${prochain.titre} », ${dateMoyenne(prochain.date)}` : '',
      brouillons.length ? `${brouillons.length} brouillon${brouillons.length > 1 ? 's' : ''}` : ''
    ].filter(Boolean).join(' · ');
    $('[data-mode]').textContent = depot.type === 'local' ? `Dossier « ${depot.nom} » sur cet ordinateur` : depot.type === 'github' ? 'Relié au site en ligne' : `Mode ${depot.nom}`;
    $('[data-action="changer-dossier"]').hidden = depot.type === 'github';
    afficherReprise();
    afficherListe();
  }

  // Un texte commencé et pas encore enregistré ? On le propose en premier.
  function afficherReprise() {
    const zone = $('[data-reprise]');
    const autos = stock.cles(AUTO).map(k => ({ cle: k, ...(stock.lire(k) || {}) })).filter(a => a.quand);
    const enAttente = autos.filter(a => {
      if (!a.fichier) return (a.titre || a.md);
      const e = episodes.find(x => x.fichier === a.fichier);
      return !e || empreinteDe(a) !== empreinteEpisode(e);
    }).sort((a, b) => b.quand - a.quand);
    if (!enAttente.length) { zone.hidden = true; return; }
    const a = enAttente[0];
    zone.innerHTML = `<p>Vous avez un texte en cours${a.titre ? ` : <strong>« ${T.echapper(a.titre)} »</strong>` : ''}, gardé le ${dateMoyenne(iso(new Date(a.quand)))} à ${heure(new Date(a.quand))}.</p>
      <a class="bouton-carnet bouton-petit" href="#/${a.fichier ? 'episode/' + encodeURIComponent(a.fichier) : 'nouveau'}">Reprendre ce texte</a>`;
    zone.hidden = false;
  }

  function afficherListe() {
    const q = T.brut($('[data-recherche]').value).toLowerCase();
    const sans = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const motif = sans(q);
    const liste = episodes
      .filter(e => filtre === 'tout' || statut(e) === filtre)
      .filter(e => !motif || sans(e.titre + ' ' + T.brut(e.corps)).includes(motif))
      .sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999') || b.fichier.localeCompare(a.fichier));
    const ol = $('[data-liste]');
    const libelles = { publie: 'En ligne', programme: 'Programmé', brouillon: 'Brouillon' };
    ol.innerHTML = liste.length ? liste.map(e => {
      const st = statut(e);
      const s = saisonDe(e);
      const { mots } = T.mesure(e.corps);
      const quand = st === 'programme' ? `paraîtra le ${dateMoyenne(e.date)}` : st === 'publie' ? dateLongue(e.date) : (e.date ? `prévu le ${dateMoyenne(e.date)}` : 'sans date');
      return `<li><a href="#/episode/${encodeURIComponent(e.fichier)}">
        <span class="cahier-num">${e.numero || '·'}<small>${e.numero ? 'épisode' : 'brouillon'}</small></span>
        <span><span class="cahier-titre">${T.echapper(e.titre || 'Sans titre')}</span>
        <span class="cahier-meta">${quand} · ${s ? T.echapper(s.nom) : ''} · ${nombre(mots)} mots</span></span>
        <span class="pastille pastille-${st}">${libelles[st]}</span></a></li>`;
    }).join('') : `<li class="cahier-vide">${q ? `Aucun épisode ne contient « ${T.echapper(q)} ».` : 'Rien ici pour le moment.'}</li>`;
    $('[data-compte]').textContent = q ? `${liste.length} épisode${liste.length > 1 ? 's' : ''} trouvé${liste.length > 1 ? 's' : ''}` : '';
  }
  $('[data-recherche]').addEventListener('input', afficherListe);
  $$('[data-filtre]').forEach(b => b.addEventListener('click', () => {
    filtre = b.dataset.filtre;
    $$('[data-filtre]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    afficherListe();
  }));
  $('[data-action="nouveau"]').addEventListener('click', () => { location.hash = '#/nouveau'; });
  $('[data-action="changer-dossier"]').addEventListener('click', async () => {
    try { demarrer(await Depot.choisirDossier()); } catch { /* annulé */ }
  });

  /* ════════════════ PAGE D'ÉCRITURE ════════════════ */
  const editeur = $('[data-editeur]');
  const champTitre = $('[data-titre]');
  const champSaison = $('[data-champ="saison"]');
  const champDate = $('[data-champ="date"]');
  const champResume = $('[data-champ="resume"]');
  const caseTypo = $('[data-typo]');
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* ancien navigateur */ }
  caseTypo.checked = stock.lire('carnet-typo') !== false;
  caseTypo.addEventListener('change', () => stock.ecrire('carnet-typo', caseTypo.checked));

  /* Du texte de l'éditeur vers le Markdown du site */
  const BLOCS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI']);
  function entourer(marque, s) {
    return s.split('\n').map(ligne => {
      const m = ligne.match(/^(\s*)([\s\S]*?)(\s*)$/);
      return m[2] ? m[1] + marque + m[2] + marque + m[3] : ligne;
    }).join('\n');
  }
  function enLigneMd(el) {
    let s = '';
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) { s += n.nodeValue.replace(/\n/g, ' '); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { s += '\n'; return; }
      let dedans = enLigneMd(n);
      const st = n.style || {};
      const gras = tag === 'B' || tag === 'STRONG' || parseInt(st.fontWeight, 10) >= 600 || st.fontWeight === 'bold';
      const ital = tag === 'I' || tag === 'EM' || st.fontStyle === 'italic';
      if (gras) dedans = entourer('**', dedans);
      if (ital) dedans = entourer('*', dedans);
      s += dedans;
    });
    return s;
  }
  function versMarkdown() {
    const blocs = [];
    const ajouter = t => { t = t.replace(/\n+$/g, '').replace(/^\n+/g, ''); if (t.trim()) blocs.push(t); };
    editeur.childNodes.forEach(n => {
      if (n.nodeType === 3) { ajouter(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (/^H[1-4]$/.test(tag)) { const t = enLigneMd(n).replace(/\s*\n\s*/g, ' ').trim(); if (t) blocs.push('### ' + t); return; }
      if (tag === 'BLOCKQUOTE') {
        const morceaux = [...n.children].some(c => BLOCS.has(c.tagName)) ? [...n.children].map(enLigneMd) : [enLigneMd(n)];
        const lignes = morceaux.join('\n').replace(/\n+$/g, '').split('\n').filter(l => l.trim()).map(l => '> ' + l.trim());
        if (!lignes.length) return;
        // citations qui se suivent (une lettre, ligne après ligne) : un seul bloc
        const prec = n.previousElementSibling;
        if (prec && prec.tagName === 'BLOCKQUOTE' && blocs.length && /^> /.test(blocs[blocs.length - 1])) blocs[blocs.length - 1] += '\n' + lignes.join('\n');
        else blocs.push(lignes.join('\n'));
        return;
      }
      if (tag === 'UL' || tag === 'OL') { [...n.children].forEach(li => ajouter(enLigneMd(li))); return; }
      if (tag === 'BR') return;
      ajouter(enLigneMd(n));
    });
    return blocs.join('\n\n');
  }
  function remplirEditeur(md) {
    editeur.innerHTML = T.versHtml(md) || '<p><br></p>';
    marquerVide();
  }
  function marquerVide() { editeur.classList.toggle('vide', !editeur.textContent.trim() && !editeur.querySelector('img')); }

  /* Champs du panneau */
  let image = '';
  let menu = [];
  function remplirSaisons(valeur) {
    champSaison.innerHTML = `<option value="">Automatique (selon le numéro)</option>` +
      [...saisons].reverse().map(s => `<option value="${T.echapper(s.id)}">${T.echapper(s.nom)} · ${T.echapper(s.titre)}</option>`).join('');
    champSaison.value = valeur || '';
  }
  function etatChamps() {
    return {
      titre: champTitre.value.trim(),
      date: champDate.value,
      saison: champSaison.value,
      image,
      resume: champResume.value.trim(),
      menu: menu.filter(x => x.plat.trim()).map(x => ({ plat: x.plat.trim(), accord: x.accord.trim() }))
    };
  }
  // Espaces invisibles en fin de ligne ignorés : ils ne changent rien à l'affichage
  const normaliser = md => String(md || '').split('\n').map(l => l.replace(/[ \t ]+$/, '')).join('\n').trim();
  const empreinteDe = a => JSON.stringify([a.titre || '', normaliser(a.md), a.champs ? [a.champs.date, a.champs.saison, a.champs.image, a.champs.resume, a.champs.menu] : null]);
  const empreinteEpisode = e => empreinteDe({ titre: e.titre, md: e.corps, champs: { date: e.date, saison: e.saison, image: e.image, resume: e.resume, menu: e.menu.filter(x => x.plat) } });
  function empreinteActuelle() { const c = etatChamps(); return empreinteDe({ titre: c.titre, md: versMarkdown(), champs: { date: c.date, saison: c.saison, image: c.image, resume: c.resume, menu: c.menu } }); }

  async function afficherImage() {
    const img = $('[data-image-apercu]');
    img.hidden = !image;
    $('[data-image-vide]').hidden = !!image;
    $('[data-action="retirer-image"]').hidden = !image;
    if (image) img.src = await depot.urlApercu(image);
  }
  function afficherMenu() {
    const ol = $('[data-menu]');
    ol.innerHTML = menu.map((x, i) => `<li class="menu-ligne">
      <label class="visuellement-cache" for="plat-${i}">Plat ${i + 1}</label>
      <input id="plat-${i}" class="menu-plat" placeholder="Le plat (ex. Lièvre à la royale)" value="${T.echapper(x.plat)}" data-i="${i}" data-k="plat">
      <label class="visuellement-cache" for="accord-${i}">Vin ou accord du plat ${i + 1}</label>
      <input id="accord-${i}" class="menu-accord" placeholder="Le vin ou l'accord (facultatif)" value="${T.echapper(x.accord)}" data-i="${i}" data-k="accord">
      <button type="button" class="menu-retirer" data-retirer="${i}" aria-label="Retirer ce plat" title="Retirer ce plat">×</button>
    </li>`).join('');
  }
  $('[data-menu]').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.k) { menu[+t.dataset.i][t.dataset.k] = t.value; changement(); }
  });
  $('[data-menu]').addEventListener('click', e => {
    const b = e.target.closest('[data-retirer]');
    if (b) { menu.splice(+b.dataset.retirer, 1); afficherMenu(); changement(); }
  });
  $('[data-action="ajouter-plat"]').addEventListener('click', () => {
    menu.push({ plat: '', accord: '' }); afficherMenu(); changement();
    $$('.menu-plat').pop().focus();
  });

  /* Ouvrir un épisode (ou une page blanche) */
  async function ouvrir(fichier) {
    let e = null;
    if (fichier) {
      e = episodes.find(x => x.fichier === fichier);
      if (!e) { annoncer('Cet épisode est introuvable.'); location.hash = '#/'; return; }
    }
    courant = e ? { ...e } : { fichier: null, titre: '', date: mardiProchain(), publie: false, saison: saisons.length ? saisons[saisons.length - 1].id : '', image: '', resume: '', menu: [], corps: '', nouveau: true };
    montrer('ecriture');
    champTitre.value = courant.titre;
    ajusterTitre();
    remplirSaisons(courant.saison);
    champDate.value = courant.date || '';
    champResume.value = courant.resume || '';
    image = courant.image || '';
    menu = courant.menu.map(x => ({ ...x }));
    afficherMenu();
    await afficherImage();
    remplirEditeur(courant.corps);
    reference = courant.nouveau ? empreinteDe({ titre: '', md: '', champs: { date: courant.date, saison: courant.saison, image: '', resume: '', menu: [] } }) : empreinteEpisode(courant);
    document.title = (courant.titre || 'Nouvel épisode') + ' · Le carnet';
    proposerReprise();
    miseAJour();
    if (!courant.titre) champTitre.focus(); else editeur.focus();
  }

  /* Sauvegarde automatique : sur cet ordinateur, quelques secondes après chaque changement */
  const cleAuto = () => AUTO + (courant && courant.fichier ? courant.fichier : 'nouveau');
  let minuteurAuto;
  function changement() {
    marquerVide();
    miseAJour();
    clearTimeout(minuteurAuto);
    minuteurAuto = setTimeout(sauvegardeAuto, 1200);
  }
  function sauvegardeAuto() {
    if (!courant) return;
    if (empreinteActuelle() === reference) { stock.effacer(cleAuto()); return; }
    const c = etatChamps();
    const ok = stock.ecrire(cleAuto(), { fichier: courant.fichier, titre: c.titre, md: versMarkdown(), champs: { date: c.date, saison: c.saison, image: c.image, resume: c.resume, menu: c.menu }, quand: Date.now() });
    if (ok) etat(`Gardé sur cet ordinateur à ${heure()} · pas encore enregistré dans le carnet`, true);
  }
  function proposerReprise() {
    const bandeau = $('[data-bandeau]');
    const a = stock.lire(cleAuto());
    if (!a || empreinteDe(a) === reference) { bandeau.hidden = true; return; }
    bandeau.innerHTML = `<p>Vous aviez continué ce texte le ${dateMoyenne(iso(new Date(a.quand)))} à ${heure(new Date(a.quand))} sans l'enregistrer.</p>
      <button type="button" class="bouton-carnet bouton-petit" data-reprise-oui>Reprendre ce texte</button>
      <button type="button" class="lien-discret" data-reprise-non>Repartir de la version enregistrée</button>`;
    bandeau.hidden = false;
    $('[data-reprise-oui]').onclick = () => { appliquer(a); bandeau.hidden = true; annoncer('Votre texte est revenu.'); };
    $('[data-reprise-non]').onclick = () => { stock.effacer(cleAuto()); bandeau.hidden = true; };
  }
  function appliquer(a) {
    champTitre.value = a.titre || ''; ajusterTitre();
    if (a.champs) {
      champDate.value = a.champs.date || '';
      champSaison.value = a.champs.saison || '';
      champResume.value = a.champs.resume || '';
      image = a.champs.image || ''; afficherImage();
      menu = (a.champs.menu || []).map(x => ({ plat: x.plat || '', accord: x.accord || '' })); afficherMenu();
    }
    remplirEditeur(a.md || '');
    changement();
  }

  /* Barre d'état, compteur, bouton principal */
  function etat(texte, nonEnregistre = false) {
    const e = $('[data-etat]');
    e.textContent = texte;
    e.classList.toggle('non-enregistre', nonEnregistre);
  }
  function numeroPrevu(date) {
    const auj = aujourdHui();
    const autres = episodes.filter(e => e.fichier !== courant.fichier && e.publie && e.titre && e.date);
    if (!date) return null;
    const avant = autres.filter(e => e.date < date || (e.date === date && courant.fichier && e.fichier < courant.fichier));
    return (date <= auj ? avant.filter(e => e.date <= auj).length : avant.length) + 1;
  }
  function miseAJour() {
    if (!courant) return;
    const md = versMarkdown();
    const { mots, minutes } = T.mesure(md);
    const date = champDate.value;
    const auj = aujourdHui();
    const n = numeroPrevu(date);
    const s = champSaison.value ? saisons.find(x => x.id === champSaison.value) : ((n && saisons.find(x => n >= x.debut && (x.fin == null || n <= x.fin))) || saisons[saisons.length - 1]);
    $('[data-surtitre]').textContent = [n ? `Épisode ${n}` : 'Nouvel épisode', s ? `${s.nom} · ${s.lieu}` : ''].filter(Boolean).join(' · ');
    $('[data-compteur]').innerHTML = `<span>${nombre(mots)} mot${mots > 1 ? 's' : ''}</span><span>${minutes} min de lecture</span><span>${nombre(T.brut(md).length)} signes</span>`;
    const aide = $('[data-aide-date]');
    const enLigne = courant.publie && courant.date && courant.date <= auj && !courant.nouveau;
    if (!date) aide.textContent = 'Choisissez une date pour publier ou programmer l\'épisode.';
    else if (date > auj) aide.textContent = `Paraîtra tout seul le ${dateLongue(date)}, comme épisode ${n}.`;
    else aide.textContent = enLigne ? `En ligne depuis le ${dateLongue(courant.date)}.` : `Paraîtra dès la publication, comme épisode ${n}.`;
    const b = $('[data-publier]');
    if (!date) b.textContent = 'Publier';
    else if (date > auj) b.textContent = enLigne ? `Reprogrammer au ${dateMoyenne(date)}` : `Programmer au ${dateMoyenne(date)}`;
    else b.textContent = enLigne ? 'Mettre à jour en ligne' : 'Publier';
    $('[data-action="brouillon"]').textContent = courant.publie && !courant.nouveau ? 'Repasser en brouillon (retirer du site)' : 'Garder en brouillon';
    const modifie = empreinteActuelle() !== reference;
    if (!modifie) etat(courant.nouveau ? 'Nouvel épisode' : (statut(courant) === 'brouillon' ? 'Brouillon enregistré' : statut(courant) === 'programme' ? `Programmé le ${dateMoyenne(courant.date)}` : 'En ligne'), false);
    else etat(stock.lire(cleAuto()) ? 'Gardé sur cet ordinateur · pas encore enregistré dans le carnet' : 'Modifications en cours…', true);
  }

  /* Enregistrer dans le carnet */
  function nomFichier(date, titre) {
    let base = `${date || aujourdHui()}-${T.versSlug(titre).slice(0, 60).replace(/-+$/, '') || 'episode'}`;
    let nom = base + '.md', i = 2;
    while (episodes.some(e => e.fichier === nom)) nom = `${base}-${i++}.md`;
    return nom;
  }
  async function enregistrer(publie, { silencieux = false } = {}) {
    const c = etatChamps();
    const md = versMarkdown();
    if (!c.titre) { annoncer('Il manque le titre de l\'épisode.'); champTitre.focus(); return false; }
    if (publie && !md.trim()) { annoncer('L\'épisode est encore vide.'); editeur.focus(); return false; }
    if (publie && !c.date) { annoncer('Choisissez la date de parution.'); champDate.focus(); return false; }
    const ancienneCle = cleAuto();
    const fichier = courant.fichier || nomFichier(c.date, c.titre);
    const texte = T.ecrireEnTete({ titre: c.titre, date: c.date, publie, saison: c.saison, image: c.image, resume: c.resume, au_menu: c.menu }, md);
    try {
      etat('Enregistrement…', true);
      await depot.ecrire(fichier, texte);
    } catch (err) {
      etat('L\'enregistrement n\'a pas abouti. Votre texte reste gardé sur cet ordinateur.', true);
      annoncer('L\'enregistrement n\'a pas abouti. Rien n\'est perdu : réessayez dans un instant.');
      return false;
    }
    const e = lireEpisode(fichier, texte);
    const i = episodes.findIndex(x => x.fichier === fichier);
    if (i === -1) episodes.push(e); else episodes[i] = e;
    numeroter();
    stock.effacer(ancienneCle);
    courant = { ...e };
    reference = empreinteEpisode(e);
    stock.effacer(cleAuto());
    if (location.hash !== '#/episode/' + encodeURIComponent(fichier)) history.replaceState(null, '', '#/episode/' + encodeURIComponent(fichier));
    miseAJour();
    etat(`Enregistré à ${heure()}`, false);
    $('[data-bandeau]').hidden = true;
    if (!silencieux) {
      const st = statut(e);
      annoncer(st === 'brouillon' ? 'Brouillon enregistré. Il reste invisible sur le site.'
        : st === 'programme' ? `C'est programmé : l'épisode paraîtra le ${dateLongue(e.date)}.`
        : depot.type === 'local' ? 'Enregistré. Il apparaîtra sur le site à la prochaine mise à jour.' : 'Publié : l\'épisode sera en ligne dans quelques minutes.');
    }
    return true;
  }

  $('[data-publier]').addEventListener('click', async () => {
    const c = etatChamps();
    const auj = aujourdHui();
    const enLigne = courant.publie && !courant.nouveau && courant.date <= auj;
    if (c.date && c.date <= auj && !enLigne) {
      const ok = await confirmer('Publier cet épisode ?', `« ${c.titre || 'Sans titre'} » paraîtra sur le site, à la suite du feuilleton.`, 'Publier');
      if (!ok) return;
    }
    enregistrer(true);
  });
  $('[data-action="brouillon"]').addEventListener('click', async () => {
    if (courant.publie && !courant.nouveau) {
      const ok = await confirmer('Repasser en brouillon ?', 'L\'épisode sera retiré du site, mais il reste dans votre carnet. Vous pourrez le republier quand vous voudrez.', 'Repasser en brouillon');
      if (!ok) return;
    }
    enregistrer(false);
  });

  /* Retour au sommaire : rien ne se perd, le texte reste gardé */
  $('[data-action="retour"]').addEventListener('click', () => {
    sauvegardeAuto();
    sortirZen();
    location.hash = '#/';
  });
  window.addEventListener('beforeunload', e => {
    if (courant && !$('[data-ecran="ecriture"]').hidden && empreinteActuelle() !== reference) { sauvegardeAuto(); e.preventDefault(); e.returnValue = ''; }
  });

  /* Titre : grandit avec le texte, Entrée passe au texte */
  function ajusterTitre() { champTitre.style.height = 'auto'; champTitre.style.height = champTitre.scrollHeight + 'px'; }
  champTitre.addEventListener('input', () => {
    if (caseTypo.checked && champTitre.value.includes("'")) {
      const p = champTitre.selectionStart;
      champTitre.value = champTitre.value.replace(/'/g, '’');
      champTitre.setSelectionRange(p, p);
    }
    ajusterTitre(); changement();
  });
  champTitre.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); editeur.focus(); }
  });
  [champSaison, champDate, champResume].forEach(c => c.addEventListener('input', changement));
  $$('[data-date]').forEach(b => b.addEventListener('click', () => {
    champDate.value = b.dataset.date === 'mardi' ? mardiProchain() : aujourdHui();
    changement();
  }));

  /* ── Mise en forme ── */
  const outils = $('[data-outils]');
  outils.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  function blocActuel() { try { return String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch { return ''; } }
  outils.addEventListener('click', e => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    editeur.focus();
    const f = b.dataset.format;
    if (f === 'gras') document.execCommand('bold');
    else if (f === 'italique') document.execCommand('italic');
    else if (f === 'intertitre') document.execCommand('formatBlock', false, /^h[1-4]$/.test(blocActuel()) ? 'p' : 'h3');
    else if (f === 'citation') document.execCommand('formatBlock', false, blocActuel() === 'blockquote' ? 'p' : 'blockquote');
    else if (f === 'tiret') document.execCommand('insertText', false, '— ');
    else if (f === 'annuler') document.execCommand('undo');
    else if (f === 'retablir') document.execCommand('redo');
    etatOutils();
    changement();
  });
  function etatOutils() {
    const dans = editeur.contains(document.getSelection().anchorNode);
    const etatDe = (f, v) => { const b = $(`[data-format="${f}"]`); b.setAttribute('aria-pressed', String(dans && v)); };
    let gras = false, ital = false;
    try { gras = document.queryCommandState('bold'); ital = document.queryCommandState('italic'); } catch { /* rien */ }
    const bloc = blocActuel();
    etatDe('gras', gras); etatDe('italique', ital);
    etatDe('intertitre', /^h[1-4]$/.test(bloc)); etatDe('citation', bloc === 'blockquote');
  }
  document.addEventListener('selectionchange', () => { if (!$('[data-ecran="ecriture"]').hidden) etatOutils(); });

  /* ── Typographie française automatique ── */
  function caractereAvant() {
    const sel = document.getSelection();
    if (!sel.rangeCount) return '';
    const r = sel.getRangeAt(0);
    if (!r.collapsed) return '';
    const n = r.startContainer;
    if (n.nodeType === 3 && r.startOffset > 0) return n.nodeValue[r.startOffset - 1];
    return '';
  }
  // Dans une citation, Entrée sur une ligne vide fait revenir au texte normal (comme dans Word)
  function ligneVideDansCitation() {
    const sel = document.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    let n = sel.anchorNode;
    if (n && n.nodeType === 3) n = n.parentNode;
    const citation = n && n.closest && n.closest('blockquote');
    if (!citation || !editeur.contains(citation)) return null;
    const bloc = n.closest('p, div') && citation.contains(n.closest('p, div')) ? n.closest('p, div') : citation;
    const r = sel.getRangeAt(0).cloneRange();
    r.setStart(bloc, 0);
    const avant = r.toString();
    const ligne = avant.split('\n').pop();
    const finDeLigne = !sel.anchorNode.nodeValue || sel.anchorOffset >= (sel.anchorNode.nodeValue || '').length;
    return (!bloc.textContent.trim() || (!ligne.trim() && finDeLigne && /\n$|^$/.test(avant))) ? citation : null;
  }
  editeur.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(courant.publie && !courant.nouveau, {}); return; }
    if (e.key === 'Enter' && !e.shiftKey && ligneVideDansCitation()) {
      e.preventDefault();
      document.execCommand('formatBlock', false, 'p');
      changement();
      return;
    }
    if (!caseTypo.checked || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "'") { e.preventDefault(); document.execCommand('insertText', false, '’'); }
    else if (e.key === '"') {
      e.preventDefault();
      const avant = caractereAvant();
      document.execCommand('insertText', false, !avant || /[\s(\[ —]/.test(avant) ? '« ' : ' »');
    } else if (e.key === '-' && caractereAvant() === '-') {
      e.preventDefault();
      document.execCommand('delete');
      document.execCommand('insertText', false, '—');
    }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && courant && !$('[data-ecran="ecriture"]').hidden && e.target !== editeur) {
      e.preventDefault(); enregistrer(courant.publie && !courant.nouveau);
    }
  });
  editeur.addEventListener('input', changement);

  /* ── Coller depuis Word ou Internet : on garde le texte, le gras et l'italique ── */
  function nettoyer(noeud) {
    if (noeud.nodeType === 3) return T.echapper(noeud.nodeValue.replace(/\s*\n\s*/g, ' '));
    if (noeud.nodeType !== 1) return '';
    const tag = noeud.tagName;
    if (/^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|svg|IMG|O:P)$/i.test(tag)) return '';
    const dedans = [...noeud.childNodes].map(nettoyer).join('');
    if (tag === 'BR') return '<br>';
    const st = noeud.style || {};
    const gras = tag === 'B' || tag === 'STRONG' || parseInt(st.fontWeight, 10) >= 600 || st.fontWeight === 'bold';
    const ital = tag === 'I' || tag === 'EM' || st.fontStyle === 'italic';
    let s = dedans;
    if (gras && s.trim()) s = `<strong>${s}</strong>`;
    if (ital && s.trim()) s = `<em>${s}</em>`;
    if (BLOCS.has(tag)) {
      const contientBlocs = [...noeud.children].some(c => BLOCS.has(c.tagName));
      if (contientBlocs) return s;
      if (!s.replace(/<br>/g, '').trim()) return '';
      return /^H[1-4]$/.test(tag) ? `<h3>${s}</h3>` : tag === 'BLOCKQUOTE' ? `<blockquote>${s}</blockquote>` : `<p>${s}</p>`;
    }
    return s;
  }
  editeur.addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html');
    const texte = e.clipboardData.getData('text/plain');
    e.preventDefault();
    let propre;
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      propre = nettoyer(doc.body);
    } else {
      const paras = texte.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      propre = paras.length > 1 ? paras.map(p => `<p>${T.echapper(p).replace(/\n/g, '<br>')}</p>`).join('') : T.echapper(texte).replace(/\n/g, '<br>');
    }
    if (caseTypo.checked) propre = propre.replace(/'/g, '’').replace(/&#39;/g, '’');
    document.execCommand('insertHTML', false, propre);
    changement();
  });
  // Une image glissée dans le texte va dans le champ « Image de l'épisode »
  editeur.addEventListener('drop', e => {
    const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); recevoirImage(f); }
  });

  /* ── Image de l'épisode : réduite avant d'être rangée (site rapide) ── */
  async function reduire(fichier) {
    const bmp = await createImageBitmap(fichier);
    const max = 1600;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(ok, 'image/webp', 0.82));
  }
  async function recevoirImage(fichier) {
    if (!fichier || !fichier.type.startsWith('image/')) { annoncer('Choisissez une photo (JPEG, PNG ou WebP).'); return; }
    try {
      etat('Préparation de l\'image…', true);
      const blob = await reduire(fichier);
      const nom = `${T.versSlug(champTitre.value).slice(0, 40) || 'episode'}-${Date.now().toString(36)}.webp`;
      image = await depot.ecrireImage(nom, blob);
      await afficherImage();
      changement();
      annoncer('Image ajoutée.');
    } catch { annoncer('Cette image n\'a pas pu être ajoutée.'); miseAJour(); }
  }
  const zoneImage = $('[data-image-zone]');
  const fichierImage = $('[data-image-fichier]');
  $('[data-action="choisir-image"]').addEventListener('click', () => fichierImage.click());
  fichierImage.addEventListener('change', () => { recevoirImage(fichierImage.files[0]); fichierImage.value = ''; });
  zoneImage.addEventListener('dragover', e => { e.preventDefault(); zoneImage.classList.add('survol'); });
  zoneImage.addEventListener('dragleave', () => zoneImage.classList.remove('survol'));
  zoneImage.addEventListener('drop', e => { e.preventDefault(); zoneImage.classList.remove('survol'); recevoirImage(e.dataTransfer.files[0]); });
  $('[data-action="retirer-image"]').addEventListener('click', () => { image = ''; afficherImage(); changement(); });

  /* ── Plein écran ── */
  function sortirZen() {
    document.body.classList.remove('zen');
    $('[data-action="plein-ecran"]').setAttribute('aria-pressed', 'false');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  $('[data-action="plein-ecran"]').addEventListener('click', () => {
    if (document.body.classList.contains('zen')) { sortirZen(); return; }
    document.body.classList.add('zen');
    $('[data-action="plein-ecran"]').setAttribute('aria-pressed', 'true');
    document.documentElement.requestFullscreen?.().catch(() => {});
    editeur.focus();
    annoncer('Plein écran : Échap pour revenir.');
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { document.body.classList.remove('zen'); $('[data-action="plein-ecran"]').setAttribute('aria-pressed', 'false'); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('[data-voile="apercu"]').hidden || !$('[data-voile="versions"]').hidden) fermerVoiles();
      else if (document.body.classList.contains('zen')) sortirZen();
    }
  });

  /* ── Aperçu exact ── */
  async function htmlEpisode({ titre, md, date, saison, image: img, menu: m, numero }) {
    const s = saison ? saisons.find(x => x.id === saison) : ((numero && saisons.find(x => numero >= x.debut && (x.fin == null || numero <= x.fin))) || saisons[saisons.length - 1]);
    const { minutes } = T.mesure(md);
    const urlImg = img ? await depot.urlApercu(img) : '';
    return `<header class="episode-tete">
      ${s ? `<span class="tampon tampon-${T.echapper(s.id)} tampon-grand">${T.echapper(s.tampon)}</span>` : ''}
      <p class="surtitre">Épisode ${numero || '?'}</p>
      <h1 class="episode-titre">${T.echapper(titre || 'Sans titre')}</h1>
      <p class="episode-meta">${date ? dateLongue(date) : 'Date à choisir'} · ${minutes} min de lecture · par ${AUTEUR}</p>
    </header>
    ${urlImg ? `<figure class="episode-image"><img src="${T.echapper(urlImg)}" alt=""></figure>` : ''}
    <div class="episode-texte lettrine">${T.versHtml(md)}</div>
    <p class="episode-fin" aria-hidden="true">✦</p>
    ${T.menuHtml(m)}`;
  }
  function ouvrirVoile(nom) {
    const v = $(`[data-voile="${nom}"]`);
    v.hidden = false;
    v.scrollTop = 0;
    $('button', v).focus();
  }
  function fermerVoiles() { $$('[data-voile]').forEach(v => { v.hidden = true; }); editeur.focus(); }
  $$('[data-voile] [data-action="fermer"]').forEach(b => b.addEventListener('click', fermerVoiles));
  $('[data-action="apercu"]').addEventListener('click', async () => {
    const c = etatChamps();
    $('[data-apercu]').innerHTML = await htmlEpisode({ titre: c.titre, md: versMarkdown(), date: c.date, saison: c.saison, image: c.image, menu: c.menu, numero: numeroPrevu(c.date) });
    ouvrirVoile('apercu');
  });

  /* ── Anciennes versions ── */
  $('[data-action="versions"]').addEventListener('click', async () => {
    const ol = $('[data-versions]');
    const lecture = $('[data-version-lecture]');
    lecture.hidden = true;
    if (!courant.fichier) { ol.innerHTML = '<li class="versions-vide">Les versions apparaîtront après le premier enregistrement.</li>'; ouvrirVoile('versions'); return; }
    let liste = [];
    try { liste = await depot.versions(courant.fichier); } catch { /* rien */ }
    if (!liste.length) { ol.innerHTML = '<li class="versions-vide">Pas encore d\'ancienne version : elles s\'ajoutent à chaque enregistrement.</li>'; ouvrirVoile('versions'); return; }
    ol.innerHTML = liste.map((v, i) => {
      const e = lireEpisode(courant.fichier, v.texte);
      const d = new Date(v.date);
      return `<li><button type="button" data-version="${i}">${dateMoyenne(iso(d))} à ${heure(d)}<small>« ${T.echapper(e.titre)} » · ${nombre(T.mesure(e.corps).mots)} mots</small></button></li>`;
    }).join('');
    ol.onclick = async ev => {
      const b = ev.target.closest('[data-version]');
      if (!b) return;
      $$('[data-version]', ol).forEach(x => x.setAttribute('aria-current', String(x === b)));
      const v = liste[+b.dataset.version];
      const e = lireEpisode(courant.fichier, v.texte);
      lecture.innerHTML = `<p class="surtitre">« ${T.echapper(e.titre)} »</p><div class="episode-texte">${T.versHtml(e.corps)}</div>
        <button type="button" class="bouton-carnet bouton-petit" data-revenir>Revenir à cette version</button>`;
      lecture.hidden = false;
      $('[data-revenir]', lecture).onclick = () => {
        appliquer({ titre: e.titre, md: e.corps, champs: { date: e.date, saison: e.saison, image: e.image, resume: e.resume, menu: e.menu } });
        fermerVoiles();
        annoncer('Cette version est revenue dans la page. Enregistrez pour la garder.');
      };
      lecture.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    ouvrirVoile('versions');
  });

  /* ── Démarrage ── */
  window.Carnet = {
    // Pour les essais : démarrer avec un dépôt donné (ex. Depot.depotMemoire)
    demarrerAvec: d => demarrer(d),
    etat: () => ({ courant, episodes, markdown: versMarkdown(), modifie: courant ? empreinteActuelle() !== reference : false })
  };
  /* aperçu : démarrage en mode essai */
})();
