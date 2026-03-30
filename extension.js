const vscode = require('vscode');
const axios = require('axios');
const path = require('node:path');

const BASE_URL = 'https://api.tess.im';

const MODELS = [
    { id: 'auto',               label: 'Auto (Tess escolhe)' },
    { id: 'tess-5',             label: 'Tess 5' },
    { id: 'claude-opus-4-5',   label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
    { id: 'gpt-4o',            label: 'GPT-4o' },
    { id: 'gpt-4.1',           label: 'GPT-4.1' },
    { id: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash' },
];

// ─── WebviewViewProvider ───────────────────────────────────────────────────────

class TessChatViewProvider {
    _view = null;
    _abortController = null;

    constructor(context) {
        this._context = context;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const logoUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'Icone_Tis.png')
        );
        webviewView.webview.html = buildHtml(logoUri);

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'send':
                    this._abortController = new AbortController();
                    await handleSend(this._view, msg.userText, msg.model, msg.history, this._abortController.signal);
                    this._abortController = null;
                    break;
                case 'cancel':
                    if (this._abortController) this._abortController.abort();
                    break;
                case 'getCode':
                    this._view.webview.postMessage({ type: 'insertCode', code: getCurrentCode() });
                    break;
                case 'pickFile':
                    await pickWorkspaceFiles(this._view);
                    break;
                case 'saveHistory':
                    this._context.workspaceState.update('tess.history', msg.history);
                    this._context.workspaceState.update('tess.model',   msg.model);
                    break;
            }
        });

        // Restaurar sessão e sincronizar config do agente após o webview estar pronto
        const savedHistory = this._context.workspaceState.get('tess.history', []);
        const savedModel   = this._context.workspaceState.get('tess.model',   'auto');
        setTimeout(() => {
            if (savedHistory.length > 0) {
                this._view.webview.postMessage({ type: 'restoreHistory', history: savedHistory, model: savedModel });
            }
            this._syncConfig();
        }, 150);

        // Re-sincronizar quando o utilizador alterar as definições
        this._context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('tess')) this._syncConfig();
            })
        );
    }

    _syncConfig() {
        const config  = vscode.workspace.getConfiguration('tess');
        const apiKey  = config.get('apiKey');
        const agentId = config.get('agentId');
        if (this._view) syncAgentConfig(this._view, apiKey, agentId);
    }

    insertCode() {
        if (!this._view) return;
        this._view.webview.postMessage({ type: 'insertCode', code: getCurrentCode() });
        this._view.show(true);
    }
}

// ─── Código do editor ──────────────────────────────────────────────────────────

function getCurrentCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    const selection = editor.selection;
    const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);
    return { code, language: editor.document.languageId };
}

// ─── Árvore do workspace ───────────────────────────────────────────────────────

async function getWorkspaceTree() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;

    const rootUri  = folders[0].uri;
    const rootPath = rootUri.fsPath.replaceAll('\\', '/');
    const exclude  = '{**/node_modules/**,**/.git/**,**/.claude/**,**/*.vsix,**/out/**,**/dist/**}';

    const files = await vscode.workspace.findFiles('**/*', exclude, 300);
    if (files.length === 0) return null;

    const lines = files
        .map(f => f.fsPath.replaceAll('\\', '/').replace(rootPath + '/', ''))
        .sort();

    return `Ficheiros do projecto (${path.basename(rootPath)}):\n${lines.join('\n')}`;
}

// ─── File picker ───────────────────────────────────────────────────────────────

async function pickWorkspaceFiles(view) {
    const folders = vscode.workspace.workspaceFolders;
    const uris = await vscode.window.showOpenDialog({
        defaultUri: folders?.[0]?.uri,
        canSelectMany: true,
        canSelectFiles: true,
        canSelectFolders: false,
        title: 'Adicionar ficheiros ao contexto'
    });
    if (!uris || uris.length === 0) return;

    const files = await Promise.all(uris.map(async (uri) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        return {
            path: vscode.workspace.asRelativePath(uri),
            language: doc.languageId,
            code: doc.getText()
        };
    }));

    view.webview.postMessage({ type: 'insertFiles', files });
}

