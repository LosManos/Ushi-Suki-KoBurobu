# KoBurobu User Manual

KoBurobu is a streamlined Azure Blob Storage Explorer.

## Getting Started

1. **Connect to Azure**: Enter your Azure Storage Connection String in the input field on the Dashboard.
2. **Explore Containers**: Once connected, you will see a list of your containers. Click on a container to view its blobs.
3. **Manage Blobs**: You can upload new blobs or refresh the list to see the latest changes.
4. **Pagination**: Large containers are loaded in pages. Use the dropdown next to the Refresh button to set the page size (10, 100, or 1000 items). If more items are available, a "More items available" indicator will appear at the bottom—click it or press Enter to fetch the next page. Only the first page is fetched initially for performance.

## Keyboard Shortcuts

The following shortcuts are available to speed up your workflow:

| Shortcut | Action |
| --- | --- |
| `Enter` | Connect Account (when focused on Connection String) |
| `Cmd + D` / `Ctrl + D` | Disconnect from Storage Account |
| `Cmd + Q` / `Ctrl + Q` | Quit Application |
| `Cmd + A` / `Ctrl + A` | Select all blobs in current view |
| `Space` | Toggle mark/selection of focused blob |
| `Click` | Mark/selection of blob |
| `Double-click` / `Alt + Enter` | Show blob properties (meta data) |
| `Enter` | Open blob as image preview |
| `Right-click` | Open blob as image preview |
| `Del` / `Alt + Backspace` | Delete all marked/selected blobs (requires confirmation) |
| `↑` / `↓` | Navigate through container or blob lists |
| `Backspace` | Go back one level or to Container List |
| `R` | Refresh current list (Containers or Blobs) |
| `P` | Focus Page Size dropdown (in Blob View) |
| `Cmd + E` / `Ctrl + E` | Switch to Containers View |
| `Cmd + ,` / `Ctrl + ,` | Switch to Settings View |
| `Cmd + F` / `Ctrl + F` | Search/Filter Blobs (in Blob View) |
| `Cmd + I` / `Ctrl + I` | Blob Counter: Count all in folder (server) or loaded items (client) |
| `Alt + Space` | Toggle Hamburger Menu (navigatable with arrows) |
| `Esc` / `Enter` | Close dialogues and menus (like Settings or Hamburger Menu) |

## Navigation

- **Dashboard**: The main screen for connecting and seeing account stats.
- **Containers**: List of all available containers in the account.
- **Hierarchical Navigation**: Use breadcrumbs at the top of the blob list to quickly jump back to parent folders.
- **Settings**: Manage application preferences, such as toggling between Local and UTC time display.
