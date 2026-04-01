// src/chatHistoryView.js
// ─── Tess TIS — Chat History Sidebar View ───────────────────────────────────
// Responsabilidade: TreeDataProvider para a view de histórico na sidebar.
// Cada item representa uma sessão. Clique carrega a conversa no chat.

'use strict';

const vscode     = require('vscode');
const chatHistory = require('./chatHistory');

// ── TreeItem ──────────────────────────────────────────────────────────────────

class HistoryItem extends vscode.TreeItem {
    /**
     * @param {{ id: string, title: string, updatedAt: string }} session
     */
    constructor(session) {
        super(session.title, vscode.TreeItemCollapsibleState.None);

        this.id          = session.id;
        this.description = _formatDate(session.updatedAt);
        this.tooltip     = session.title;
        this.iconPath    = new vscode.ThemeIcon('comment-discussion');
        this.contextValue = 'historyItem';

        // Ao clicar, carrega a sessão no chat
        this.command = {
            command:   'tess.loadSession',
            title:     'Carregar conversa',
            arguments: [session.id],
        };
    }
}

// ── TreeDataProvider ──────────────────────────────────────────────────────────

class ChatHistoryProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        /** @type {vscode.Event<void>} */
        this.onDidChangeTreeData  = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    /** @param {HistoryItem} element */
    getTreeItem(element) {
        return element;
    }

    /** @returns {HistoryItem[]} */
    getChildren() {
        const sessions = chatHistory.listSessions();

        if (sessions.length === 0) {
            const empty = new vscode.TreeItem('Sem conversas guardadas');
            empty.iconPath = new vscode.ThemeIcon('info');
            return [empty];
        }

        return sessions.map(s => new HistoryItem(s));
    }
}

// ── Registo ───────────────────────────────────────────────────────────────────

/**
 * Regista a view de histórico e os comandos associados.
 *
 * @param {vscode.ExtensionContext} context
 * @param {ChatHistoryProvider}     provider
 * @param {Function}                onLoadSession - Callback chamado com (sessionId)
 */
function registerHistoryView(context, onLoadSession) {
    const provider = new ChatHistoryProvider();

    const treeView = vscode.window.createTreeView('tess.historyView', {
        treeDataProvider: provider,
        showCollapseAll:  false,
    });

    // ── Comandos ──────────────────────────────────────────────────────────────

    const cmdRefresh = vscode.commands.registerCommand(
        'tess.refreshHistory',
        () => provider.refresh()
    );

    const cmdLoad = vscode.commands.registerCommand(
        'tess.loadSession',
        (sessionId) => {
            const session = chatHistory.getSession(sessionId);
            if (session) onLoadSession(session);
        }
    );

    const cmdDelete = vscode.commands.registerCommand(
        'tess.deleteSession',
        async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Apagar conversa "${item.label}"?`,
                { modal: true },
                'Apagar'
            );
            if (confirm === 'Apagar') {
                chatHistory.deleteSession(item.id);
                provider.refresh();
            }
        }
    );

    const cmdRename = vscode.commands.registerCommand(
        'tess.renameSession',
        async (item) => {
            const newTitle = await vscode.window.showInputBox({
                prompt:      'Novo título da conversa',
                value:       item.label,
                placeHolder: 'Título...',
            });
            if (newTitle) {
                chatHistory.renameSession(item.id, newTitle);
                provider.refresh();
            }
        }
    );

    const cmdClearAll = vscode.commands.registerCommand(
        'tess.clearHistory',
        async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Apagar todo o histórico de conversas?',
                { modal: true },
                'Apagar tudo'
            );
            if (confirm === 'Apagar tudo') {
                chatHistory.clearAll();
                provider.refresh();
            }
        }
    );

    context.subscriptions.push(
        treeView,
        cmdRefresh,
        cmdLoad,
        cmdDelete,
        cmdRename,
        cmdClearAll
    );

    return provider;
}

// ── Helper privado ────────────────────────────────────────────────────────────

/**
 * Formata uma data ISO para exibição na sidebar.
 * @param {string} isoDate
 * @returns {string}
 */
function _formatDate(isoDate) {
    const date = new Date(isoDate);
    const now  = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

module.exports = { ChatHistoryProvider, registerHistoryView };