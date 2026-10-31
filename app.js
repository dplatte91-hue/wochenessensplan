'use strict';

// ---------- Grunddaten ----------

const STORAGE_KEY = 'wochenessensplan-v1';

const DAYS = [
  { id: 'mo', name: 'Montag' },
  { id: 'di', name: 'Dienstag' },
  { id: 'mi', name: 'Mittwoch' },
  { id: 'do', name: 'Donnerstag' },
  { id: 'fr', name: 'Freitag' },
  { id: 'sa', name: 'Samstag' },
  { id: 'so', name: 'Sonntag' },
];

// Gangreihenfolge im Aldi – unter „Mehr“ in der App änderbar.
const DEFAULT_AISLES = [
  'Obst & Gemüse',
  'Brot & Backwaren',
  'Nudeln, Reis & Konserven',
  'Gewürze, Öl & Saucen',
  'Kühlregal',
  'Tiefkühl',
  'Getränke',
  'Drogerie & Sonstiges',
];

const UNITS = ['g', 'kg', 'ml', 'l', 'Stück', 'Dose', 'Packung', 'Bund', 'EL', 'TL', 'Zehe', 'Prise'];

const ing = (name, amount, unit, category) => ({ name, amount, unit, category });

// Mengen für 2 Erwachsene + 1 Kleinkind
const START_RECIPES = [
  {
    id: 'linsenbolognese',
    name: 'Linsenbolognese',
    ingredients: [
      ing('Zwiebel', 1, 'Stück', 'Obst & Gemüse'),
      ing('Karotten', 2, 'Stück', 'Obst & Gemüse'),
      ing('Knoblauch', 1, 'Zehe', 'Obst & Gemüse'),
      ing('Spaghetti', 400, 'g', 'Nudeln, Reis & Konserven'),
      ing('Rote Linsen', 200, 'g', 'Nudeln, Reis & Konserven'),
      ing('Passierte Tomaten', 500, 'g', 'Nudeln, Reis & Konserven'),
      ing('Tomatenmark', 2, 'EL', 'Nudeln, Reis & Konserven'),
      ing('Olivenöl', 2, 'EL', 'Gewürze, Öl & Saucen'),
      ing('Parmesan', 50, 'g', 'Kühlregal'),
    ],
  },
  {
    id: 'wraps',
    name: 'Wraps',
    ingredients: [
      ing('Paprika', 2, 'Stück', 'Obst & Gemüse'),
      ing('Tomaten', 2, 'Stück', 'Obst & Gemüse'),
      ing('Eisbergsalat', 1, 'Stück', 'Obst & Gemüse'),
      ing('Weizentortillas', 8, 'Stück', 'Brot & Backwaren'),
      ing('Kidneybohnen', 1, 'Dose', 'Nudeln, Reis & Konserven'),
      ing('Mais', 1, 'Dose', 'Nudeln, Reis & Konserven'),
      ing('Geriebener Käse', 150, 'g', 'Kühlregal'),
      ing('Schmand', 200, 'g', 'Kühlregal'),
    ],
  },
  {
    id: 'ofengnocchi',
    name: 'Ofengnocchi mit Gemüse',
    ingredients: [
      ing('Zucchini', 1, 'Stück', 'Obst & Gemüse'),
      ing('Paprika', 1, 'Stück', 'Obst & Gemüse'),
      ing('Kirschtomaten', 250, 'g', 'Obst & Gemüse'),
      ing('Rote Zwiebel', 1, 'Stück', 'Obst & Gemüse'),
      ing('Olivenöl', 3, 'EL', 'Gewürze, Öl & Saucen'),
      ing('Italienische Kräuter', 1, 'TL', 'Gewürze, Öl & Saucen'),
      ing('Gnocchi', 800, 'g', 'Kühlregal'),
      ing('Feta', 200, 'g', 'Kühlregal'),
    ],
  },
  {
    id: 'kartoffelpueree',
    name: 'Kartoffelpüree mit Gemüsestäbchen',
    ingredients: [
      ing('Kartoffeln, mehligkochend', 1, 'kg', 'Obst & Gemüse'),
      ing('Milch', 200, 'ml', 'Kühlregal'),
      ing('Butter', 30, 'g', 'Kühlregal'),
      ing('Gemüsestäbchen', 1, 'Packung', 'Tiefkühl'),
      ing('Erbsen', 300, 'g', 'Tiefkühl'),
    ],
  },
];

