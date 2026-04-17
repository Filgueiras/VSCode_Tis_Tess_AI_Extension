// src/tools.js
const vscode = require('vscode');
const { readWorkspaceFile, getWorkspaceTree, grepWorkspaceFiles, deleteWorkspaceFile } = require('./workspace');

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

// ─── Handlers individuais por ferramenta ──────────────────────────────────────

async function _toolGetTree(toolName, args) {
    const tree = await getWorkspaceTree();
    const result = tree ?? 'Erro: sem workspace aberto ou pasta vazia.';
    await appendToActionLog(toolName, args, result.slice(0, 80));
    return result;
}

async function _toolGetFile(toolName, args) {
    if (!args) return 'Erro: get_file requer um caminho de ficheiro.';

    // Detectar range opcional: get_file:caminho:startLine:endLine
    const parts = args.split(':');
    let filePath, startLine, endLine;

    if (parts.length >= 3) {
        const maybeEnd   = parseInt(parts[parts.length - 1], 10);
        const maybeStart = parseInt(parts[parts.length - 2], 10);
        if (!isNaN(maybeStart) && !isNaN(maybeEnd) && maybeStart > 0 && maybeEnd > 0) {
            filePath  = parts.slice(0, -2).join(':');
            startLine = maybeStart;
            endLine   = maybeEnd;
        }
    }

    if (!filePath) filePath = args;

    if (startLine && endLine) {
        const { error, content, language, path: fPath, meta } = await readWorkspaceFile(filePath, startLine, endLine);
        if (error) {
            const result = `Erro ao ler "${filePath}": ${error}`;
            await appendToActionLog(toolName, args, result);
            return result;
        }
        await appendToActionLog(toolName, args, `lido com range (${meta})`);
        return `\`\`\`${language}\n// ${fPath} (${meta})\n${content}\n\`\`\``;
    }

    // Comportamento original (sem range)
    const { error, content, language, path: fPath } = await readWorkspaceFile(filePath);
    if (error) {
        const result = `Erro ao ler "${filePath}": ${error}`;
        await appendToActionLog(toolName, args, result);
        return result;
    }
    await appendToActionLog(toolName, args, 'lido com sucesso');
    return `\`\`\`${language}\n// ${fPath}\n${content}\n\`\`\``;
}

async function _toolGrepFile(toolName, args) {
    if (!args) return 'Erro: grep_file requer pelo menos um padrão. Formato: grep_file:padrão ou grep_file:padrão:caminho';

    const sepIndex = args.indexOf(':');
    const pattern  = sepIndex === -1 ? args : args.slice(0, sepIndex);
    const target   = sepIndex === -1 ? ''   : args.slice(sepIndex + 1);

    const { error, results } = await grepWorkspaceFiles(pattern, target);

    if (error) {
        await appendToActionLog(toolName, args, error);
        return error;
    }

    if (results.length === 0) {
        const msg = `Nenhum resultado para "${pattern}"${target ? ` em ${target}` : ''}.`;
        await appendToActionLog(toolName, args, msg);
        return msg;
    }

    const formatted = results.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n');
    const summary   = `${results.length} resultado(s)${results.length >= 50 ? ' (limite atingido)' : ''}`;
    await appendToActionLog(toolName, args, summary);
    return `Resultados para "${pattern}"${target ? ` em ${target}` : ''}:\n\n${formatted}`;
}

