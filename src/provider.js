// src/provider.js
'use strict';

const vscode      = require('vscode');
const { startStream, cancelStream }                   = require('./api');
const { startOpenAICompatStream, cancelOpenAICompatStream } = require('./openai-compat');
const { syncAgentConfig }                             = require('./models');
const { getProvider }                                 = require('./providers/index');
const { getCurrentCode, getWorkspaceTree, pickWorkspaceFiles, sendWorkspaceContext } = require('./workspace');
const { buildHtml }                                   = require('./webview');
const { executeTool, getToolsSystemPrompt }           = require('./tools');
const chatHistory                                     = require('./chatHistory');

function _currentWorkspacePath() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

class TisViewProvider {

    static viewType = 'tis.chatView';

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

        webviewView.webview.html = buildHtml(webviewView.webview, this._context.extensionUri);

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg);
        });

        vscode.workspace.onDidChangeConfiguration(e => {
            if (!e.affectsConfiguration('tis')) return;
            webviewView.webview.postMessage({ type: 'configChanged' });
        });
    }

    // ─── Dispatcher ──────────────────────────────────────────────────────────

    async _handleMessage(msg) {
        switch (msg.type) {
            case 'ready':               await this._onWebviewReady();                  break;
            case 'send':                await this._handleSend(msg);                   break;
            case 'cancel':
                cancelStream();
                cancelOpenAICompatStream();
                this._view.webview.postMessage({ type: 'endResponse' });
                break;
            case 'providerChanged':     await this._syncProviderModels(msg.provider);  break;
            case 'pickFile':            await pickWorkspaceFiles(this._view.webview);  break;
            case 'getWorkspaceContext': await sendWorkspaceContext(this._view.webview); break;
            case 'newChat':             this._activeSessionId = null;                  break;
            case 'getHistory':          this._sendHistoryList();                       break;
            case 'loadSession':         this._loadSessionById(msg.id);                 break;
            case 'renameSession':       this._renameSession(msg.id, msg.title);        break;
            case 'deleteSession':       this._deleteSession(msg.id);                   break;
            case 'audit':               await this._handleAudit(msg);                  break;
            case 'toolCall':            await this._handleToolCall(msg);               break;
            case 'saveFile':            await this._handleSaveFile(msg);               break;
            case 'resync':              await this._handleResync();                    break;
        }
    }

    // ─── Ready ───────────────────────────────────────────────────────────────

    async _onWebviewReady() {
        cancelStream();
        cancelOpenAICompatStream();
        // Arranca sempre com Tess; syncAgentConfig envia lista estática se sem credenciais
        const cfg = vscode.workspace.getConfiguration('tis');
        await syncAgentConfig(
            this._view.webview,
            cfg.get('tessApiKey', ''),
            cfg.get('tessAgentId', '')
        );
        const latestSession = chatHistory.getLatestSessionForWorkspace(_currentWorkspacePath());
        if (latestSession) {
            this._activeSessionId = latestSession.id;
            this._loadSessionById(latestSession.id);
        }
    }

    // ─── Sincronização de modelos (sem switch hardcoded) ─────────────────────

    async _syncProviderModels(provider) {
        const webview = this._view.webview;

        // Tess: usa syncAgentConfig (modelos dinâmicos via GET /agents/{id})
        if (provider === 'tess') {
            const cfg = vscode.workspace.getConfiguration('tis');
            await syncAgentConfig(webview, cfg.get('tessApiKey', ''), cfg.get('tessAgentId', ''));
            return;
        }

        // Todos os outros providers: usa registry
        const p = getProvider(provider);
        if (!p) return;

        const cfg    = vscode.workspace.getConfiguration('tis');
        const creds  = p.getCredentials(cfg);
        const fetched = creds.ok ? await p.fetchModels(creds) : null;
        let models    = fetched ?? p.staticModels;

        // Ollama sem servidor: placeholder informativo
        if (provider === 'ollama' && models.length === 0) {
            models = [{ id: 'auto', label: 'Ollama não detectado — configure tis.ollama.baseUrl' }];
        }

        // Remote sem endpoint: placeholder
        if (provider === 'remote' && !creds.ok) {
            models = [{ id: 'auto', label: 'Configure tis.remote.endpoint nas Definições' }];
        }

        // Remote com modelo fixo configurado: pré-selecciona
        if (provider === 'remote' && creds.ok && creds.model && models.length === 0) {
            models = [{ id: creds.model, label: creds.model }];
        }

        webview.postMessage({
            type:   'setModels',
            models: models.length > 0 ? models : [{ id: 'auto', label: 'Auto' }],
            limits: p.modelLimits ?? {},
            fixed:  false
        });
    }

    // ─── Credenciais (sem switch hardcoded) ──────────────────────────────────

    _resolveCredentials(provider) {
        const cfg = vscode.workspace.getConfiguration('tis');

        if (provider === 'tess') {
            const apiKey  = cfg.get('tessApiKey', '');
            const agentId = cfg.get('tessAgentId', '');
            if (!apiKey || !agentId) return {
                ok: false,
                errorText: 'API Key ou Agent ID Tess não configurados. Verifique Definições → tis.tessApiKey e tis.tessAgentId.'
            };
            return { ok: true, apiKey, agentId };
        }

        const p = getProvider(provider);
        if (!p) return { ok: false, errorText: `Provider desconhecido: "${provider}".` };
        return p.getCredentials(cfg);
    }

    // ─── Dispatch do stream (sem switch hardcoded) ────────────────────────────

    _dispatchStream(provider, creds, opts) {
        if (provider === 'tess') {
            return startStream({ apiKey: creds.apiKey, agentId: creds.agentId, ...opts });
        }

        const p = getProvider(provider);
        const { baseUrl, headers, extraBody, defaultModel } = p.buildStreamConfig(creds);

        // Modelo: o seleccionado pelo utilizador tem prioridade; cai para o default do provider
        const model = (opts.model && opts.model !== 'auto') ? opts.model : (defaultModel ?? opts.model);

        return startOpenAICompatStream({
            providerLabel: p.label,
            baseUrl,
            headers,
            extraBody,
            ...opts,
            model,
        });
    }

    // ─── Envio ───────────────────────────────────────────────────────────────

    async _handleSend(msg) {
        const webview  = this._view.webview;
        const provider = msg.provider ?? 'tess';
        const creds    = this._resolveCredentials(provider);

        if (!creds.ok) {
            webview.postMessage({ type: 'error', text: creds.errorText });
            return;
        }

        if (!this._activeSessionId) {
            this._activeSessionId = chatHistory.createSession(
                msg.userText, msg.model, _currentWorkspacePath()
            );
        }

        let messagesWithContext = msg.history ?? [];
        if (!msg.isTool) {
            const isFirst     = (messagesWithContext.length === 0);
            const code        = getCurrentCode();
            const systemParts = [];

            if (isFirst) {
                const tree = await getWorkspaceTree();
                if (tree) systemParts.push('Estrutura do projecto:\n' + tree);
            }
            if (code) systemParts.push(`Ficheiro activo (${code.language}):\n\`\`\`${code.language}\n${code.code}\n\`\`\``);

            if (systemParts.length > 0) {
                messagesWithContext = [
                    { role: 'user',      content: systemParts.join('\n\n') },
                    { role: 'assistant', content: 'Contexto recebido.' },
                    ...messagesWithContext
                ];
            }
        }

        messagesWithContext = [
            { role: 'system', content: getToolsSystemPrompt() },
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
            await this._dispatchStream(provider, creds, {
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

    // ─── Auditoria Hypercoding ────────────────────────────────────────────────

    async _handleAudit(msg) {
        const webview  = this._view.webview;
        const provider = msg.provider ?? 'tess';
        const creds    = this._resolveCredentials(provider);

        if (!creds.ok) {
            webview.postMessage({ type: 'error', text: creds.errorText });
            return;
        }

        const code = getCurrentCode();
        if (!code) {
            webview.postMessage({ type: 'error', text: 'Nenhum ficheiro activo no editor para auditar.' });
            return;
        }

        // Notifica o webview para mostrar a mensagem de auditoria no chat
        webview.postMessage({ type: 'auditStart', filename: code.language ? `${code.language}` : '' });

        const auditPrompt = `Faz uma auditoria Hypercoding ao seguinte código. Analisa cada um dos cinco princípios e sê directo: aponta problemas concretos, não elogios genéricos. Se um princípio estiver bem, uma linha chega.

\`\`\`${code.language}
${code.code}
\`\`\`

Estrutura a resposta assim:

## 1. Qualidade e clareza
*Nomes, duplicação, estrutura, legibilidade.*

## 2. Segurança
*Inputs sem validação, credenciais expostas, injecções, dependências vulneráveis.*

## 3. Eficiência
*Operações desnecessariamente custosas, estruturas de dados inadequadas, desperdício de recursos.*

## 4. Manutenibilidade
*Funções com múltiplas responsabilidades, falta de comentários onde necessário, código morto.*

## 5. Autonomia com supervisão
*Decisões com impacto relevante que deviam ser explícitas ou documentadas.*

## Prioridade de acção
Lista as 3 coisas mais importantes a corrigir, por ordem de impacto.`;

        const messages = [
            { role: 'system', content: getToolsSystemPrompt() },
            { role: 'user',   content: auditPrompt }
        ];

        webview.postMessage({ type: 'startResponse' });

        let assistantBuffer = '';
        let ended           = false;

        const finish = (persist) => {
            if (ended) return;
            ended = true;
            if (persist && assistantBuffer) {
                if (!this._activeSessionId) {
                    this._activeSessionId = chatHistory.createSession(
                        '🔍 Auditoria Hypercoding', msg.model, _currentWorkspacePath()
                    );
                }
                chatHistory.appendMessage(this._activeSessionId, 'user',      '🔍 Auditoria Hypercoding');
                chatHistory.appendMessage(this._activeSessionId, 'assistant', assistantBuffer);
            }
            webview.postMessage({ type: 'endResponse' });
        };

        try {
            await this._dispatchStream(provider, creds, {
                model:    msg.model,
                messages,
                onChunk:  (text) => {
                    assistantBuffer += text;
                    webview.postMessage({ type: 'chunk', text });
                },
                onUsage:  (usage) => webview.postMessage({ type: 'usage', usage }),
                onEnd:    () => finish(true),
                onError:  (err) => { finish(false); webview.postMessage({ type: 'error', text: err }); },
            });
        } catch (err) {
            finish(false);
            webview.postMessage({ type: 'error', text: String(err) });
        }
    }

    // ─── Tool Calls ──────────────────────────────────────────────────────────

    async _handleToolCall(msg) {
        let result;
        try {
            result = await executeTool(msg.tool, msg.args, msg.content);
        } catch (err) {
            console.error('[Tis] Erro em _handleToolCall:', err.message);
            result = `Erro ao executar ferramenta ${msg.tool}: ${err.message}`;
        }
        this._view.webview.postMessage({
            type:   'toolResult',
            tool:   msg.tool,
            args:   msg.args,
            result: result ?? ''
        });
    }

    // ─── Ressinc pelo log local ───────────────────────────────────────────────

    async _handleResync() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            this._view.webview.postMessage({ type: 'resyncData', log: null });
            return;
        }
        const logUri = vscode.Uri.joinPath(folders[0].uri, '.tess-log.md');
        try {
            const raw = await vscode.workspace.fs.readFile(logUri);
            this._view.webview.postMessage({ type: 'resyncData', log: new TextDecoder().decode(raw) });
        } catch {
            this._view.webview.postMessage({ type: 'resyncData', log: null });
        }
    }

    // ─── Guardar ficheiro ─────────────────────────────────────────────────────

    async _handleSaveFile(msg) {
        const folders = vscode.workspace.workspaceFolders;
        const base    = folders?.[0]?.uri ?? vscode.Uri.file(require('node:os').homedir());
        const uri     = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.joinPath(base, msg.filename ?? 'snippet.txt'),
            filters:    { 'All files': ['*'] }
        });
        if (!uri) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(msg.content ?? '', 'utf8'));
        await vscode.window.showTextDocument(uri);
    }
}

module.exports = { TisViewProvider };
