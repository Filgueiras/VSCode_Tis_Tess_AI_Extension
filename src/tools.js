//https://pareto-workflows.storage.googleapis.com/5a521f9d4ca1a927ec8e1e479a645bd60433b10c/tools.js

const vscode = require('vscode');
const { readWorkspaceFile, getWorkspaceTree } = require('./workspace');

// ─── Protocolo de ferramentas ──────────────────────────────────────────────────
// Formato: [TOOL:nome_ferramenta:argumento_opcional]
// Exemplos:
//   [TOOL:get_tree]
//   [TOOL:get_file:src/extension.js]
//   [TOOL:write_file:src/test.js:conteudo]

const TOOL_REGEX = /\[TOOL:(\w+)(?::([^\]]+))?\]/g;

// ─── Executor de ferramentas ───────────────────────────────────────────────────

/**
 * Detecta e executa tool calls no texto de resposta do agente.
 * @param {string} text - Texto completo da resposta do agente
 * @param {import('vscode').WebviewView} view - WebviewView para enviar resultados
 * @returns {{ cleanText: string, hasTools: boolean }}
 */
async function executeToolCalls(text, view) {
    const matches = [...text.matchAll(TOOL_REGEX)];
    if (matches.length === 0) return { cleanText: text, hasTools: false };

    // Remove as tags do texto visível
    const cleanText = text.replace(TOOL_REGEX, '').trim();

    // Executa cada ferramenta sequencialmente
    for (const match of matches) {
        const [, toolName, args] = match;
        const result = await executeTool(toolName, args ?? null);

        view.webview.postMessage({
            type: 'toolResult',
            tool: toolName,
            args: args ?? null,
            result
        });
    }

    return { cleanText, hasTools: true };
}

/**
 * Executa uma ferramenta específica e retorna o resultado formatado.
 * @param {string} toolName - Nome da ferramenta
 * @param {string|null} args - Argumentos da ferramenta
 * @returns {Promise<string>} Resultado formatado para injectar no histórico
 */
async function executeTool(toolName, args) {
    console.log(`[Tess Tools] Executando: ${toolName}${args ? ':' + args : ''}`);

    switch (toolName) {

        case 'get_tree': {
            const tree = await getWorkspaceTree();
            if (!tree) return 'Erro: sem workspace aberto ou pasta vazia.';
            return tree;
        }

        case 'get_file': {
            if (!args) return 'Erro: get_file requer um caminho de ficheiro.';
            const { error, content, language, path } = await readWorkspaceFile(args);
            if (error) return `Erro ao ler "${args}": ${error}`;
            return `\`\`\`${language}\n// ${path}\n${content}\n\`\`\``;
        }

        case 'write_file': {
            if (!args) return 'Erro: write_file requer caminho e conteúdo.';

            // Formato: caminho:conteudo (o conteúdo pode conter ":")
            const colonIndex = args.indexOf(':');
            if (colonIndex === -1) return 'Erro: formato inválido. Use [TOOL:write_file:caminho:conteudo]';

            const filePath = args.slice(0, colonIndex);
            const fileContent = args.slice(colonIndex + 1);

            const confirmed = await vscode.window.showWarningMessage(
                `Tess quer escrever em: ${filePath}`,
                { modal: true },
                'Permitir',
                'Cancelar'
            );

            if (confirmed !== 'Permitir') return `Escrita cancelada pelo utilizador: ${filePath}`;

            try {
                const folders = vscode.workspace.workspaceFolders;
                if (!folders) return 'Erro: sem workspace aberto.';

                const uri = vscode.Uri.joinPath(folders[0].uri, filePath);
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(uri, encoder.encode(fileContent));

                console.log(`[Tess Tools] Ficheiro escrito: ${filePath}`);
                return `Ficheiro escrito com sucesso: ${filePath}`;
            } catch (err) {
                return `Erro ao escrever ficheiro: ${err.message}`;
            }
        }

        case 'list_dir': {
            const dirPath = args ?? '';
            try {
                const folders = vscode.workspace.workspaceFolders;
                if (!folders) return 'Erro: sem workspace aberto.';

                const uri = vscode.Uri.joinPath(folders[0].uri, dirPath);
                const entries = await vscode.workspace.fs.readDirectory(uri);
                const lines = entries.map(([name, type]) => {
                    const icon = type === vscode.FileType.Directory ? '📁' : '📄';
                    return `${icon} ${name}`;
                });

                return `Conteúdo de "${dirPath || '/'}":\n${lines.join('\n')}`;
            } catch (err) {
                return `Erro ao listar directoria: ${err.message}`;
            }
        }

        default:
            return `Ferramenta desconhecida: "${toolName}". Ferramentas disponíveis: get_tree, get_file, write_file, list_dir`;
    }
}

// ─── System prompt para o agente ──────────────────────────────────────────────

/**
 * Retorna o bloco de texto a adicionar ao system prompt do agente Tess
 * para activar o protocolo de ferramentas.
 */
function getToolsSystemPrompt() {
    return `
## Ferramentas disponíveis (VS Code File System)

Tens acesso ao sistema de ficheiros do projecto VS Code do utilizador.
Para usar uma ferramenta, inclui a tag exacta na tua resposta — a extensão intercepta-a automaticamente.

### Ferramentas

| Tag | Descrição |
|-----|-----------|
| [TOOL:get_tree] | Ver a estrutura completa do projecto |
| [TOOL:get_file:caminho/ficheiro.js] | Ler o conteúdo de um ficheiro |
| [TOOL:list_dir:caminho/pasta] | Listar o conteúdo de uma directoria |
| [TOOL:write_file:caminho/ficheiro.js:conteudo] | Escrever/editar um ficheiro (pede confirmação ao utilizador) |

### Regras de uso

1. Usa **get_tree** primeiro quando não conheces a estrutura do projecto
2. Usa **get_file** para ler ficheiros específicos antes de os editar
3. Usa **write_file** apenas quando tiveres o conteúdo completo e correcto
4. Pede apenas os ficheiros necessários — não peças todos de uma vez
5. Após receberes o resultado de uma ferramenta, analisa e responde ao utilizador
6. As tags são removidas da resposta visível — o utilizador não as vê
`.trim();
}

module.exports = { executeToolCalls, executeTool, getToolsSystemPrompt };