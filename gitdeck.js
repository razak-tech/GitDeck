#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");

const isWin = process.platform === "win32";
const home = os.homedir();
const configDir = isWin
  ? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "gitdeck")
  : path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "gitdeck");
const registryFile = path.join(configDir, "repositories.json");
const settingsFile = path.join(configDir, "settings.json");
const esc = "\x1b[";
const color = (code, value) => `${esc}${code}m${value}${esc}0m`;
const themes = {
  ocean: { name: "Ocean Blue", primary: "38;5;81", secondary: "38;5;45", success: "38;5;114", danger: "38;5;203", warning: "38;5;220", muted: "38;5;245", selection: "48;5;24;1" },
  emerald: { name: "Emerald", primary: "38;5;84", secondary: "38;5;49", success: "38;5;120", danger: "38;5;203", warning: "38;5;220", muted: "38;5;245", selection: "48;5;22;1" },
  violet: { name: "Violet", primary: "38;5;141", secondary: "38;5;213", success: "38;5;114", danger: "38;5;203", warning: "38;5;220", muted: "38;5;245", selection: "48;5;54;1" },
  amber: { name: "Amber", primary: "38;5;220", secondary: "38;5;208", success: "38;5;114", danger: "38;5;203", warning: "38;5;227", muted: "38;5;245", selection: "48;5;94;1" },
  terracotta: { name: "Terracotta Orange", primary: "38;2;224;136;103", secondary: "38;2;246;173;134", success: "38;5;114", danger: "38;5;203", warning: "38;5;220", muted: "38;5;248", selection: "48;2;86;47;36;1", logoShadow: "38;2;151;84;64" },
  monochrome: { name: "Monochrome", primary: "37", secondary: "97", success: "37", danger: "37", warning: "37", muted: "90", selection: "48;5;238;1" },
};

function readSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    return { theme: themes[data.theme] ? data.theme : "ocean" };
  } catch { return { theme: "ocean" }; }
}

let settings = readSettings();
const activeTheme = () => themes[settings.theme] || themes.ocean;
const cyan = (s) => color(activeTheme().primary, s);
const accent = (s) => color(activeTheme().secondary, s);
const dim = (s) => color(activeTheme().muted, s);
const green = (s) => color(activeTheme().success, s);
const red = (s) => color(activeTheme().danger, s);
const yellow = (s) => color(activeTheme().warning, s);
const bold = (s) => color("1", s);
const inverse = (s) => color(activeTheme().selection, s);

const glyphs = {
  G: [" ███ ", "█   █", "█    ", "█ ███", " ███ "],
  I: ["█████", "  █  ", "  █  ", "  █  ", "█████"],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
  K: ["█   █", "█  █ ", "███  ", "█  █ ", "█   █"],
};
const logo = Array.from({ length: 5 }, (_, row) =>
  [..."GITDECK"].map((letter) => glyphs[letter][row]).join("  ")
);

function readRepos() {
  try {
    const data = JSON.parse(fs.readFileSync(registryFile, "utf8"));
    return Array.isArray(data) ? data.filter((r) => r && r.path) : [];
  } catch { return []; }
}

function saveRepos(repos) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(registryFile, `${JSON.stringify(repos, null, 2)}\n`, "utf8");
}

function saveSettings() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function git(args, cwd, options = {}) {
  try {
    return spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, ...options });
  } catch (error) {
    return { status: 1, stdout: "", stderr: error.message };
  }
}

function resolveRepoInput(value) {
  const unquoted = value.trim().replace(/^["']|["']$/g, "");
  return path.resolve(unquoted.replace(/^~(?=$|[\\/])/, home));
}

function repositoryRoot(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return "";
  } catch { return ""; }
  const result = git(["rev-parse", "--show-toplevel"], dir);
  return result.status === 0 ? path.resolve(result.stdout.trim()) : "";
}

function branchAt(dir) {
  if (!fs.existsSync(dir)) return "path missing";
  const result = git(["branch", "--show-current"], dir);
  return result.status === 0 ? (result.stdout.trim() || "detached HEAD") : "not a repository";
}

function upstreamAt(dir) {
  if (!fs.existsSync(dir)) return "unavailable";
  const result = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], dir);
  return result.status === 0 ? result.stdout.trim() : "no upstream";
}

