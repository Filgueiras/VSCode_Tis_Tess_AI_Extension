# Guia de Build — Tess Tis

## Processo completo

```bash
# 1. Actualizar a versão (MAJOR.MINOR.PATCH — ver tabela abaixo)
npm version 2.3.X --no-git-tag-version

IMPORTANTE: precisa estar coerente com o package.json do projecto (última versão 2.3.0)

# 2. Gerar o .vsix
npx vsce package
```

Após gerar o `.vsix`, instale pelo método recomendado abaixo.

---

## Instalação recomendada (via UI do VS Code)

Este é o método correcto — evita estados "pendentes" que causam o ícone de reload persistente:

1. **`Ctrl+Shift+P` → Extensions: Install from VSIX** — selecciona o ficheiro `.vsix` gerado
2. **`Ctrl+Shift+P` → Developer: Reload Window**

> **Importante:** Evite usar `code --install-extension` no terminal enquanto o VS Code está aberto.
> O comando deixa a extensão num estado "pendente de reload" que persiste mesmo após recarregar.

---

## Limpar versões antigas (quando necessário)

O VS Code não substitui versões antigas automaticamente ao instalar via VSIX — adiciona uma nova pasta lado a lado. Se houver versões em conflito, remova manualmente **com o VS Code fechado**:

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.vscode\extensions\tis-angola.tis-tess-*" -Recurse -Force
```

**macOS / Linux (Bash):**
```bash
rm -rf ~/.vscode/extensions/tis-angola.tis-tess-*
```

Depois reabra o VS Code e instale a versão pretendida via UI.

> **Nota:** O ficheiro `.obsolete` na pasta de extensões regista versões marcadas para remoção.
> A remoção manual acima é segura quando feita com o VS Code fechado.

---

## Semantic Versioning — MAJOR.MINOR.PATCH

| Posição   | Nome           | Quando incrementar                                              |
|-----------|----------------|-----------------------------------------------------------------|
| 1 (Major) | Ruptura        | API ou comportamento muda de forma incompatível                 |
| 2 (Minor) | Funcionalidade | Adicionas algo novo que não quebra nada existente               |
| 3 (Patch) | Correcção      | Corrigiste um bug sem adicionar funcionalidade                  |

---

## Localização das extensões instaladas localmente

| Sistema   | Pasta                                |
|-----------|--------------------------------------|
| Windows   | `%USERPROFILE%\.vscode\extensions\` |
| macOS     | `~/.vscode/extensions/`              |
| Linux     | `~/.vscode/extensions/`              |

Cada extensão ocupa uma subpasta com o formato `publisher.nome-versão`:
`tis-angola.tis-tess-2.1.3`

---

## Avisos normais do vsce (podem ser ignorados)

```
WARNING  A 'repository' field is missing from the 'package.json' manifest file.
WARNING  LICENSE.md, LICENSE.txt or LICENSE not found
```