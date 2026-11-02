/* ============================================================
   LE CARNET D'ÉCRITURE · où sont rangés les épisodes
   Un « dépôt » sait lister, lire et enregistrer les épisodes,
   les images et les anciennes versions. Le carnet ne parle qu'à
   lui, ce qui permet de changer de mode sans toucher au reste :
   - local  : le dossier du site sur cet ordinateur (Chrome, Edge),
              pour construire et tester sans compte ni Internet ;
   - memoire : un dépôt de démonstration, pour les essais ;
   - github : le dépôt en ligne (le jour de la mise en ligne).
   ============================================================ */
(() => {
  const HISTOIRES = ['content', 'histoires'];
  const SAISONS = ['content', 'saisons.json'];
  const IMAGES = ['src', 'images', 'episodes'];
  const URL_IMAGES = '/cvigne-apercu/images/episodes/';
  const VERSIONS_MAX = 40;

  /* ── Petite base IndexedDB : dossier choisi et anciennes versions ── */
  let baseP = null;
  function base() {
    if (!baseP) baseP = new Promise((ok, ko) => {
      const r = indexedDB.open('carnet-emilien', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('reglages');
        const v = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        v.createIndex('fichier', 'fichier');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return baseP;
  }
  async function tx(magasin, mode, fn) {
    const db = await base();
    return new Promise((ok, ko) => {
      const t = db.transaction(magasin, mode);
      const res = fn(t.objectStore(magasin));
      t.oncomplete = () => ok(res && 'result' in res ? res.result : res);
      t.onerror = () => ko(t.error);
    });
  }
  const reglage = {
    lire: cle => tx('reglages', 'readonly', s => s.get(cle)),
    ecrire: (cle, val) => tx('reglages', 'readwrite', s => s.put(val, cle)),
    effacer: cle => tx('reglages', 'readwrite', s => s.delete(cle))
  };

  // Versions gardées sur cet ordinateur (mode local et démonstration)
  const versionsLocales = {
    async ajouter(fichier, texte) {
      await tx('versions', 'readwrite', s => s.add({ fichier, texte, date: Date.now() }));
      const toutes = await this.lister(fichier);
      const enTrop = toutes.slice(VERSIONS_MAX);
      if (enTrop.length) await tx('versions', 'readwrite', s => enTrop.forEach(v => s.delete(v.id)));
    },
    async lister(fichier) {
      const liste = await tx('versions', 'readonly', s => s.index('fichier').getAll(fichier));
      return (liste || []).sort((a, b) => b.date - a.date);
    }
  };

  /* ── Mode local : le dossier du site, par l'API « File System Access » ── */
  async function dossier(racine, chemin, creer = false) {
    let d = racine;
    for (const nom of chemin) d = await d.getDirectoryHandle(nom, { create: creer });
    return d;
  }

  function depotLocal(racine) {
    const lireFichier = async (chemin) => {
      const d = await dossier(racine, chemin.slice(0, -1));
      const f = await d.getFileHandle(chemin[chemin.length - 1]);
      return (await f.getFile()).text();
    };
    const ecrireFichier = async (chemin, contenu) => {
      const d = await dossier(racine, chemin.slice(0, -1), true);
      const f = await d.getFileHandle(chemin[chemin.length - 1], { create: true });
      const w = await f.createWritable();
      // le texte est toujours écrit sous forme de « Blob » (accepté par tous les navigateurs)
      await w.write(typeof contenu === 'string' ? new Blob([contenu], { type: 'text/plain;charset=utf-8' }) : contenu);
      await w.close();
    };
    const apercus = new Map();

    return {
      type: 'local',
      nom: racine.name,
      async episodes() {
        const d = await dossier(racine, HISTOIRES);
        const liste = [];
        for await (const [nom, h] of d.entries()) {
          if (h.kind === 'file' && nom.endsWith('.md')) liste.push({ fichier: nom, texte: await (await h.getFile()).text() });
        }
        return liste;
      },
      async saisons() { return JSON.parse(await lireFichier(SAISONS)); },
      lire: fichier => lireFichier([...HISTOIRES, fichier]),
      async existe(fichier) {
        try { await (await dossier(racine, HISTOIRES)).getFileHandle(fichier); return true; } catch { return false; }
      },
      async ecrire(fichier, texte) {
        // l'ancienne version est gardée avant d'écrire la nouvelle
        try {
          const avant = await lireFichier([...HISTOIRES, fichier]);
          if (avant !== texte) await versionsLocales.ajouter(fichier, avant);
        } catch { /* nouvel épisode */ }
        await ecrireFichier([...HISTOIRES, fichier], texte);
      },
      async ecrireImage(nom, blob) {
        await ecrireFichier([...IMAGES, nom], blob);
        apercus.set(URL_IMAGES + nom, URL.createObjectURL(blob));
        return URL_IMAGES + nom;
      },
      // Pour l'aperçu : une image du site affichée depuis le dossier local
      async urlApercu(chemin) {
        if (!chemin) return '';
        if (apercus.has(chemin)) return apercus.get(chemin);
        try {
          const morceaux = chemin.replace(/^\//, '').split('/');
          const f = await (await dossier(racine, ['src', ...morceaux.slice(0, -1)])).getFileHandle(morceaux[morceaux.length - 1]);
          const url = URL.createObjectURL(await f.getFile());
          apercus.set(chemin, url);
          return url;
        } catch { return chemin; }
      },
      versions: fichier => versionsLocales.lister(fichier)
    };
  }

  /* ── Mode démonstration : tout en mémoire (essais) ── */
  function depotMemoire({ fichiers = {}, saisons = [] } = {}) {
    const f = new Map(Object.entries(fichiers));
    const versions = new Map();
    const images = new Map();
    return {
      type: 'memoire',
      nom: 'démonstration',
      async episodes() { return [...f].map(([fichier, texte]) => ({ fichier, texte })); },
      async saisons() { return saisons; },
      async lire(fichier) { if (!f.has(fichier)) throw new Error('introuvable'); return f.get(fichier); },
      async existe(fichier) { return f.has(fichier); },
      async ecrire(fichier, texte) {
        if (f.has(fichier) && f.get(fichier) !== texte) {
          const l = versions.get(fichier) || [];
          l.unshift({ id: Date.now() + Math.random(), fichier, texte: f.get(fichier), date: Date.now() });
          versions.set(fichier, l.slice(0, VERSIONS_MAX));
        }
        f.set(fichier, texte);
      },
      async ecrireImage(nom, blob) { const u = URL.createObjectURL(blob); images.set(URL_IMAGES + nom, u); return URL_IMAGES + nom; },
      async urlApercu(chemin) { return images.get(chemin) || chemin; },
      async versions(fichier) { return versions.get(fichier) || []; },
      _fichiers: f
    };
  }

  /* ── Mode en ligne : le dépôt GitHub du site, par l'API GitHub ──
     Chaque enregistrement est un « commit » sur la branche du site ; la
     fabrication automatique (GitHub Actions) remet le site en ligne.
     La clé (jeton GitHub limité à ce seul dépôt) reste dans ce navigateur. */
  function base64Texte(texte) {
    const octets = new TextEncoder().encode(texte);
    let s = '';
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const base64Blob = blob => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });

  function depotGithub({ repo, branche, jeton }) {
    const chemin = parties => parties.map(encodeURIComponent).join('/');
    async function api(url, { brut = false, ...options } = {}) {
      const rep = await fetch(`https://api.github.com/repos/${repo}/${url}`, {
        ...options,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${jeton}`,
          Accept: brut ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.body ? { 'Content-Type': 'application/json' } : {})
        }
      });
      if (!rep.ok) { const err = new Error(`GitHub ${rep.status}`); err.statut = rep.status; throw err; }
      return brut ? rep.text() : rep.json();
    }
    const lireFichier = (parties, ref = branche) => api(`contents/${chemin(parties)}?ref=${encodeURIComponent(ref)}`, { brut: true });
    // L'empreinte (sha) du fichier actuel est demandée juste avant d'écrire : pas de conflit entre deux enregistrements
    async function empreinte(parties) {
      try { return (await api(`contents/${chemin(parties)}?ref=${encodeURIComponent(branche)}`)).sha; }
      catch (err) { if (err.statut === 404) return null; throw err; }
    }
    async function ecrireFichier(parties, contenu64, message) {
      for (let essai = 0; essai < 2; essai++) {
        const sha = await empreinte(parties);
        try {
          return await api(`contents/${chemin(parties)}`, { method: 'PUT', body: JSON.stringify({ message, content: contenu64, branch: branche, ...(sha ? { sha } : {}) }) });
        } catch (err) { if (err.statut !== 409 || essai) throw err; }
      }
    }
    const apercus = new Map();

    return {
      type: 'github',
      nom: 'en ligne',
      // Vérifie la clé : elle doit pouvoir lire le dépôt du site
      async verifier() { await api(`contents/${chemin(SAISONS)}?ref=${encodeURIComponent(branche)}`); },
      async episodes() {
        const liste = (await api(`contents/${chemin(HISTOIRES)}?ref=${encodeURIComponent(branche)}`)).filter(f => f.type === 'file' && f.name.endsWith('.md'));
        return Promise.all(liste.map(async f => ({ fichier: f.name, texte: await lireFichier([...HISTOIRES, f.name]) })));
      },
      async saisons() { return JSON.parse(await lireFichier(SAISONS)); },
      lire: fichier => lireFichier([...HISTOIRES, fichier]),
      async existe(fichier) { return (await empreinte([...HISTOIRES, fichier])) !== null; },
      async ecrire(fichier, texte) {
        const titre = (texte.match(/^titre:\s*"?(.*?)"?\s*$/m) || [])[1] || fichier;
        await ecrireFichier([...HISTOIRES, fichier], base64Texte(texte), `Carnet : « ${titre} »`);
      },
      async ecrireImage(nom, blob) {
        await ecrireFichier([...IMAGES, nom], await base64Blob(blob), `Carnet : image ${nom}`);
        apercus.set(URL_IMAGES + nom, URL.createObjectURL(blob));
        return URL_IMAGES + nom;
      },
      // Une image ajoutée à l'instant n'est sur le site qu'après la fabrication : on la montre depuis ce navigateur
      async urlApercu(chemin) { return apercus.get(chemin) || chemin; },
      // Les anciennes versions sont l'historique GitHub du fichier (le plus récent d'abord, sans la version actuelle)
      async versions(fichier) {
        const commits = await api(`commits?path=${encodeURIComponent([...HISTOIRES, fichier].join('/'))}&sha=${encodeURIComponent(branche)}&per_page=${VERSIONS_MAX}`);
        const anciens = commits.slice(1, 16);
        const textes = await Promise.all(anciens.map(c => lireFichier([...HISTOIRES, fichier], c.sha).catch(() => null)));
        return anciens.map((c, i) => ({ id: c.sha, fichier, texte: textes[i], date: new Date(c.commit.committer.date).getTime() })).filter(v => v.texte !== null);
      }
    };
  }

  // La clé est gardée dans ce navigateur (IndexedDB), jamais dans les fichiers du site
  async function depotEnLigne(jetonNeuf) {
    const reglages = await (await fetch('/cvigne-apercu/carnet/depot.json', { cache: 'no-store' })).json();
    const jeton = jetonNeuf || await reglage.lire('jeton').catch(() => null);
    if (!jeton) return null;
    const d = depotGithub({ ...reglages, jeton: jeton.trim() });
    await d.verifier();
    if (jetonNeuf) await reglage.ecrire('jeton', jeton.trim());
    return d;
  }

  /* ── Ouvrir ou retrouver le dossier du site (mode local) ── */
  const localPossible = 'showDirectoryPicker' in window;

  async function verifierDossier(racine) {
    // On s'assure que c'est bien le dossier du site (content/histoires)
    await dossier(racine, HISTOIRES);
    await racine.getDirectoryHandle('content').then(c => c.getFileHandle('saisons.json'));
  }

  async function choisirDossier() {
    const racine = await window.showDirectoryPicker({ id: 'site-emilien', mode: 'readwrite' });
    await verifierDossier(racine);
    await reglage.ecrire('dossier', racine);
    return depotLocal(racine);
  }

  // Retrouve le dossier déjà choisi. « demander » : redemande l'autorisation
  // (seulement après un clic, le navigateur l'exige).
  async function dossierMemorise(demander = false) {
    if (!localPossible) return null;
    const racine = await reglage.lire('dossier').catch(() => null);
    if (!racine) return null;
    let etat = await racine.queryPermission({ mode: 'readwrite' });
    if (etat !== 'granted' && demander) etat = await racine.requestPermission({ mode: 'readwrite' });
    if (etat !== 'granted') return { aAutoriser: true, nom: racine.name };
    await verifierDossier(racine);
    return depotLocal(racine);
  }

  // Sur le vrai site, le carnet travaille en ligne ; sur cet ordinateur (localhost), dans le dossier du site.
  // « ?enligne » force le mode en ligne en local, pour l'essayer avant la mise en ligne.
  const enLigne = /[?&]enligne\b/.test(location.search) || !['localhost', '127.0.0.1', ''].includes(location.hostname);

  window.Depot = { localPossible, enLigne, choisirDossier, dossierMemorise, oublierDossier: () => reglage.effacer('dossier'), depotMemoire, depotLocal, depotGithub, depotEnLigne, oublierJeton: () => reglage.effacer('jeton') };
})();
