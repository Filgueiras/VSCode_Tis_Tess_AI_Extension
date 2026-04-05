// src/chatHistory.js
// ─── TIS.ai — Chat History Manager ────────────────────────────────────────
// Responsabilidade: persistir e gerir o histórico de conversas.
// Armazena em globalStorageUri/tis_history.json — não polui o workspace.
// Sessões são associadas ao workspacePath — cada projecto tem o seu contexto.

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

/** @type {string} Caminho absoluto para o ficheiro de histórico */
let _historyPath = null;

/** @type {boolean} Flag de escrita em curso */
let _writing = false;

/** @type {ChatSession[] | null} Sessões pendentes de escrita */
let _pending = null;

/**
 * Inicializa o módulo. Deve ser chamado em activate().
 * @param {import('vscode').ExtensionContext} context
 */
function init(context) {
    const storageDir = context.globalStorageUri.fsPath;

    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    _historyPath = path.join(storageDir, 'tis_history.json');

    if (!fs.existsSync(_historyPath)) {
        _write([]);
    }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Cria uma nova sessão de chat associada a um workspace.
 * O título é gerado automaticamente a partir da primeira mensagem.
 *
 * @param {string} firstMessage   - Primeira mensagem do utilizador
 * @param {string} [model]        - Modelo seleccionado
 * @param {string} [workspacePath] - Caminho absoluto do workspace activo
 * @returns {string} ID da sessão criada
 */
function createSession(firstMessage, model = 'auto', workspacePath = null) {
    _assertInit();

    const sessions = _read();
    const id       = crypto.randomUUID();
    const title    = _generateTitle(firstMessage);

    const session = {
        id,
        title,
        model,
        workspacePath: workspacePath ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages:  [],
    };

    sessions.unshift(session);
    _write(sessions);

    return id;
}

/**
 * Adiciona uma mensagem a uma sessão existente.
 *
 * @param {string}               sessionId
 * @param {'user' | 'assistant'} role
 * @param {string}               content
 * @param {string}               [model] - modelo usado (opcional)
 * @returns {boolean} true se a sessão foi encontrada e actualizada
 */
function appendMessage(sessionId, role, content, model) {
    _assertInit();

    const sessions = _read();
    const session  = sessions.find(s => s.id === sessionId);

    if (!session) {
        console.error(`[ChatHistory] Session not found: ${sessionId}`);
        return false;
    }

    session.messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
        ...(model ? { model } : {}),
    });

    session.updatedAt = new Date().toISOString();
    _write(sessions);

    return true;
}

/**
 * Devolve a lista de sessões sem as mensagens (para o drawer de histórico).
 * Se workspacePath for fornecido, filtra apenas as sessões desse workspace.
 *
 * @param {string} [workspacePath] - Filtra por workspace. Se omitido, devolve todas.
 * @returns {{ id: string, title: string, createdAt: string, updatedAt: string, workspacePath: string|null }[]}
 */
function listSessions(workspacePath = null) {
    _assertInit();
    const all = _read();
    const filtered = workspacePath
        ? all.filter(s => s.workspacePath === workspacePath)
        : all;

    return filtered.map(({ id, title, createdAt, updatedAt, workspacePath: wp }) => ({
        id,
        title,
        createdAt,
        updatedAt,
        workspacePath: wp ?? null,
    }));
}

/**
 * Devolve a sessão mais recente para um workspace específico.
 * Usado em _onWebviewReady para restaurar a conversa correcta ao abrir um projecto.
 *
 * @param {string} workspacePath
 * @returns {ChatSession | null}
 */
function getLatestSessionForWorkspace(workspacePath) {
    _assertInit();
    const sessions = _read();
    // Já estão ordenadas por unshift — a primeira é a mais recente
    return sessions.find(s => s.workspacePath === workspacePath) ?? null;
}

/**
 * Devolve uma sessão completa com todas as mensagens.
 *
 * @param {string} sessionId
 * @returns {ChatSession | null}
 */
function getSession(sessionId) {
    _assertInit();
    return _read().find(s => s.id === sessionId) ?? null;
}

/**
 * Renomeia uma sessão.
 *
 * @param {string} sessionId
 * @param {string} newTitle
 * @returns {boolean}
 */
function renameSession(sessionId, newTitle) {
    _assertInit();

    const sessions = _read();
    const session  = sessions.find(s => s.id === sessionId);

    if (!session) return false;

    session.title     = newTitle.trim() || session.title;
    session.updatedAt = new Date().toISOString();
    _write(sessions);

    return true;
}

/**
 * Apaga uma sessão pelo ID.
 *
 * @param {string} sessionId
 * @returns {boolean}
 */
function deleteSession(sessionId) {
    _assertInit();

    const sessions = _read();
    const index    = sessions.findIndex(s => s.id === sessionId);

    if (index === -1) return false;

    sessions.splice(index, 1);
    _write(sessions);

    return true;
}

/**
 * Apaga todo o histórico.
 */
function clearAll() {
    _assertInit();
    _write([]);
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/**
 * Lê e parseia o ficheiro de histórico.
 * @returns {ChatSession[]}
 */
function _read() {
    try {
        const raw = fs.readFileSync(_historyPath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('[ChatHistory] Failed to read history file:', err);
        return [];
    }
}

/**
 * Serializa e escreve o histórico no disco com protecção contra concorrência.
 * Se uma escrita estiver em curso, guarda a versão mais recente e escreve
 * assim que a anterior terminar.
 *
 * @param {ChatSession[]} sessions
 */
function _write(sessions) {
    if (_writing) {
        _pending = sessions;
        return;
    }

    _writing = true;

    try {
        fs.writeFileSync(_historyPath, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (err) {
        console.error('[ChatHistory] Failed to write history file:', err);
    } finally {
        _writing = false;

        if (_pending) {
            const toWrite = _pending;
            _pending = null;
            _write(toWrite);
        }
    }
}

/**
 * Gera um título legível a partir da primeira mensagem.
 * Remove blocos de código antes de truncar — evita títulos como "```python..."
 * Trunca em 60 caracteres.
 *
 * @param {string} message
 * @returns {string}
 */
function _generateTitle(message) {
    const clean = message
        .replace(/```[\s\S]*?```/g, '')  // remove blocos de código
        .replace(/\s+/g, ' ')
        .trim();

    const base = clean || 'Nova conversa';
    return base.length > 60 ? base.slice(0, 57) + '...' : base;
}

/**
 * Garante que init() foi chamado antes de qualquer operação.
 */
function _assertInit() {
    if (!_historyPath) {
        throw new Error('[ChatHistory] Module not initialized. Call init(context) in activate().');
    }
}

// ── Tipos (JSDoc) ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ChatSession
 * @property {string}        id
 * @property {string}        title
 * @property {string}        model
 * @property {string|null}   workspacePath
 * @property {string}        createdAt
 * @property {string}        updatedAt
 * @property {ChatMessage[]} messages
 */

/**
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant'} role
 * @property {string}               content
 * @property {string}               timestamp
 * @property {string}               [model]
 */

module.exports = {
    init,
    createSession,
    appendMessage,
    listSessions,
    getLatestSessionForWorkspace,
    getSession,
    renameSession,
    deleteSession,
    clearAll,
};