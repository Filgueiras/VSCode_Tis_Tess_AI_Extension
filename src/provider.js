// src/provider.js
'use strict';

const vscode      = require('vscode');
const { startStream, cancelStream } = require('./api');
const { syncAgentConfig }           = require('./models');
const { getCurrentCode, getWorkspaceTree, pickFiles, sendWorkspaceContext } = require('./workspace');
const { buildHtml }                 = require('./webview');
const { executeTool }               = require('./tools');
const chatHistory                   = require('./chatHistory');

function _currentWorkspacePath() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

class TessViewProvider {

    static viewType = 'tess.chatView';

    constructor(context) {
        this._context         = context;
        this._view            = null;
        this._activeSessionId = null;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._context.extensionUri,
                vscode.Uri.joinPath(this._context.extensionUri, 'media')
            ]
        };

        webviewView.webview.html = buildHtml(
            webviewView.webview,
            this._context.extensionUri
        );

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg);
        });

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('tess')) {
                const cfg     = vscode.workspace.getConfiguration('tess');
                const apiKey  = cfg.get('apiKey', '');
                const agentId = cfg.get('agentId', '');
                syncAgentConfig(webviewView.webview, apiKey, agentId);
            }
        });
    }

    // ─── Dispatcher ──────────────────────────────────────────────────────────

    async _handleMessage(msg) {
        switch (msg.type) {
            case 'ready':               await this._onWebviewReady();                   break;
            case 'send':                await this._handleSend(msg);                    break;
            case 'cancel':
                cancelStream();
                this._view.webview.postMessage({ type: 'endResponse' }); // ✅ desbloqueia o UI
                break;
            case 'pickFile':            await pickFiles(this._view.webview);            break;
            case 'getWorkspaceContext': await sendWorkspaceContext(this._view.webview); break;
            case 'newChat':             this._activeSessionId = null;                   break;
            case 'getHistory':          this._sendHistoryList();                        break;
            case 'loadSession':         this._loadSessionById(msg.id);                  break;
            case 'renameSession':       this._renameSession(msg.id, msg.title);         break;
            case 'deleteSession':       this._deleteSession(msg.id);                    break;
            case 'toolCall':            await this._handleToolCall(msg);                break;
            case 'saveFile':            await this._handleSaveFile(msg);                break;
        }
    }

    // ─── Ready ───────────────────────────────────────────────────────────────

    async _onWebviewReady() {
        const cfg     = vscode.workspace.getConfiguration('tess');
        const apiKey  = cfg.get('apiKey', '');
        const agentId = cfg.get('agentId', '');
        await syncAgentConfig(this._view.webview, apiKey, agentId);

        const workspacePath  = _currentWorkspacePath();
        const latestSession  = chatHistory.getLatestSessionForWorkspace(workspacePath);

        if (latestSession) {
            this._activeSessionId = latestSession.id;
            this._loadSessionById(latestSession.id);
        }
    }

    // ─── Envio ───────────────────────────────────────────────────────────────

    async _handleSend(msg) {
        const webview       = this._view.webview;
        const apiKey        = vscode.workspace.getConfiguration('tess').get('apiKey', '');
        const agentId       = vscode.workspace.getConfiguration('tess').get('agentId', '');
        const workspacePath = _currentWorkspacePath();

        if (!apiKey || !agentId) {
            webview.postMessage({ type: 'error', text: 'API Key ou Agent ID não configurados.' });
            return;
        }

        if (!this._activeSessionId) {
            this._activeSessionId = chatHistory.createSession(
                msg.userText,
                msg.model,
                workspacePath
            );
        }

        let messagesWithContext = msg.history ?? [];
        if (!msg.isTool) {
            const isFirst     = (messagesWithContext.length === 0);
            const code        = getCurrentCode();
            const systemParts = [];

            if (isFirst) {
                const tree = getWorkspaceTree();
                if (tree) systemParts.push('Estrutura do projecto:\n' + tree);
            }
            if (code) systemParts.push('Ficheiro activo:\n' + code);

            if (systemParts.length > 0) {
                messagesWithContext = [
                    { role: 'user',      content: systemParts.join('\n\n') },
                    { role: 'assistant', content: 'Contexto recebido.' },
                    ...messagesWithContext
                ];
            }
        }

        messagesWithContext = [
            ...messagesWithContext,
            { role: 'user', content: msg.userText }
        ];

        webview.postMessage({ type: 'startResponse' });

        let assistantBuffer = '';
        let ended           = false;

        const finish = (persist) => {
            if (ended) return;
            ended = true;
            if (persist && !msg.isTool && assistantBuffer) {
                chatHistory.appendMessage(this._activeSessionId, 'user',      msg.userText);
                chatHistory.appendMessage(this._activeSessionId, 'assistant', assistantBuffer);
            }
            webview.postMessage({ type: 'endResponse' });
        };

        try {
            await startStream({
                apiKey,
                agentId,
                model:    msg.model,
                messages: messagesWithContext,
                onChunk:  (text) => {
                    assistantBuffer += text;
                    webview.postMessage({ type: 'chunk', text });
                },
                onUsage:  (usage) => webview.postMessage({ type: 'usage', usage }),
                onEnd:    () => finish(true),
                onError:  (err) => {
                    finish(false);
                    webview.postMessage({ type: 'error', text: err });
                },
            });
        } catch (err) {
            finish(false);
            webview.postMessage({ type: 'error', text: String(err) });
        }
    }

    // ─── Histórico ───────────────────────────────────────────────────────────

    _sendHistoryList() {
        const sessions = chatHistory.listSessions(_currentWorkspacePath());
        this._view.webview.postMessage({ type: 'historyList', sessions });
    }

    _loadSessionById(id) {
        const session = chatHistory.getSession(id);
        if (!session) return;
        this._activeSessionId = id;
        this._view.webview.postMessage({
            type:    'restoreHistory',
            history: session.messages ?? [],
            model:   session.model    ?? 'auto'
        });
    }

    _renameSession(id, title) {
        if (!title?.trim()) return;
        chatHistory.renameSession(id, title.trim());
        this._sendHistoryList();
    }

    _deleteSession(id) {
        chatHistory.deleteSession(id);
        if (this._activeSessionId === id) this._activeSessionId = null;
        this._sendHistoryList();
    }

    // ─── Tool Calls ──────────────────────────────────────────────────────────

    async _handleToolCall(msg) {
        const result = await executeTool(msg.tool, msg.args, msg.content);
        this._view.webview.postMessage({
            type:   'toolResult',
            tool:   msg.tool,
            args:   msg.args,
            result: result ?? ''
        });
    }

    // ─── Guardar ficheiro ─────────────────────────────────────────────────────

    async _handleSaveFile(msg) {
        const folders = vscode.workspace.workspaceFolders;
        const base    = folders?.[0]?.uri ?? vscode.Uri.file(require('os').homedir());
        const uri     = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.joinPath(base, msg.filename ?? 'snippet.txt'),
            filters:    { 'All files': ['*'] }
        });
        if (!uri) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(msg.content ?? '', 'utf8'));
        await vscode.window.showTextDocument(uri);
    }
}

module.exports = { TessViewProvider };
