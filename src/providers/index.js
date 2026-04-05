// src/providers/index.js
// Registo de providers OpenAI-compatíveis.
// Para adicionar um novo provider: criar src/providers/novo.js e registá-lo aqui.
// A Tess não está neste registo — usa api.js com autenticação Bearer + path /agents/{id}.
'use strict';

const PROVIDERS = {
    tisai:  require('./tisai'),
    ollama: require('./ollama'),
    remote: require('./remote'),
};

/**
 * Devolve o provider pelo ID, ou null se não existir.
 * @param {string} id
 */
function getProvider(id) {
    return PROVIDERS[id] ?? null;
}

/**
 * Lista de todos os providers registados (excluindo Tess).
 * @returns {{ id: string, label: string }[]}
 */
function listProviders() {
    return Object.values(PROVIDERS).map(p => ({ id: p.id, label: p.label }));
}

module.exports = { PROVIDERS, getProvider, listProviders };
