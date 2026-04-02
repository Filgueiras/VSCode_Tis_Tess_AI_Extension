// c:\Developer\VS_Code_Tess_Extension\src\provider.js
'use strict';

const vscode = require('vscode');
const { handleSend }                        = require('./api');
const { syncAgentConfig, MODELS, MODEL_LIMITS } = require('./models');

const { getCurrentCode, pickWorkspaceFiles, sendWorkspaceContext } = require('./workspace');

const { buildHtml }                         = require('./webview');
const { executeTool }                       = require('./tools');
const chatHistory                           = require('./chatHistory');

class TessChatViewProvider {
    _view               = null;
    _abortController    = null;
    _lastEditor         = null;
    _activeSessionId    = null;
    _historyProvider    = null;

    constructor(context) {
        this._context = context;
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) this._lastEditor = editor;
            })
        );
    }

    // ── Métodos públicos chamados pelo extension.js ──────────────────────────

    setHistoryProvider(historyProvider) {
        this._historyProvider = historyProvider;
    }

    loadSession(session) {
        if (!this._view) return;

        this._activeSessionId = session.id;

        this._view.webview.postMessage({
            type: 'restoreHistory',
            history: session.messages,
            model: session.model ?? 'auto'
        });
    }

    insertCode() {
        if (!this._view) return;
        this._view.webview.postMessage({
            type: 'insertCode',
            code: getCurrentCode(this._lastEditor)
        });
        this._view.show(true);
    }

    // ── WebView lifecycle ────────────────────────────────────────────────────

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                this._context.extensionUri,
                vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview')
            ]
        };

        const logoUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'tis_vector_vscode.svg')
        );
        const cssUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview', 'webview.css')
        );
        const scriptUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview', 'webview-script.js')
        );

        webviewView.webview.html = buildHtml(logoUri, cssUri, scriptUri, MODELS, MODEL_LIMITS);

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg);
        });
    }

    // ── Message handler ──────────────────────────────────────────────────────

    async _handleMessage(msg) {
        switch (msg.type) {
            case 'ready':
                this._onWebviewReady();
                break;

            case 'send':
                await this._handleSend(msg);
                break;

            case 'cancel':
                if (this._abortController) this._abortController.abort();
                break;

            case 'getCode':
                this._view.webview.postMessage({
                    type: 'insertCode',
                    code: getCurrentCode(this._lastEditor)
                });
                break;

            case 'pickFile':
                await pickWorkspaceFiles(this._view);
                break;

            case 'getWorkspaceContext':
                await sendWorkspaceContext(this._view);
                break;

            case 'toolCall':
                await this._handleToolCall(msg);
                break;

            // saveHistory substituído pela integração directa no _handleSend
            // mantido por compatibilidade com versões antigas do webview-script.js
            case 'saveHistory':
                this._context.workspaceState.update('tess.history', msg.history);
                this._context.workspaceState.update('tess.model',   msg.model);
                break;

            case 'newChat':
                this._activeSessionId = null;
                break;
        }
    }

    async _handleSend(msg) {
        // Cria sessão nova se não existe
        if (!this._activeSessionId) {
            this._activeSessionId = chatHistory.createSession(msg.userText);
            this._historyProvider?.refresh();
        }

        // Guarda mensagem do utilizador
        chatHistory.appendMessage(this._activeSessionId, 'user', msg.userText, msg.model);

        this._abortController = new AbortController();

        try {
            const response = await handleSend(
                this._view,
                msg.userText,
                msg.model,
                msg.history,
                this._abortController.signal,
                this._lastEditor,
                msg.isTool ?? false
            );

            // Guarda resposta do assistente (se handleSend a devolver)
            if (response) {
                chatHistory.appendMessage(this._activeSessionId, 'assistant', response, msg.model);
                this._historyProvider?.refresh();
            }

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('[Tess] Erro no handleSend:', err);
            }
        } finally {
            this._abortController = null;
        }
    }

    async _handleToolCall(msg) {
        const { tool, args } = msg;
        const result = await executeTool(tool, args);
        this._view.webview.postMessage({ type: 'toolResult', tool, args, result });
    }

    // ── Config & restore ─────────────────────────────────────────────────────

    _onWebviewReady() {
        // Tenta restaurar a sessão mais recente do histórico
        const sessions = chatHistory.listSessions();

        if (sessions.length > 0) {
            const latest  = sessions[0]; // listSessions devolve ordenado por data desc
            const session = chatHistory.getSession(latest.id);

            if (session?.messages?.length > 0) {
                this._activeSessionId = session.id;
                this._view.webview.postMessage({
                    type: 'restoreHistory',
                    history: session.messages,
                    model: session.model ?? 'auto'
                });
            }
        }

        this._syncConfig();

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

        if (!apiKey || !agentId) {
            if (this._view) this._view.webview.postMessage({ type: 'notConfigured' });
            return;
        }

        if (this._view) syncAgentConfig(this._view, apiKey, agentId);
    }
}

module.exports = { TessChatViewProvider };