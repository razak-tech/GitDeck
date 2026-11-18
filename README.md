# GitDeck

**A clean, keyboard-first home for your local Git repositories.**

GitDeck is a lightweight terminal app that keeps your projects in one place. Add each repository once, then check its status, pull or push changes, or open a shell directly in its folder.

## Features

- Keep a personal list of local Git repositories.
- See each repository's current branch and remote tracking branch.
- View working tree status, pull updates, and push changes.
- Open a shell at the repository root. On Windows, the colored PowerShell prompt shows the local and tracking branches and refreshes as you switch branches.
- Remove a repository from GitDeck without deleting its files.
- No third-party packages or graphical interface required.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- [Git](https://git-scm.com/) available on your `PATH`
- An interactive terminal

## Get started

```powershell
git clone https://github.com/razak-tech/GitDeck.git
cd GitDeck
npm start
```

You can also start GitDeck with `node gitdeck.js` from the project folder.

## Using GitDeck

Use the arrow keys to move through a menu and press **Enter** to select an item. Shortcuts are shown next to menu actions.

| Screen | Key | Action |
| --- | --- | --- |
| Home | `A` | Add a local repository |
| Home | `Q` | Quit GitDeck |
| Project | `S` | View repository status |
| Project | `L` | Pull updates |
| Project | `U` | Push changes |
| Project | `T` | Open a shell in the repository |
| Project | `R` | Remove the repository from the list |

When adding a project, enter the path to its repository folder. GitDeck records the repository root, even if you enter a nested folder. In the project shell, use Git or run your usual development commands; type `exit` to return to GitDeck.

## Where GitDeck stores your list

GitDeck stores repository paths in a small configuration file on your device:

- **Windows:** `%APPDATA%\gitdeck\repositories.json`
- **macOS and Linux:** `~/.config/gitdeck/repositories.json` (or `$XDG_CONFIG_HOME/gitdeck/repositories.json` when `XDG_CONFIG_HOME` is set)

The list contains local folder paths. Removing an entry from GitDeck does not remove or modify the repository itself.

## Support GitDeck

If GitDeck is useful to you, you can support its development with a coffee. Thank you for helping the project grow!

<p align="center">
  <a href="https://www.buymeacoffee.com/razak.dj" aria-label="Buy me a coffee">
    <img src=".github/assets/buy-me-a-coffee.svg" alt="Buy Me a Coffee" width="220" />
  </a>
</p>
