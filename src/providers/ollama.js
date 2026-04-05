// src/providers/ollama.js
// Provider Ollama — servidor local ou remoto compatível com Ollama
'use strict';

const axios = require('axios');

const DEFAULT_BASE_URL = 'http://localhost:11434';

function getCredentials(cfg) {
    const baseUrl = (cfg.get('ollama.baseUrl', DEFAULT_BASE_URL) || DEFAULT_BASE_URL)
        .replace(/\/$/, '');
    return { ok: true, baseUrl };
}

function buildStreamConfig(creds) {
    return {
        baseUrl:   `${creds.baseUrl}/v1`,
        headers:   {}, // sem autenticação para Ollama por omissão
        extraBody: {},
    };
}

async function fetchModels(creds) {
    // Ollama expõe modelos em /api/tags (formato nativo)
    try {
        const res    = await axios.get(`${creds.baseUrl}/api/tags`, { timeout: 5000 });
        const models = res.data?.models ?? [];
        if (models.length > 0) {
            return models.map(m => ({ id: m.name, label: m.name }));
        }
    } catch { /* servidor pode estar desligado */ }

    // Fallback: endpoint OpenAI-compatível /v1/models
    try {
        const res  = await axios.get(`${creds.baseUrl}/v1/models`, { timeout: 5000 });
        const data = res.data?.data ?? [];
        if (data.length > 0) {
            return data.map(m => ({ id: m.id, label: m.id }));
        }
    } catch { /* ignorar */ }

    return null; // Ollama não está a correr — UI mostra lista vazia com aviso
}

module.exports = {
    id:           'ollama',
    label:        'Ollama (local)',
    getCredentials,
    buildStreamConfig,
    fetchModels,
    staticModels: [],
    modelLimits:  {},
};
