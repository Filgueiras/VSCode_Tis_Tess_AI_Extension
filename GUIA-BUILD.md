# Guia de Build — Tess Tis

## Processo completo (versão nova)

```bash
# 1. Actualizar a versão (MAJOR.MINOR.PATCH — ver tabela abaixo)
npm version 2.X.X --no-git-tag-version

# 2. Gerar o .vsix
npx vsce package

# 3. Remover versões antigas instaladas e instalar a nova
rm -rf "$USERPROFILE/.vscode/extensions/tis-angola.tess-tis-"*
code --install-extension tess-tis-2.X.X.vsix --force

# 4. Recarregar o VS Code
# CTRL+SHIFT+P → Developer: Reload Window
```

> **Nota:** O VS Code não substitui versões antigas automaticamente ao instalar via VSIX —
> adiciona uma nova pasta lado a lado. Sem o passo 3, acumulam-se versões em conflito
> e o ícone de reload fica persistente.

---

## Semantic Versioning — MAJOR.MINOR.PATCH

| Posição   | Nome           | Quando incrementar                                              |
|-----------|----------------|-----------------------------------------------------------------|
| 1 (Major) | Ruptura        | API ou comportamento muda de forma incompatível                 |
| 2 (Minor) | Funcionalidade | Adicionas algo novo que não quebra nada existente               |
| 3 (Patch) | Correcção      | Corrigiste um bug sem adicionar funcionalidade                  |

---

## Instalação recomendada (via UI)

Instalar pelo UI do VS Code evita estados "pendentes" que causam o ícone de reload persistente:

1. **CTRL+SHIFT+P → Extensions: Install from VSIX** — selecciona o ficheiro `.vsix`
2. **CTRL+SHIFT+P → Developer: Reload Window**

> Evitar `code --install-extension` no terminal enquanto o VS Code está aberto —
> deixa a extensão num estado "pendente de reload" que persiste mesmo após recarregar.

---

## Localização das extensões instaladas localmente

| Sistema   | Pasta                                              |
|-----------|----------------------------------------------------|
| Windows   | `%USERPROFILE%\.vscode\extensions\`                |
| macOS     | `~/.vscode/extensions/`                            |
| Linux     | `~/.vscode/extensions/`                            |

Cada extensão ocupa uma subpasta com o formato `publisher.nome-versão`, por exemplo:
`tis-angola.tess-tis-2.1.3`

O ficheiro `.obsolete` na mesma pasta regista versões marcadas para remoção pelo VS Code.
**Não apagar pastas manualmente** — usar sempre a UI ou `code --uninstall-extension`
para que o `.obsolete` seja actualizado correctamente.

---

## Avisos normais do vsce (podem ser ignorados)

```
WARNING  A 'repository' field is missing from the 'package.json' manifest file.
WARNING  LICENSE.md, LICENSE.txt or LICENSE not found
```
