/* ============================================================
   TEXTE · le même convertisseur pour le site et pour le carnet
   d'écriture : ce que C. Vigné voit dans l'aperçu est exactement
   ce qui sera publié.
   Markdown simple : paragraphes, retours à la ligne, gras,
   italique, intertitres (## et ###), citations (>).
   Fonctionne dans Node (construction du site) et dans le navigateur.
   ============================================================ */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.Texte = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  function echapper(t) {
    return String(t ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function enLigne(t) {
    return echapper(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  }

  function versHtml(md) {
    return String(md || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(bloc => bloc.trim()).filter(Boolean).map(bloc => {
      if (/^>\s?/.test(bloc)) {
        return `<blockquote><p>${bloc.split('\n').map(l => enLigne(l.replace(/^>\s?/, ''))).join('<br>')}</p></blockquote>`;
      }
      const titre = bloc.match(/^(#{2,3})\s+(.+)$/);
      if (titre) return `<h${titre[1].length}>${enLigne(titre[2])}</h${titre[1].length}>`;
      return `<p>${bloc.split('\n').map(enLigne).join('<br>')}</p>`;
    }).join('\n');
  }

  function brut(md) {
    return String(md || '').replace(/[*_>#]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Nombre de mots et minutes de lecture (220 mots par minute, comme le site)
  function mesure(md) {
    const t = brut(md);
    const mots = t ? t.split(' ').length : 0;
    return { mots, minutes: Math.max(1, Math.round(mots / 220)) };
  }

  // Carte « Au menu de cet épisode » : rien si la liste est vide
  function menuHtml(menu) {
    const lignes = (menu || []).filter(x => x && String(x.plat || '').trim());
    if (!lignes.length) return '';
    return `<aside class="au-menu" aria-label="Au menu de cet épisode">
    <p class="surtitre">Au menu de cet épisode</p>
    <ul class="au-menu-liste">
      ${lignes.map(x => `<li><span class="au-menu-plat">${echapper(String(x.plat).trim())}</span>${String(x.accord || '').trim() ? `<span class="au-menu-accord">${echapper(String(x.accord).trim())}</span>` : ''}</li>`).join('\n      ')}
    </ul>
  </aside>`;
  }

  // ── En-tête des fichiers d'épisode (« front matter ») ──────
  // Lecture : « clé: valeur », plus les listes écrites par le carnet ou
  // par Sveltia (au_menu : une liste de { plat, accord }).
  function valeurSimple(v) {
    v = v.trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }

  function lireEnTete(texte) {
    const tout = String(texte || '').replace(/\r\n?/g, '\n');
    const m = tout.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const data = {};
    if (!m) return { data, corps: tout.trim() };
    let liste = null, element = null;
    m[1].split('\n').forEach(ligne => {
      if (!ligne.trim()) return;
      const tiret = ligne.match(/^\s*-\s+(.*)$/);
      if (tiret && liste) {
        const paire = tiret[1].match(/^([\w-]+):\s*(.*)$/);
        if (paire) { element = { [paire[1]]: valeurSimple(paire[2]) }; liste.push(element); }
        else { element = null; liste.push(valeurSimple(tiret[1])); }
        return;
      }
      const suite = ligne.match(/^\s{2,}([\w-]+):\s*(.*)$/);
      if (suite && element) { element[suite[1]] = valeurSimple(suite[2]); return; }
      const i = ligne.indexOf(':');
      if (i === -1) return;
      const cle = ligne.slice(0, i).trim();
      const val = ligne.slice(i + 1).trim();
      if (val === '' || val === '[]') { liste = []; element = null; data[cle] = val === '' ? liste : []; return; }
      liste = null; element = null;
      data[cle] = valeurSimple(val);
    });
    // « titre: » sans valeur ni liste : une chaîne vide, pas une liste
    Object.keys(data).forEach(k => { if (Array.isArray(data[k]) && !data[k].length) data[k] = ''; });
    return { data, corps: m[2].trim() };
  }

  // Écriture : toujours entre guillemets, ordre fixe, champs vides omis
  function guillemets(v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"'; }
  function ecrireEnTete(data, corps) {
    const l = ['---'];
    l.push('titre: ' + guillemets(data.titre || ''));
    l.push('date: ' + guillemets(data.date || ''));
    l.push('publie: ' + (data.publie === false ? 'false' : 'true'));
    if (data.saison) l.push('saison: ' + guillemets(data.saison));
    if (data.image) l.push('image: ' + guillemets(data.image));
    if (data.resume) l.push('resume: ' + guillemets(data.resume));
    const menu = (data.au_menu || []).filter(x => x && String(x.plat || '').trim());
    if (menu.length) {
      l.push('au_menu:');
      menu.forEach(x => {
        l.push('  - plat: ' + guillemets(String(x.plat).trim()));
        if (String(x.accord || '').trim()) l.push('    accord: ' + guillemets(String(x.accord).trim()));
      });
    }
    l.push('---');
    return l.join('\n') + '\n' + String(corps || '').trim() + '\n';
  }

  function versSlug(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  return { echapper, enLigne, versHtml, brut, mesure, menuHtml, lireEnTete, ecrireEnTete, versSlug };
});
