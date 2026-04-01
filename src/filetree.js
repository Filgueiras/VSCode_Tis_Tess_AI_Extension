// fileTree.js
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Represents a single node in the file tree (file or directory).
 */
class FileTreeItem extends vscode.TreeItem {
  /**
   * @param {string} label - Display name
   * @param {vscode.Uri} resourceUri - Full URI of the resource
   * @param {vscode.TreeItemCollapsibleState} collapsibleState
   */
  constructor(label, resourceUri, collapsibleState) {
    super(label, collapsibleState);

    this.resourceUri = resourceUri;
    this.tooltip = resourceUri.fsPath;

    const isDirectory = collapsibleState !== vscode.TreeItemCollapsibleState.None;

    this.iconPath = isDirectory
      ? vscode.ThemeIcon.Folder
      : vscode.ThemeIcon.File;

    if (!isDirectory) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [resourceUri],
      };
    }

    // Used in view/item/context menu contributions
    this.contextValue = isDirectory ? 'folder' : 'file';
  }
}

/**
 * TreeDataProvider that renders the workspace file system.
 * @implements {vscode.TreeDataProvider<FileTreeItem>}
 */
class FileTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    /** @type {vscode.Event<void | FileTreeItem | FileTreeItem[]>} */
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  /**
   * Triggers a full tree refresh.
   */
  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * @param {FileTreeItem} element
   * @returns {FileTreeItem}
   */
  getTreeItem(element) {
    return element;
  }

  /**
   * @param {FileTreeItem | undefined} element
   * @returns {vscode.ProviderResult<FileTreeItem[]>}
   */
  getChildren(element) {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showInformationMessage('No workspace folder open.');
      return [];
    }

    const dirPath = element
      ? element.resourceUri.fsPath
      : workspaceFolders[0].uri.fsPath;

    return this._readDirectory(dirPath);
  }

  /**
   * Reads a directory and returns its contents as FileTreeItems.
   * @param {string} dirPath
   * @returns {FileTreeItem[]}
   */
  _readDirectory(dirPath) {
    let entries;

    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      console.error(`[FileTree] Failed to read directory: ${dirPath}`, err);
      return [];
    }

    // Directories first, then files — both sorted alphabetically
    const dirs = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    const files = entries
      .filter((e) => e.isFile())
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...dirs, ...files].map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const uri = vscode.Uri.file(fullPath);
      const collapsibleState = entry.isDirectory()
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      return new FileTreeItem(entry.name, uri, collapsibleState);
    });
  }
}

/**
 * Registers the file tree view and associated commands.
 * @param {vscode.ExtensionContext} context
 */
function registerFileTree(context) {
  const provider = new FileTreeProvider();

  const treeView = vscode.window.createTreeView('fileTreeView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const refreshCommand = vscode.commands.registerCommand(
    'fileTree.refresh',
    () => provider.refresh()
  );

  context.subscriptions.push(treeView, refreshCommand);

  return provider;
}

module.exports = {
  FileTreeItem,
  FileTreeProvider,
  registerFileTree,
};