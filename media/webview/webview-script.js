// ─── Tess Tis — WebView Script ──────────────────────────────────────────────
// Corre dentro do WebView (contexto de browser, sem acesso a Node.js)

const vscode = acquireVsCodeApi();

// ─── Elementos DOM ───────────────────────────────────────────────────────────

const messagesEl     = document.getElementById('messages');
const inputEl        = document.getElementById('userInput');
const sendBtn        = document.getElementById('sendBtn');
const modelSelect    = document.getElementById('modelSelect');
const codeBtn        = document.getElementById('codeBtn');
const contextBtn     = document.getElementById('contextBtn');
const historyBtn     = document.getElementById('historyBtn');
const clearBtn       = document.getElementById('clearBtn');
const watermarkEl    = document.getElementById('watermark');
const modelRowEl     = document.getElementById('modelRow');
const contextFillEl  = document.getElementById('contextFill');
const contextLabelEl = document.getElementById('contextLabel');

// ─── Estado ──────────────────────────────────────────────────────────────────

let history           = [];
let assistantBubble   = null;
let waiting           = false;
let actualTokens      = null;
let configured        = false;
let historyDrawerOpen = false;

// ─── Drawer de Histórico ─────────────────────────────────────────────────────

function buildHistoryDrawer() {
    if (document.getElementById('history-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'history-drawer';
    drawer.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'width:100%',
        'height:100%',
        'background:var(--vscode-sideBar-background)',
        'z-index:100',
        'display:flex',
        'flex-direction:column',
        'transform:translateX(-100%)',
        'transition:transform 0.2s ease',
        'border-right:1px solid var(--vscode-panel-border)'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:8px 12px',
        'border-bottom:1px solid var(--vscode-panel-border)',
        'flex-shrink:0'
    ].join(';');

    const title = document.createElement('span');
    title.textContent = 'Hist\u00f3rico de conversas';
    title.style.cssText = 'font-size:12px;font-weight:600;color:var(--vscode-foreground);';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Fechar';
    closeBtn.style.cssText = [
        'background:none',
        'border:none',
        'cursor:pointer',
        'color:var(--vscode-descriptionForeground)',
        'font-size:14px',
        'padding:0 4px',
        'line-height:1'
    ].join(';');
    closeBtn.addEventListener('click', closeHistoryDrawer);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const list = document.createElement('div');
    list.id = 'history-list';
    list.style.cssText = [
        'flex:1',
        'overflow-y:auto',
        'padding:8px 0'
    ].join(';');

    const loading = document.createElement('div');
    loading.style.cssText = 'padding:16px 12px;font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;';
    loading.textContent = 'A carregar...';
    list.appendChild(loading);

    drawer.appendChild(header);
    drawer.appendChild(list);

    document.body.style.position = 'relative';
    document.body.appendChild(drawer);
}

function openHistoryDrawer() {
    buildHistoryDrawer();
    historyDrawerOpen = true;
    const drawer = document.getElementById('history-drawer');
    if (drawer) drawer.style.transform = 'translateX(0)';
    vscode.postMessage({ type: 'getHistory' });
}

function closeHistoryDrawer() {
    historyDrawerOpen = false;
    const drawer = document.getElementById('history-drawer');
    if (drawer) drawer.style.transform = 'translateX(-100%)';
}

function renderHistoryList(sessions) {
    const list = document.getElementById('history-list');
    if (!list) return;

    list.innerHTML = '';

    if (!sessions || sessions.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:16px 12px;font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;';
        empty.textContent = 'Nenhuma conversa guardada.';
        list.appendChild(empty);
        return;
    }

    for (const session of sessions) {
        const item = document.createElement('div');
        item.style.cssText = [
            'display:flex',
            'flex-direction:column',
            'padding:8px 12px',
            'cursor:pointer',
            'border-bottom:1px solid var(--vscode-panel-border)',
            'transition:background 0.1s'
        ].join(';');

        item.addEventListener('mouseenter', () => { item.style.background = 'var(--vscode-list-hoverBackground)'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

        const titleEl = document.createElement('div');
        titleEl.textContent = session.title || 'Conversa sem t\u00edtulo';
        titleEl.style.cssText = [
            'font-size:12px',
            'color:var(--vscode-foreground)',
            'white-space:nowrap',
            'overflow:hidden',
            'text-overflow:ellipsis',
            'margin-bottom:3px'
        ].join(';');

        const meta = document.createElement('div');
        meta.style.cssText = 'display:flex;align-items:center;gap:6px;';

        const dateEl = document.createElement('span');
        dateEl.textContent = session.date;
        dateEl.style.cssText = 'font-size:10px;color:var(--vscode-descriptionForeground);';

        const modelEl = document.createElement('span');
        modelEl.textContent = (session.model && session.model !== 'auto') ? session.model : '';
        modelEl.style.cssText = 'font-size:10px;color:var(--vscode-descriptionForeground);opacity:0.7;';

        meta.appendChild(dateEl);
        if (session.model && session.model !== 'auto') meta.appendChild(modelEl);

        item.appendChild(titleEl);
        item.appendChild(meta);

        item.addEventListener('click', () => {
            vscode.postMessage({ type: 'loadSession', id: session.id });
            closeHistoryDrawer();
        });

        list.appendChild(item);
    }
}

// ─── Medidor de contexto ─────────────────────────────────────────────────────

function estimateTokens() {
    return Math.ceil(history.reduce((s, m) => s + m.content.length, 0) / 4);
}

function updateContextMeter() {
    const limits = window.MODEL_LIMITS || {};
    const limit  = limits[modelSelect.value] ?? 128000;
    const tokens = actualTokens ?? estimateTokens();
    const pct    = Math.min(tokens / limit * 100, 100);
    const color  = pct < 60
        ? 'var(--vscode-charts-green, #4ec9b0)'
        : pct < 80
            ? 'var(--vscode-charts-yellow, #cca700)'
            : 'var(--vscode-charts-red, #f14c4c)';
    contextFillEl.style.width      = pct + '%';
    contextFillEl.style.background = color;
    const limitStr = limit >= 1000000
        ? (limit / 1000000).toFixed(0) + 'M'
        : (limit / 1000).toFixed(0) + 'K';
    const tokStr = tokens >= 1000 ? (tokens / 1000).toFixed(1) + 'K' : tokens;
    const prefix = actualTokens ? '' : '~';
    contextLabelEl.textContent = prefix + tokStr + ' / ' + limitStr + ' tok';
}

function saveHistory() {
    vscode.postMessage({ type: 'saveHistory', history, model: modelSelect.value });
}

// ─── Render inline (negrito, itálico, código, links) ─────────────────────────

function appendInline(parent, text) {
    const inlineRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|https?:\/\/[^\s\)\]\>"']+)/g;
    let last  = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > last) {
            parent.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        if (match[0].startsWith('**')) {
            const strong       = document.createElement('strong');
            strong.textContent = match[2];
            parent.appendChild(strong);
        } else if (match[0].startsWith('*')) {
            const em       = document.createElement('em');
            em.textContent = match[3];
            parent.appendChild(em);
        } else if (match[0].startsWith('`')) {
            const code       = document.createElement('code');
            code.textContent = match[4];
            parent.appendChild(code);
        } else {
            const a       = document.createElement('a');
            a.href        = match[0];
            a.textContent = match[0];
            a.target      = '_blank';
            a.rel         = 'noopener noreferrer';
            parent.appendChild(a);
        }
        last = match.index + match[0].length;
    }

    if (last < text.length) {
        parent.appendChild(document.createTextNode(text.slice(last)));
    }
}

// ─── Render Markdown ──────────────────────────────────────────────────────────

function renderMarkdown(text) {
    const container = document.createElement('div');

    // Separa blocos de código do texto normal usando exec() com índices explícitos
    // (mais robusto que split() para conteúdo multiline)
    const parts = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let lastIndex = 0;
    let m;
    while ((m = codeBlockRegex.exec(text)) !== null) {
        if (m.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, m.index) });
        }
        parts.push({ type: 'code', content: m[0] });
        lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    for (const part of parts) {

        // ── Bloco de código ──────────────────────────────────────────────────
        if (part.type === 'code') {
            const raw    = part.content;
            const inner  = raw.slice(3, -3);
            const lines  = inner.split('\n');
            const lang   = lines[0].trim();
            const code   = lines.slice(1).join('\n');

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;margin:8px 0;';

            const pre    = document.createElement('pre');
            pre.style.margin = '0';
            const codeEl = document.createElement('code');
            if (lang) codeEl.className = 'language-' + lang;
            codeEl.textContent = code;
            pre.appendChild(codeEl);

            const copyBtn = document.createElement('button');
            copyBtn.textContent   = 'Copiar';
            copyBtn.style.cssText = [
                'position:absolute',
                'top:6px',
                'right:6px',
                'padding:2px 8px',
                'font-size:10px',
                'cursor:pointer',
                'border-radius:3px',
                'border:1px solid var(--vscode-panel-border)',
                'background:var(--vscode-editor-background)',
                'color:var(--vscode-descriptionForeground)',
                'opacity:0',
                'transition:opacity 0.15s ease'
            ].join(';');

            wrapper.addEventListener('mouseenter', () => { copyBtn.style.opacity = '1'; });
            wrapper.addEventListener('mouseleave', () => { copyBtn.style.opacity = '0'; });

            copyBtn.addEventListener('click', () => {
                const doSuccess = () => {
                    copyBtn.textContent = '\u2713 Copiado';
                    copyBtn.style.color = 'var(--vscode-charts-green, #4ec9b0)';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copiar';
                        copyBtn.style.color = 'var(--vscode-descriptionForeground)';
                    }, 1500);
                };
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(code).then(doSuccess).catch(() => fallbackCopy(code, doSuccess));
                } else {
                    fallbackCopy(code, doSuccess);
                }
            });

            wrapper.appendChild(pre);
            wrapper.appendChild(copyBtn);
            container.appendChild(wrapper);
            continue;
        }

        // ── Texto normal — linha a linha ─────────────────────────────────────
        const lines = part.content.split('\n');
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (line.trim() === '') { i++; continue; }

            // Cabeçalhos
            const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const el    = document.createElement('h' + (level + 2));
                el.style.cssText = 'margin:8px 0 4px;font-weight:600;font-size:'
                    + (level === 1 ? '15px' : level === 2 ? '13px' : '12px');
                appendInline(el, headingMatch[2]);
                container.appendChild(el);
                i++;
                continue;
            }

            // Linha horizontal
            if (/^---+$/.test(line.trim())) {
                const hr = document.createElement('hr');
                hr.style.cssText = 'border:none;border-top:1px solid var(--vscode-panel-border);margin:8px 0;';
                container.appendChild(hr);
                i++;
                continue;
            }

            // Checkboxes
            if (/^\s*-\s+\[[ x]\]/i.test(line)) {
                const ul = document.createElement('ul');
                ul.style.cssText = 'margin:4px 0;padding-left:20px;list-style:none;';
                while (i < lines.length && /^\s*-\s+\[[ x]\]/i.test(lines[i])) {
                    const checked = /\[x\]/i.test(lines[i]);
                    const li      = document.createElement('li');
                    li.style.margin = '2px 0';
                    const cb      = document.createElement('input');
                    cb.type       = 'checkbox';
                    cb.checked    = checked;
                    cb.disabled   = true;
                    cb.style.marginRight = '6px';
                    li.appendChild(cb);
                    appendInline(li, lines[i].replace(/^\s*-\s+\[[ x]\]\s*/i, ''));
                    ul.appendChild(li);
                    i++;
                }
                container.appendChild(ul);
                continue;
            }

            // Listas não ordenadas
            if (/^\s*[-*\u2022]\s+/.test(line)) {
                const ul = document.createElement('ul');
                ul.style.cssText = 'margin:4px 0;padding-left:20px;';
                while (i < lines.length && /^\s*[-*\u2022]\s+/.test(lines[i])) {
                    const li = document.createElement('li');
                    li.style.margin = '2px 0';
                    appendInline(li, lines[i].replace(/^\s*[-*\u2022]\s+/, ''));
                    ul.appendChild(li);
                    i++;
                }
                container.appendChild(ul);
                continue;
            }

            // Listas ordenadas
            if (/^\s*\d+\.\s+/.test(line)) {
                const ol = document.createElement('ol');
                ol.style.cssText = 'margin:4px 0;padding-left:20px;';
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                    const li = document.createElement('li');
                    li.style.margin = '2px 0';
                    appendInline(li, lines[i].replace(/^\s*\d+\.\s+/, ''));
                    ol.appendChild(li);
                    i++;
                }
                container.appendChild(ol);
                continue;
            }

            // Parágrafo normal
            const p = document.createElement('p');
            p.style.margin = '4px 0';
            appendInline(p, line);
            container.appendChild(p);
            i++;
        }
    }

    return container;
}

