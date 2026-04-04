//https://pareto-workflows.storage.googleapis.com/5a521f9d4ca1a927ec8e1e479a645bd60433b10c/tools.js

const vscode = require('vscode');
const { readWorkspaceFile, getWorkspaceTree } = require('./workspace');

// ─── Log local de acções ───────────────────────────────────────────────────────

async function appendToActionLog(toolName, args, result) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;

    const now       = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
    const status    = (typeof result === 'string' && result.startsWith('Erro')) ? '❌' : '✅';
    const argStr    = args ? `: ${args}` : '';
    const line      = `${status} [${timestamp}] ${toolName}${argStr} → ${result.split('\n')[0]}\n`;

    const logUri = vscode.Uri.joinPath(folders[0].uri, '.tess-log.md');

    let existing = '';
    try {
        const raw = await vscode.workspace.fs.readFile(logUri);
        existing  = new TextDecoder().decode(raw);
    } catch { /* ficheiro ainda não existe */ }

    if (!existing) {
        existing = '# Tess — Log de Acções\n\n';
    }

    await vscode.workspace.fs.writeFile(logUri, new TextEncoder().encode(existing + line));
}

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
 * @param {string|null} args - Argumentos da ferramenta (caminho para write/edit_file)
 * @param {string|null} [content] - Conteúdo do ficheiro (extraído do bloco de código anterior)
 * @returns {Promise<string>} Resultado formatado para injectar no histórico
 */
async function executeTool(toolName, args, content = null) {
    console.log(`[Tess Tools] Executando: ${toolName}${args ? ':' + args : ''}`);

    switch (toolName) {

        case 'get_tree': {
            const tree = await getWorkspaceTree();
            const result = tree ?? 'Erro: sem workspace aberto ou pasta vazia.';
            await appendToActionLog(toolName, args, result.slice(0, 80));
            return result;
        }

        case 'get_file': {
            if (!args) return 'Erro: get_file requer um caminho de ficheiro.';
            const { error, content, language, path: filePath } = await readWorkspaceFile(args);
            if (error) {
                const result = `Erro ao ler "${args}": ${error}`;
                await appendToActionLog(toolName, args, result);
                return result;
            }
            await appendToActionLog(toolName, args, `lido com sucesso`);
            return `\`\`\`${language}\n// ${filePath}\n${content}\n\`\`\``;
        }

        case 'write_file':
        case 'edit_file': {
            if (!args) return `Erro: ${toolName} requer o caminho do ficheiro.`;
            if (!content) return `Erro: ${toolName} não recebeu conteúdo — escreve o bloco de código antes da tag.`;

            const filePath = args.trim();
            const folders  = vscode.workspace.workspaceFolders;
            if (!folders) return 'Erro: sem workspace aberto.';

            const uri = vscode.Uri.joinPath(folders[0].uri, filePath);

            // Determina se é criação ou edição para a mensagem de confirmação
            let fileExists = false;
            try { await vscode.workspace.fs.stat(uri); fileExists = true; } catch { /* novo */ }
            const action = fileExists ? 'editar' : 'criar';

            const confirmed = await vscode.window.showWarningMessage(
                `Tess quer ${action}: ${filePath}`,
                { modal: true },
                'Permitir',
                'Cancelar'
            );

            if (confirmed !== 'Permitir') {
                const result = `Operação cancelada pelo utilizador: ${filePath}`;
                await appendToActionLog(toolName, filePath, result);
                return result;
            }

            try {
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

                // Abre o ficheiro no editor para o utilizador ver o resultado
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });

                console.log(`[Tess Tools] Ficheiro ${action}: ${filePath}`);
                const result = `Ficheiro ${action === 'criar' ? 'criado' : 'editado'} com sucesso: ${filePath}`;
                await appendToActionLog(toolName, filePath, result);
                return result;
            } catch (err) {
                const result = `Erro ao ${action} ficheiro: ${err.message}`;
                await appendToActionLog(toolName, filePath, result);
                return result;
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

                const result = `Conteúdo de "${dirPath || '/'}":\n${lines.join('\n')}`;
                await appendToActionLog(toolName, dirPath || '/', `listado (${lines.length} entradas)`);
                return result;
            } catch (err) {
                const result = `Erro ao listar directoria: ${err.message}`;
                await appendToActionLog(toolName, dirPath || '/', result);
                return result;
            }
        }

        default:
            return `Ferramenta desconhecida: "${toolName}". Ferramentas disponíveis: get_tree, get_file, list_dir, write_file, edit_file`;
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
| \`[TOOL:get_tree]\` | Ver a estrutura completa do projecto |
| \`[TOOL:get_file:caminho/ficheiro.js]\` | Ler o conteúdo de um ficheiro |
| \`[TOOL:list_dir:caminho/pasta]\` | Listar o conteúdo de uma directoria |
| \`[TOOL:write_file:caminho/ficheiro.js]\` | Criar um ficheiro novo (pede confirmação) |
| \`[TOOL:edit_file:caminho/ficheiro.js]\` | Editar um ficheiro existente (pede confirmação) |

### Protocolo para write_file e edit_file

Para criar ou editar um ficheiro, segue **obrigatoriamente** este padrão:
1. Escreve o conteúdo completo num bloco de código (\`\`\`linguagem ... \`\`\`)
2. Imediatamente a seguir, coloca a tag da ferramenta com o caminho

Exemplo:
\`\`\`javascript
// conteúdo completo do ficheiro
function hello() { return 'world'; }
\`\`\`
[TOOL:write_file:src/utils.js]

### Regras

1. Usa **get_tree** primeiro quando não conheces a estrutura do projecto
2. Usa **get_file** para ler ficheiros antes de os editar
3. O conteúdo do bloco de código deve ser o ficheiro completo, nunca parcial
4. Pede apenas os ficheiros necessários — não peças todos de uma vez
5. Após receberes o resultado de uma ferramenta, analisa e responde ao utilizador
6. As tags são removidas da resposta visível — o utilizador não as vê
`.trim();
}

module.exports = { executeToolCalls, executeTool, getToolsSystemPrompt };