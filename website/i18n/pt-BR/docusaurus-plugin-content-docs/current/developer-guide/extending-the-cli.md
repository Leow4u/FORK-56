---
sidebar_position: 8
title: "Extending the CLI"
description: "Build wrapper CLIs that extend the Work4You TUI with custom widgets, keybindings, and layout changes"
---

# Estendendo a CLI

O Work4You expõe hooks de extensão protegidos em `Work4YouCLI` para que CLIs wrapper possam adicionar widgets, atalhos de teclado e customizações de layout sem sobrescrever o método `run()` de mais de 1000 linhas. Isso mantém sua extensão desacoplada de mudanças internas.

## Pontos de extensão

Existem cinco pontos de extensão disponíveis:

| Hook | Propósito | Sobrescreva quando... |
|------|---------|------------------|
| `_get_extra_tui_widgets()` | Injetar widgets no layout | Você precisa de um elemento de UI persistente (painel, barra de status, mini-player) |
| `_register_extra_tui_keybindings(kb, *, input_area)` | Adicionar atalhos de teclado | Você precisa de hotkeys (alternar painéis, controles de transporte, atalhos modais) |
| `_build_tui_layout_children(**widgets)` | Controle total sobre a ordenação de widgets | Você precisa reordenar ou envolver widgets existentes (raro) |
| `process_command()` | Adicionar comandos slash customizados | Você precisa lidar com `/mycommand` (hook pré-existente) |
| `_build_tui_style_dict()` | Estilos customizados de prompt_toolkit | Você precisa de cores ou estilos customizados (hook pré-existente) |

Os três primeiros são novos hooks protegidos. Os dois últimos já existiam.

## Início rápido: uma CLI wrapper

```python
#!/usr/bin/env python3
"""my_cli.py — Example wrapper CLI that extends Work4You."""

from cli import Work4YouCLI
from prompt_toolkit.layout import FormattedTextControl, Window
from prompt_toolkit.filters import Condition


class MyCLI(Work4YouCLI):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._panel_visible = False

    def _get_extra_tui_widgets(self):
        """Add a toggleable info panel above the status bar."""
        cli_ref = self
        return [
            Window(
                FormattedTextControl(lambda: "📊 My custom panel content"),
                height=1,
                filter=Condition(lambda: cli_ref._panel_visible),
            ),
        ]

    def _register_extra_tui_keybindings(self, kb, *, input_area):
        """F2 toggles the custom panel."""
        cli_ref = self

        @kb.add("f2")
        def _toggle_panel(event):
            cli_ref._panel_visible = not cli_ref._panel_visible

    def process_command(self, cmd: str) -> bool:
        """Add a /panel slash command."""
        if cmd.strip().lower() == "/panel":
            self._panel_visible = not self._panel_visible
            state = "visible" if self._panel_visible else "hidden"
            print(f"Panel is now {state}")
            return True
        return super().process_command(cmd)


if __name__ == "__main__":
    cli = MyCLI()
    cli.run()
```

Execute:

```bash
cd ~/.work4you/work4you
source .venv/bin/activate
python my_cli.py
```

## Referência de hooks

### `_get_extra_tui_widgets()`

Retorna uma lista de widgets do prompt_toolkit para inserir no layout da TUI. Os widgets aparecem **entre o espaçador e a barra de status** — acima da área de entrada mas abaixo da saída principal.

```python
def _get_extra_tui_widgets(self) -> list:
    return []  # default: no extra widgets
```

Cada widget deve ser um container do prompt_toolkit (ex.: `Window`, `ConditionalContainer`, `HSplit`). Use `ConditionalContainer` ou `filter=Condition(...)` para tornar os widgets alternáveis.

```python
from prompt_toolkit.layout import ConditionalContainer, Window, FormattedTextControl
from prompt_toolkit.filters import Condition

def _get_extra_tui_widgets(self):
    return [
        ConditionalContainer(
            Window(FormattedTextControl("Status: connected"), height=1),
            filter=Condition(lambda: self._show_status),
        ),
    ]
```

### `_register_extra_tui_keybindings(kb, *, input_area)`

Chamado depois que o Work4You registra seus próprios atalhos de teclado e antes que o layout seja construído. Adicione seus atalhos a `kb`.

```python
def _register_extra_tui_keybindings(self, kb, *, input_area):
    pass  # default: no extra keybindings
```

Parâmetros:
- **`kb`** — A instância `KeyBindings` da aplicação prompt_toolkit
- **`input_area`** — O widget `TextArea` principal, caso você precise ler ou manipular a entrada do usuário

```python
def _register_extra_tui_keybindings(self, kb, *, input_area):
    cli_ref = self

    @kb.add("f3")
    def _clear_input(event):
        input_area.text = ""

    @kb.add("f4")
    def _insert_template(event):
        input_area.text = "/search "
```

**Evite conflitos** com atalhos nativos: `Enter` (enviar), `Escape Enter` (nova linha), `Ctrl-C` (interromper), `Ctrl-D` (sair), `Tab` (aceitar auto-sugestão). Teclas de função F2+ e combinações com Ctrl geralmente são seguras.

### `_build_tui_layout_children(**widgets)`

Sobrescreva isso apenas quando precisar de controle total sobre a ordenação de widgets. A maioria das extensões deve usar `_get_extra_tui_widgets()` em vez disso.

```python
def _build_tui_layout_children(self, *, sudo_widget, secret_widget,
    approval_widget, clarify_widget, model_picker_widget=None,
    spinner_widget=None, spacer, status_bar, input_rule_top,
    image_bar, input_area, input_rule_bot, voice_status_bar,
    completions_menu) -> list:
```

A implementação padrão retorna (qualquer widget `None` é filtrado):

```python
[
    Window(height=0),       # anchor
    sudo_widget,            # sudo password prompt (conditional)
    secret_widget,          # secret input prompt (conditional)
    approval_widget,        # dangerous command approval (conditional)
    clarify_widget,         # clarify question UI (conditional)
    model_picker_widget,    # model picker overlay (conditional)
    spinner_widget,         # thinking spinner (conditional)
    spacer,                 # fills remaining vertical space
    *self._get_extra_tui_widgets(),  # YOUR WIDGETS GO HERE
    status_bar,             # model/token/context status line
    input_rule_top,         # ─── border above input
    image_bar,              # attached images indicator
    input_area,             # user text input
    input_rule_bot,         # ─── border below input
    voice_status_bar,       # voice mode status (conditional)
    completions_menu,       # autocomplete dropdown
]
```

## Diagrama de layout

O layout padrão de cima para baixo:

1. **Área de saída** — histórico de conversa com rolagem
2. **Espaçador**
3. **Widgets extras** — de `_get_extra_tui_widgets()`
4. **Barra de status** — modelo, % de contexto, tempo decorrido
5. **Barra de imagens** — contador de imagens anexadas
6. **Área de entrada** — prompt do usuário
7. **Status de voz** — indicador de gravação
8. **Menu de completions** — sugestões de auto-completar

## Dicas

- **Invalide a exibição** após mudanças de estado: chame `self._invalidate()` para disparar uma nova renderização do prompt_toolkit.
- **Acesse o estado do agente**: `self.agent`, `self.model`, `self.conversation_history` estão todos disponíveis.
- **Estilos customizados**: Sobrescreva `_build_tui_style_dict()` e adicione entradas para suas classes de estilo customizadas.
- **Comandos slash**: Sobrescreva `process_command()`, trate seus comandos e chame `super().process_command(cmd)` para todo o resto.
- **Não sobrescreva `run()`** a menos que seja absolutamente necessário — os hooks de extensão existem especificamente para evitar esse acoplamento.
