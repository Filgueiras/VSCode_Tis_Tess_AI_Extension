// src/providers/remote.js
// Provider "Remoto" — qualquer endpoint OpenAI-compatível com streaming SSE.
// O utilizador configura: endpoint (obrigatório), API key (opcional), modelo (opcional).
'use strict';

const axios = require('axios');

function getCredentials(cfg) {
    const endpoint = (cfg.get('remote.endpoint', '') || '').trim().replace(/\/$/, '');
    if (!endpoint) return {
        ok: false,
        errorText: 'Endpoint remoto não configurado. Verifique Definições → tis.remote.endpoint.'
    };
    const apiKey = cfg.get('remote.apiKey', '') || null;
    const model  = cfg.get('remote.model', '')  || null;
    return { ok: true, endpoint, apiKey, model };
}

function buildStreamConfig(creds) {
    const headers = creds.apiKey
        ? { 'Authorization': `Bearer ${creds.apiKey}` }
        : {};
    return {
        baseUrl:      creds.endpoint,
        headers,
        extraBody:    {},
        defaultModel: creds.model,
    };
}

async function fetchModels(creds) {
    const headers = creds.apiKey ? { 'Authorization': `Bearer ${creds.apiKey}` } : {};
    try {
        const res  = await axios.get(`${creds.endpoint}/models`, { headers, timeout: 6000 });
        const data = res.data?.data ?? res.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
            return data
                .map(m => ({ id: m.id ?? m.name, label: m.id ?? m.name }))
                .filter(m => m.id);
        }
    } catch { /* endpoint pode não suportar listagem */ }
    return null;
}

module.exports = {
    id:           'remote',
    label:        'Remoto',
    getCredentials,
    buildStreamConfig,
    fetchModels,
    staticModels: [],
    modelLimits:  {},
};