function fallbackCopy(text, onSuccess) {
    const ta         = document.createElement('textarea');
    ta.value         = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        onSuccess();
    } catch (e) {
        console.error('[Tess] Falha ao copiar:', e);
    }
    document.body.removeChild(ta);
}

// ─── Mensagens ───────────────────────────────────────────────────────────────

function removeEmpty() {
    const e = document.getElementById('empty');
    if (e) e.remove();
}

function appendMessage(role, content) {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row ' + role;
    const label  = document.createElement('div');
    label.className   = 'msg-label';
    label.textContent = role === 'user' ? 'Voc\u00ea' : 'Tess AI';
    const bubble = document.createElement('div');
    bubble.className  = 'msg-bubble';
    if (role === 'user') {
        bubble.textContent = content;
    } else {
        bubble.appendChild(renderMarkdown(content));
    }
    row.appendChild(label);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollBottom();
    return bubble;
}

function appendError(text) {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row error';
    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollBottom();
}

function appendToolNotice(tool, args) {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row tool';
    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
    bubble.textContent = '\u{1F527} A executar ferramenta: ' + tool + (args ? ' \u2192 ' + args : '');
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollBottom();
}

function beginAssistantBubble() {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row assistant';
    const label  = document.createElement('div');
    label.className   = 'msg-label';
    label.textContent = 'Tess AI';
    assistantBubble   = document.createElement('div');
    assistantBubble.className = 'msg-bubble';
    assistantBubble.innerHTML = '<span class="thinking">Pensando<span class="thinking-dot">.</span><span class="thinking-dot">.</span><span class="thinking-dot">.</span></span>';
    row.appendChild(label);
    row.appendChild(assistantBubble);
    messagesEl.appendChild(row);
    scrollBottom();
}

