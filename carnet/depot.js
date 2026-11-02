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

  window.Depot = { localPossible, choisirDossier, dossierMemorise, oublierDossier: () => reglage.effacer('dossier'), depotMemoire, depotLocal };
})();