function branchLabel(dir) {
  return `${branchAt(dir)}  →  ${upstreamAt(dir)}`;
}

function projectHint(repo) {
  const root = repositoryRoot(repo.path);
  if (!root) return [{ text: "Path unavailable", paint: yellow }];
  const upstream = upstreamAt(root);
  return [
    { text: branchAt(root), paint: accent },
    { text: " / " + upstream, paint: upstream === "no upstream" ? yellow : cyan },
    { text: "  |  " + root, paint: cyan, folder: root },
  ];
}

function repoName(repo) { return repo.name || path.basename(repo.path); }

function clear() { process.stdout.write(`${esc}2J${esc}H`); }

function visibleText(value) { return String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""); }

function truncate(value, maxLength) {
  const chars = Array.from(visibleText(value));
  if (chars.length <= maxLength) return chars.join("");
  return `${chars.slice(0, Math.max(0, maxLength - 1)).join("")}…`;
}

function cursorRowAfter(output) { return 1 + (output.match(/\n/g) || []).length; }

function frame(title, subtitle = "", paintSubtitle = dim, backKey = "Esc", backHovered = false, write = process.stdout.write.bind(process.stdout)) {
  if (arguments.length < 6) clear();
  const width = Math.max(24, (process.stdout.columns || 80) - 5);
  const titleText = truncate(title, Math.max(12, width - 14));
  const subtitleText = truncate(subtitle, width);
  const output = `\n  ${(backHovered ? inverse : cyan)("\u2190 Back")} ${dim("[" + backKey + "]")}\n\n  ${cyan("◆")} ${bold("GITDECK")}  ${dim("/ ")} ${accent(titleText)}\n${subtitleText ? `  ${paintSubtitle(subtitleText)}\n` : ""}  ${dim("─".repeat(width))}\n\n`;
  write(output);
  return cursorRowAfter(output);
}

function mainFrame(subtitle, width, margin, write) {
  const shadow = activeTheme().logoShadow || activeTheme().muted;
  const scale = width >= logo[0].length * 2 + 1 && (process.stdout.rows || 24) >= 24 ? 2 : 1;
  const face = logo.flatMap(line =>
    Array(scale).fill(Array.from(line, cell => cell.repeat(scale)).join("")),
  );
  const logoWidth = face[0].length + 1;
  const wordmark = width >= logoWidth
    ? [...face, ""].map((line, row) => margin + Array.from(
        { length: logoWidth },
        (_, column) => {
          if (line[column] === "\u2588") return cyan("\u2588");
          return face[row - 1]?.[column - 1] === "\u2588" ? color(shadow, "\u2592") : " ";
        },
      ).join("")).join("\n")
    : margin + cyan("GIT") + bold("DECK");
  const output = `\n${wordmark}\n\n${margin}${cyan("Repositories")}\n${margin}${dim(truncate(subtitle, width))}\n\n`;
  write(output);
  return cursorRowAfter(output);
}

function prompt(label, initial = "", mouseBack = false) {
  return new Promise((resolve) => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    const readline = require("node:readline");
    const input = mouseBack ? new (require("node:stream").PassThrough)() : process.stdin;
    const rl = readline.createInterface({ input, output: process.stdout });
    let hovered = false;
    const mouseInput = chunk => {
      const report = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
      const text = chunk.toString();
      let offset = 0;
      for (const event of text.matchAll(report)) {
        input.write(text.slice(offset, event.index));
        offset = event.index + event[0].length;
        const [, button, column, row, state] = event;
        const onBack = Number(row) === 2 && Number(column) >= 3 && Number(column) <= 14;
        if (onBack && Number(button) === 0 && state === "M") {
          rl.close();
          return;
        }
        if (hovered !== onBack) {
          hovered = onBack;
          const back = (hovered ? inverse : cyan)("\u2190 Back");
          process.stdout.write(`\x1b7${esc}2;3H${back}\x1b8`);
        }
      }
      input.write(text.slice(offset));
    };
    if (mouseBack) {
      process.stdin.setRawMode(true);
      process.stdin.on("data", mouseInput);
      process.stdout.write("\x1b[?1003h\x1b[?1006h");
      process.stdin.resume();
    }
    const cancel = (_, key) => {
      if (key?.name === "escape") rl.close();
    };
    input.on("keypress", cancel);
    rl.once("close", () => {
      input.off("keypress", cancel);
      if (mouseBack) {
        process.stdin.off("data", mouseInput);
        process.stdin.pause();
        process.stdin.setRawMode(false);
        process.stdout.write("\x1b[?1006l\x1b[?1003l");
        input.end();
      }
      resolve("");
    });
    rl.question(`  ${label}${initial ? ` (${initial})` : ""}\n  › `, (answer) => {
      resolve(answer.trim() || initial);
      rl.close();
    });
  });
}

