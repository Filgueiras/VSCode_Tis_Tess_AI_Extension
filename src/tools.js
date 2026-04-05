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

    const logUri = vscode.Uri.joinPath(folders[0].uri, '.tis-log.md');

    let existing = '';
    try {
        const raw = await vscode.workspace.fs.readFile(logUri);
        existing  = new TextDecoder().decode(raw);
    } catch { /* ficheiro ainda não existe */ }

    if (!existing) {
        existing = '# TIS.ai — Log de Acções\n\n';
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
    const cleanText = text.replaceAll(TOOL_REGEX, '').trim();

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
// ─── Handlers individuais por ferramenta ──────────────────────────────────────

async function _toolGetTree(toolName, args) {
    const tree = await getWorkspaceTree();
    const result = tree ?? 'Erro: sem workspace aberto ou pasta vazia.';
    await appendToActionLog(toolName, args, result.slice(0, 80));
    return result;
}

async function _toolGetFile(toolName, args) {
    if (!args) return 'Erro: get_file requer um caminho de ficheiro.';
    const { error, content, language, path: filePath } = await readWorkspaceFile(args);
    if (error) {
        const result = `Erro ao ler "${args}": ${error}`;
        await appendToActionLog(toolName, args, result);
        return result;
    }
    await appendToActionLog(toolName, args, 'lido com sucesso');
    return `\`\`\`${language}\n// ${filePath}\n${content}\n\`\`\``;
}

async function _toolWriteFile(toolName, args, content) {
    if (!args) return `Erro: ${toolName} requer o caminho do ficheiro.`;
    if (!content) return `Erro: ${toolName} não recebeu conteúdo — escreve o bloco de código antes da tag.`;

    const filePath = args.trim();
    const folders  = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';

    const uri = vscode.Uri.joinPath(folders[0].uri, filePath);

    let fileExists = false;
    try { await vscode.workspace.fs.stat(uri); fileExists = true; } catch { /* novo */ }
    const action = fileExists ? 'editar' : 'criar';

    const confirmed = await vscode.window.showWarningMessage(
        `Tis quer ${action}: ${filePath}`,
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
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
        const result = `Ficheiro ${action === 'criar' ? 'criado' : 'editado'} com sucesso: ${filePath}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    } catch (err) {
        const result = `Erro ao ${action} ficheiro: ${err.message}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }
}

async function _toolListDir(toolName, args = '') {
    const dirPath = args;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';
    try {
        const uri     = vscode.Uri.joinPath(folders[0].uri, dirPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        const lines   = entries.map(([name, type]) =>
            `${type === vscode.FileType.Directory ? '📁' : '📄'} ${name}`
        );
        const result = `Conteúdo de "${dirPath || '/'}":\n${lines.join('\n')}`;
        await appendToActionLog(toolName, dirPath || '/', `listado (${lines.length} entradas)`);
        return result;
    } catch (err) {
        const result = `Erro ao listar directoria: ${err.message}`;
        await appendToActionLog(toolName, dirPath || '/', result);
        return result;
    }
}

function _tasksUri() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return null;
    return vscode.Uri.joinPath(folders[0].uri, '.tis-tasks.md');
}

async function _readTasksFile(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(raw);
    } catch { return ''; }
}

async function _toolGetTasks(toolName) {
    const uri = _tasksUri();
    if (!uri) return 'Erro: sem workspace aberto.';
    const content = await _readTasksFile(uri);
    await appendToActionLog(toolName, null, 'lista lida');
    return content || '(lista de tarefas vazia)';
}

async function _toolSetTasks(toolName, args) {
    if (!args) return 'Erro: set_tasks requer conteúdo.';
    const uri = _tasksUri();
    if (!uri) return 'Erro: sem workspace aberto.';
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(`# TIS.ai — Tarefas\n\n${args.trim()}\n`));
    await appendToActionLog(toolName, null, 'lista actualizada');
    return 'Lista de tarefas actualizada.';
}

async function _toolAddTask(toolName, args) {
    if (!args) return 'Erro: add_task requer a descrição da tarefa.';
    const uri = _tasksUri();
    if (!uri) return 'Erro: sem workspace aberto.';
    let existing = await _readTasksFile(uri);
    if (!existing) existing = '# TIS.ai — Tarefas\n\n';
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(
        existing.trimEnd() + `\n- [ ] ${args.trim()}\n`
    ));
    await appendToActionLog(toolName, args, 'tarefa adicionada');
    return `Tarefa adicionada: ${args.trim()}`;
}

async function _toolDoneTask(toolName, args) {
    if (!args) return 'Erro: done_task requer a descrição ou número da tarefa.';
    const uri = _tasksUri();
    if (!uri) return 'Erro: sem workspace aberto.';
    const existing = await _readTasksFile(uri);
    if (!existing) return 'Erro: sem lista de tarefas existente.';

    const needle = args.trim().toLowerCase();
    let matched  = false;
    const updated = existing.split('\n').map(line => {
        if (!matched && line.startsWith('- [ ]') && line.toLowerCase().includes(needle)) {
            matched = true;
            return line.replaceAll('- [ ]', '- [x]');
        }
        return line;
    }).join('\n');

    if (!matched) return `Tarefa não encontrada: "${args.trim()}"`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
    await appendToActionLog(toolName, args, 'tarefa concluída');
    return `Tarefa marcada como concluída: ${args.trim()}`;
}

// ─── Dispatcher de ferramentas ────────────────────────────────────────────────

