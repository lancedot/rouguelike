const storyEl = document.getElementById('story');
const choicesEl = document.getElementById('choices');
const endingBookEl = document.getElementById('endingBook');
const restartBtn = document.getElementById('restartBtn');
const imagePanel = document.getElementById('imagePanel');
const sceneImage = document.getElementById('sceneImage');
const ambientTextEl = document.getElementById('ambientText');
const sanityIndicator = document.getElementById('sanityIndicator');

const ENDING_STORAGE_KEY = 'night_clinic_endings_v4';
const PROGRESS_STORAGE_KEY = 'night_clinic_progress_v4';

let story;
let nodes = {};
let currentId;
let state;

const initState = (progress) => ({
  player_ticket: `${Math.floor(Math.random() * 79) + 11}`,
  registered: false,
  took_ticket: false,
  filled_gap: false,
  responded_number: false,
  replaced: false,
  danger: 0,
  sanity: 100,
  queue_count: 6,
  death_count: progress.death_count || 0,
  unlocked_rules: progress.unlocked_rules || [],
  fragments: progress.fragments || [],
  echo_line: '',
  rules: {}
});

const loadProgress = () => {
  try {
    const data = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return data ? JSON.parse(data) : { death_count: 0, unlocked_rules: [], fragments: [] };
  } catch (e) {
    console.error('Failed to load progress', e);
    return { death_count: 0, unlocked_rules: [], fragments: [] };
  }
};

const saveProgress = (progress) => {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress', e);
  }
};

const updateEchoLine = () => {
  if (state.death_count <= 0) {
    state.echo_line = '你第一次站进这座大厅，仍愿意相信这里只是夜间就诊。';
  } else if (state.death_count <= 2) {
    state.echo_line = '你又一次站在同一扇门内，路线似曾相识，连灯闪烁的节拍都没变。';
  } else {
    state.echo_line = '你已经记不清第几次重回这里。队伍像在等你按固定顺序犯错。';
  }
  
  if (state.fragments && state.fragments.length > 0) {
    state.echo_line += ` 口袋里，${state.fragments.join('、')} 散发着微弱的热量。`;
  }
};

const readVar = (name) => {
  if (!name) return undefined;
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
  if (!effect) return;
  const op = effect.op;
  const varName = effect.var;
  if (op === 'set') writeVar(varName, effect.value);
  else if (op === 'inc') writeVar(varName, (readVar(varName) || 0) + (effect.value ?? 1));
  else if (op === 'dec') writeVar(varName, (readVar(varName) || 0) - (effect.value ?? 1));
  else if (op === 'copy') writeVar(varName, readVar(effect.from));
};

const conditionPass = (cond) => {
  if (!cond) return true;
  const left = readVar(cond.var);
  let right = cond.value;
  
  switch (cond.op || 'equals') {
    case 'equals': return left === right;
    case 'not_equals': return left !== right;
    case 'gte': return left >= right;
    case 'lte': return left <= right;
    case 'gt': return left > right;
    case 'lt': return left < right;
    case 'in': return Array.isArray(right) && right.includes(left);
    default: return false;
  }
};

const template = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // 1. 处理条件判断 {{if var op val}}...{{else}}...{{endif}}
  // 注意：这个简单的正则不支持嵌套 if
  let processed = text.replace(/\{\{if\s+([a-zA-Z0-9_.]+)\s+([a-z_]+)\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{endif\}\}/g, (match, v, op, val, thenPart, elsePart) => {
    const left = readVar(v);
    let right;
    if (val === 'true') right = true;
    else if (val === 'false') right = false;
    else right = isNaN(val) ? val : Number(val);
    
    let pass = false;
    switch (op) {
      case 'equals': pass = left === right; break;
      case 'not_equals': pass = left !== right; break;
      case 'gte': pass = left >= right; break;
      case 'lte': pass = left <= right; break;
      case 'gt': pass = left > right; break;
      case 'lt': pass = left < right; break;
    }
    return pass ? thenPart : (elsePart || '');
  });

  // 2. 处理变量替换 {{var}}
  return processed.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => {
    const val = readVar(k);
    return val !== undefined ? val : '';
  });
};

const parseFormatting = (text) => {
  if (!text) return '';
  let parsed = text.replace(/~~(.*?)~~/g, '<span class="del-text">$1</span>');
  parsed = parsed.replace(/\[\[(.*?)\|(.*?)\]\]/g, '<span class="blood-reveal" data-hidden="$2">$1</span>');
  return parsed;
};

const enterNode = (node) => {
  if (!node) return;
  (node.on_enter || []).forEach(applyEffect);
  
  // 导演系统效果
  if (state.danger > 2) {
    state.sanity = Math.max(0, state.sanity - (state.danger * 2));
    document.body.style.animation = `shake ${0.1 * state.danger}s infinite`;
  } else {
    document.body.style.animation = 'none';
  }

  const pulseRate = state.danger > 0 ? (2 / state.danger) : 0;
  if (pulseRate > 0) {
    imagePanel.style.animation = `pulse ${pulseRate}s infinite alternate`;
  } else {
    imagePanel.style.animation = 'none';
  }

  if (state.sanity < 30) {
    document.documentElement.style.filter = `hue-rotate(${Math.random() * 360}deg) invert(0.1)`;
  } else {
    document.documentElement.style.filter = 'none';
  }
};

