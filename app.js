(function() {
    const storyEl = document.getElementById('story');
    const choicesEl = document.getElementById('choices');
    const endingBookEl = document.getElementById('endingBook');
    const restartBtn = document.getElementById('restartBtn');
    const imagePanel = document.getElementById('imagePanel');
    const sceneImage = document.getElementById('sceneImage');
    const ambientTextEl = document.getElementById('ambientText');
    const sanityIndicator = document.getElementById('sanityIndicator');

    const ENDING_STORAGE_KEY = 'night_clinic_endings_v5';
    const PROGRESS_STORAGE_KEY = 'night_clinic_progress_v5';

    let story = null;
    let nodes = {};
    let currentId = null;
    let state = {};

    // 全局错误展示
    window.onerror = function(msg, url, line) {
        if (storyEl) {
            storyEl.innerHTML = `<span style="color:var(--danger)">[系统错误] ${msg}<br>位置: ${line}行</span>`;
        }
    };

    // --- 数据持久化函数 ---
    function loadProgress() {
        try {
            const data = localStorage.getItem(PROGRESS_STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) { return {}; }
    }

    function saveProgress() {
        try {
            localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
                death_count: state.death_count,
                unlocked_rules: state.unlocked_rules,
                fragments: state.fragments
            }));
        } catch (e) {}
    }

    function loadEndingBook() {
        try {
            const data = localStorage.getItem(ENDING_STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) { return {}; }
    }

    function saveEnding(id, title) {
        const book = loadEndingBook();
        book[id] = title;
        localStorage.setItem(ENDING_STORAGE_KEY, JSON.stringify(book));
    }

    // --- 游戏逻辑函数 ---
    const initState = (progress) => ({
        player_ticket: `${Math.floor(Math.random() * 79) + 11}`,
        danger: 0,
        sanity: 100,
        death_count: progress.death_count || 0,
        unlocked_rules: progress.unlocked_rules || [],
        fragments: progress.fragments || [],
        echo_line: '',
        rules: {}
    });

    const readVar = (name) => {
        if (!name) return undefined;
        if (name.startsWith('rules.')) return state.rules[name.split('.', 2)[1]] ?? false;
        return state[name];
    };

    const writeVar = (name, value) => {
        if (name.startsWith('rules.')) state.rules[name.split('.', 2)[1]] = value;
        else state[name] = value;
    };

    const applyEffect = (effect) => {
        if (!effect) return;
        const op = effect.op;
        const varName = effect.var;
        const val = effect.value;
        if (op === 'set') writeVar(varName, val);
        else if (op === 'inc') writeVar(varName, (readVar(varName) || 0) + (val ?? 1));
        else if (op === 'dec') writeVar(varName, (readVar(varName) || 0) - (val ?? 1));
    };

    const conditionPass = (cond) => {
        if (!cond) return true;
        const left = readVar(cond.var);
        let right = cond.value;
        if (right === 'true') right = true;
        if (right === 'false') right = false;

        switch (cond.op || 'equals') {
            case 'equals': return left === right;
            case 'not_equals': return left !== right;
            case 'gte': return left >= right;
            case 'lte': return left <= right;
            case 'gt': return left > right;
            case 'lt': return left < right;
            default: return false;
        }
    };

    const template = (text) => {
        if (!text) return '';
        let processed = text.replace(/\{\{if\s+([a-zA-Z0-9_.]+)\s+([a-z_]+)\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{endif\}\}/g, (match, v, op, val, thenPart, elsePart) => {
            const left = readVar(v);
            let right = isNaN(val) ? val : Number(val);
            if (val === 'true') right = true;
            if (val === 'false') right = false;
            
            let pass = false;
            if (op === 'equals') pass = left === right;
            else if (op === 'not_equals') pass = left !== right;
            else if (op === 'gt') pass = left > right;
            else if (op === 'lt') pass = left < right;
            else if (op === 'gte') pass = left >= right;
            else if (op === 'lte') pass = left <= right;
            return pass ? thenPart : (elsePart || '');
        });
        return processed.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => readVar(k) ?? '');
    };

    const parseFormatting = (text) => {
        if (!text) return '';
        return text.replace(/~~(.*?)~~/g, '<span class="del-text">$1</span>')
                   .replace(/\[\[(.*?)\|(.*?)\]\]/g, '<span class="blood-reveal" data-hidden="$2">$1</span>');
    };

    const render = () => {
        const node = nodes[currentId];
        if (!node) {
            showError('无法定位节点: ' + currentId);
            return;
        }

        if (sanityIndicator) {
            sanityIndicator.textContent = `理智: ${Math.floor(state.sanity)}% | 危险度: ${state.danger}`;
        }

        if (node.image && sceneImage && imagePanel) {
            sceneImage.style.filter = 'none';
            sceneImage.src = node.image;
            imagePanel.classList.remove('hidden');
            const blur = Math.min(state.danger, 3);
            const dark = Math.max(0.4, 0.8 - (state.danger * 0.08));
            sceneImage.style.filter = `grayscale(100%) brightness(${dark}) blur(${blur}px)`;
        } else if (imagePanel) {
            imagePanel.classList.add('hidden');
        }

        let lines = (node.text || []).map(template);
        if (currentId === story.start && state.echo_line) {
            lines.unshift(state.echo_line, "");
        }
        storyEl.innerHTML = lines.map(parseFormatting).join('<br><br>');

        if (ambientTextEl) {
            const ambPool = (story.ambient || []).filter(a => state.danger >= (a.min_danger || 0) && state.sanity <= (a.max_sanity || 100));
            if (ambPool.length > 0 && Math.random() > 0.4) {
                ambientTextEl.innerHTML = parseFormatting(template(ambPool[Math.floor(Math.random() * ambPool.length)].text));
                ambientTextEl.className = 'ambient-text' + (state.danger >= 3 ? ' ambient-danger' : '');
            } else {
                ambientTextEl.innerHTML = '';
            }
        }

        choicesEl.innerHTML = '';
        if (node.ending) {
            saveEnding(node.id, node.ending_title || node.id);
            if (node.ending_type === 'death') state.death_count++;
            if (node.gain_fragment && !state.fragments.includes(node.gain_fragment)) state.fragments.push(node.gain_fragment);
            saveProgress();
            renderEndingBook();
            choicesEl.innerHTML = '<div class="system-glitch">--- 档案已记录 ---</div>';
            return;
        }

        const availChoices = (node.choices || []).filter(c => (c.conditions || []).every(conditionPass));
        if (availChoices.length === 0) {
            choicesEl.innerHTML = '<div class="system-glitch">（无路可走）</div>';
            return;
        }

        availChoices.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'choice';
            if (c.effects && c.effects.some(e => e.op === 'inc' && e.var === 'danger')) btn.classList.add('choice-danger');
            btn.innerHTML = parseFormatting(template(c.text));
            btn.onclick = () => {
                (c.effects || []).forEach(applyEffect);
                currentId = c.next;
                
                if (state.danger > 2) {
                    state.sanity = Math.max(0, state.sanity - (state.danger * 1.2));
                    document.body.style.animation = 'none';
                    void document.body.offsetWidth; 
                    document.body.style.animation = `shake 0.5s ease-in-out`;
                }
                
                if (state.sanity < 30) {
                    document.documentElement.style.filter = `hue-rotate(${Math.random() * 30}deg) sepia(0.2) contrast(1.1)`;
                } else {
                    document.documentElement.style.filter = 'none';
                }
                
                render();
            };
            choicesEl.appendChild(btn);
        });
    };

    const renderEndingBook = () => {
        const book = loadEndingBook();
        const keys = Object.keys(book);
        let html = `结局收集: <strong>${keys.length}</strong><br>`;
        keys.forEach(k => html += `- ${book[k]}<br>`);
        html += `<br>记忆碎片: ${state.fragments.length > 0 ? state.fragments.join('、') : '无'}<br>`;
        html += `轮回次数: ${state.death_count}`;
        endingBookEl.innerHTML = html;
    };

    const showError = (msg) => {
        storyEl.innerHTML = `<span style="color:var(--danger)">${msg}</span>`;
    };

    const boot = async () => {
        try {
            const resp = await fetch('./story/night_clinic.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error('无法加载剧情文件');
            story = await resp.json();
            story.nodes.forEach(n => nodes[n.id] = n);
            
            const progress = loadProgress();
            state = initState(progress);
            currentId = story.start;
            
            if (state.death_count > 0) {
                state.echo_line = state.death_count > 2 ? '你已经记不清第几次重回这里。' : '你又一次站在同一扇门内。';
            } else {
                state.echo_line = '你第一次站进这座大厅。';
            }

            restartBtn.onclick = () => { location.reload(); };
            renderEndingBook();
            render();
        } catch (e) {
            showError('启动失败: ' + e.message);
        }
    };

    boot();
})();