/* ================================================================
   VALIDATION DE FORMULAIRE · Sud Web Project
   Module réutilisable, sans dépendance, pour tous les sites SWP.

   Utilisation :
     1. <form data-valider> … </form>
     2. <script src="js/validation-formulaire.js" defer></script>
     3. Chaque champ est dans un conteneur (par défaut .fg) avec son <label>.

   Les règles viennent des attributs HTML :
     required · type="email" · type="tel" · minlength · maxlength
     data-min="20"          longueur minimale (après suppression des espaces)
     data-message-requis     message personnalisé si le champ est vide
     data-message-invalide   message personnalisé si le format est faux

   Ce que fait le module :
     · remplace les bulles du navigateur par des messages en français,
       sous chaque champ, reliés au champ pour les lecteurs d'écran ;
     · affiche l'erreur quand on quitte le champ, puis la retire dès que
       la saisie devient correcte ;
     · à l'envoi : vérifie tout, place le curseur sur le premier champ
       à corriger et bloque les autres scripts d'envoi (EmailJS, fetch…) ;
     · refuse les champs remplis uniquement d'espaces ;
     · repère les fautes courantes d'adresse (gmial.com, hotmial.fr…) ;
     · piège à robots (champ invisible) et envoi trop rapide bloqués.

   Sans JavaScript, la validation native du navigateur reste active.
   ================================================================ */

