'use strict';

// Muntsoorten in centen. `begin` = standaard beginstapel per speler (samen € 5).
const MUNTEN = [
  { c: 5, tekst: '5', kleur: 'rood', begin: 10 },
  { c: 10, tekst: '10', kleur: 'blauw', begin: 10 },
  { c: 25, tekst: '25', kleur: 'groen', begin: 4 },
  { c: 50, tekst: '50', kleur: 'zwart', begin: 5 },
  { c: 100, tekst: '100', kleur: 'paars', begin: 0 },
];
const MAX_SPELERS = 10;
const MAX_MUNTEN = 999;
const OPSLAG = 'pokermuntjes-v1';

const $ = (id) => document.getElementById(id);
const euro = (c) => (c < 0 ? '−' : '') + '€ ' + (Math.abs(c) / 100).toFixed(2).replace('.', ',');
const waarde = (n) => MUNTEN.reduce((som, m) => som + m.c * (n[m.c] || 0), 0);
const leeg = () => Object.fromEntries(MUNTEN.map((m) => [m.c, 0]));
const muntHtml = (m, extra = '') => `<span class="munt ${m.kleur} ${extra}" aria-hidden="true"><span>${m.tekst}</span></span>`;

let staat = laad();
let vorige = null; // stand vóór de laatste actie, voor Ongedaan
let meldTimer = null;

function laad() {
  try {
    const s = JSON.parse(localStorage.getItem(OPSLAG));
    if (s && s.fase && s.stapel && Array.isArray(s.spelers)) return laadAanvullen(s);
  } catch (e) { /* kapotte opslag: opnieuw beginnen */ }
  return { fase: 'start', namen: [], aantal: 4, stapel: Object.fromEntries(MUNTEN.map((m) => [m.c, m.begin])), spelers: [], tel: 0 };
}
// Spellen van vóór de dagen-functie aanvullen
function laadAanvullen(s) {
  s.dag = s.dag || 1;
  s.dagen = s.dagen || [];
  s.namen = s.namen || [];
  s.aantal = s.aantal || 4;
  for (const p of s.spelers) {
    p.stand = p.stand || { ...s.stapel };
    p.inkStart = p.inkStart || 1;
    p.eind = p.eind || leeg();
  }
  return s;
}

function bewaar() {
  staat.opgeslagen = Date.now();
  try { localStorage.setItem(OPSLAG, JSON.stringify(staat)); } catch (e) {
    melden('Opslaan lukt niet op deze telefoon. Staat privé-surfen aan?', false);
  }
}
const klok = (t) => new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
const datumTijd = (t) => new Date(t).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/* Stepper-rij met − [getal] +; getal is ook in te typen */
function muntRij(m, aantal, opWijzig) {
  const rij = document.createElement('div');
  rij.className = 'munt-rij';
  rij.innerHTML = `${muntHtml(m)}<span class="munt-naam">${m.tekst} cent</span>
    <div class="stapper">
      <button type="button" data-d="-1" aria-label="Eén muntje van ${m.tekst} minder">−</button>
      <input inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Aantal muntjes van ${m.tekst} cent">
      <button type="button" data-d="1" aria-label="Eén muntje van ${m.tekst} meer">+</button>
    </div>`;
  const inp = rij.querySelector('input');
  const zet = (v) => {
    v = Math.min(MAX_MUNTEN, Math.max(0, v | 0));
    inp.value = v;
    rij.classList.toggle('nul', v === 0);
    rij.querySelector('[data-d="-1"]').disabled = v === 0;
    opWijzig(v);
  };
  inp.value = aantal;
  rij.classList.toggle('nul', aantal === 0);
  rij.querySelector('[data-d="-1"]').disabled = aantal === 0;
  rij.querySelectorAll('button').forEach((b) => {
    b.onclick = () => zet((parseInt(inp.value, 10) || 0) + Number(b.dataset.d));
  });
  inp.addEventListener('focus', () => inp.select());
  inp.addEventListener('input', () => {
    const v = parseInt(inp.value.replace(/\D/g, ''), 10);
    if (inp.value === '') { opWijzig(0); return; }
    zet(Number.isFinite(v) ? v : 0);
  });
  inp.addEventListener('blur', () => zet(parseInt(inp.value, 10) || 0));
  return rij;
}

