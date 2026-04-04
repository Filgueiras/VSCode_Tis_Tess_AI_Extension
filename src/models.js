//https://pareto-workflows.storage.googleapis.com/014f694ec31019b4b9d1f5452e25b9ebb0c7edd7/models.js
// src/models.js

const axios = require('axios');
const BASE_URL = 'https://api.tess.im';

// ─── Lista estática de modelos ─────────────────────────────────────────────────

const MODELS = [
    { id: 'auto',               label: 'Auto (Tess escolhe)' },
    { id: 'tess-5',             label: 'Tess 5' },
    { id: 'claude-opus-4-5',   label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
    { id: 'gpt-4o',            label: 'GPT-4o' },
    { id: 'gpt-4.1',           label: 'GPT-4.1' },
    { id: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash' },
];

// ─── Limites de contexto por modelo (em tokens) ────────────────────────────────

const MODEL_LIMITS = {
    'auto':               128000,
    'tess-5':             128000,
    'claude-opus-4-5':    200000,
    'claude-sonnet-4-5':  200000,
    'claude-haiku-4-5':   200000,
    'gpt-4o':             128000,
    'gpt-4.1':            128000,
    'gemini-2.5-pro':    1000000,
    'gemini-2.0-flash':  1000000,
};

// ─── Fetch de modelos disponíveis no agente ────────────────────────────────────

/**
 * Obtém os modelos disponíveis para um agente específico da API Tess.
 *
 * @param {string} apiKey  - Token de autenticação Bearer
 * @param {string} agentId - ID numérico do agente Tess
 * @returns {Promise<Array|null|undefined>}
 *   - Array  → lista de modelos disponíveis para este agente
 *   - null   → agente com modelo fixo (esconde o selector)
 *   - undefined → erro de rede (usa lista estática para não bloquear a UI)
 */
async function fetchAgentModels(apiKey, agentId) {
    try {
        const res = await axios.get(`${BASE_URL}/agents/${agentId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000
        });

        const questions = res.data?.questions ?? res.data?.data?.questions ?? [];
        const modelQ = questions.find(q => q.name === 'model' || q.slug === 'model');

        if (!modelQ) return null; // agente com modelo fixo — sem selector

        // A API pode usar .options, .answers ou .choices como lista de escolhas
        const raw = modelQ.options ?? modelQ.answers ?? modelQ.choices ?? [];
        const models = raw
            .filter(o => o.value || o.id)
            .map(o => ({
                id:    o.value ?? o.id,
                label: o.label ?? o.name ?? o.value ?? o.id
            }));

        return models.length > 0 ? models : null;

    } catch (err) {
        console.warn('[Tess] Não foi possível obter modelos do agente:', err.message);
        return undefined; // erro de rede — mantém lista estática
    }
}

// ─── Sincronização de config do agente com o WebView ──────────────────────────

/**
 * Obtém os modelos do agente e envia para o WebView.
 * Em caso de erro de rede, envia a lista estática para não bloquear a interface.
 *
 * @param {import('vscode').WebviewView} view
 * @param {string} apiKey
 * @param {string} agentId
 */
async function syncAgentConfig(webview, apiKey, agentId) {
    if (!apiKey || !agentId) return;

    const models = await fetchAgentModels(apiKey, agentId);

    // null      → agente com modelo fixo, mostra selector desactivado com "Padrão do agente"
    // array     → modelos disponíveis para este agente
    // undefined → erro de rede, usa lista estática para não bloquear a interface
    const fixed = models === null;
    let modelList;
    if (fixed)                 modelList = [{ id: 'auto', label: 'Padrão do agente' }];
    else if (models === undefined) modelList = MODELS;
    else                       modelList = models;

    webview.postMessage({ type: 'setModels', models: modelList, fixed });
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    MODELS,
    MODEL_LIMITS,
    fetchAgentModels,
    syncAgentConfig,
};