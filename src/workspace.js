// src/workspace.js
const vscode = require('vscode');
const path = require('node:path');

// ─── Constantes ────────────────────────────────────────────────────────────────

const EXCLUDE_PATTERN = '{**/node_modules/**,**/.git/**,**/.claude/**,**/*.vsix,**/out/**,**/dist/**,**/.vscode/**,**/coverage/**,**/__pycache__/**}';
const MAX_FILES       = 300;
const MAX_FILE_CHARS  = 100000;
const MAX_GREP_RESULTS = 50;

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
 * Suporta range opcional de linhas para leitura cirúrgica de ficheiros grandes.
 * @param {string} relativePath
 * @param {number} [startLine] - Linha inicial (1-based, inclusive). Opcional.
 * @param {number} [endLine]   - Linha final (1-based, inclusive). Opcional.
 * @returns {Promise<{ content: string, language: string, path: string, error?: string, meta?: string }>}
 */
async function readWorkspaceFile(relativePath, startLine, endLine) {
    try {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return { error: 'Sem workspace aberto', content: null, language: null, path: relativePath };
        }

        const fullUri = vscode.Uri.joinPath(folders[0].uri, relativePath);
        const doc     = await vscode.workspace.openTextDocument(fullUri);
        const content = doc.getText();
        const language = doc.languageId;

        // Range de linhas solicitado — sem limite de tamanho
        if (startLine != null && endLine != null) {
            const allLines   = content.split('\n');
            const totalLines = allLines.length;
            const start      = Math.max(1, startLine);
            const end        = Math.min(totalLines, endLine);
            const selected   = allLines.slice(start - 1, end).join('\n');
            return {
                content: selected,
                language,
                path: relativePath,
                error: null,
                meta: `Linhas ${start}-${end} de ${totalLines}`
            };
        }

        // Sem range — comportamento original com truncagem de protecção
        if (content.length > MAX_FILE_CHARS) {
            const truncated = content.split('\n').slice(0, 200).join('\n');
            return {
                content: truncated,
                language,
                path: relativePath,
                error: `Ficheiro truncado — tamanho original: ${content.length} chars (${content.split('\n').length} linhas). A mostrar as primeiras 200 linhas. Usa grep_file para localizar secções e get_file com range para ler blocos específicos.`
            };
        }

        return { content, language, path: relativePath, error: null };

    } catch (err) {
        return { error: `Erro ao ler ficheiro: ${err.message}`, content: null, language: null, path: relativePath };
    }
}

// ─── Grep no workspace ─────────────────────────────────────────────────────────

/**
 * Pesquisa um padrão (regex case-insensitive) em ficheiros do workspace.
 * @param {string} pattern - Padrão de pesquisa (string ou regex)
 * @param {string} [targetPath=''] - Caminho relativo de ficheiro ou pasta (vazio = todo o projecto)
 * @returns {Promise<{ error: string|null, results: Array<{file:string, line:number, text:string}> }>}
 */
async function grepWorkspaceFiles(pattern, targetPath = '') {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return { error: 'Sem workspace aberto.', results: [] };

    let regex;
    try {
        regex = new RegExp(pattern, 'i');
    } catch (err) {
        return { error: `Padrão regex inválido: ${err.message}`, results: [] };
    }

    const rootUri  = folders[0].uri;
    const rootPath = rootUri.fsPath.replaceAll('\\', '/');
    const results  = [];

    let filesToSearch = [];

    if (targetPath) {
        const targetUri = vscode.Uri.joinPath(rootUri, targetPath);
        let stat;
        try {
            stat = await vscode.workspace.fs.stat(targetUri);
        } catch {
            return { error: `Caminho não encontrado: ${targetPath}`, results: [] };
        }

        if (stat.type === vscode.FileType.File) {
            filesToSearch = [targetUri];
        } else if (stat.type === vscode.FileType.Directory) {
            const globPattern = new vscode.RelativePattern(targetUri, '**/*');
            filesToSearch = await vscode.workspace.findFiles(globPattern, EXCLUDE_PATTERN, MAX_FILES);
        }
    } else {
        filesToSearch = await vscode.workspace.findFiles('**/*', EXCLUDE_PATTERN, MAX_FILES);
    }

    for (const fileUri of filesToSearch) {
        if (results.length >= MAX_GREP_RESULTS) break;

        try {
            const doc     = await vscode.workspace.openTextDocument(fileUri);
            const text    = doc.getText();
            const lines   = text.split('\n');
            const relPath = fileUri.fsPath.replaceAll('\\', '/').replace(rootPath + '/', '');

            for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                    results.push({
                        file: relPath,
                        line: i + 1,
                        text: lines[i].trimEnd()
                    });
                    if (results.length >= MAX_GREP_RESULTS) break;
                }
            }
        } catch {
            // Ficheiro binário ou inacessível — ignorar silenciosamente
        }
    }

    return { error: null, results };
}

// ─── Apagar ficheiro ───────────────────────────────────────────────────────────

/**
 * Apaga um ficheiro do workspace após confirmação do utilizador.
 * Inclui protecção contra path traversal.
 * @param {string} relativePath
 * @returns {Promise<string>} Mensagem de resultado
 */
async function deleteWorkspaceFile(relativePath) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';

    const normalised = path.normalize(relativePath);
    if (normalised.startsWith('..') || path.isAbsolute(normalised)) {
        return 'Erro: caminho inválido — não é permitido apagar ficheiros fora do workspace.';
    }

    const uri = vscode.Uri.joinPath(folders[0].uri, relativePath);

    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        return `Erro: ficheiro não encontrado: ${relativePath}`;
    }

    const confirmed = await vscode.window.showWarningMessage(
        `Tis quer APAGAR: ${relativePath}\nEsta acção é irreversível.`,
        { modal: true },
        'Apagar',
        'Cancelar'
    );

    if (confirmed !== 'Apagar') {
        return `Operação cancelada pelo utilizador: ${relativePath}`;
    }

    try {
        await vscode.workspace.fs.delete(uri);
        return `Ficheiro apagado com sucesso: ${relativePath}`;
    } catch (err) {
        return `Erro ao apagar ficheiro: ${err.message}`;
    }
}

// ─── File picker (selector nativo do VS Code) ─────────────────────────────────

/**
 * Abre o selector de ficheiros nativo e envia os conteúdos para o WebView.
 * @param {import('vscode').Webview} view
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

    view.postMessage({ type: 'insertFiles', files });
}

/**
 * Gera a árvore do workspace e envia para o WebView como contexto injectado.
 * @param {import('vscode').Webview} view
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

    view.postMessage({
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
    grepWorkspaceFiles,
    deleteWorkspaceFile,
    pickWorkspaceFiles,
    sendWorkspaceContext,
    getCurrentCode
};