// ─── Configuração do agente ────────────────────────────────────────────────────

async function fetchAgentModels(apiKey, agentId) {
    try {
        const res = await axios.get(`${BASE_URL}/agents/${agentId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000
        });
        const questions = res.data?.questions ?? res.data?.data?.questions ?? [];
        const modelQ = questions.find(q => q.name === 'model' || q.slug === 'model');
        if (!modelQ) return null; // agente com modelo fixo — sem selector

        // A API pode usar .options ou .answers como lista de escolhas
        const raw = modelQ.options ?? modelQ.answers ?? modelQ.choices ?? [];
        const models = raw
            .filter(o => o.value || o.id)
            .map(o => ({ id: o.value ?? o.id, label: o.label ?? o.name ?? o.value ?? o.id }));
        return models.length > 0 ? models : null;
    } catch (err) {
        console.warn('[Tess] Não foi possível obter modelos do agente:', err.message);
        return undefined; // undefined = erro de rede, manter lista estática
    }
}

async function syncAgentConfig(view, apiKey, agentId) {
    if (!apiKey || !agentId) return;
    const models = await fetchAgentModels(apiKey, agentId);
    // null  → agente com modelo fixo, esconde selector
    // array → modelos disponíveis para este agente
    // undefined → erro, mantém lista actual
    if (models !== undefined) {
        view.webview.postMessage({ type: 'setModels', models });
    }
}

// ─── Chamada à API ─────────────────────────────────────────────────────────────

function parseSSELines(lines, view) {
    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { view.webview.postMessage({ type: 'endResponse' }); return; }
        try {
            const parsed = JSON.parse(raw);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) view.webview.postMessage({ type: 'chunk', text });
            if (parsed.usage) view.webview.postMessage({ type: 'usage', usage: parsed.usage });
        } catch { /* linha incompleta */ }
    }
}

async function readErrorBody(data) {
    if (typeof data?.pipe !== 'function') {
        console.error('[Tess] Erro API:', JSON.stringify(data));
        return data?.message || data?.error || data?.detail || null;
    }
    const chunks = [];
    await new Promise((res, rej) => {
        data.on('data', c => chunks.push(c));
        data.on('end', res);
        data.on('error', rej);
    });
    const body = JSON.parse(Buffer.concat(chunks).toString());
    console.error('[Tess] Erro API:', JSON.stringify(body));
    return body.message || body.error || body.detail || null;
}

async function handleSend(view, userText, model, history, signal) {
    const config  = vscode.workspace.getConfiguration('tess');
    const apiKey  = config.get('apiKey');
    const agentId = config.get('agentId');

    if (!apiKey) {
        view.webview.postMessage({ type: 'error', text: 'API Key não configurada. Vá a Definições → tess.apiKey' });
        return;
    }
    if (!agentId) {
        view.webview.postMessage({ type: 'error', text: 'Agent ID não configurado. Vá a Definições → tess.agentId' });
        return;
    }

    // Inclui automaticamente o código do editor activo como contexto
    const codeInfo = getCurrentCode();
    let fullUserText = userText;
    if (codeInfo) {
        fullUserText = `${userText}\n\n\`\`\`${codeInfo.language}\n${codeInfo.code}\n\`\`\``;
    }

    // Na primeira mensagem da conversa, injecta silenciosamente a árvore do workspace
    if (history.length === 0) {
        const tree = await getWorkspaceTree();
        if (tree) fullUserText = `${tree}\n\n---\n\n${fullUserText}`;
    }

    const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: fullUserText }
    ];

    const body = { messages, stream: true };
    if (model !== 'auto') body.model = model;

    try {
        console.log(`[Tess] → POST ${BASE_URL}/agents/${agentId}/openai/chat/completions (model: ${model})`);
        view.webview.postMessage({ type: 'startResponse' });

        const response = await axios.post(
            `${BASE_URL}/agents/${agentId}/openai/chat/completions`,
            body,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream',
                timeout: 300000,
                signal
            }
        );

        let buffer = '';

        response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            parseSSELines(lines, view);
        });

        response.data.on('end',   () => view.webview.postMessage({ type: 'endResponse' }));
        response.data.on('error', (err) => {
            console.error('[Tess] Erro de stream:', err.message, err.code);
            view.webview.postMessage({ type: 'error', text: `Erro de ligação: ${err.message}` });
        });

    } catch (error) {
        console.error('[Tess] Erro na chamada:', error.message, '| code:', error.code, '| status:', error.response?.status);
        if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
            view.webview.postMessage({ type: 'cancelled' });
            return;
        }
        let msg = error.message;
        if (error.response?.data) {
            try {
                msg = await readErrorBody(error.response.data) ?? msg;
            } catch (e) {
                console.error('[Tess] Falha ao ler erro:', e.message);
            }
        }
        view.webview.postMessage({ type: 'error', text: `Erro ${error.response?.status ?? ''}: ${msg}` });
    }
}