// ---------- Zustand & Speicherung ----------

function defaultState() {
  return {
    recipes: structuredClone(START_RECIPES),
    plan: Object.fromEntries(DAYS.map(d => [d.id, null])),
    checked: {},
    extras: [],
    aisles: DEFAULT_AISLES.slice(),
    tab: 'plan',
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) { /* kaputte oder gesperrte Daten → Startzustand */ }
  return defaultState();
}

let state = loadState();
let editing = null; // Kopie des Rezepts, das gerade bearbeitet wird

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
}

// ---------- Hilfsfunktionen ----------

const $app = document.getElementById('app');
const $title = document.getElementById('title');

const uid = () => Math.random().toString(36).slice(2, 10);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseAmount(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtAmount(n) {
  return (Math.round(n * 100) / 100).toLocaleString('de-DE');
}

function recipeById(id) {
  return state.recipes.find(r => r.id === id) || null;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function aisleIndex(cat) {
  const i = state.aisles.indexOf(cat);
  return i < 0 ? state.aisles.length : i;
}

function categoryOptions(selected) {
  const cats = state.aisles.includes(selected) || !selected ? state.aisles : [...state.aisles, selected];
  return cats.map(c => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

// ---------- Wochenplan ----------

function randomRecipeFor(dayIndex) {
  const ids = state.recipes.map(r => r.id);
  if (!ids.length) return null;
  const neighbours = [DAYS[dayIndex - 1], DAYS[dayIndex + 1]].filter(Boolean).map(d => state.plan[d.id]);
  const current = state.plan[DAYS[dayIndex].id];
  const best = ids.filter(id => id !== current && !neighbours.includes(id));
  const ok = best.length ? best : ids.filter(id => id !== current);
  const pool = ok.length ? ok : ids;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Füllt leere Tage so, dass sich Gerichte möglichst selten wiederholen.
function fillEmptyDays() {
  const ids = state.recipes.map(r => r.id);
  if (!ids.length) return;
  const used = Object.values(state.plan).filter(Boolean);
  let pool = shuffle(ids.filter(id => !used.includes(id)));
  DAYS.forEach((d, i) => {
    if (state.plan[d.id]) return;
    if (!pool.length) pool = shuffle(ids.slice());
    const prev = i > 0 ? state.plan[DAYS[i - 1].id] : null;
    let k = pool.findIndex(id => id !== prev);
    if (k < 0) k = 0;
    state.plan[d.id] = pool.splice(k, 1)[0];
  });
}

function renderPlan() {
  const opts = id => ['<option value="">– nichts geplant –</option>']
    .concat(state.recipes.map(r => `<option value="${esc(r.id)}" ${r.id === id ? 'selected' : ''}>${esc(r.name)}</option>`))
    .join('');

  const days = DAYS.map(d => `
    <div class="row day">
      <div class="day-name">${d.name}</div>
      <div class="day-controls">
        <select data-day="${d.id}" aria-label="Gericht am ${d.name}">${opts(state.plan[d.id])}</select>
        <button class="icon" data-action="dice" data-day="${d.id}" aria-label="Zufälliges Gericht für ${d.name}">🎲</button>
      </div>
    </div>`).join('');

  return `
    <div class="card">${days}</div>
    <div class="actions">
      <button class="primary" data-action="fill">🎲 Leere Tage füllen</button>
      <button data-action="clear-plan">Plan leeren</button>
    </div>
    <button class="block primary" data-action="goto-einkauf">🛒 Zur Einkaufsliste</button>`;
}

// ---------- Einkaufsliste ----------

function buildShoppingList() {
  const map = new Map();
  for (const d of DAYS) {
    const r = recipeById(state.plan[d.id]);
    if (!r) continue;
    for (const i of r.ingredients) {
      const name = (i.name || '').trim();
      if (!name) continue;
      const unit = (i.unit || '').trim();
      const key = name.toLowerCase() + '|' + unit.toLowerCase();
      let e = map.get(key);
      if (!e) {
        e = { key, name, unit, amount: 0, category: i.category, from: new Set() };
        map.set(key, e);
      }
      const a = parseAmount(i.amount);
      if (a) e.amount += a;
      e.from.add(r.name);
    }
  }
  for (const x of state.extras) {
    const key = 'extra|' + x.id;
    map.set(key, { key, name: x.name, unit: '', amount: 0, category: x.category, from: new Set(), extraId: x.id });
  }
  const items = [...map.values()];
  items.sort((a, b) => aisleIndex(a.category) - aisleIndex(b.category) || a.name.localeCompare(b.name, 'de'));
  return items;
}

function renderEinkauf() {
  const items = buildShoppingList();
  const doneCount = items.filter(i => state.checked[i.key]).length;

  let list = '';
  if (!items.length) {
    list = `<div class="card empty">Noch nichts auf der Liste.<br>Plane zuerst ein paar Gerichte.</div>`;
  } else {
    const groups = new Map();
    for (const it of items) {
      const cat = it.category || 'Drogerie & Sonstiges';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    }
    for (const [cat, its] of groups) {
      // Erledigte rutschen innerhalb des Gangs nach unten
      its.sort((a, b) => (state.checked[a.key] ? 1 : 0) - (state.checked[b.key] ? 1 : 0));
      list += `<h2>${esc(cat)}</h2><div class="card">` + its.map(it => {
        const done = !!state.checked[it.key];
        let [n, unit] = [it.amount, it.unit];
        if (n >= 1000 && unit === 'g') [n, unit] = [n / 1000, 'kg'];
        if (n >= 1000 && unit === 'ml') [n, unit] = [n / 1000, 'l'];
        const amount = n ? `${fmtAmount(n)} ${esc(unit)}` : '';
        const from = it.extraId ? 'extra' : [...it.from].join(', ');
        return `
          <div class="row item ${done ? 'done' : ''}" data-action="toggle" data-key="${esc(it.key)}" role="checkbox" aria-checked="${done}">
            <div class="check">${done ? '✓' : ''}</div>
            <div class="item-text">
              <div class="item-name">${esc(it.name)}</div>
              <div class="item-from">${esc(from)}</div>
            </div>
            <div class="item-amount">${amount}</div>
            ${it.extraId ? `<button class="icon danger" data-action="del-extra" data-id="${esc(it.extraId)}" aria-label="${esc(it.name)} entfernen">✕</button>` : ''}
          </div>`;
      }).join('') + `</div>`;
    }
  }

  return `
    ${items.length ? `<p class="progress">${doneCount} von ${items.length} erledigt</p>` : ''}
    ${list}
    <h2>Extra-Artikel</h2>
    <div class="card" style="padding:12px">
      <input id="extra-name" placeholder="z. B. Bananen, Windeln …" autocomplete="off">
      <div class="day-controls" style="margin-top:8px">
        <select id="extra-cat">${categoryOptions('Obst & Gemüse')}</select>
        <button class="primary" data-action="add-extra">Hinzufügen</button>
      </div>
    </div>
    <div class="actions">
      <button data-action="reset-checks">Haken zurücksetzen</button>
    </div>`;
}

// ---------- Rezepte ----------

function renderRezepte() {
  const list = state.recipes.length
    ? state.recipes.map(r => `
        <div class="row recipe-link" data-action="edit" data-id="${esc(r.id)}">
          <div>${esc(r.name)}<div class="meta">${r.ingredients.length} Zutaten</div></div>
          <span aria-hidden="true">›</span>
        </div>`).join('')
    : `<div class="empty">Noch keine Rezepte.</div>`;
  return `
    <div class="card">${list}</div>
    <button class="block primary" data-action="new-recipe">＋ Neues Rezept</button>`;
}

function renderEditor() {
  const r = editing;
  const rows = r.ingredients.map((i, idx) => `
    <div class="ing" data-idx="${idx}">
      <input class="ing-name" data-field="name" value="${esc(i.name)}" placeholder="Zutat" aria-label="Zutat">
      <button class="icon danger" data-action="del-ing" data-idx="${idx}" aria-label="Zutat entfernen">✕</button>
      <input data-field="amount" inputmode="decimal" value="${i.amount ?? ''}" placeholder="Menge" aria-label="Menge">
      <input data-field="unit" list="units" value="${esc(i.unit)}" placeholder="Einheit" aria-label="Einheit">
      <select class="ing-cat" data-field="category" aria-label="Kategorie">${categoryOptions(i.category)}</select>
    </div>`).join('');

  return `
    <label class="field"><span>Name des Gerichts</span>
      <input id="recipe-name" value="${esc(r.name)}" placeholder="z. B. Gemüsecurry">
    </label>
    <h2>Zutaten</h2>
    <div class="card">${rows || '<div class="empty">Noch keine Zutaten.</div>'}</div>
    <datalist id="units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
    <button class="block" data-action="add-ing">＋ Zutat hinzufügen</button>
    <div class="actions">
      <button class="primary" data-action="save-recipe">Speichern</button>
      <button data-action="cancel-edit">Abbrechen</button>
    </div>
    ${state.recipes.some(x => x.id === r.id) ? `<button class="block danger" data-action="delete-recipe">Rezept löschen</button>` : ''}`;
}

// Liest die Eingabefelder des Editors zurück in `editing`.
function syncEditor() {
  if (!editing) return;
  const name = document.getElementById('recipe-name');
  if (name) editing.name = name.value;
  document.querySelectorAll('.ing').forEach(row => {
    const i = editing.ingredients[+row.dataset.idx];
    row.querySelectorAll('[data-field]').forEach(el => {
      i[el.dataset.field] = el.dataset.field === 'amount' ? (parseAmount(el.value) ?? '') : el.value;
    });
  });
}

// ---------- Einstellungen ----------

function renderEinstellungen() {
  const aisles = state.aisles.map((a, i) => `
    <div class="row">
      <div style="flex:1">${i + 1}. ${esc(a)}</div>
      <button class="icon" data-action="aisle-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(a)} nach oben">↑</button>
      <button class="icon" data-action="aisle-down" data-idx="${i}" ${i === state.aisles.length - 1 ? 'disabled' : ''} aria-label="${esc(a)} nach unten">↓</button>
    </div>`).join('');

  return `
    <h2>Gangreihenfolge im Aldi</h2>
    <p class="hint">So ist die Einkaufsliste sortiert. Mit den Pfeilen an euren Markt anpassen.</p>
    <div class="card">${aisles}</div>
    <div class="day-controls" style="margin-top:10px">
      <input id="new-aisle" placeholder="Neue Kategorie" autocomplete="off">
      <button class="primary" data-action="add-aisle">＋</button>
    </div>

    <h2>Daten sichern</h2>
    <p class="hint">Die Daten liegen nur auf diesem Gerät. Mit „Exportieren“ sicherst du sie als Datei oder überträgst sie auf ein anderes Handy.</p>
    <div class="actions">
      <button data-action="export">Exportieren</button>
      <button data-action="import">Importieren</button>
    </div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="block danger" data-action="reset-all">Alles auf Anfang zurücksetzen</button>`;
}

// ---------- Rendern ----------

const TITLES = { plan: 'Wochenplan', einkauf: 'Einkaufsliste', rezepte: 'Rezepte', einstellungen: 'Einstellungen' };

function render() {
  if (editing) {
    $title.textContent = editing.name || 'Neues Rezept';
    $app.innerHTML = renderEditor();
  } else {
    $title.textContent = TITLES[state.tab];
    $app.innerHTML = { plan: renderPlan, einkauf: renderEinkauf, rezepte: renderRezepte, einstellungen: renderEinstellungen }[state.tab]();
  }
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
}

function setTab(tab) {
  editing = null;
  state.tab = tab;
  save();
  render();
  window.scrollTo(0, 0);
}

// ---------- Ereignisse ----------

document.querySelector('.tabbar').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (b) setTab(b.dataset.tab);
});

$app.addEventListener('change', e => {
  const day = e.target.dataset.day;
  if (day && e.target.tagName === 'SELECT') {
    state.plan[day] = e.target.value || null;
    save();
  }
});

$app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'extra-name') addExtra();
  if (e.target.id === 'new-aisle') addAisle();
});

