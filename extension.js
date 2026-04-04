// c:\Developer\VS_Code_Tess_Extension\extension.js
'use strict';

const vscode = require('vscode');
const { TessViewProvider } = require('./src/provider');

const chatHistory              = require('./src/chatHistory');

function activate(context) {
    console.log('[Tis.ai & Tess] Extensão activada');

    // 1. Histórico — inicializa o módulo de persistência
    chatHistory.init(context);

    // 2. Provider do chat (único ponto de entrada visual)
    const provider = new TessViewProvider(context);

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
        }),

        vscode.commands.registerCommand('tess.saveFile', async (args) => {
            const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(folder + '/' + args.filename),
                filters: { 'All Files': ['*'] }
            });
            if (!uri) return;
            await vscode.workspace.fs.writeFile(uri, Buffer.from(args.content, 'utf8'));
            vscode.window.showInformationMessage('Ficheiro guardado: ' + uri.fsPath);
        })

    );

    // Força o chat a ficar visível assim que a extensão activa
    setTimeout(() => {
        vscode.commands.executeCommand('tess.chatView.focus');
    }, 500);
}

function deactivate() {
    console.log('[Tis.ai & Tess] Extensão desactivada');
}

module.exports = { activate, deactivate };