/* ---------- 1. Start ---------- */
function tekenStart() {
  const oud = [...$('namen').querySelectorAll('input')].map((i) => i.value);
  $('namen').innerHTML = '';
  for (let i = 0; i < staat.aantal; i++) {
    const inp = document.createElement('input');
    inp.placeholder = 'Speler ' + (i + 1);
    inp.value = oud[i] ?? staat.namen[i] ?? '';
    inp.maxLength = 14;
    inp.autocomplete = 'off';
    inp.enterKeyHint = 'next';
    inp.setAttribute('aria-label', 'Naam speler ' + (i + 1));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); (inp.nextElementSibling || inp).focus(); }
    });
    $('namen').appendChild(inp);
  }
  $('aantal').textContent = staat.aantal;
  $('minSpeler').disabled = staat.aantal <= 2;
  $('plusSpeler').disabled = staat.aantal >= MAX_SPELERS;

  if (!$('stapel').children.length) {
    for (const m of MUNTEN) {
      $('stapel').appendChild(muntRij(m, staat.stapel[m.c] || 0, (v) => {
        staat.stapel[m.c] = v;
        bewaar();
        tekenStapelWaarde();
      }));
    }
  }
  tekenStapelWaarde();
}
function tekenStapelWaarde() {
  const w = waarde(staat.stapel);
  $('stapelWaarde').textContent = euro(w);
  $('beginKnop').disabled = w === 0;
}
function bewaarNamen() {
  staat.namen = [...$('namen').querySelectorAll('input')].map((i) => i.value.trim());
}

$('minSpeler').onclick = () => { bewaarNamen(); staat.aantal = Math.max(2, staat.aantal - 1); bewaar(); tekenStart(); };
$('plusSpeler').onclick = () => { bewaarNamen(); staat.aantal = Math.min(MAX_SPELERS, staat.aantal + 1); bewaar(); tekenStart(); };
$('namen').addEventListener('input', () => { bewaarNamen(); bewaar(); });

$('beginKnop').onclick = () => {
  bewaarNamen();
  staat.spelers = staat.namen.map((naam, i) => ({ naam: naam || 'Speler ' + (i + 1), inkopen: 1, inkStart: 1, stand: { ...staat.stapel }, eind: leeg() }));
  staat.dag = 1;
  staat.dagen = [];
  staat.waard = waarde(staat.stapel); // waarde van één inkoop, vast voor dit spel
  staat.tel = 0;
  staat.fase = 'spel';
  bewaar();
  toon();
};

/* ---------- 2. Spel ---------- */
function tekenSpel() {
  const lijst = $('spelers');
  lijst.innerHTML = '';
  let totaal = 0;
  staat.spelers.forEach((s, i) => {
    totaal += s.inkopen;
    const li = document.createElement('li');
    li.className = 'speler';
    li.innerHTML = `<div class="sp-info"><span class="naam"></span><span class="inleg"></span></div>
      <button type="button" class="inkoop">+ Inkopen</button>`;
    li.querySelector('.naam').textContent = s.naam;
    if (staat.dag > 1) {
      const vandaag = s.inkopen - s.inkStart;
      li.querySelector('.inleg').textContent = `begint met ${euro(waarde(s.stand))}` + (vandaag ? ` · vandaag ${vandaag}× gekocht` : '');
      const rij = document.createElement('span');
      rij.className = 'uitdelen';
      for (const m of [...MUNTEN].reverse()) {
        if (!s.stand[m.c]) continue;
        const t = document.createElement('span');
        t.className = m.kleur;
        t.textContent = s.stand[m.c] + '× ' + m.tekst;
        rij.appendChild(t);
      }
      li.querySelector('.sp-info').appendChild(rij);
    } else {
      li.querySelector('.inleg').textContent = euro(s.inkopen * staat.waard) + (s.inkopen > 1 ? ` · ${s.inkopen}× gekocht` : ' · beginstapel');
    }
    li.querySelector('.inkoop').onclick = () => {
      vorige = JSON.stringify(staat);
      s.inkopen++;
      bewaar();
      tekenSpel();
      melden(s.naam + ' koopt in voor ' + euro(staat.waard), true);
    };
    lijst.appendChild(li);
  });
  $('opgeslagen').textContent = staat.opgeslagen ? '✓ Automatisch opgeslagen om ' + klok(staat.opgeslagen) : '';
  $('potKop').textContent = staat.dag > 1 ? `Dag ${staat.dag} · in de pot` : 'In de pot';
  $('pot').textContent = euro(totaal * staat.waard);
  const extra = totaal - staat.spelers.length;
  $('potUitleg').textContent = staat.spelers.length + ' spelers' + (extra ? ` · ${extra}× ingekocht` : '') + ' · inkoop ' + euro(staat.waard);
}