function waitKey(message = "Press any key to continue") {
  return new Promise((resolve) => {
    process.stdout.write(`\n  ${dim(message)} `);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => { process.stdin.pause(); resolve(); });
  });
}

async function choose(title, subtitle, items, selected = 0, isHome = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("GitDeck requires an interactive terminal.");
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write("\x1b[?1003h\x1b[?1006h");
  return new Promise((resolve) => {
    const selectableCount = isHome ? Math.max(1, items.length - 3) : items.length;
    let itemRows = [];
    const folderLinks = new Map();
    let footerRow, footerLinks;
    let hover = "";
    let inputBuffer = "";
    const finish = (choice) => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", draw);
      process.stdout.write("\x1b[?1006l\x1b[?1003l");
      process.stdin.pause();
      resolve(choice);
    };
    let previousLines = [];
    const draw = (incremental = false) => {
      items[selected]?.preview?.();
      let screen = "";
      const write = text => { screen += text; };
      const columns = process.stdout.columns || 80;
      const width = Math.max(8, columns - 5);
      const margin = "  ";
      let row = isHome ? mainFrame(subtitle, width, margin, write) : frame(title, subtitle, dim, "Esc", hover === "back", write);
      itemRows = [];
      folderLinks.clear();
      const rows = process.stdout.rows || 24;
      const repoCount = isHome ? items.length - 3 : items.length;
      const capacity = Math.max(1, rows - row - 1);
      const first = Math.max(0, Math.min(selected, repoCount - 1) - capacity + 1);
      const drawItem = (item, i) => {
        const rowForItem = row++;
        itemRows[i] = rowForItem;
        const shortcut = item.key ? item.key.toUpperCase() + " " : "  ";
        const room = width - 3 - shortcut.length;
        const repository = Array.isArray(item.hint);
        const nameWidth = Math.min(24, Math.max(8, Math.floor(room * 0.23)));
        const branchWidth = Math.min(24, Math.max(6, Math.floor(room * 0.22)));
        const name = truncate(item.label, Math.min(repository ? nameWidth : 32, room));
        const label = repository ? name.padEnd(Math.min(nameWidth, room)) : name;
        const hintRoom = room - label.length - 2;
        const parts = Array.isArray(item.hint) ? item.hint : [{ text: item.hint || "", paint: dim }];
        let remaining = Math.max(0, hintRoom);
        let hint = "", paintedHint = "";
        for (const [index, { text, paint, folder }] of parts.entries()) {
          if (remaining < 4 || !text) break;
          const column = repository && parts.length === 3 && index < 2
            ? Math.min(remaining, branchWidth + (index === 1 ? 3 : 0))
            : remaining;
          const segment = repository && parts.length === 3 && index < 2
            ? truncate(text, column).padEnd(column)
            : truncate(text, column);
          if (isHome && folder) {
            const start = 1 + Array.from(margin + "   " + label + "  " + hint).length;
            folderLinks.set(itemRows[i], { start, end: start + Array.from(segment).length, folder });
          }
          hint += segment;
          paintedHint += folder && hover === "folder:" + rowForItem ? bold(yellow(segment)) : paint(segment);
          remaining -= Array.from(segment).length;
        }
        const gap = hint ? "  " : "";
        const padding = " ".repeat(Math.max(0, room - Array.from(label + gap + hint).length));
        const active = i === selected || hover === "row:" + rowForItem;
        const paintedLabel = item.paint ? item.paint(label) : Array.isArray(item.hint) ? bold(label) : label;
        const content = active
          ? inverse("  " + (paintedLabel + gap + paintedHint).replaceAll(esc + "0m", esc + "0;" + activeTheme().selection + "m") + padding + shortcut)
          : "  " + paintedLabel + gap + paintedHint + padding + accent(shortcut);
        write(margin + (active ? cyan("\u258c") : " ") + content + "\n");
      };
      items.slice(first, Math.min(repoCount, first + capacity))
        .forEach((item, offset) => drawItem(item, first + offset));
      const shortcuts = isHome
        ? [["A Add repository", "a"], ["E Edit", "e"], ["S Settings", "s"],
           ["Q Quit", "q"], ["Enter shell", "\r"], ["Up/Down move"]]
        : [["Up/Down move"], ["Enter select", "\r"], ["Q Back", "q"]];
      footerLinks = [];
      const footerParts = [];
      let x = margin.length + 1;
      for (const [label, key] of shortcuts) {
        if (x + label.length > margin.length + width + 1) break;
        footerParts.push((key && hover === "key:" + key ? inverse : key === "a" ? green : key ? accent : dim)(label));
        if (key) footerLinks.push({ start: x, end: x + label.length, key });
        x += label.length + 3;
      }
      const footerText = footerParts.join("   ");
      if (row + 1 < rows) {
        write(margin + dim("\u2500".repeat(width)) + "\n");
        row++;
      }
      footerRow = Math.max(rows, row);
      write("\n".repeat(Math.max(0, rows - row)) + margin + footerText);

      const lines = screen.split("\n");
      if (incremental && lines.length === previousLines.length) {
        const changes = lines.map((line, index) => line === previousLines[index]
          ? ""
          : `${esc}${index + 1};1H${line}${esc}K`).join("");
        if (changes) process.stdout.write(`\x1b7${changes}\x1b8`);
      } else {
        process.stdout.write(`${esc}2J${esc}H${screen}`);
      }
      previousLines = lines;
    };
    draw();
    const onData = (buffer) => {
      inputBuffer += buffer.toString();
      const mouseStart = inputBuffer.indexOf("\x1b[<");
      if (mouseStart >= 0) {
        const mouseEnd = inputBuffer.slice(mouseStart).search(/[Mm]/);
        if (mouseEnd < 0) return;
        const sequence = inputBuffer.slice(mouseStart, mouseStart + mouseEnd + 1);
        inputBuffer = inputBuffer.slice(0, mouseStart) + inputBuffer.slice(mouseStart + mouseEnd + 1);
        const mouse = sequence.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
        if (mouse) {
          const button = Number(mouse[1]);
          const y = Number(mouse[3]);
          const x = Number(mouse[2]);
          if ((button & 32) !== 0) {
            const folder = folderLinks.get(y);
            const link = y === footerRow && footerLinks.find(({ start, end }) => x >= start && x < end);
            const target = !isHome && y === 2 && x >= 3 && x <= 14 ? "back"
              : folder && x >= folder.start && x < folder.end ? "folder:" + y
              : link ? "key:" + link.key : itemRows.includes(y) && x >= 3 && x <= (process.stdout.columns || 80) - 3
                ? "row:" + y : "";
            if (target !== hover) {
              hover = target;
              draw(true);
            }
          } else if ((button & 64) !== 0 && mouse[4] === "M") {
            selected = (selected + ((button & 1) === 0 ? -1 : 1) + selectableCount) % selectableCount;
            draw(true);
          } else if ((button & 3) === 0 && mouse[4] === "M") {
            if (!isHome && y === 2 && Number(mouse[2]) <= 14) {
              finish(-1);
              return;
            }
            if (y === footerRow) {
              const x = Number(mouse[2]);
              const link = footerLinks.find(({ start, end }) => x >= start && x < end);
              if (link) onData(Buffer.from(link.key));
              return;
            }
            const folderLink = folderLinks.get(y);
            const column = Number(mouse[2]);
            if (folderLink && column >= folderLink.start && column < folderLink.end) {
              finish({ folder: folderLink.folder });
              return;
            }
            const clicked = itemRows.indexOf(y);
            if (clicked >= 0) {
              if (items[clicked].preview) {
                selected = clicked;
                draw(true);
              } else finish(clicked);
              return;
            }
          }
        }
        if (inputBuffer) {
          const remaining = inputBuffer;
          inputBuffer = "";
          onData(Buffer.from(remaining));
        }
        return;
      }
      if (inputBuffer.startsWith("\x1b[<")) return;
      const key = inputBuffer;
      inputBuffer = "";
      if (key === "\u001b[A" || key === "k") selected = (selected - 1 + selectableCount) % selectableCount;
      else if (key === "\u001b[B" || key === "j") selected = (selected + 1) % selectableCount;
      else if (isHome && key.toLowerCase() === "e" && selected < items.length - 3) {
        finish({ edit: selected });
        return;
      }
      else if (items.some((item) => item.key && key.toLowerCase() === item.key)) {
        const shortcutItem = items.find((item) => item.key && key.toLowerCase() === item.key);
        finish(items.indexOf(shortcutItem));
        return;
      }
      else if (key === "\r" || key === "\n") {
        if (items[selected]?.preview) return;
        finish(isHome && items.length === 3 ? items.findIndex(item => item.key === "a") : selected);
        return;
      } else if (key === "q" || key === "\u0003" || key === "\u001b") {
        finish(-1);
        return;
      }
      draw(true);
    };
    process.stdin.on("data", onData);
    process.stdout.on("resize", draw);
  });
}

