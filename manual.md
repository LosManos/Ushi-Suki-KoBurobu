# KoBurobu User Manual

KoBurobu is a streamlined Azure Blob Storage Explorer.

## Getting Started

1. **Connect to Azure**: Enter your Azure Storage Connection String in the input field on the Dashboard.
2. **Saved Connections**: You can save your connection strings for future use. 
   - Check the **"Save this connection"** box and provide a name (e.g., "Production", "Testing").
   - Previously saved connections will appear in a list above the input field. 
   - Click a saved connection to quickly fill the connection string.
   - Use the **"×"** button next to a saved connection to remove it.
   - Connection strings are stored securely using your operating system's safe storage.
   - You can inspect the saved connections file via **Menu > Connections File...**.
3. **Explore Containers**: Once connected, you will see a list of your containers. Click on a container to view its blobs.
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
| `↑` / `↓` | Navigate through treeview, container or blob lists |
| `Backspace` | Go back one level or to Container List |
| `R` | Refresh current list (Containers or Blobs) |
| `P` | Focus Page Size dropdown (in Blob View) |
| `Cmd + E` / `Ctrl + E` | Focus Sidebar Treeview |
| `Cmd + ,` / `Ctrl + ,` | Switch to Settings View |
| `Cmd + F` / `Ctrl + F` | Search/Filter Blobs (in Blob View) |
| `Cmd + I` / `Ctrl + I` | Blob Counter: Count all in folder (server) or loaded items (client) |
| `Cmd + 1-8` | Switch to Tab (1-8 for opened containers) |
| `Cmd + 9` | Switch to Last Tab |
| `Cmd + W` | Close current container tab |
| `Shift + Space` | Toggle Hamburger Menu (navigatable with arrows) |
| `F1` / `Cmd + ?` | Open this Manual |
| `Esc` | Bails out of dialogues and closes menus |
| `Enter` | Updates/confirms in dialogues or closes info-only dialogues |
| `Backspace` | Navigate up one level or switch to Containers View (if at root) |

## Navigation

- **Dashboard**: The main screen for connecting and seeing account stats.
- **Tabs**: Containers open in separate tabs. Switching tabs preserves search filters and navigation state. The first item in a container is automatically focused upon opening. Closing all tabs returns to the Containers overview.
- **Sidebar**: Access account actions (hamburger menu, disconnect), see your connected account name, and jump between containers.
- **Hierarchical Navigation**: Use breadcrumbs at the top of the blob list to quickly jump back to parent folders.
- **Status Bar**: Toggles between Local and UTC time display and shows application version.
- **Details Sidebar**: When a blob is selected or focused, a sidebar appears on the right showing its metadata (size, content type, created/modified dates, and custom metadata). You can close it by clicking the "✕" button or deselecting the item. Both labels (🔑) and values (📋) can be copied to the clipboard by clicking their respective icons.

## License

This project is licensed under the **LGPLv3+NoEvil** license. See the `license.md` file for full details.