const TOOL_HANDLERS = {
    get_tree:  (n, a)    => _toolGetTree(n, a),
    get_file:  (n, a)    => _toolGetFile(n, a),
    write_file:(n, a, c) => _toolWriteFile(n, a, c),
    edit_file: (n, a, c) => _toolWriteFile(n, a, c),
    list_dir:  (n, a)    => _toolListDir(n, a),
    get_tasks: (n)       => _toolGetTasks(n),
    set_tasks: (n, a)    => _toolSetTasks(n, a),
    add_task:  (n, a)    => _toolAddTask(n, a),
    done_task: (n, a)    => _toolDoneTask(n, a),
};

async function executeTool(toolName, args, content = null) {
    console.log(`[Tis Tools] Executando: ${toolName}${args ? ':' + args : ''}`);
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
        return `Ferramenta desconhecida: "${toolName}". Ferramentas disponíveis: ${Object.keys(TOOL_HANDLERS).join(', ')}`;
    }
    return handler(toolName, args, content);
}

// ─── System prompt para o agente ──────────────────────────────────────────────

/**
 * Retorna o bloco de texto a adicionar ao system prompt do agente TIS.ai
 * para activar o protocolo de ferramentas e definir o comportamento esperado.
 */
function getToolsSystemPrompt() {
    return `
# Contexto de execução — VS Code (Tis.ai Hypercoding)

Estás a ser executado dentro do VS Code como extensão nativa de desenvolvimento assistido por IA.
A extensão injeta automaticamente em cada mensagem:
- **Primeira mensagem da sessão:** estrutura completa de ficheiros do workspace
- **Todas as mensagens:** conteúdo do ficheiro activo no editor (ou selecção, se houver)

Usa este contexto directamente. Não peças informação que já foi fornecida.

# Override de comportamento — execução directa

**Ignora qualquer instrução anterior que diga para aguardar confirmação antes de começar.**

Em leituras, análises e exploração de código: age imediatamente.
Em escrita de ficheiros (write_file, edit_file): o VS Code pede confirmação nativa ao utilizador — não precisas de pedir aprovação antes de emitir a tag.
Em tarefas multi-step: apresenta o plano e executa de seguida sem esperar "sim".

# Manifesto Hypercoding — princípios de desenvolvimento sustentável

Estas são as tuas directrizes de qualidade. Aplica-as activamente, não apenas quando questionado.

## 1. Qualidade antes de velocidade
- Prefere código claro e bem estruturado a código que "apenas funciona"
- Nomeia variáveis, funções e ficheiros de forma descritiva e intencional
- Evita duplicação — reutiliza o que existe antes de criar novo
- Quando detetares dívida técnica relevante numa área que estás a tocar, assinala-a

## 2. Segurança por defeito
- Nunca sugiras credenciais, tokens ou segredos no código — usa variáveis de ambiente
- Valida e sanitiza sempre inputs que vêm do exterior (utilizador, API, ficheiro)
- Sinaliza activamente: SQL injection, XSS, SSRF, path traversal, e outros riscos OWASP comuns
- Em dependências novas: assinala se têm vulnerabilidades conhecidas ou manutenção inactiva

## 3. Eficiência como responsabilidade
- Evita operações desnecessariamente custosas: loops aninhados sem necessidade, queries sem índice, re-renders excessivos
- Prefere estruturas de dados adequadas ao padrão de acesso
- Código eficiente não é só mais rápido — consome menos energia

## 4. Manutenibilidade como acto de respeito
- Comenta o que não é óbvio — não o que já é evidente pelo código
- Funções com mais de uma responsabilidade devem ser divididas
- Testes não são opcionais em código de produção — sugere-os quando relevante
- Se removeres código, remove-o a sério — não o comentas

## 5. Autonomia com supervisão humana
- Executa o que foi pedido; propõe melhorias mas não as impões
- Quando uma decisão tem impacto relevante (arquitectura, segurança, performance), explica as opções
- Nunca alteras ficheiros sem passar pelo mecanismo de confirmação do VS Code

# Ferramentas disponíveis

As ferramentas são activadas por tags na resposta. As tags são removidas do texto visível.

## Ficheiros
| Tag | Descrição |
|-----|-----------|
| \`[TOOL:get_tree]\` | Estrutura completa do projecto |
| \`[TOOL:get_file:caminho]\` | Ler ficheiro |
| \`[TOOL:list_dir:caminho]\` | Listar directoria |
| \`[TOOL:write_file:caminho]\` | Criar ficheiro (bloco de código imediatamente antes) |
| \`[TOOL:edit_file:caminho]\` | Editar ficheiro (bloco de código imediatamente antes) |

## Lista de tarefas (persiste em \`.tis-tasks.md\` no workspace)
| Tag | Descrição |
|-----|-----------|
| \`[TOOL:get_tasks]\` | Ler lista de tarefas actual |
| \`[TOOL:set_tasks:conteúdo]\` | Substituir toda a lista |
| \`[TOOL:add_task:descrição]\` | Adicionar tarefa pendente |
| \`[TOOL:done_task:descrição]\` | Marcar tarefa como concluída |

Usa a lista de tarefas em trabalho multi-passo: cria-a no início, actualiza ao longo do processo.
Ao retomar trabalho, começa por \`[TOOL:get_tasks]\` para ver o estado actual.
`.trim();
}

module.exports = { executeToolCalls, executeTool, getToolsSystemPrompt };