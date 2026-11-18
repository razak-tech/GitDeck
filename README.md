# GitDeck

A fast, lightweight terminal app for managing local Git repositories. GitDeck has a focused, keyboard-driven interface with a large terminal wordmark and a custom geometric icon. No graphical interface or extra packages are required; you only need Node.js and Git.

## Run

From this folder, run:

```powershell
npm start
```

Or launch it directly:

```powershell
node gitdeck.js
```

Use ↑ and ↓ to move through the menu, then press Enter to select. On the home screen, press A to add a repository or Q to quit. Add a repository path once and GitDeck will remember it on this device. Select a project to view its status, pull updates, push changes, or open a shell directly in its folder. In a project menu, use S for status, L to pull, U to push, T to open a shell, and R to remove the project from the list. The Windows project shell uses a colored prompt that shows the current local branch and its remote tracking branch; it updates as you switch branches.

## Repository list location

- Windows: `%APPDATA%\gitdeck\repositories.json`
- macOS and Linux: `~/.config/gitdeck/repositories.json` (or `XDG_CONFIG_HOME` when set)

Removing a project from the list does not delete its files.