async function addRepo(repos) {
  let feedback = "";
  while (true) {
    frame("Add repository", "Register a local Git repository");
    if (feedback) process.stdout.write(`  ${feedback}\n\n`);
    process.stdout.write(`  ${dim("Paste a folder path. Press Enter on an empty line to go back.")}\n\n`);
    const entered = await prompt(cyan("Repository path"), "", true);
    if (!entered) return;

    const root = repositoryRoot(resolveRepoInput(entered));
    if (!root) {
      feedback = red("No Git repository found at that path. Check the folder and try again.");
      continue;
    }

    const pathKey = value => isWin ? path.resolve(value).toLowerCase() : path.resolve(value);
    const duplicate = repos.find(repo => pathKey(repo.path) === pathKey(root));
    if (duplicate) {
      feedback = yellow(`Already registered as ${repoName(duplicate)}.`);
      continue;
    }

    const repo = { path: root, name: path.basename(root) || root };
    try {
      saveRepos([...repos, repo]);
    } catch (error) {
      feedback = red(`Could not save the repository list (${error.code || "write failed"}).`);
      continue;
    }
    repos.push(repo);
    frame("Repository added", repoName(repo), green);
    process.stdout.write(`  ${cyan(root)}\n`);
    await waitKey();
    return;
  }
}