async function _toolOpenFile(toolName, args) {
    if (!args) return 'Erro: open_file requer o caminho do ficheiro.';
    const filePath = args.trim();
    const folders  = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';

    const uri = vscode.Uri.joinPath(folders[0].uri, filePath);
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        const result = `Erro: ficheiro não encontrado: ${filePath}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }

    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
        const result = `Ficheiro aberto no editor: ${filePath}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    } catch (err) {
        const result = `Erro ao abrir ficheiro: ${err.message}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }
}

async function _toolWriteFile(toolName, args, content) {
    if (!args) return `Erro: ${toolName} requer o caminho do ficheiro.`;
    if (!content) return `Erro: ${toolName} não recebeu conteúdo — escreve o bloco de código antes da tag.`;

    const filePath = args.trim();
    const folders  = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';

    const uri = vscode.Uri.joinPath(folders[0].uri, filePath);

    let fileExists   = false;
    let originalSize = 0;
    try {
        const raw    = await vscode.workspace.fs.readFile(uri);
        originalSize = raw.length;
        fileExists   = true;
    } catch { /* novo ficheiro */ }

    const action = fileExists ? 'editar' : 'criar';

    // ── Protecção anti-trecho: avisa se o novo conteúdo é muito menor que o original ──
    let warningDetail = '';
    if (toolName === 'edit_file' && fileExists && originalSize > 0) {
        const newSize = new TextEncoder().encode(content).length;
        const ratio   = newSize / originalSize;
        if (ratio < 0.6 && originalSize > 500) {
            warningDetail = `\n⚠️ O novo conteúdo (${newSize} bytes) é muito menor que o ficheiro original (${originalSize} bytes).\nIsso pode substituir o ficheiro inteiro por um trecho.\nUsa patch_file para edições cirúrgicas.`;
        }
    }

    const confirmed = await vscode.window.showWarningMessage(
        `Tis quer ${action}: ${filePath}${warningDetail}`,
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

/**
 * Aplica patches cirúrgicos (search+replace) num ficheiro existente.
 * Formato do bloco de código:
 *   SEARCH:
 *   <texto exacto a encontrar>
 *   REPLACE:
 *   <texto de substituição>
 * Múltiplos patches separados por ---NEXT_PATCH---
 */
async function _toolPatchFile(toolName, args, content) {
    if (!args) return 'Erro: patch_file requer o caminho do ficheiro.';
    if (!content) return 'Erro: patch_file não recebeu conteúdo — escreve o bloco SEARCH/REPLACE antes da tag.';

    const filePath = args.trim();
    const folders  = vscode.workspace.workspaceFolders;
    if (!folders) return 'Erro: sem workspace aberto.';

    const uri = vscode.Uri.joinPath(folders[0].uri, filePath);

    let originalContent;
    try {
        const raw     = await vscode.workspace.fs.readFile(uri);
        originalContent = new TextDecoder().decode(raw);
    } catch {
        const result = `Erro: ficheiro não encontrado para patch: ${filePath}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }

    // Divide em blocos de patch individuais
    const patchBlocks = content.split(/^---NEXT_PATCH---$/m);
    let patched = originalContent;
    const applied = [];
    const failed  = [];

    for (let i = 0; i < patchBlocks.length; i++) {
        const block = patchBlocks[i];
        const searchMatch  = block.match(/SEARCH:\r?\n([\s\S]*?)\r?\nREPLACE:\r?\n([\s\S]*?)(?:\r?\n)?$/);
        if (!searchMatch) {
            failed.push(`Patch ${i + 1}: formato inválido (esperado SEARCH:/REPLACE:)`);
            continue;
        }
        const searchText  = searchMatch[1];
        const replaceText = searchMatch[2];

        if (!patched.includes(searchText)) {
            failed.push(`Patch ${i + 1}: texto SEARCH não encontrado no ficheiro`);
            continue;
        }

        patched = patched.replace(searchText, replaceText);
        applied.push(`Patch ${i + 1}: aplicado`);
    }

    if (applied.length === 0) {
        const result = `Nenhum patch aplicado em ${filePath}:\n${failed.join('\n')}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }

    const confirmed = await vscode.window.showWarningMessage(
        `Tis quer aplicar ${applied.length} patch(es) em: ${filePath}`,
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
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(patched));
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
        const summary = [...applied, ...failed].join('\n');
        const result  = `patch_file concluído em ${filePath}:\n${summary}`;
        await appendToActionLog(toolName, filePath, `${applied.length} patch(es) aplicados`);
        return result;
    } catch (err) {
        const result = `Erro ao escrever ficheiro após patch: ${err.message}`;
        await appendToActionLog(toolName, filePath, result);
        return result;
    }
}

async function _toolDeleteFile(toolName, args) {
    if (!args) return 'Erro: delete_file requer o caminho do ficheiro.';
    const result = await deleteWorkspaceFile(args.trim());
    await appendToActionLog(toolName, args, result);
    return result;
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
    get_tree:    (n, a)    => _toolGetTree(n, a),
    get_file:    (n, a)    => _toolGetFile(n, a),
    grep_file:   (n, a)    => _toolGrepFile(n, a),
    open_file:   (n, a)    => _toolOpenFile(n, a),
    write_file:  (n, a, c) => _toolWriteFile(n, a, c),
    edit_file:   (n, a, c) => _toolWriteFile(n, a, c),
    patch_file:  (n, a, c) => _toolPatchFile(n, a, c),
    delete_file: (n, a)    => _toolDeleteFile(n, a),
    list_dir:    (n, a)    => _toolListDir(n, a),
    get_tasks:   (n)       => _toolGetTasks(n),
    set_tasks:   (n, a)    => _toolSetTasks(n, a),
    add_task:    (n, a)    => _toolAddTask(n, a),
    done_task:   (n, a)    => _toolDoneTask(n, a),
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
| \`[TOOL:get_file:caminho]\` | Ler ficheiro completo (trunca se >100K chars) |
| \`[TOOL:get_file:caminho:inicio:fim]\` | Ler range de linhas (1-based, inclusive) — usar para ficheiros grandes |
| \`[TOOL:grep_file:padrão]\` | Pesquisar texto em todo o projecto |
| \`[TOOL:grep_file:padrão:caminho]\` | Pesquisar texto num ficheiro ou pasta |
| \`[TOOL:list_dir:caminho]\` | Listar directoria |
| \`[TOOL:open_file:caminho]\` | Abrir ficheiro no editor (sem editar) |
| \`[TOOL:write_file:caminho]\` | Criar ficheiro novo (bloco de código completo antes da tag) |
| \`[TOOL:patch_file:caminho]\` | **Edição cirúrgica** (bloco SEARCH/REPLACE antes da tag) — preferir sempre sobre edit_file |
| \`[TOOL:edit_file:caminho]\` | Substituir ficheiro completo (só usar com conteúdo total do ficheiro) |
| \`[TOOL:delete_file:caminho]\` | Apagar ficheiro (pede confirmação modal) |

## Lista de tarefas (persiste em .tis-tasks.md no workspace)
| Tag | Descrição |
|-----|-----------|
| \`[TOOL:get_tasks]\` | Ler lista de tarefas actual |
| \`[TOOL:set_tasks:conteúdo]\` | Substituir toda a lista |
| \`[TOOL:add_task:descrição]\` | Adicionar tarefa pendente |
| \`[TOOL:done_task:descrição]\` | Marcar tarefa como concluída |

## Pesquisa eficiente em ficheiros grandes
Quando um ficheiro é truncado (>100K chars), usa esta estratégia:
1. grep_file com o padrão e caminho para localizar a zona de interesse
2. get_file com caminho, linha inicial e linha final para ler apenas as linhas relevantes (ex: linhas 1-300, depois 301-600, etc.)

Nunca lês um ficheiro truncado e tentas inferir o conteúdo que não viste — sempre usa get_file com range para ler os blocos que precisas.

## Edição cirúrgica de ficheiros — REGRA OBRIGATÓRIA

**Nunca uses \`edit_file\` para substituir um ficheiro inteiro por um trecho de código.**

- \`write_file\` — para criar ficheiros novos ou reescritas totais intencionais (ficheiro novo do zero)
- \`edit_file\` — apenas quando forneces o ficheiro COMPLETO e tens a certeza absoluta do conteúdo total
- \`patch_file\` — **OBRIGATÓRIO para qualquer alteração parcial** (corrigir uma função, mudar uma variável, adicionar um método, etc.)

### Formato do patch_file

O bloco de código antes da tag deve ter o formato:
\`\`\`
SEARCH:
<texto exacto que existe no ficheiro, incluindo indentação>
REPLACE:
<novo texto que substitui o anterior>
\`\`\`

Para múltiplas alterações independentes no mesmo ficheiro, separa com \`---NEXT_PATCH---\`:
\`\`\`
SEARCH:
primeira função antiga
REPLACE:
primeira função nova
---NEXT_PATCH---
SEARCH:
segunda coisa a mudar
REPLACE:
segunda coisa nova
\`\`\`
[TOOL:patch_file:caminho/do/ficheiro]

O texto SEARCH deve ser copiado **exactamente** do ficheiro (usa get_file para confirmar antes de patchear).

## Abre ficheiros sem editar
| Tag | Descrição |
|-----|-----------|
| \`[TOOL:open_file:caminho]\` | Abre ficheiro no editor (só leitura, sem alterações) |

Usa open_file quando o utilizador pedir para ver um ficheiro, sem qualquer intenção de edição.

## Regras de comunicação — sem repetições

- **Não repitas perguntas ou pedidos de confirmação** que o utilizador já respondeu nesta conversa.
- Se o utilizador confirmou uma informação (ex: "sim, esse é o caminho correcto"), age com base nessa confirmação — não perguntes de novo.
- Se já tens a informação necessária no contexto (ficheiro activo, árvore do projecto, resultados de ferramentas anteriores), usa-a directamente.
- Nunca digas "estou a trabalhar nisso" sem imediatamente emitir uma tag de ferramenta. Ou ages, ou explicas o que precisas — mas não anuncias trabalho sem o fazer.

## Protocolo de trabalho verificável

Cada vez que fazes uma acção (ler, escrever, pesquisar), emite a tag correspondente.
O utilizador tem um sistema de log que regista cada acção com timestamp.
Nunca descreves uma acção como feita sem teres emitido a tag que a executa.

Usa a lista de tarefas em trabalho multi-passo: cria-a no início, actualiza ao longo do processo.
Ao retomar trabalho, começa por get_tasks para ver o estado actual.
`.trim();
}

module.exports = { executeToolCalls, executeTool, getToolsSystemPrompt };