$('ongedaan').onclick = () => {
  if (!vorige) return;
  staat = JSON.parse(vorige);
  vorige = null;
  bewaar();
  toon();
};

function melden(tekst, metOngedaan) {
  $('meldTekst').textContent = tekst;
  $('ongedaan').hidden = !metOngedaan;
  $('melding').hidden = false;
  clearTimeout(meldTimer);
  meldTimer = setTimeout(() => { $('melding').hidden = true; }, 4500);
}

$('naarTellen').onclick = () => { staat.fase = 'tellen'; staat.tel = 0; bewaar(); toon(); };

/* ---------- 3. Tellen ---------- */
const pot = () => staat.spelers.reduce((s, p) => s + p.inkopen, 0) * staat.waard;

function tekenTellen() {
  const i = staat.tel;
  const s = staat.spelers[i];
  $('telStap').textContent = `Tellen ${i + 1} van ${staat.spelers.length}`;
  $('telNaam').textContent = s.naam;
  $('telNaam2').textContent = s.naam;
  const rijen = $('telRijen');
  rijen.innerHTML = '';
  for (const m of MUNTEN) {
    rijen.appendChild(muntRij(m, s.eind[m.c] || 0, (v) => { s.eind[m.c] = v; bewaar(); tekenTelSom(); }));
  }
  $('telVerder').textContent = i === staat.spelers.length - 1 ? 'Klaar met tellen' : 'Volgende: ' + staat.spelers[i + 1].naam;
  tekenTelSom();
}
function tekenTelSom() {
  const s = staat.spelers[staat.tel];
  $('telWaarde').textContent = euro(waarde(s.eind));
  const rest = pot() - staat.spelers.reduce((som, p) => som + waarde(p.eind), 0);
  $('telRest').textContent = euro(rest);
  $('telRest').classList.toggle('min', rest < 0);
}

$('telVerder').onclick = () => {
  if (staat.tel < staat.spelers.length - 1) { staat.tel++; bewaar(); tekenTellen(); scrollTo(0, 0); return; }
  staat.fase = 'uitslag';
  bewaar();
  toon();
};
$('telTerug').onclick = () => {
  if (staat.tel > 0) { staat.tel--; bewaar(); tekenTellen(); return; }
  staat.fase = 'spel';
  bewaar();
  toon();
};

/* ---------- 4. Uitslag ---------- */
// Zo min mogelijk betalingen: grootste verliezer betaalt grootste winnaar, enz.
function betalingen(saldi) {
  const krijgen = saldi.filter((s) => s.saldo > 0).map((s) => ({ ...s }));
  const betalen = saldi.filter((s) => s.saldo < 0).map((s) => ({ ...s, saldo: -s.saldo }));
  const uit = [];
  krijgen.sort((a, b) => b.saldo - a.saldo);
  betalen.sort((a, b) => b.saldo - a.saldo);
  let k = 0, b = 0;
  while (k < krijgen.length && b < betalen.length) {
    const bedrag = Math.min(krijgen[k].saldo, betalen[b].saldo);
    if (bedrag > 0) uit.push({ van: betalen[b].naam, aan: krijgen[k].naam, bedrag });
    krijgen[k].saldo -= bedrag;
    betalen[b].saldo -= bedrag;
    if (krijgen[k].saldo === 0) k++;
    if (betalen[b].saldo === 0) b++;
  }
  return uit;
}

