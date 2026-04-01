//https://pareto-workflows.storage.googleapis.com/212aca51fceb76764751447b75b2ae328a4d1f7c/webview-script.js

// ─── Tess Tis — WebView Script ──────────────────────────────────────────────
// Corre dentro do WebView (contexto de browser, sem acesso a Node.js)

const vscode = acquireVsCodeApi();

// ─── Elementos DOM ───────────────────────────────────────────────────────────

const messagesEl     = document.getElementById('messages');
const inputEl        = document.getElementById('userInput');
const sendBtn        = document.getElementById('sendBtn');
const modelSelect    = document.getElementById('modelSelect');
const codeBtn        = document.getElementById('codeBtn');
const clearBtn       = document.getElementById('clearBtn');
const watermarkEl    = document.getElementById('watermark');
const modelRowEl     = document.getElementById('modelRow');
const contextFillEl  = document.getElementById('contextFill');
const contextLabelEl = document.getElementById('contextLabel');

// ─── Estado ──────────────────────────────────────────────────────────────────

let history        = [];
let assistantBubble = null;
let waiting        = false;
let actualTokens   = null;
let configured     = false;

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

// ─── Render de conteúdo (seguro — sem innerHTML directo) ─────────────────────

/**
 * Converte texto simples em nós DOM, detectando URLs e criando <a> clicáveis.
 * Não usa innerHTML para evitar XSS.
 */
function renderTextWithLinks(text) {
    const fragment = document.createDocumentFragment();
    const urlRegex = /https?:\/\/[^\s\)\]\>"']+/g;
    let last = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > last) {
            fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        const a = document.createElement('a');
        a.href      = match[0];
        a.textContent = match[0];
        a.target    = '_blank';
        a.rel       = 'noopener noreferrer';
        fragment.appendChild(a);
        last = match.index + match[0].length;
    }
    if (last < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(last)));
    }
    return fragment;
}

/**
 * Renderiza markdown simples: blocos de código, negrito, itálico, listas e links.
 * Mantém-se seguro usando createElement em vez de innerHTML.
 */