async function settingsMenu() {
  const previous = settings.theme;
  const themeItems = Object.entries(themes).map(([id, theme]) => ({
    label: theme.name,
    preview: () => { settings.theme = id; },
  }));
  await choose(
    "Color theme",
    "Choose a theme with the arrows or mouse. Go back to save.",
    themeItems,
    Object.keys(themes).indexOf(previous),
  );
  if (settings.theme !== previous) saveSettings();
}

async function updateRepoPath(repo, repos, detectedUnavailable = false) {
  frame(detectedUnavailable ? "Project path unavailable" : "Update project path", `${repoName(repo)}  ·  Current: ${repo.path}`);
  if (detectedUnavailable) {
    process.stdout.write(`  ${yellow("The saved folder is missing or is no longer a Git repository.")}\n\n`);
  }
  const entered = await prompt("Enter the new repository path (blank to cancel)");
  if (!entered) return false;

  const root = repositoryRoot(resolveRepoInput(entered));
  if (!root) {
    frame("Path not updated");
    process.stdout.write(`  ${red("That folder is not an accessible Git repository.")}\n`);
    await waitKey();
    return false;
  }
  const duplicate = repos.find((item) => item !== repo && path.resolve(item.path).toLowerCase() === root.toLowerCase());
  if (duplicate) {
    frame("Path not updated");
    process.stdout.write(`  ${red(`That path is already registered as ${repoName(duplicate)}.`)}\n`);
    await waitKey();
    return false;
  }

  const oldPath = repo.path;
  repo.path = root;
  saveRepos(repos);
  frame("Project path changed", repoName(repo));
  process.stdout.write(`  ${dim("FROM")} ${oldPath}\n`);
  process.stdout.write(`  ${green("TO  ")} ${root}\n`);
  await waitKey();
  return true;
}

