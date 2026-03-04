const storyEl = document.getElementById('story');
const choicesEl = document.getElementById('choices');
const endingBookEl = document.getElementById('endingBook');
const restartBtn = document.getElementById('restartBtn');

const ENDING_STORAGE_KEY = 'night_clinic_endings_v1';

let story;
let nodes;
let currentId;
let state;

const initState = () => ({
  player_ticket: `${Math.floor(Math.random() * 79) + 11}`,
  registered: false,
  took_ticket: false,
  filled_gap: false,
  responded_number: false,
  replaced: false,
  danger: 0,
  queue_count: 6,
  rules: {}
});

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

const showError = (message) => {
  storyEl.textContent = message;
  choicesEl.innerHTML = '';
};

const loadEndingBook = () => {
  try {
    return JSON.parse(localStorage.getItem(ENDING_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveEnding = (endingId, endingTitle) => {
  const book = loadEndingBook();
  book[endingId] = endingTitle;
  localStorage.setItem(ENDING_STORAGE_KEY, JSON.stringify(book));
};

const renderEndingBook = () => {
  const book = loadEndingBook();
  const total = (story.nodes || []).filter((n) => n.ending).length;
  const keys = Object.keys(book);
  const lines = [`结局收集：<strong>${keys.length}</strong> / ${total}`];
  if (!keys.length) {
    lines.push('你还没有记录任何结局。');
  } else {
    for (const k of keys) {
      lines.push(`- ${book[k]}`);
    }
  }
  endingBookEl.innerHTML = lines.join('<br/>');
};

const render = () => {
  const node = nodes[currentId];
  if (!node) {
    showError('场景加载失败：找不到当前节点。请刷新页面。');
    return;
  }

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
    saveEnding(node.id, node.ending_title || node.id);
    renderEndingBook();

    const end = document.createElement('div');
    end.className = 'system-glitch';
    end.textContent = '--- 结局结束，可点击“重新开始” ---';
    choicesEl.appendChild(end);
    return;
  }

  const choices = visibleChoices(node);
  if (!choices.length) {
    const empty = document.createElement('div');
    empty.className = 'system-glitch';
    empty.textContent = '（暂时没有可选行动，请刷新重试）';
    choicesEl.appendChild(empty);
    return;
  }

  for (const c of choices) {
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

const restartGame = () => {
  state = initState();
  currentId = story.start;
  enterNode(nodes[currentId]);
  render();
};

async function boot() {
  try {
    storyEl.textContent = '夜诊大厅正在亮灯...';
    const response = await fetch('./story/night_clinic.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`剧情加载失败（HTTP ${response.status}）`);
    }
    story = await response.json();
    nodes = Object.fromEntries((story.nodes || []).map((n) => [n.id, n]));
    state = initState();
    currentId = story.start;

    if (!currentId || !nodes[currentId]) {
      throw new Error('剧情入口节点无效');
    }

    restartBtn.onclick = restartGame;
    renderEndingBook();

    enterNode(nodes[currentId]);
    render();
  } catch (error) {
    showError(`加载失败：${error.message}`);
  }
}

boot();
