// src/providers/tisai.js
// Provider TisAI — api.tisdev.cloud
'use strict';

const axios = require('axios');

const BASE_URL = 'https://ai.tisdev.cloud/api/v1';

const STATIC_MODELS = [
    { id: 'auto',                   label: 'Auto (TisAI escolhe)' },
    { id: 'deepseek-coder-v2:16b',  label: 'DeepSeek Coder V2 16B' },
    { id: 'deepseek-r1:14b',        label: 'DeepSeek R1 14B' },
    { id: 'llama3.1:8b',            label: 'Llama 3.1 8B' },
    { id: 'qwen2.5-coder:14b',      label: 'Qwen 2.5 Coder 14B' },
];

const MODEL_LIMITS = {
    'auto':                   32000,
    'deepseek-coder-v2:16b':  64000,
    'deepseek-r1:14b':        64000,
    'llama3.1:8b':            128000,
    'qwen2.5-coder:14b':      32000,
};

function getCredentials(cfg) {
    const apiKey = cfg.get('tisAiApiKey', '');
    if (!apiKey) return {
        ok: false,
        errorText: 'Chave API TisAI não configurada. Verifique Definições → tis.tisAiApiKey.'
    };
    const assistantId = cfg.get('tisAiAssistantId', '') || null;
    return { ok: true, apiKey, assistantId };
}

function buildStreamConfig(creds) {
    const extraBody = creds.assistantId
        ? { assistant_id: Number.parseInt(creds.assistantId, 10) || creds.assistantId }
        : {};
    return {
        baseUrl:   BASE_URL,
        headers:   { 'X-API-Key': creds.apiKey },
        extraBody,
    };
}

async function fetchModels(creds) {
    const headers = { 'X-API-Key': creds.apiKey };

    // Tenta endpoint OpenAI-compatível /models
    try {
        const res  = await axios.get(`${BASE_URL}/models`, { headers, timeout: 8000 });
        const data = res.data?.data ?? res.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
            return data.map(m => ({ id: m.id ?? m.name, label: m.id ?? m.name })).filter(m => m.id);
        }
    } catch { /* endpoint pode não existir */ }

    // Tenta /assistants
    try {
        const res  = await axios.get(`${BASE_URL}/assistants`, { headers, timeout: 8000 });
        const data = res.data?.data ?? res.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
            return data.map(a => ({
                id:    String(a.id),
                label: a.name ?? a.title ?? String(a.id)
            })).filter(m => m.id);
        }
    } catch { /* endpoint pode não existir */ }

    return null;
}

module.exports = {
    id:           'tisai',
    label:        'TisAI',
    getCredentials,
    buildStreamConfig,
    fetchModels,
    staticModels: STATIC_MODELS,
    modelLimits:  MODEL_LIMITS,
};