async function renameRepo(repo, repos) {
  frame("Rename project", `Current name: ${repoName(repo)}`);
  const entered = await prompt("New project name");
  const name = entered.trim();
  if (!name) return;
  repo.name = name;
  saveRepos(repos);
  frame("Project renamed", name);
  process.stdout.write(`  ${green("✓ Name updated.")}\n`);
  await waitKey();
}

async function showStatus(repo) {
  frame(repoName(repo), `${repo.path}  ·  ${branchAt(repo.path)}`);
  const result = git(["status", "--short", "--branch"], repo.path);
  if (result.status === 0) {
    const lines = result.stdout.trim().split(/\r?\n/);
    if (lines.length === 1 && lines[0].includes("##") && !lines[0].includes("...") && !lines[0].includes("ahead") && !lines[0].includes("behind")) {
      process.stdout.write(`  ${green("✓ Working tree clean.")}\n`);
    } else {
      lines.forEach((line) => process.stdout.write(`  ${line}\n`));
    }
  } else process.stdout.write(`  ${red(result.stderr.trim() || "Could not read repository status.")}\n`);
  await waitKey();
}

function openShell(repo) {
  process.stdin.setRawMode(false);
  const local = branchAt(repo.path);
  const upstream = upstreamAt(repo.path);
  frame("Project shell", repo.path, cyan, "exit");
  process.stdout.write(`  ${accent("LOCAL BRANCH   ")}   ${green(local)}\n`);
  process.stdout.write(`  ${accent("TRACKING BRANCH")}   ${upstream === "no upstream" ? yellow(upstream) : cyan(upstream)}\n\n`);
  process.stdout.write(`  ${dim("The prompt shows the folder, local branch, and tracking branch. Type ")}${accent("exit")}${dim(" to return.")}\n\n`);

  let shell;
  let args = [];
  if (isWin) {
    const pwsh = path.join(process.env.ProgramFiles || "C:/Program Files", "PowerShell", "7", "pwsh.exe");
    shell = fs.existsSync(pwsh) ? pwsh : "powershell.exe";
    const promptScript = [
      "if ($PSVersionTable.PSVersion.Major -ge 7) {",
      "  try {",
      "    Import-Module PSReadLine -ErrorAction Stop",
      "    Set-PSReadLineOption -PredictionSource History -ErrorAction Stop",
      "  } catch { Write-Warning $_.Exception.Message }",
      "}",
      "function global:prompt {",
      "  $lastCommandSucceeded = $?",
      "  $folderName = Split-Path (Get-Location).Path -Leaf",
      "  if (-not $folderName) { $folderName = (Get-Location).Path }",
      "  $localBranch = (& git branch --show-current 2>$null | Out-String).Trim()",
      "  if (-not $localBranch) { $localBranch = 'detached HEAD' }",
      "  $upstreamBranch = (& git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>$null | Out-String).Trim()",
      "  $escape = [char]27",
      `  $reset = "$escape[0m"`,
      `  $primary = "$escape[${activeTheme().primary}m"`,
      `  $accent = "$escape[${activeTheme().secondary}m"`,
      `  $muted = "$escape[${activeTheme().muted}m"`,
      `  $danger = "$escape[${activeTheme().danger}m"`,
      `  $status = if ($lastCommandSucceeded) { "$primary○" } else { "$danger×" }`,
      `  $tracking = if ($upstreamBranch) { " $muted→ $accent$upstreamBranch" } else { '' }`,
      `  Write-Host "$status $primary➜ $folderName $muted git:($accent$localBranch$muted)$tracking$reset"`,
      `  return "$primary❯$reset "`,
      "}",
    ].join("\n");
    args = ["-NoLogo", "-NoExit", "-EncodedCommand", Buffer.from(promptScript, "utf16le").toString("base64")];
  } else {
    shell = process.env.SHELL || "bash";
  }
  const child = spawn(shell, args, { cwd: repo.path, stdio: "inherit", windowsHide: false });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => { process.stdin.pause(); resolve(); });
  });
}

