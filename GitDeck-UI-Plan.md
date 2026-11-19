# GitDeck UI Plan

**Status:** Milestone 1 design review complete.

## 1. Analyze the reference design

The design review uses extracted mockup labels and the earlier layout notes. The original image preview required sign-in, so exact visual comparison is pending.

### 1.1 Screen layout

| Area | Mockup | Proposed behavior |
|---|---|---|
| Top | GitDeck name, repository, branch, local and remote status | Show the current branch, upstream status, and when tracking data was refreshed |
| Left | Repositories, branches, Ahead, Behind, and Diverged | Provide a navigable repository list and a branch summary. Review branch management separately |
| Center | Commit history with a graph, short IDs, subjects, and times | Start with a scrollable commit list. Add a graph if approved |
| Right | Working tree counts, changed files, and file details | Label file states and show a diff for the selected file |
| Bottom | Fetch, Pull, Push, Branch, and Commit | Show shortcuts available in the active panel |

### 1.2 Readability and navigation

- [ ] Use a navy background, thin borders, cyan or teal focus accents, and amber warnings.
- [ ] Mark the active panel and selected row. Use text labels so the interface works in monochrome.
- [ ] Show panels side by side in a wide terminal. Show the active panel with visible switching controls in a narrow terminal.
- [ ] Keep the repository and branch visible during scrolling. Shorten long paths and provide a way to see the full path.

### 1.3 Visual verification

- [x] Visually inspected a static preview with a three-column wide layout and a single-panel narrow layout.
- [x] Confirmed that the sample header and footer fit and the selected file remains recognizable in monochrome.
- [ ] Verify scrolling, resizing, and keyboard interaction in the running terminal app during implementation.

## 2. Prepare and build the interface

### 2.1 Review the current application

- [ ] Identify reusable logic in `gitdeck.js`, including repository management, themes, Git status, Pull, Push, and opening a shell.
- [ ] Check repository registration, path relinking, and existing settings before changing the UI.
- [ ] Confirm the implementation stack. The current app uses Node.js without third-party packages. The earlier V1 plan proposes Go and Bubble Tea. Reusing Node.js is the suggested starting point to reduce rework.

### 2.2 Build the terminal UI

- [ ] Separate panel rendering and navigation from Git commands and settings storage.
- [ ] Build wide and narrow layouts and connect them to the current themes.
- [ ] Use Tab to switch panels, arrow keys to navigate, Enter to select, and Esc to go back. Display contextual shortcuts.
- [ ] Handle resizing, scrolling, loading, empty states, and errors. Restore the terminal on exit.

## 3. Connect data and add Git workflows

### 3.1 Repositories and branches

- [ ] Connect project registration, opening, renaming, relinking, and removal from the list.
- [ ] Show the current branch and handle empty repositories, detached HEAD, and missing upstreams.
- [ ] Show Ahead and Behind against cached tracking data. Explain that Fetch refreshes this data if Fetch is enabled.

### 3.2 History and changed files

- [ ] Show commit subjects, short IDs, and dates. Provide an empty state before the first commit.
- [ ] Distinguish staged, unstaged, untracked, and conflicted changes, including files with both staged and unstaged changes.
- [ ] Update the diff when a file is selected. Handle new files, binary files, and paths with spaces.

### 3.3 Create a commit

- [ ] Add file-level Stage and Unstage and refresh the list after each operation.
- [ ] Preview the staged files and commit message, then request confirmation. Refresh the preview if the staged content changes before confirmation.
- [ ] Explain why a commit is blocked when the message or staged changes are missing, or when a conflict exists. Show the short ID and refresh history after success.

### 3.4 Features to confirm

| Feature | Proposed scope |
|---|---|
| Fetch, Pull, and Push on the dashboard | Pull and Push already exist. Confirm whether to move them into the dashboard and add Fetch, since the earlier V1 plan defers network operations |
| Commit graph | Revisit after the commit list is complete |
| Creating and switching branches | Start with read-only branch information |
| Stash | Defer. It appears in a sample commit message in the mockup |

## 4. Verify before delivery

### 4.1 UI and platform compatibility

- [ ] Check keyboard navigation, resizing, and monochrome display on Windows and Fedora.
- [ ] Verify settings, saved repositories, missing paths, and returning to the app after opening a shell.

### 4.2 End-to-end workflow

- [ ] In a temporary repository, register the project, inspect a diff, stage a file, create a local commit, and see the commit in history.
- [ ] Verify cancellation, missing upstream, conflicts, and file preservation when removing a project from the list.
- [ ] Update the README with the approved commands and shortcuts.