function appendChunk(text) {
    if (!assistantBubble) return;
    const thinking = assistantBubble.querySelector('.thinking');
    if (thinking) {
        assistantBubble.textContent = '';
        assistantBubble.dataset.raw = '';
    }
    const cursor = assistantBubble.querySelector('.cursor');
    if (cursor) cursor.remove();

    assistantBubble.dataset.raw = (assistantBubble.dataset.raw ?? '') + text;
    assistantBubble.appendChild(document.createTextNode(text));

    const newCursor = document.createElement('span');
    newCursor.className = 'cursor';
    assistantBubble.appendChild(newCursor);

    scrollBottom();
}

function _extractLastCodeBlock(text, tagIndex) {
    const segment = text.slice(0, tagIndex);
    const regex   = /```(?:\w+)?\n([\s\S]*?)```/g;
    let last = null;
    let m;
    while ((m = regex.exec(segment)) !== null) { last = m[1]; }
    return last;
}

function finalizeAssistant() {
    if (!assistantBubble) return;

    try {
        const cursor = assistantBubble.querySelector('.cursor');
        if (cursor) cursor.remove();

        const thinking = assistantBubble.querySelector('.thinking');
        const rawText  = assistantBubble.dataset.raw ?? assistantBubble.textContent;

        if (thinking || rawText.trim() === '') {
            assistantBubble.closest('.msg-row').remove();
            assistantBubble = null;
            setWaiting(false);
            updateContextMeter();
            return;
        }

        const toolRegex   = /\[TOOL:(\w+)(?::([^\]]+))?\]/g;
        const toolMatches = [...rawText.matchAll(toolRegex)];

        if (toolMatches.length > 0) {
            const cleanText = rawText.replace(/\[TOOL:[^\]]+\]/g, '').trim();
            assistantBubble.textContent = '';
            if (cleanText) {
                assistantBubble.appendChild(renderMarkdown(cleanText));
                history.push({ role: 'assistant', content: cleanText });
                saveHistory();
            } else {
                assistantBubble.closest('.msg-row').remove();
            }
            assistantBubble = null;
            setWaiting(false);

            for (const match of toolMatches) {
                const tool    = match[1];
                const args    = match[2] ?? null;
                const content = (tool === 'write_file' || tool === 'edit_file')
                    ? _extractLastCodeBlock(rawText, match.index)
                    : null;
                vscode.postMessage({ type: 'toolCall', tool, args, content });
            }
            return;
        }

        assistantBubble.textContent = '';
        assistantBubble.appendChild(renderMarkdown(rawText));

        history.push({ role: 'assistant', content: rawText });
        saveHistory();

        assistantBubble = null;
        setWaiting(false);
        updateContextMeter();

    } catch (err) {
        console.error('[Tess] Erro em finalizeAssistant:', err);
        if (assistantBubble) {
            assistantBubble.closest('.msg-row')?.remove();
            assistantBubble = null;
        }
        setWaiting(false);
        updateContextMeter();
    }
}

