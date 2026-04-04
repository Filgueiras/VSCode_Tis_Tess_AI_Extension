# Tess Tis

Extensão para VS Code que integra os agentes [Tess](https://tess.im) directamente no editor.
Mantém o contexto do projecto, historial de conversas por workspace e suporte a ferramentas de leitura e escrita de ficheiros.

---

## Funcionalidades

- **Chat com streaming** — respostas em tempo real, directamente no painel lateral
- **Contexto automático** — o ficheiro activo (ou selecção) é incluído em cada mensagem
- **Árvore do projecto** — injectada automaticamente na primeira mensagem de cada sessão
- **Histórico por workspace** — cada projecto tem as suas próprias conversas, sem misturar contexto
- **Apagar e renomear sessões** — gestão de conversas directamente no drawer de histórico
- **Tabelas e Markdown** — cabeçalhos, listas, checkboxes, blocos de código, tabelas e links renderizados
- **Botão Guardar** — guarda qualquer bloco de código directamente para um ficheiro
- **Medidor de contexto** — mostra os tokens consumidos em tempo real
- **Múltiplos modelos** — selecção do modelo directamente no painel
- **Tool calling** — o agente pode ler e escrever ficheiros do projecto com confirmação antes de executar

---

## Instalação

1. Abra o VS Code
2. `Ctrl+Shift+X` → pesquise `Tess Tis`
3. Clique em **Install**

Ou instale manualmente a partir de um ficheiro `.vsix`:


---

## Configuração

A extensão precisa de dois valores para funcionar:

| Definição | O que preencher |
|---|---|
| `tess.apiKey` | Token criado em [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) |
| `tess.agentId` | Número no URL do agente — `tess.im/dashboard/agents/12345/edit` |

`Ctrl+,` → pesquise `tess` → preencha os dois campos.

As definições têm âmbito global — são configuradas uma única vez e ficam disponíveis em todos os workspaces.

---

## Modelos disponíveis

| Modelo | Melhor para |
|---|---|
| **Auto** | Deixar o agente Tess decidir |
| **Tess 5** | Tarefas gerais, mais económico |
| **Claude Opus 4.5** | Raciocínio complexo, arquitectura |
| **Claude Sonnet 4.5** | Equilíbrio entre qualidade e velocidade |
| **Claude Haiku 4.5** | Respostas rápidas, tarefas simples |
| **GPT-4o / GPT-4.1** | Alternativa OpenAI |
| **Gemini 2.5 Pro** | Contextos muito longos |
| **Gemini 2.0 Flash** | Velocidade máxima |

---

## Utilização

### Conversar

1. Escreva a pergunta na caixa de texto no fundo do painel
2. Prima `Enter` ou clique em **Enviar**
3. Para parar uma resposta a meio, clique em **Parar**

### Adicionar ficheiros

Clique em **📎 Adicionar ficheiros** para incluir o conteúdo de ficheiros que não estão abertos no editor.

### Contexto do projecto

Clique em **🗂️ Contexto do projecto** para injectar manualmente a árvore de ficheiros do workspace.

### Histórico

Clique em **Histórico** para abrir o drawer de conversas do workspace actual.
Em cada sessão, clique em **···** para renomear ou apagar.

### Menu de contexto no editor

Clique com o botão direito em qualquer ficheiro ou selecção → **Tis: Chat com Código Actual**

---

## Resolução de problemas

| Sintoma | Causa | Solução |
|---|---|---|
| Painel bloqueado com aviso de configuração | `tess.apiKey` ou `tess.agentId` não preenchidos | `Ctrl+,` → pesquise `tess` |
| Selector de modelo mostra "Padrão do agente" (desactivado) | Agente com modelo fixo | Normal — o agente usa um modelo fixo, não expõe escolha |
| Resposta parou a meio | Timeout ou erro de rede | Clique **Parar** e tente novamente |
| Painel não aparece na barra lateral | Vista oculta | `View → Open View… → Tess Chat` |

---

## Requisitos

- VS Code 1.80 ou superior
- Conta em [tess.im](https://tess.im) com um agente do tipo **Chat** configurado

---

## Versão

2.5.1 · [TIS Angola](https://tis.ao)