const storyEl = document.getElementById('story');
const choicesEl = document.getElementById('choices');

const state = {
  player_ticket: `${Math.floor(Math.random() * 79) + 11}`,
  registered: false,
  took_ticket: false,
  filled_gap: false,
  responded_number: false,
  replaced: false,
  danger: 0,
  queue_count: 6,
  rules: {}
};

let story;
let nodes;
let currentId;

const readVar = (name) => {
  if (name.startsWith('rules.')) {
    return state.rules[name.split('.', 2)[1]] ?? false;
  }
  return state[name];
};

const writeVar = (name, value) => {
  if (name.startsWith('rules.')) {
    state.rules[name.split('.', 2)[1]] = value;
    return;
  }
  state[name] = value;
};

const applyEffect = (effect) => {
  const op = effect.op;
  const varName = effect.var;
  if (op === 'set') writeVar(varName, effect.value);
  else if (op === 'inc') writeVar(varName, (readVar(varName) || 0) + (effect.value ?? 1));
  else if (op === 'dec') writeVar(varName, (readVar(varName) || 0) - (effect.value ?? 1));
  else if (op === 'copy') writeVar(varName, readVar(effect.from));
};

const conditionPass = (cond) => {
  const left = readVar(cond.var);
  const right = cond.value;
  switch (cond.op || 'equals') {
    case 'equals': return left === right;
    case 'not_equals': return left !== right;
    case 'gte': return left >= right;
    case 'lte': return left <= right;
    case 'in': return right.includes(left);
    default: return false;
  }
};

const template = (text) => text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => `${readVar(k) ?? ''}`);

const enterNode = (node) => {
  (node.on_enter || []).forEach(applyEffect);
};

const ambientLine = () => {
  const pool = (story.ambient || []).filter((a) => state.danger >= (a.min_danger || 0));
  if (!pool.length) return '';
  return template(pool[Math.floor(Math.random() * pool.length)].text);
};

const visibleChoices = (node) => (node.choices || []).filter((c) => (c.conditions || []).every(conditionPass));

const render = () => {
  const node = nodes[currentId];
  if (!node) return;

  const lines = (node.text || []).map(template);
  const amb = ambientLine();
  if (amb) lines.push('', amb);
  storyEl.textContent = lines.join('\n');

  choicesEl.innerHTML = '';

  if (state.danger >= 3 && Math.random() < 0.2) {
    const glitch = document.createElement('div');
    glitch.className = 'system-glitch';
    glitch.textContent = '[系统] ...等待叫号...';
    choicesEl.appendChild(glitch);
  }

  if (node.ending) {
    const end = document.createElement('div');
    end.className = 'system-glitch';
    end.textContent = '--- 结局结束，可刷新重开 ---';
    choicesEl.appendChild(end);
    return;
  }

  for (const c of visibleChoices(node)) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = template(c.text);
    btn.onclick = () => {
      (c.effects || []).forEach(applyEffect);
      currentId = c.next;
      enterNode(nodes[currentId]);
      render();
    };
    choicesEl.appendChild(btn);
  }
};

async function boot() {
  story = await fetch('./story/night_clinic.json').then((r) => r.json());
  nodes = Object.fromEntries(story.nodes.map((n) => [n.id, n]));
  currentId = story.start;
  enterNode(nodes[currentId]);
  render();
}

boot();