function tekenUitslag() {
  const geteld = staat.spelers.reduce((som, p) => som + waarde(p.eind), 0);
  const verschil = geteld - pot();
  $('verschil').hidden = verschil === 0;
  $('verschil').textContent = verschil > 0
    ? `Er is ${euro(verschil)} méér geteld dan er in de pot zit (${euro(pot())}). Tel nog eens na.`
    : `Er is ${euro(-verschil)} minder geteld dan er in de pot zit (${euro(pot())}). Tel nog eens na.`;

  $('uitKop').textContent = staat.dag > 1 ? `Stand na dag ${staat.dag}` : 'Stand';
  $('morgen').disabled = verschil !== 0;
  tekenDagen(verschil === 0);

  const saldi = staat.spelers.map((p) => ({ naam: p.naam, in: p.inkopen * staat.waard, eind: waarde(p.eind), saldo: waarde(p.eind) - p.inkopen * staat.waard }));
  const lijst = $('stand');
  lijst.innerHTML = '';
  [...saldi].sort((a, b) => b.saldo - a.saldo).forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="sp-info"><span class="naam"></span><span class="inleg"></span></div><b class="saldo"></b>`;
    li.querySelector('.naam').textContent = s.naam;
    li.querySelector('.inleg').textContent = `heeft ${euro(s.eind)} · ingelegd ${euro(s.in)}`;
    const b = li.querySelector('.saldo');
    b.textContent = s.saldo === 0 ? 'quitte' : (s.saldo > 0 ? '+' : '') + euro(s.saldo);
    b.classList.add(s.saldo > 0 ? 'plus' : s.saldo < 0 ? 'min' : 'nul');
    lijst.appendChild(li);
  });

  const bet = $('betalen');
  bet.innerHTML = '';
  const regels = verschil === 0 ? betalingen(saldi) : [];
  if (verschil !== 0) {
    bet.innerHTML = '<li class="leeg">Eerst de telling kloppend maken.</li>';
  } else if (!regels.length) {
    bet.innerHTML = '<li class="leeg">Niemand hoeft iets te betalen.</li>';
  }
  for (const r of regels) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="van"></span><span class="pijl">betaalt</span><span class="aan"></span><b></b>';
    li.querySelector('.van').textContent = r.van;
    li.querySelector('.aan').textContent = r.aan;
    li.querySelector('b').textContent = euro(r.bedrag);
    bet.appendChild(li);
  }
}

// Resultaat van vandaag per speler: eind − (begin van de dag + inkopen van vandaag)
const dagSaldo = (p) => waarde(p.eind) - waarde(p.stand) - (p.inkopen - p.inkStart) * staat.waard;

function tekenDagen(vandaagKlopt) {
  const toon = staat.dag > 1;
  $('dagenKop').hidden = !toon;
  $('dagen').hidden = !toon;
  if (!toon) return;
  const rijen = staat.dagen.map((d, i) => ({ kop: 'Dag ' + (i + 1), datum: d.datum, uit: d.uitslag }));
  if (vandaagKlopt) rijen.push({ kop: 'Dag ' + staat.dag, datum: Date.now(), uit: staat.spelers.map(dagSaldo) });
  const lijst = $('dagen');
  lijst.innerHTML = '';
  for (const r of rijen.reverse()) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="dag-kop"><span></span><small></small></div><div class="dag-uitslag"></div>';
    li.querySelector('.dag-kop span').textContent = r.kop;
    li.querySelector('.dag-kop small').textContent = new Date(r.datum).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
    r.uit.forEach((saldo, i) => {
      const s = document.createElement('span');
      s.textContent = staat.spelers[i].naam + ' ' + (saldo > 0 ? '+' : '') + euro(saldo);
      s.className = saldo > 0 ? 'plus' : saldo < 0 ? 'min' : '';
      li.querySelector('.dag-uitslag').appendChild(s);
    });
    lijst.appendChild(li);
  }
}

// Dag afsluiten: iedereen begint morgen met wat hij nu heeft
$('morgen').onclick = () => {
  vorige = JSON.stringify(staat);
  staat.dagen.push({ datum: Date.now(), uitslag: staat.spelers.map(dagSaldo) });
  for (const p of staat.spelers) {
    p.stand = { ...p.eind };
    p.inkStart = p.inkopen;
    p.eind = leeg();
  }
  staat.dag++;
  staat.fase = 'spel';
  bewaar();
  toon();
  melden(`Dag ${staat.dag - 1} bewaard. Volgende keer verder met dag ${staat.dag}.`, true);
};

$('uitTerug').onclick = () => { staat.fase = 'tellen'; staat.tel = staat.spelers.length - 1; bewaar(); toon(); };

/* ---------- Nieuw spel ---------- */
$('nieuwKnop').onclick = () => { $('nieuwLaag').hidden = false; };
$('uitNieuw').onclick = () => { $('nieuwLaag').hidden = false; };
$('nieuwJa').onclick = () => { $('nieuwLaag').hidden = true; nieuwSpel(); };
function nieuwSpel() {
  staat.namen = staat.spelers.map((s) => s.naam);
  staat.aantal = staat.spelers.length || staat.aantal;
  staat.spelers = [];
  staat.fase = 'start';
  bewaar();
  $('namen').innerHTML = '';
  toon();
}

document.querySelectorAll('.laag').forEach((laag) => {
  laag.addEventListener('click', (e) => {
    if (e.target === laag || e.target.closest('[data-sluit]')) laag.hidden = true;
  });
});

/* ---------- Bewaren als link ---------- */
// De hele stand gaat in het #-deel van de link; dat deel wordt nooit naar een server gestuurd.
const naarLink = () => location.origin + location.pathname + '#s=' +
  btoa(unescape(encodeURIComponent(JSON.stringify(staat)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function uitLink(code) {
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
    return s && s.fase && s.stapel && Array.isArray(s.spelers) ? s : null;
  } catch (e) { return null; }
}

$('bewaarKnop').onclick = () => { $('bewaarLaag').hidden = false; };
$('deelKnop').onclick = async () => {
  const url = naarLink();
  const titel = 'Pokermuntjes – stand dag ' + staat.dag + ' (' + datumTijd(Date.now()) + ')';
  if (navigator.share) {
    try { await navigator.share({ title: titel, text: titel, url }); $('bewaarLaag').hidden = true; return; } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    $('bewaarLaag').hidden = true;
    melden('Link gekopieerd. Plak hem in WhatsApp of Notities.', false);
  } catch (e) {
    prompt('Kopieer deze link:', url);
  }
};

let teruggezet = null;
function controleerLink() {
  const m = location.hash.match(/^#s=([\w-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  const s = uitLink(m[1]);
  if (!s) { melden('Deze bewaarde link werkt niet (onvolledig gekopieerd?).', false); return; }
  if (s.opgeslagen && staat.opgeslagen === s.opgeslagen) return; // is al de huidige stand
  teruggezet = s;
  const wie = s.spelers.map((p) => p.naam).join(', ') || 'nog geen spelers';
  $('terugTekst').textContent = `Stand van ${s.opgeslagen ? datumTijd(s.opgeslagen) : 'eerder'}: dag ${s.dag || 1}, ${wie}.` +
    (staat.spelers.length ? ' Het spel dat nu op deze telefoon staat wordt vervangen.' : '');
  $('terugLaag').hidden = false;
}
$('terugJa').onclick = () => {
  if (!teruggezet) return;
  vorige = JSON.stringify(staat);
  staat = laadAanvullen(teruggezet);
  bewaar();
  $('terugLaag').hidden = true;
  $('namen').innerHTML = '';
  $('stapel').innerHTML = '';
  toon();
  melden('Bewaarde stand teruggezet.', true);
};
window.addEventListener('hashchange', controleerLink);

/* ---------- Schermen ---------- */
function toon() {
  for (const f of ['start', 'spel', 'tellen', 'uitslag']) $(f).hidden = staat.fase !== f;
  $('melding').hidden = true;
  if (staat.fase === 'start') tekenStart();
  if (staat.fase === 'spel') tekenSpel();
  if (staat.fase === 'tellen') tekenTellen();
  if (staat.fase === 'uitslag') tekenUitslag();
  scrollTo(0, 0);
}

toon();
controleerLink();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