// ─── Estado do input ─────────────────────────────────────────────────────────

function setWaiting(val) {
    waiting                  = val;
    inputEl.disabled         = val;
    sendBtn.textContent      = val ? 'Parar' : 'Enviar';
    sendBtn.style.background = val ? 'var(--vscode-errorForeground)' : '';
    sendBtn.style.color      = val ? 'white' : '';
}

function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + 'px';
}

// ─── Envio de mensagem ────────────────────────────────────────────────────────

function send() {
    if (!configured) return;
    if (waiting) { vscode.postMessage({ type: 'cancel' }); return; }
    const text = inputEl.value.trim();
    if (!text) return;
    watermarkEl.classList.add('hidden');
    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    inputEl.value = '';
    autoResize();
    setWaiting(true);
    beginAssistantBubble();
    actualTokens = null;
    updateContextMeter();
    vscode.postMessage({
        type:     'send',
        userText: text,
        model:    modelSelect.value,
        history:  history.slice(0, -1)
    });
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

sendBtn.addEventListener('click', send);

inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

inputEl.addEventListener('input', () => {
    autoResize();
    watermarkEl.classList.toggle('hidden', inputEl.value.length > 0);
});

codeBtn.addEventListener('click', () => vscode.postMessage({ type: 'pickFile' }));
contextBtn.addEventListener('click', () => vscode.postMessage({ type: 'getWorkspaceContext' }));

// ── Histórico: abre/fecha o drawer inline ────────────────────────────────────
historyBtn.addEventListener('click', () => {
    if (historyDrawerOpen) {
        closeHistoryDrawer();
    } else {
        openHistoryDrawer();
    }
});

modelSelect.addEventListener('change', updateContextMeter);

clearBtn.addEventListener('click', () => {
    history         = [];
    actualTokens    = null;
    assistantBubble = null;
    [...messagesEl.children].forEach(el => { if (el.id !== 'watermark') el.remove(); });
    const emptyDiv = document.createElement('div');
    emptyDiv.id = 'empty';
    emptyDiv.style.cssText = 'margin:auto;text-align:center;color:var(--vscode-descriptionForeground);font-size:13px;line-height:2';
    emptyDiv.innerHTML = 'Ol\u00e1! Como posso ajudar?<br><small>O c\u00f3digo do editor activo \u00e9 inclu\u00eddo automaticamente.</small>';
    messagesEl.appendChild(emptyDiv);
    watermarkEl.classList.remove('hidden');
    setWaiting(false);
    updateContextMeter();
    saveHistory();
    vscode.postMessage({ type: 'newChat' });
});

// ─── Mensagens da extensão (postMessage) ─────────────────────────────────────

window.addEventListener('message', ({ data }) => {
    switch (data.type) {

        case 'chunk':
            appendChunk(data.text);
            break;

        case 'startResponse':
            break;

        case 'endResponse':
        case 'cancelled':
            finalizeAssistant();
            break;

        case 'usage':
            if (data.usage?.total_tokens) {
                actualTokens = data.usage.total_tokens;
                updateContextMeter();
            }
            break;

        case 'error':
            if (assistantBubble) {
                assistantBubble.closest('.msg-row').remove();
                assistantBubble = null;
                if (history.length > 0 && history[history.length - 1].role === 'user') {
                    history.pop();
                }
            }
            appendError(data.text);
            setWaiting(false);
            break;

        case 'toolCall':
            appendToolNotice(data.tool, data.args);
            break;

        case 'toolResult': {
            const toolContent = '[Resultado da ferramenta ' + data.tool
                + (data.args ? ': ' + data.args : '') + ']\n\n' + data.result;
            history.push({ role: 'user', content: toolContent });
            setWaiting(true);
            beginAssistantBubble();
            vscode.postMessage({
                type:     'send',
                userText: toolContent,
                model:    modelSelect.value,
                history:  history.slice(0, -1),
                isTool:   true
            });
            break;
        }

        case 'insertCode':
            if (data.code) {
                const snippet = '```' + data.code.language + '\n' + data.code.code + '\n```';
                inputEl.value = inputEl.value ? inputEl.value + '\n\n' + snippet : snippet;
            } else {
                appendError('Nenhum editor activo. Abra um ficheiro de c\u00f3digo primeiro.');
            }
            autoResize();
            inputEl.focus();
            break;

        case 'insertFiles':
            if (data.files?.length > 0) {
                const snippets = data.files
                    .map(f => '```' + f.language + '\n// ' + f.path + '\n' + f.code + '\n```')
                    .join('\n\n');
                inputEl.value = inputEl.value ? inputEl.value + '\n\n' + snippets : snippets;
                autoResize();
                inputEl.focus();
            }
            break;

        case 'insertContext':
            if (data.context) {
                const prefix = '<!-- Contexto do projecto: ' + data.label + ' -->\n';
                const block  = '\n' + data.context + '\n';
                inputEl.value = inputEl.value
                    ? inputEl.value + '\n\n' + prefix + block
                    : prefix + block;
                autoResize();
                inputEl.focus();
            }
            break;

        case 'notConfigured':
            configured          = false;
            inputEl.disabled    = true;
            sendBtn.disabled    = true;
            codeBtn.disabled    = true;
            contextBtn.disabled = true;
            {
                const emptyEl = document.getElementById('empty');
                const msg = 'Configure a sua liga\u00e7\u00e3o \u00e0 Tess antes de continuar.<br>'
                    + '<small>Ctrl+, \u2192 pesquise <strong>tess</strong> \u2192 preencha <em>API Key</em> e <em>Agent ID</em></small>';
                if (emptyEl) {
                    emptyEl.innerHTML = msg;
                } else {
                    const banner = document.getElementById('not-configured-banner') || document.createElement('div');
                    banner.id = 'not-configured-banner';
                    banner.style.cssText = 'padding:12px;text-align:center;font-size:12px;'
                        + 'color:var(--vscode-descriptionForeground);'
                        + 'border-bottom:1px solid var(--vscode-panel-border);'
                        + 'background:var(--vscode-sideBar-background);flex-shrink:0;';
                    banner.innerHTML = msg;
                    messagesEl.parentElement.insertBefore(banner, messagesEl);
                }
            }
            break;

        case 'setModels':
            if (!configured) {
                configured          = true;
                inputEl.disabled    = false;
                sendBtn.disabled    = false;
                codeBtn.disabled    = false;
                contextBtn.disabled = false;
                const banner  = document.getElementById('not-configured-banner');
                if (banner) banner.remove();
                const emptyEl = document.getElementById('empty');
                if (emptyEl) emptyEl.innerHTML = 'Ol\u00e1! Como posso ajudar?<br><small>O c\u00f3digo do editor activo \u00e9 inclu\u00eddo automaticamente.</small>';
            }
            if (data.models === null) {
                modelRowEl.classList.add('hidden');
            } else {
                modelRowEl.classList.remove('hidden');
                const current = modelSelect.value;
                modelSelect.innerHTML = data.models
                    .map(m => '<option value="' + m.id + '"' + (m.id === current ? ' selected' : '') + '>' + m.label + '</option>')
                    .join('');
                if (!data.models.find(m => m.id === current)) modelSelect.selectedIndex = 0;
                updateContextMeter();
            }
            break;

        // ── Histórico inline ─────────────────────────────────────────────────
        case 'historyList':
            renderHistoryList(data.sessions);
            break;

        case 'restoreHistory':
            history         = [];
            actualTokens    = null;
            assistantBubble = null;
            [...messagesEl.children].forEach(el => { if (el.id !== 'watermark') el.remove(); });

            history = data.history.map(m => ({ role: m.role, content: m.content }));

            if (history.length > 0) {
                watermarkEl.classList.add('hidden');
                for (const msg of history) { appendMessage(msg.role, msg.content); }
            } else {
                watermarkEl.classList.remove('hidden');
            }

            if (data.model && data.model !== 'auto') modelSelect.value = data.model;
            updateContextMeter();
            break;
    }
});

// ─── Sinaliza ao provider que o WebView está pronto (ADR-004) ────────────────
vscode.postMessage({ type: 'ready' });