function addExtra() {
  const name = document.getElementById('extra-name').value.trim();
  if (!name) return;
  state.extras.push({ id: uid(), name, category: document.getElementById('extra-cat').value });
  save();
  render();
}

function addAisle() {
  const name = document.getElementById('new-aisle').value.trim();
  if (!name || state.aisles.includes(name)) return;
  state.aisles.push(name);
  save();
  render();
}

$app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;

  switch (action) {
    case 'dice': {
      const idx = DAYS.findIndex(d => d.id === el.dataset.day);
      state.plan[el.dataset.day] = randomRecipeFor(idx);
      break;
    }
    case 'fill':
      fillEmptyDays();
      break;
    case 'clear-plan':
      if (!confirm('Den ganzen Wochenplan leeren?')) return;
      DAYS.forEach(d => { state.plan[d.id] = null; });
      break;
    case 'goto-einkauf':
      setTab('einkauf');
      return;

    case 'toggle':
      if (e.target.closest('[data-action="del-extra"]')) return;
      state.checked[el.dataset.key] = !state.checked[el.dataset.key];
      if (!state.checked[el.dataset.key]) delete state.checked[el.dataset.key];
      break;
    case 'del-extra':
      e.stopPropagation();
      state.extras = state.extras.filter(x => x.id !== el.dataset.id);
      delete state.checked['extra|' + el.dataset.id];
      break;
    case 'add-extra':
      addExtra();
      return;
    case 'reset-checks':
      if (!confirm('Alle Haken entfernen und Extra-Artikel löschen?')) return;
      state.checked = {};
      state.extras = [];
      break;

    case 'edit':
      editing = structuredClone(recipeById(el.dataset.id));
      render();
      window.scrollTo(0, 0);
      return;
    case 'new-recipe':
      editing = { id: uid(), name: '', ingredients: [ing('', '', 'g', state.aisles[0])] };
      render();
      return;
    case 'add-ing':
      syncEditor();
      editing.ingredients.push(ing('', '', 'g', state.aisles[0]));
      render();
      document.querySelector('.ing:last-of-type .ing-name')?.focus();
      return;
    case 'del-ing':
      syncEditor();
      editing.ingredients.splice(+el.dataset.idx, 1);
      render();
      return;
    case 'save-recipe': {
      syncEditor();
      editing.name = editing.name.trim();
      if (!editing.name) { alert('Bitte einen Namen eingeben.'); return; }
      editing.ingredients = editing.ingredients.filter(i => i.name.trim());
      const pos = state.recipes.findIndex(r => r.id === editing.id);
      if (pos >= 0) state.recipes[pos] = editing; else state.recipes.push(editing);
      editing = null;
      break;
    }
    case 'cancel-edit':
      editing = null;
      break;
    case 'delete-recipe':
      if (!confirm(`„${editing.name}“ wirklich löschen?`)) return;
      state.recipes = state.recipes.filter(r => r.id !== editing.id);
      DAYS.forEach(d => { if (state.plan[d.id] === editing.id) state.plan[d.id] = null; });
      editing = null;
      break;

    case 'aisle-up':
    case 'aisle-down': {
      const i = +el.dataset.idx;
      const j = action === 'aisle-up' ? i - 1 : i + 1;
      [state.aisles[i], state.aisles[j]] = [state.aisles[j], state.aisles[i]];
      break;
    }
    case 'add-aisle':
      addAisle();
      return;
    case 'export': {
      const { tab, ...data } = state;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `essensplan-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
    case 'import':
      document.getElementById('import-file').click();
      return;
    case 'reset-all':
      if (!confirm('Wirklich alles löschen und mit den Startrezepten neu beginnen?')) return;
      state = defaultState();
      break;
    default:
      return;
  }
  save();
  render();
});

$app.addEventListener('change', e => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  e.target.files[0].text().then(text => {
    const data = JSON.parse(text);
    if (!Array.isArray(data.recipes)) throw new Error('Keine Rezepte gefunden');
    state = { ...defaultState(), ...data, tab: state.tab };
    save();
    render();
    alert('Daten importiert.');
  }).catch(err => alert('Import fehlgeschlagen: ' + err.message));
});

// ---------- Start ----------

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
