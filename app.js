const storyEl = document.getElementById('story');
const choicesEl = document.getElementById('choices');
const rulebookEl = document.getElementById('rulebook');
const metaEl = document.getElementById('meta');

const state = {
  player_name: '访客',
  registered: false,
  took_ticket: false,
  filled_gap: false,
  responded_name: false,
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

const renderRulebook = () => {
  const lines = ['【夜诊规则页】'];
  for (const rule of story.rules || []) {
    const k = rule.id;
    const discovered = state.rules[`${k}_discovered`] || false;
    const corrupted = state.rules[`${k}_corrupted`] || false;
    if (!discovered) lines.push(`- ${rule.unknown_text}`);
    else if (corrupted) lines.push(`- ${rule.corrupted_text}`);
    else lines.push(`- ${rule.safe_text}`);
  }
  rulebookEl.textContent = lines.join('\n');
};

const visibleChoices = (node) => (node.choices || []).filter((c) => (c.conditions || []).every(conditionPass));

const render = () => {
  const node = nodes[currentId];
  if (!node) return;

  metaEl.innerHTML = `姓名：<span class="name">${state.player_name}</span>　危险值：<span class="danger">${state.danger}</span>　队伍剩余：${state.queue_count}`;

  const lines = (node.text || []).map(template);
  const amb = ambientLine();
  if (amb) lines.push('', amb);
  storyEl.textContent = lines.join('\n');

  choicesEl.innerHTML = '';

  if (state.danger >= 3 && Math.random() < 0.2) {
    const glitch = document.createElement('div');
    glitch.className = 'system-glitch';
    glitch.textContent = '[系统] 返回主菜单 / [系统] 归队';
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
      const nextNode = nodes[currentId];
      if (nextNode?.input?.type === 'name') {
        const x = window.prompt(nextNode.input.prompt || '请输入姓名：', state.player_name) || '';
        const n = x.trim().slice(0, 20) || '访客';
        state.player_name = n;
      }
      enterNode(nodes[currentId]);
      renderRulebook();
      render();
    };
    choicesEl.appendChild(btn);
  }
};

async function boot() {
  story = await fetch('./story/night_clinic.json').then((r) => r.json());
  nodes = Object.fromEntries(story.nodes.map((n) => [n.id, n]));
  currentId = story.start;

  const first = nodes[currentId];
  if (first?.input?.type === 'name') {
    const x = window.prompt(first.input.prompt || '请输入姓名：', '') || '';
    state.player_name = x.trim().slice(0, 20) || '访客';
  }

  enterNode(nodes[currentId]);
  renderRulebook();
  render();
}

boot();