// ─── HTML do Webview ───────────────────────────────────────────────────────────

function buildHtml(logoUri) {
    const modelOptions = MODELS
        .map(m => `<option value="${m.id}">${m.label}</option>`)
        .join('');

    return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tess AI</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  #toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
  }
  #toolbar label { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
  select {
    flex: 1;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 3px;
    padding: 3px 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .btn-ghost {
    background: none;
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground);
    border-radius: 3px;
    padding: 3px 8px;
    cursor: pointer;
    font-size: 11px;
    white-space: nowrap;
  }
  .btn-ghost:hover { background: var(--vscode-toolbar-hoverBackground); }
  #modelRow { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  #modelRow.hidden { display: none; }

  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
  }
  #watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: opacity 0.4s ease;
    opacity: 0.07;
  }
  #watermark.hidden { opacity: 0; }
  #watermark img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    filter: grayscale(100%);
    display: block;
  }
  #empty {
    margin: auto;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
    line-height: 2;
  }
  .msg-row { display: flex; flex-direction: column; }
  .msg-row.user      { align-items: flex-end; }
  .msg-row.assistant { align-items: flex-start; }
  .msg-label { font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 3px; padding: 0 4px; }
  .msg-bubble {
    max-width: 88%;
    border-radius: 10px;
    padding: 10px 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 13px;
  }
  .msg-row.user .msg-bubble {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-bottom-right-radius: 3px;
  }
  .msg-row.assistant .msg-bubble {
    background: var(--vscode-editor-inactiveSelectionBackground);
    border: 1px solid var(--vscode-panel-border);
    border-bottom-left-radius: 3px;
  }
  .msg-row.error .msg-bubble {
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    color: var(--vscode-errorForeground, #f48771);
    font-size: 12px;
    align-self: center;
    text-align: center;
  }
  .cursor {
    display: inline-block;
    width: 2px;
    height: 13px;
    background: var(--vscode-foreground);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink .9s step-end infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }
  .thinking {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
  }
  .thinking-dot {
    display: inline-block;
    animation: thinking-pulse 1.4s ease-in-out infinite;
    opacity: 0;
  }
  .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes thinking-pulse { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }

  #inputArea {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border);
  }
  #inputRow { display: flex; gap: 6px; align-items: flex-end; }
  textarea {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: inherit;
    font-size: inherit;
    resize: none;
    min-height: 38px;
    max-height: 130px;
    outline: none;
    line-height: 1.5;
  }
  textarea:focus  { border-color: var(--vscode-focusBorder); }
  textarea:disabled { opacity: 0.5; }
  #sendBtn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 6px;
    padding: 0 16px;
    height: 38px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  #sendBtn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  #sendBtn:disabled { opacity: 0.45; cursor: not-allowed; }
  #hint { font-size: 10px; color: var(--vscode-descriptionForeground); }
  #contextStatus {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #contextBar {
    flex: 1;
    height: 3px;
    background: var(--vscode-panel-border);
    border-radius: 2px;
    overflow: hidden;
  }
  #contextFill {
    height: 100%;
    width: 0%;
    background: var(--vscode-charts-green, #4ec9b0);
    border-radius: 2px;
    transition: width 0.4s ease, background 0.4s ease;
  }
  #contextLabel {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    min-width: 90px;
    text-align: right;
  }
</style>
</head>
<body>