const ambientLine = () => {
  if (!story || !story.ambient) return '';
  const pool = story.ambient.filter((a) => 
    state.danger >= (a.min_danger || 0) && 
    state.sanity <= (a.max_sanity || 100)
  );
  if (!pool.length) return '';
  const probability = (100 - state.sanity) / 100 + 0.2;
  if (Math.random() > probability) return '';
  return template(pool[Math.floor(Math.random() * pool.length)].text);
};

const visibleChoices = (node) => {
  if (!node || !node.choices) return [];
  return node.choices.filter((c) => {
    if (!c.conditions) return true;
    return c.conditions.every(conditionPass);
  });
};

const showError = (message) => {
  console.error(message);
  storyEl.innerHTML = `<span style="color:var(--danger)">${message}</span>`;
  choicesEl.innerHTML = '';
};

const loadEndingBook = () => {
  try {
    const data = localStorage.getItem(ENDING_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
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
    for (const k of keys) lines.push(`- ${book[k]}`);
  }

  lines.push('<br/>记住的禁忌：');
  if (!state.unlocked_rules || !state.unlocked_rules.length) {
    lines.push('（尚未想起任何一条）');
  } else {
    for (const rule of state.unlocked_rules) lines.push(`- ${rule}`);
  }

  lines.push(`<br/>重复排队次数：${state.death_count}`);
  endingBookEl.innerHTML = lines.join('<br/>');
};

const onEndingReached = (node) => {
  saveEnding(node.id, node.ending_title || node.id);
  if (node.ending_type === 'death') {
    state.death_count += 1;
    if (node.unlock_rule && !state.unlocked_rules.includes(node.unlock_rule)) {
      state.unlocked_rules.push(node.unlock_rule);
    }
  }
  if (node.gain_fragment && !state.fragments.includes(node.gain_fragment)) {
    state.fragments.push(node.gain_fragment);
  }
  saveProgress({ 
    death_count: state.death_count, 
    unlocked_rules: state.unlocked_rules,
    fragments: state.fragments 
  });
  renderEndingBook();
};

const render = () => {
  const node = nodes[currentId];
  if (!node) {
    showError('场景加载失败：找不到当前节点 ' + currentId);
    return;
  }

  sanityIndicator.textContent = `理智: ${Math.floor(state.sanity)}% | 危险度: ${state.danger}`;

  if (node.image) {
    sceneImage.src = node.image;
    imagePanel.classList.remove('hidden');
    const blur = Math.min(state.danger, 5) + 'px';
    const dark = 0.8 - (state.danger * 0.1);
    sceneImage.style.filter = `grayscale(100%) contrast(120%) brightness(${dark}) blur(${state.danger >= 3 ? blur : '0'})`;
  } else {
    imagePanel.classList.add('hidden');
  }

  let rawTextLines = (node.text || []).map(template);
  if (node.id === story.start && state.echo_line) {
    rawTextLines.unshift(state.echo_line);
    rawTextLines.unshift('');
  }
  
  storyEl.innerHTML = rawTextLines.map(parseFormatting).join('<br/><br/>');

  const amb = ambientLine();
  if (amb) {
    ambientTextEl.innerHTML = parseFormatting(amb);
    if (state.danger >= 3) ambientTextEl.classList.add('ambient-danger');
    else ambientTextEl.classList.remove('ambient-danger');
  } else {
    ambientTextEl.innerHTML = '';
  }

  choicesEl.innerHTML = '';

  if (node.ending) {
    onEndingReached(node);
    const end = document.createElement('div');
    end.className = 'system-glitch';
    end.innerHTML = '--- 档案已记录 ---';
    choicesEl.appendChild(end);
    return;
  }

  const choices = visibleChoices(node);
  if (!choices.length) {
    const empty = document.createElement('div');
    empty.className = 'system-glitch';
    empty.textContent = '（死路一条）';
    choicesEl.appendChild(empty);
    return;
  }

  for (const c of choices) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    if (c.effects && c.effects.some(e => e.op === 'inc' && e.var === 'danger')) {
      btn.classList.add('choice-danger');
    }
    btn.innerHTML = parseFormatting(template(c.text));
    btn.onclick = () => {
      storyEl.style.opacity = '0';
      imagePanel.style.opacity = '0';
      setTimeout(() => {
        (c.effects || []).forEach(applyEffect);
        currentId = c.next;
        enterNode(nodes[currentId]);
        render();
        storyEl.style.opacity = '1';
        imagePanel.style.opacity = '1';
      }, 300);
    };
    choicesEl.appendChild(btn);
  }
};

const restartGame = () => {
  const progress = loadProgress();
  state = initState(progress);
  updateEchoLine();
  currentId = story.start;
  enterNode(nodes[currentId]);
  renderEndingBook();
  render();
};

async function boot() {
  try {
    console.log('Booting game...');
    const response = await fetch('./story/night_clinic.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`剧情加载失败（HTTP ${response.status}）`);

    story = await response.json();
    // 替代 Object.fromEntries 以提高兼容性
    nodes = (story.nodes || []).reduce((acc, n) => {
      acc[n.id] = n;
      return acc;
    }, {});

    if (!story.start || !nodes[story.start]) throw new Error('剧情入口节点无效');

    restartBtn.onclick = restartGame;
    restartGame();
    console.log('Game booted successfully.');
  } catch (error) {
    showError(`加载失败：${error.message}`);
  }
}

window.onload = boot;