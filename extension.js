// c:\Developer\VS_Code_Tess_Extension\extension.js
'use strict';

const vscode = require('vscode');
const { TessChatViewProvider } = require('./src/provider');
const { registerFileTree }     = require('./src/fileTree');
const chatHistory              = require('./src/chatHistory');
const { registerHistoryView }  = require('./src/chatHistoryView');

function activate(context) {
    console.log('[Tess] Extensão activada');

    // 1. Histórico — tem de ser o primeiro
    chatHistory.init(context);

    // 2. Árvore de ficheiros
    registerFileTree(context);

    // 3. Provider do chat
    const provider = new TessChatViewProvider(context);

    // 4. Sidebar de histórico
    const historyProvider = registerHistoryView(context, (session) => {
        provider.loadSession(session);
    });

    // 5. Expõe o historyProvider ao provider para ele poder fazer refresh
    provider.setHistoryProvider(historyProvider);

    context.subscriptions.push(

        vscode.window.registerWebviewViewProvider(
            'tess.chatView',
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        ),

        vscode.commands.registerCommand('tess.openChatWithCode', () => {
            vscode.commands.executeCommand('tess.chatView.focus');
            setTimeout(() => provider.insertCode(), 300);
        }),

        vscode.commands.registerCommand('tess.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'tess');
        })

    );
}

function deactivate() {
    console.log('[Tess] Extensão desactivada');
}

module.exports = { activate, deactivate };