(function () {
    'use strict';

    var DELAI_MINIMUM_MS = 3000; // un humain ne remplit pas un formulaire en moins de 3 s

    var MESSAGES = {
        requis: 'Ce champ est à compléter.',
        requisChoix: 'Choisissez une option dans la liste.',
        email: 'Cette adresse semble incomplète (exemple : prenom@domaine.fr).',
        tel: 'Indiquez un numéro à 10 chiffres, ou au format international (+33…).',
        min: 'Quelques mots de plus nous aideront à vous répondre ({n} caractères minimum).',
        max: 'Ce texte est un peu long ({n} caractères maximum).',
        suggestion: 'Vouliez-vous dire ',
        resume: function (n) {
            return n > 1 ? n + ' champs sont à corriger.' : 'Un champ est à corriger.';
        }
    };

    /* Fautes de frappe fréquentes sur les messageries françaises */
    var DOMAINES = {
        'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.fr': 'gmail.com', 'gamil.com': 'gmail.com',
        'gmail.co': 'gmail.com', 'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com',
        'hotmial.fr': 'hotmail.fr', 'hotmai.fr': 'hotmail.fr', 'hotmal.fr': 'hotmail.fr', 'hotmail.f': 'hotmail.fr',
        'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
        'outlok.fr': 'outlook.fr', 'outlook.f': 'outlook.fr', 'outlok.com': 'outlook.com',
        'orange.f': 'orange.fr', 'orage.fr': 'orange.fr', 'wanado.fr': 'wanadoo.fr', 'wanadoo.f': 'wanadoo.fr',
        'yahoo.f': 'yahoo.fr', 'yaho.fr': 'yahoo.fr', 'yahou.fr': 'yahoo.fr',
        'icloud.fr': 'icloud.com', 'iclou.com': 'icloud.com', 'free.f': 'free.fr', 'sfr.f': 'sfr.fr'
    };

    var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    function valeur(champ) {
        return (champ.value || '').trim();
    }

    function conteneur(champ, form) {
        var sel = form.getAttribute('data-conteneur') || '.fg';
        return champ.closest(sel) || champ.parentNode;
    }

    function suggestionEmail(v) {
        var at = v.lastIndexOf('@');
        if (at < 1) return null;
        var domaine = v.slice(at + 1).toLowerCase();
        return DOMAINES[domaine] ? v.slice(0, at + 1) + DOMAINES[domaine] : null;
    }

    function telValide(v) {
        var chiffres = v.replace(/[\s.\-()]/g, '');
        if (/^0[1-9]\d{8}$/.test(chiffres)) return true;           // 06 12 34 56 78
        if (/^\+33[1-9]\d{8}$/.test(chiffres)) return true;        // +33 6 12 34 56 78
        if (/^(\+|00)[1-9]\d{7,14}$/.test(chiffres)) return true;  // autres pays
        return false;
    }

    /* Renvoie le message d'erreur du champ, ou '' s'il est correct */
    function erreur(champ) {
        var v = valeur(champ);
        var type = (champ.getAttribute('type') || champ.tagName).toLowerCase();

        if (!v) {
            if (!champ.required) return '';
            return champ.getAttribute('data-message-requis') ||
                (type === 'select' ? MESSAGES.requisChoix : MESSAGES.requis);
        }

        var invalide = champ.getAttribute('data-message-invalide');

        if (type === 'email' && !RE_EMAIL.test(v)) return invalide || MESSAGES.email;
        if (type === 'tel' && !telValide(v)) return invalide || MESSAGES.tel;

        var min = parseInt(champ.getAttribute('data-min') || champ.getAttribute('minlength'), 10);
        if (min && v.length < min) return invalide || MESSAGES.min.replace('{n}', min);

        var max = parseInt(champ.getAttribute('maxlength'), 10);
        if (max && v.length > max) return MESSAGES.max.replace('{n}', max);

        return '';
    }

    function zoneErreur(champ, form) {
        var id = (champ.id || champ.name) + '-erreur';
        var zone = document.getElementById(id);
        if (!zone) {
            zone = document.createElement('p');
            zone.id = id;
            zone.className = 'fg-erreur';
            zone.setAttribute('aria-live', 'polite');
            conteneur(champ, form).appendChild(zone);
            var decrit = champ.getAttribute('aria-describedby');
            champ.setAttribute('aria-describedby', decrit ? decrit + ' ' + id : id);
        }
        return zone;
    }

    function afficher(champ, form) {
        var message = erreur(champ);
        var boite = conteneur(champ, form);
        var zone = zoneErreur(champ, form);

        boite.classList.toggle('is-invalide', !!message);
        champ.setAttribute('aria-invalid', message ? 'true' : 'false');
        zone.textContent = message;

        /* Faute de frappe probable dans une adresse pourtant bien formée */
        if (!message && (champ.getAttribute('type') || '').toLowerCase() === 'email') {
            var proposition = suggestionEmail(valeur(champ));
            if (proposition) {
                var bouton = document.createElement('button');
                bouton.type = 'button';
                bouton.className = 'fg-suggestion';
                bouton.textContent = proposition;
                bouton.addEventListener('click', function () {
                    champ.value = proposition;
                    afficher(champ, form);
                    champ.focus();
                });
                zone.textContent = MESSAGES.suggestion;
                zone.appendChild(bouton);
                zone.appendChild(document.createTextNode(' ?'));
            }
        }
        return !message;
    }

    function piegeARobots(form) {
        var piege = document.createElement('div');
        piege.setAttribute('aria-hidden', 'true');
        piege.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
        piege.innerHTML = '<label>Ne pas remplir<input type="text" name="site_web_confirmation" tabindex="-1" autocomplete="off"></label>';
        form.appendChild(piege);
        return piege.querySelector('input');
    }

    function annonce(form) {
        var zone = document.createElement('p');
        zone.className = 'fg-resume';
        zone.setAttribute('role', 'status');
        zone.setAttribute('aria-live', 'polite');
        var bouton = form.querySelector('[type="submit"]');
        if (bouton) bouton.parentNode.insertBefore(zone, bouton);
        else form.appendChild(zone);
        return zone;
    }

    function brancher(form) {
        if (form.__valide) return;
        form.__valide = true;
        form.setAttribute('novalidate', ''); // nos messages remplacent les bulles du navigateur

        var ouvertureMs = Date.now();
        var piege = piegeARobots(form);
        var resume = annonce(form);
        var champs = Array.prototype.slice.call(
            form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([name="site_web_confirmation"]), select, textarea')
        );

        champs.forEach(function (champ) {
            var touche = false;
            champ.addEventListener('blur', function () {
                if (champ.tagName !== 'SELECT' && champ.type !== 'checkbox' && champ.type !== 'radio') {
                    champ.value = champ.value.trim();
                }
                if (champ.value || touche) { touche = true; afficher(champ, form); }
            });
            champ.addEventListener(champ.tagName === 'SELECT' ? 'change' : 'input', function () {
                /* Une fois l'erreur montrée, elle disparaît dès que c'est corrigé */
                if (conteneur(champ, form).classList.contains('is-invalide')) afficher(champ, form);
            });
        });

        /* Phase de capture : on passe avant tout autre script d'envoi */
        form.addEventListener('submit', function (e) {
            var robot = piege.value !== '' || Date.now() - ouvertureMs < DELAI_MINIMUM_MS;
            if (robot) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            var fautifs = champs.filter(function (champ) { return !afficher(champ, form); });
            if (fautifs.length) {
                e.preventDefault();
                e.stopImmediatePropagation();
                resume.textContent = MESSAGES.resume(fautifs.length);
                fautifs[0].focus({ preventScroll: true });
                fautifs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            resume.textContent = '';
        }, true);
    }

    function init() {
        Array.prototype.forEach.call(document.querySelectorAll('form[data-valider]'), brancher);
    }

    /* Accessible aux autres scripts : SWPValidation.brancher(monFormulaire) */
    window.SWPValidation = { brancher: brancher, messages: MESSAGES };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