async function repoMenu(repo, repos) {
  while (true) {
    const actions = [
      { label: "View status", paint: cyan, hint: "Changes and current branch", key: "s" },
      { label: "Pull updates", paint: cyan, hint: "git pull", key: "l" },
      { label: "Push changes", paint: green, hint: "git push", key: "u" },
      { label: "Rename project", paint: accent, hint: "Change its display name", key: "n" },
      { label: "Update project path", paint: accent, hint: "Relink a moved repository", key: "p" },
      { label: "Remove from list", paint: yellow, hint: "Repository files are kept", key: "r" },
      { label: "Back", key: "b" },
    ];
    const choice = await choose(`Edit repository / ${repoName(repo)}`, `${repo.path}  ·  ${branchLabel(repo.path)}`, actions);
    if (choice < 0 || choice === actions.length - 1) return;
    if (choice === 0) await showStatus(repo);
    if (choice === 1 || choice === 2) {
      const operation = choice === 1 ? "pull" : "push";
      frame(`${operation === "pull" ? "Pull updates" : "Push changes"}`, repoName(repo));
      const result = spawnSync("git", [operation], { cwd: repo.path, encoding: "utf8", stdio: "inherit", windowsHide: true });
      process.stdout.write(`\n  ${result.status === 0 ? green("Operation complete.") : red("Operation failed.")}\n`);
      await waitKey();
    }
    if (choice === 3) await renameRepo(repo, repos);
    if (choice === 4) await updateRepoPath(repo, repos);
    if (choice === 5) {
      const ok = await prompt("Type yes to remove this project from the list");
      if (ok.toLowerCase() === "yes") {
        saveRepos(repos.filter((r) => r !== repo));
        repos.splice(repos.indexOf(repo), 1);
        return;
      }
    }
  }
}

async function main() {
  const repos = readRepos();
  while (true) {
    const projectItems = repos.map((repo) => ({
      label: repoName(repo),
      hint: projectHint(repo),
    }));
    const items = [
      ...projectItems,
      { label: "+ Add repository", paint: green, hint: "Choose a local folder", key: "a" },
      { label: "Settings", hint: `Change the app color theme · ${activeTheme().name}`, key: "s" },
      { label: "Quit", key: "q" },
    ];
    const choice = await choose("Your repositories", repos.length ? "Select a project to get started" : "Add your first local Git repository", items, 0, true);
    if (typeof choice === "object" && choice.folder) {
      try {
        if (!fs.statSync(choice.folder).isDirectory()) throw new Error("Folder unavailable");
        const opener = isWin ? "powershell.exe" : process.platform === "darwin" ? "open" : "xdg-open";
        const args = isWin
          ? ["-NoProfile", "-NonInteractive", "-Command", "Invoke-Item -LiteralPath $env:GITDECK_OPEN_FOLDER -ErrorAction Stop"]
          : [choice.folder];
        const result = spawnSync(opener, args, {
          encoding: "utf8",
          env: { ...process.env, GITDECK_OPEN_FOLDER: choice.folder },
          windowsHide: true,
        });
        if (result.error || result.status !== 0) {
          throw result.error || new Error((result.stderr || "").trim() || "The file manager could not open the folder.");
        }
      } catch (error) {
        frame("Could not open folder", choice.folder);
        process.stdout.write(`  ${red(error.message)}\n`);
        await waitKey();
      }
      continue;
    }
    if (typeof choice === "object") {
      await repoMenu(repos[choice.edit], repos);
      continue;
    }
    if (choice < 0 || choice === items.length - 1) { clear(); return; }
    if (choice === projectItems.length) await addRepo(repos);
    else if (choice === projectItems.length + 1) await settingsMenu();
    else if (repos[choice]) {
      const repo = repos[choice];
      if (repositoryRoot(repo.path) || await updateRepoPath(repo, repos, true)) {
        await openShell(repo);
      }
    }
  }
}

main().catch((error) => {
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch {} }
  console.error(`\nGitDeck: ${error.message}`);
  process.exitCode = 1;
});
