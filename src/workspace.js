//https://pareto-workflows.storage.googleapis.com/b7940c52aec4193f54ec96e26b2594efe8a2824a/workspace.js

const vscode = require('vscode');
const path = require('node:path');

// ─── Constantes ────────────────────────────────────────────────────────────────

const EXCLUDE_PATTERN = '{**/node_modules/**,**/.git/**,**/.claude/**,**/*.vsix,**/out/**,**/dist/**,**/.vscode/**,**/coverage/**,**/__pycache__/**}';
const MAX_FILES       = 300;
const MAX_FILE_CHARS  = 50000;

// ─── Árvore do workspace ───────────────────────────────────────────────────────

/**
 * Gera uma lista de ficheiros do workspace activo.
 * @returns {Promise<string|null>} Texto com a árvore ou null se não houver workspace.
 */
async function getWorkspaceTree() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;

    const rootUri  = folders[0].uri;
    const rootPath = rootUri.fsPath.replaceAll('\\', '/');
    const files    = await vscode.workspace.findFiles('**/*', EXCLUDE_PATTERN, MAX_FILES);

    if (files.length === 0) return null;

    const lines = files
        .map(f => f.fsPath.replaceAll('\\', '/').replace(rootPath + '/', ''))
        .sort();

    return `Ficheiros do projecto (${path.basename(rootPath)}):\n${lines.join('\n')}`;
}

// ─── Leitura de ficheiro por caminho relativo ──────────────────────────────────

/**
 * Lê um ficheiro do workspace por caminho relativo.
 * @param {string} relativePath
 * @returns {Promise<{ content: string, language: string, path: string, error?: string }>}
 */
async function readWorkspaceFile(relativePath) {
    try {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return { error: 'Sem workspace aberto', content: null, language: null, path: relativePath };
        }

        const fullUri = vscode.Uri.joinPath(folders[0].uri, relativePath);
        const doc     = await vscode.workspace.openTextDocument(fullUri);
        const content = doc.getText();
        const language = doc.languageId;

        if (content.length > MAX_FILE_CHARS) {
            const truncated = content.split('\n').slice(0, 200).join('\n');
            return {
                content: truncated,
                language,
                path: relativePath,
                error: `Ficheiro truncado — tamanho original: ${content.length} chars. A mostrar as primeiras 200 linhas.`
            };
        }

        return { content, language, path: relativePath, error: null };

    } catch (err) {
        return { error: `Erro ao ler ficheiro: ${err.message}`, content: null, language: null, path: relativePath };
    }
}

// ─── File picker (selector nativo do VS Code) ─────────────────────────────────

/**
 * Abre o selector de ficheiros nativo e envia os conteúdos para o WebView.
 * @param {import('vscode').WebviewView} view
 */
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
        const content = doc.getText();
        return {
            path: vscode.workspace.asRelativePath(uri),
            language: doc.languageId,
            code: content.length > MAX_FILE_CHARS
                ? content.slice(0, MAX_FILE_CHARS) + '\n// ... ficheiro truncado'
                : content
        };
    }));

    view.webview.postMessage({ type: 'insertFiles', files });
}

/**
 * Gera a árvore do workspace e envia para o WebView como contexto injectado.
 * @param {import('vscode').WebviewView} view
 */
async function sendWorkspaceContext(view) {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        vscode.window.showWarningMessage('Nenhum workspace aberto.');
        return;
    }

    const tree = await getWorkspaceTree();

    if (!tree) {
        vscode.window.showWarningMessage('Não foi possível gerar a árvore do projecto.');
        return;
    }

    view.webview.postMessage({
        type: 'insertContext',
        context: tree,
        label: `📁 ${path.basename(folders[0].uri.fsPath)}`
    });
}


// ─── Código do editor activo ───────────────────────────────────────────────────

/**
 * Retorna o código do editor activo (selecção ou ficheiro completo).
 * @param {import('vscode').TextEditor|null} editor
 * @returns {{ code: string, language: string }|null}
 */
function getCurrentCode(editor) {
    const ed = editor ?? vscode.window.activeTextEditor;
    if (!ed) return null;

    const selection = ed.selection;
    const code = selection.isEmpty
        ? ed.document.getText()
        : ed.document.getText(selection);

    return { code, language: ed.document.languageId };
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    getWorkspaceTree,
    readWorkspaceFile,
    pickWorkspaceFiles,
    sendWorkspaceContext,
    getCurrentCode
};