function renderMarkdown(text) {
    const container = document.createElement('div');
    // Divide blocos de código ```...``` do resto
    const parts = text.split(/(```[\s\S]*?```)/g);

    for (const part of parts) {
        if (part.startsWith('```')) {
            const lines    = part.slice(3).split('\n');
            const lang     = lines[0].trim();
            const code     = lines.slice(1).join('\n').replace(/```$/, '');
            const pre      = document.createElement('pre');
            const codeEl   = document.createElement('code');
            if (lang) codeEl.className = 'language-' + lang;
            codeEl.textContent = code;
            pre.appendChild(codeEl);
            container.appendChild(pre);
        } else {
            // Processa o texto linha a linha para listas, negrito, itálico
            const lines = part.split('\n');
            let ul = null;
            for (const line of lines) {
                // Lista
                if (/^[\*\-] /.test(line)) {
                    if (!ul) { ul = document.createElement('ul'); container.appendChild(ul); }
                    const li = document.createElement('li');
                    li.appendChild(renderInline(line.slice(2)));
                    ul.appendChild(li);
                } else {
                    if (ul) ul = null;
                    if (line.trim() === '') {
                        container.appendChild(document.createElement('br'));
                    } else {
                        const p = document.createElement('p');
                        p.appendChild(renderInline(line));
                        container.appendChild(p);
                    }
                }
            }
        }
    }
    return container;
}

/**
 * Renderiza negrito, itálico e links dentro de uma linha de texto.
 */
function renderInline(text) {
    const fragment = document.createDocumentFragment();
    // Regex que captura **bold**, *italic* e URLs
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|https?:\/\/[^\s\)\]\>"']+)/g;
    let last = 0, match;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
            fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        if (match[0].startsWith('**')) {
            const b = document.createElement('strong');
            b.textContent = match[2];
            fragment.appendChild(b);
        } else if (match[0].startsWith('*')) {
            const em = document.createElement('em');
            em.textContent = match[3];
            fragment.appendChild(em);
        } else {
            const a = document.createElement('a');
            a.href = match[0]; a.textContent = match[0];
            a.target = '_blank'; a.rel = 'noopener noreferrer';
            fragment.appendChild(a);
        }
        last = match.index + match[0].length;
    }
    if (last < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(last)));
    }
    return fragment;
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
    label.className  = 'msg-label';
    label.textContent = role === 'user' ? 'Você' : 'Tess AI';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
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
    bubble.className  = 'msg-bubble';
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
    bubble.className  = 'msg-bubble';
    bubble.textContent = `🔧 A executar ferramenta: ${tool}${args ? ' → ' + args : ''}`;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollBottom();
}

function beginAssistantBubble() {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row assistant';
    const label  = document.createElement('div');
    label.className  = 'msg-label';
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
        // guarda o texto bruto no dataset para o histórico
        assistantBubble.dataset.raw = '';
    }
    const cursor = assistantBubble.querySelector('.cursor');
    if (cursor) cursor.remove();

    // Acumula o texto bruto
    assistantBubble.dataset.raw = (assistantBubble.dataset.raw ?? '') + text;

    // Adiciona o texto como nó de texto (seguro)
    assistantBubble.appendChild(document.createTextNode(text));

    // Re-adiciona o cursor
    const newCursor = document.createElement('span');
    newCursor.className = 'cursor';
    assistantBubble.appendChild(newCursor);

    scrollBottom();
}

function finalizeAssistant() {
    if (!assistantBubble) return;

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

    // ── Detecta tool calls ──────────────────────────────────────────────────
    const toolRegex   = /\[TOOL:(\w+)(?::([^\]]+))?\]/g;
    const toolMatches = [...rawText.matchAll(toolRegex)];

    if (toolMatches.length > 0) {
        const cleanText = rawText.replace(/\[TOOL:[^\]]+\]/g, '').trim();
        assistantBubble.textContent = '';
        if (cleanText) {
            assistantBubble.appendChild(renderMarkdown(cleanText));
        } else {
            assistantBubble.closest('.msg-row').remove();
        }
        assistantBubble = null;
        setWaiting(false);

        for (const match of toolMatches) {
            vscode.postMessage({ type: 'toolCall', tool: match[1], args: match[2] ?? null });
        }
        return; // não guarda no histórico ainda — aguarda resultado da ferramenta
    }

    // ── Resposta normal — re-renderiza com markdown ─────────────────────────
    assistantBubble.textContent = '';
    assistantBubble.appendChild(renderMarkdown(rawText));

    history.push({ role: 'assistant', content: rawText });
    saveHistory();

    assistantBubble = null;
    setWaiting(false);
    updateContextMeter();
}

// ─── Estado do input ─────────────────────────────────────────────────────────

function setWaiting(val) {
    waiting              = val;
    inputEl.disabled     = val;
    sendBtn.textContent  = val ? 'Parar' : 'Enviar';
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
        type: 'send',
        userText: text,
        model: modelSelect.value,
        history: history.slice(0, -1)
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
modelSelect.addEventListener('change', updateContextMeter);

clearBtn.addEventListener('click', () => {
    history      = [];
    actualTokens = null;
    assistantBubble = null;
    [...messagesEl.children].forEach(el => { if (el.id !== 'watermark') el.remove(); });
    const emptyDiv = document.createElement('div');
    emptyDiv.id = 'empty';
    emptyDiv.style.cssText = 'margin:auto;text-align:center;color:var(--vscode-descriptionForeground);font-size:13px;line-height:2';
    emptyDiv.innerHTML = 'Olá! Como posso ajudar?<br><small>O código do editor activo é incluído automaticamente.</small>';
    messagesEl.appendChild(emptyDiv);
    watermarkEl.classList.remove('hidden');
    setWaiting(false);
    updateContextMeter();
    saveHistory();
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
            // Mostra notificação visual da ferramenta a ser executada
            appendToolNotice(data.tool, data.args);
            break;

        case 'toolResult':
            // Injeta o resultado da ferramenta no histórico e continua a conversa
            history.push({
                role: 'user',
                content: `[Resultado da ferramenta ${data.tool}${data.args ? ': ' + data.args : ''}]\n\n${data.result}`
            });
            setWaiting(true);
            beginAssistantBubble();
            vscode.postMessage({
                type: 'send',
                userText: '',
                model: modelSelect.value,
                history: history.slice(0, -1),
                isTool: true
            });
            break;

        case 'insertCode':
            if (data.code) {
                const snippet = '```' + data.code.language + '\n' + data.code.code + '\n```';
                inputEl.value = inputEl.value ? inputEl.value + '\n\n' + snippet : snippet;
            } else {
                appendError('Nenhum editor activo. Abra um ficheiro de código primeiro.');
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

        case 'notConfigured':
            configured           = false;
            inputEl.disabled     = true;
            sendBtn.disabled     = true;
            codeBtn.disabled     = true;
            {
                const emptyEl = document.getElementById('empty');
                const msg = 'Configure a sua ligação à Tess antes de continuar.<br>'
                    + '<small>Ctrl+, → pesquise <strong>tess</strong> → preencha <em>API Key</em> e <em>Agent ID</em></small>';
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
                configured       = true;
                inputEl.disabled = false;
                sendBtn.disabled = false;
                codeBtn.disabled = false;
                const banner  = document.getElementById('not-configured-banner');
                if (banner) banner.remove();
                const emptyEl = document.getElementById('empty');
                if (emptyEl) emptyEl.innerHTML = 'Olá! Como posso ajudar?<br><small>O código do editor activo é incluído automaticamente.</small>';
            }
            if (data.models === null) {
                modelRowEl.classList.add('hidden');
            } else {
                modelRowEl.classList.remove('hidden');
                const current = modelSelect.value;
                modelSelect.innerHTML = data.models
                    .map(m => `<option value="${m.id}"${m.id === current ? ' selected' : ''}>${m.label}</option>`)
                    .join('');
                if (!data.models.find(m => m.id === current)) modelSelect.selectedIndex = 0;
                updateContextMeter();
            }
            break;

        case 'restoreHistory':
            history = data.history;
            watermarkEl.classList.add('hidden');
            for (const msg of history) { appendMessage(msg.role, msg.content); }
            if (data.model) modelSelect.value = data.model;
            updateContextMeter();
            break;
    }
});

// ─── Sinaliza ao provider que o WebView está pronto (ADR-004) ────────────────
vscode.postMessage({ type: 'ready' });