<div id="toolbar">
  <div id="modelRow">
    <label>Modelo:</label>
    <select id="modelSelect">${modelOptions}</select>
  </div>
  <button class="btn-ghost" id="clearBtn">Limpar</button>
</div>

<div id="messages">
  <div id="watermark"><img src="${logoUri}" alt="TIS"></div>
  <div id="empty">
    Olá! Como posso ajudar?<br>
    <small>O código do editor activo é incluído automaticamente.</small>
  </div>
</div>

<div id="inputArea">
  <button class="btn-ghost" id="codeBtn">📁 Adicionar ficheiros</button>
  <div id="inputRow">
    <textarea id="userInput" placeholder="Escreva aqui... (Enter envia, Shift+Enter nova linha)" rows="1"></textarea>
    <button id="sendBtn">Enviar</button>
  </div>
  <div id="contextStatus">
    <div id="contextBar"><div id="contextFill"></div></div>
    <span id="contextLabel">contexto: 0 tok</span>
  </div>
  <div id="hint">Enter para enviar · Shift+Enter para nova linha</div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  const messagesEl    = document.getElementById('messages');
  const inputEl       = document.getElementById('userInput');
  const sendBtn       = document.getElementById('sendBtn');
  const modelSelect   = document.getElementById('modelSelect');
  const codeBtn       = document.getElementById('codeBtn');
  const clearBtn      = document.getElementById('clearBtn');
  const watermarkEl   = document.getElementById('watermark');
  const modelRowEl    = document.getElementById('modelRow');
  const contextFillEl = document.getElementById('contextFill');
  const contextLabelEl= document.getElementById('contextLabel');

  const MODEL_LIMITS = {
    'auto': 128000, 'tess-5': 128000,
    'claude-opus-4-5': 200000, 'claude-sonnet-4-5': 200000, 'claude-haiku-4-5': 200000,
    'gpt-4o': 128000, 'gpt-4.1': 128000,
    'gemini-2.5-pro': 1000000, 'gemini-2.0-flash': 1000000
  };

  let history = [];
  let assistantBubble = null;
  let waiting = false;
  let actualTokens = null;

  // ── Medidor de contexto ──────────────────────────────────────────────────────

  function estimateTokens() {
    return Math.ceil(history.reduce((s, m) => s + m.content.length, 0) / 4);
  }

  function updateContextMeter() {
    const limit  = MODEL_LIMITS[modelSelect.value] ?? 128000;
    const tokens = actualTokens ?? estimateTokens();
    const pct    = Math.min(tokens / limit * 100, 100);
    const color  = pct < 60
      ? 'var(--vscode-charts-green, #4ec9b0)'
      : pct < 80
        ? 'var(--vscode-charts-yellow, #cca700)'
        : 'var(--vscode-charts-red, #f14c4c)';
    contextFillEl.style.width      = pct + '%';
    contextFillEl.style.background = color;
    const limitStr = limit >= 1000000 ? (limit / 1000000).toFixed(0) + 'M' : (limit / 1000).toFixed(0) + 'K';
    const tokStr   = tokens >= 1000   ? (tokens / 1000).toFixed(1) + 'K' : tokens;
    const prefix   = actualTokens ? '' : '~';
    contextLabelEl.textContent = prefix + tokStr + ' / ' + limitStr + ' tok';
  }

  function saveHistory() {
    vscode.postMessage({ type: 'saveHistory', history, model: modelSelect.value });
  }

  // ── Envio de mensagem ────────────────────────────────────────────────────────

  function send() {
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
    vscode.postMessage({ type: 'send', userText: text, model: modelSelect.value, history: history.slice(0, -1) });
  }

  // ── Render de mensagens ──────────────────────────────────────────────────────

  function removeEmpty() { const e = document.getElementById('empty'); if (e) e.remove(); }

  function appendMessage(role, content) {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row ' + role;
    const label  = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = role === 'user' ? 'Você' : 'Tess AI';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = content;
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
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollBottom();
  }

  function beginAssistantBubble() {
    removeEmpty();
    const row    = document.createElement('div');
    row.className = 'msg-row assistant';
    const label  = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = 'Tess AI';
    assistantBubble = document.createElement('div');
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
    if (thinking) assistantBubble.textContent = '';
    const cursor = assistantBubble.querySelector('.cursor');
    if (cursor) cursor.remove();
    assistantBubble.textContent += text;
    assistantBubble.innerHTML += '<span class="cursor"></span>';
    scrollBottom();
  }

  function finalizeAssistant() {
    if (!assistantBubble) return;
    const cursor   = assistantBubble.querySelector('.cursor');
    if (cursor) cursor.remove();
    const thinking = assistantBubble.querySelector('.thinking');
    if (thinking || assistantBubble.textContent.trim() === '') {
      assistantBubble.closest('.msg-row').remove();
    } else {
      history.push({ role: 'assistant', content: assistantBubble.textContent });
      saveHistory();
    }
    assistantBubble = null;
    setWaiting(false);
    updateContextMeter();
  }

  function setWaiting(val) {
    waiting = val;
    inputEl.disabled = val;
    sendBtn.textContent = val ? 'Parar' : 'Enviar';
    sendBtn.style.background = val ? 'var(--vscode-errorForeground)' : '';
    sendBtn.style.color = val ? 'white' : '';
  }

  function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + 'px';
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  inputEl.addEventListener('input', () => {
    autoResize();
    watermarkEl.classList.toggle('hidden', inputEl.value.length > 0);
  });
  codeBtn.addEventListener('click', () => vscode.postMessage({ type: 'pickFile' }));
  modelSelect.addEventListener('change', updateContextMeter);

  clearBtn.addEventListener('click', () => {
    history = [];
    actualTokens = null;
    assistantBubble = null;
    // Remove todas as mensagens preservando o elemento #watermark
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

  // ── Mensagens da extensão ────────────────────────────────────────────────────

  window.addEventListener('message', ({ data }) => {
    switch (data.type) {
      case 'chunk':         appendChunk(data.text); break;
      case 'startResponse': break;
      case 'endResponse':   finalizeAssistant(); break;
      case 'cancelled':     finalizeAssistant(); break;
      case 'usage':
        if (data.usage?.total_tokens) {
          actualTokens = data.usage.total_tokens;
          updateContextMeter();
        }
        break;
      case 'error':
        if (assistantBubble) { assistantBubble.closest('.msg-row').remove(); assistantBubble = null; history.pop(); }
        appendError(data.text);
        setWaiting(false);
        break;
      case 'insertCode':
        if (data.code) {
          const snippet = '\`\`\`' + data.code.language + '\\n' + data.code.code + '\\n\`\`\`';
          inputEl.value = inputEl.value ? inputEl.value + '\\n\\n' + snippet : snippet;
        } else {
          appendError('Nenhum editor activo. Abra um ficheiro de código primeiro.');
        }
        autoResize();
        inputEl.focus();
        break;
      case 'insertFiles':
        if (data.files?.length > 0) {
          const snippets = data.files.map(f =>
            '\`\`\`' + f.language + '\\n// ' + f.path + '\\n' + f.code + '\\n\`\`\`'
          ).join('\\n\\n');
          inputEl.value = inputEl.value ? inputEl.value + '\\n\\n' + snippets : snippets;
          autoResize();
          inputEl.focus();
        }
        break;
      case 'setModels':
        if (data.models === null) {
          // Agente com modelo fixo — esconde o selector
          modelRowEl.classList.add('hidden');
        } else {
          modelRowEl.classList.remove('hidden');
          const current = modelSelect.value;
          modelSelect.innerHTML = data.models
            .map(m => '<option value="' + m.id + '"' + (m.id === current ? ' selected' : '') + '>' + m.label + '</option>')
            .join('');
          // Se o modelo guardado já não existe nesta lista, usa o primeiro
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
</script>
</body>
</html>`;
}

// ─── Activação ─────────────────────────────────────────────────────────────────

function activate(context) {
    console.log('Tess AI activada');

    const provider = new TessChatViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('tess.chatView', provider),

        vscode.commands.registerCommand('tess.openChatWithCode', () => {
            vscode.commands.executeCommand('tess.chatView.focus');
            setTimeout(() => provider.insertCode(), 300);
        })
    );
}

function deactivate() { /* extensão desactivada */ }

module.exports = { activate, deactivate };
