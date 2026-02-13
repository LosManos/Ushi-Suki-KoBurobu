---
trigger: always_on
---

# keyboard shortcuts

The whole application should be navigatable by keyboard.

Buttons and other controls the user can interact with should have keyboard shortcuts.

The shortcut must be explorable, that is the user can find it without reading the manual. A good way for this is to have a tooltip describing the keyboard shortcut.

The manual must contain list of these shortcuts.

## dialoges

Dialogues are typically closed with esc for bailing out, and enter for updating.

Dialogues with only information can be closed with either.

When a modal dialogue is visible, it is the only one receiving keyboard strokes.  
It is not possible to tab out of a dialogue.  
Do not have a cross for closing a dialogue, only buttons.

# manual

There must be a file `manual.md` describing how to use the application.

# menu

The menu must be navigatable with the keyboard.  
The menu is opened with shift-space and can be closed with esc.

Any item that opens a dialogue, that can be dismissed, must be suffixed with en ellipsis.