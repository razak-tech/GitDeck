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
const esc = "\x1b[";
const color = (code, value) => `${esc}${code}m${value}${esc}0m`;
const cyan = (s) => color("38;5;81", s);
const dim = (s) => color("38;5;245", s);
const green = (s) => color("38;5;114", s);
const red = (s) => color("38;5;203", s);
const bold = (s) => color("1", s);
const inverse = (s) => color("48;5;238;1", s);

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

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

function branchAt(dir) {
  const result = git(["branch", "--show-current"], dir);
  return result.status === 0 ? (result.stdout.trim() || "detached HEAD") : "unavailable";
}

function upstreamAt(dir) {
  const result = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], dir);
  return result.status === 0 ? result.stdout.trim() : "no upstream";
}

function branchLabel(dir) {
  return `${branchAt(dir)}  →  ${upstreamAt(dir)}`;
}

function repoName(repo) { return repo.name || path.basename(repo.path); }

function clear() { process.stdout.write(`${esc}2J${esc}H`); }

function frame(title, subtitle = "") {
  clear();
  const width = Math.max(24, Math.min(68, (process.stdout.columns || 80) - 6));
  process.stdout.write(`\n  ${cyan("◆")} ${bold("GITDECK")}  ${dim("/ ")} ${bold(title)}\n`);
  if (subtitle) process.stdout.write(`  ${dim(subtitle)}\n`);
  process.stdout.write(`  ${dim("─".repeat(width))}\n\n`);
}

function mainFrame(subtitle) {
  clear();
  process.stdout.write("\n");
  logo.forEach((line) => process.stdout.write(`  ${cyan(line)}\n`));
  process.stdout.write(`\n  ${dim("LOCAL REPOSITORY MANAGER")}  ${dim("·")}  ${dim("Fast, focused Git workflows")}\n`);
  process.stdout.write(`  ${dim("─".repeat(Math.max(24, Math.min(68, (process.stdout.columns || 80) - 6))))}\n\n`);
  process.stdout.write(`  ${bold(subtitle)}\n\n`);
}

function prompt(label, initial = "") {
  return new Promise((resolve) => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    const readline = require("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${label}${initial ? ` (${initial})` : ""}\n  › `, (answer) => {
      rl.close();
      resolve(answer.trim() || initial);
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
  return new Promise((resolve) => {
    const draw = () => {
      if (isHome) mainFrame(subtitle);
      else frame(title, subtitle);
      items.forEach((item, i) => {
        const active = i === selected;
        const marker = active ? cyan("◆") : dim("·");
        const shortcut = item.key ? dim(`[${item.key}] `) : "";
        const label = active ? inverse(` ${item.label} `) : item.label;
        process.stdout.write(`  ${marker}  ${shortcut}${label}`);
        if (item.hint) process.stdout.write(`  ${dim(item.hint)}`);
        process.stdout.write("\n\n");
      });
      const footer = isHome
        ? "↑ ↓ navigate   Enter open   A add repository   Q quit"
        : "↑ ↓ navigate   Enter select   Q back";
      process.stdout.write(`\n  ${dim("─".repeat(Math.max(24, Math.min(68, (process.stdout.columns || 80) - 6))))}\n`);
      process.stdout.write(`  ${dim(footer)}`);
    };
    draw();
    const onData = (buffer) => {
      const key = buffer.toString();
      if (key === "\u001b[A" || key === "k") selected = (selected - 1 + items.length) % items.length;
      else if (key === "\u001b[B" || key === "j") selected = (selected + 1) % items.length;
      else if (items.some((item) => item.key && key.toLowerCase() === item.key)) {
        const shortcutItem = items.find((item) => item.key && key.toLowerCase() === item.key);
        process.stdin.off("data", onData);
        process.stdin.pause();
        resolve(items.indexOf(shortcutItem));
        return;
      }
      else if (key === "\r" || key === "\n") {
        process.stdin.off("data", onData);
        process.stdin.pause();
        resolve(selected);
        return;
      } else if (key === "q" || key === "\u0003" || key === "\u001b") {
        process.stdin.off("data", onData);
        process.stdin.pause();
        resolve(-1);
        return;
      }
      draw();
    };
    process.stdin.on("data", onData);
  });
}

async function addRepo(repos) {
  frame("Add a project", "Add the local path to an existing Git repository");
  const entered = await prompt("Repository path", process.cwd());
  const dir = path.resolve(entered.replace(/^~(?=$|[\\/])/, home));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    frame("Could not add project"); process.stdout.write(`  ${red("This folder does not exist.")}\n`); await waitKey(); return;
  }
  const check = git(["rev-parse", "--show-toplevel"], dir);
  if (check.status !== 0) {
    frame("Could not add project"); process.stdout.write(`  ${red("This folder is not a Git repository.")}\n`); await waitKey(); return;
  }
  const root = path.resolve(check.stdout.trim());
  if (repos.some((r) => path.resolve(r.path).toLowerCase() === root.toLowerCase())) {
    frame("Project already added"); process.stdout.write(`  ${repoName({ path: root })}\n`); await waitKey(); return;
  }
  repos.push({ path: root, name: path.basename(root) });
  saveRepos(repos);
  frame("Project added"); process.stdout.write(`  ${green("✓")} ${path.basename(root)}\n  ${dim(root)}\n`); await waitKey();
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
  frame("Project shell", repo.path);
  process.stdout.write(`  ${dim("LOCAL BRANCH")}   ${cyan(local)}\n`);
  process.stdout.write(`  ${dim("TRACKING BRANCH")} ${upstream === "no upstream" ? dim(upstream) : cyan(upstream)}\n\n`);
  process.stdout.write(`  ${dim("The colored prompt updates these branches as you work. Type exit to return.")}\n\n`);

  let shell;
  let args = [];
  if (isWin) {
    shell = "powershell.exe";
    const promptScript = [
      "function global:prompt {",
      "  $localBranch = (& git branch --show-current 2>$null | Out-String).Trim()",
      "  if (-not $localBranch) { $localBranch = 'detached HEAD' }",
      "  $upstreamBranch = (& git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>$null | Out-String).Trim()",
      "  if (-not $upstreamBranch) { $upstreamBranch = 'no upstream' }",
      "  Write-Host -NoNewline -ForegroundColor DarkGray \"$((Get-Location).Path)  \"",
      "  Write-Host -NoNewline -ForegroundColor Cyan \"[$localBranch] \"",
      "  Write-Host -NoNewline -ForegroundColor DarkGray '→ ' ",
      "  Write-Host -NoNewline -ForegroundColor Magenta \"[$upstreamBranch]\"",
      "  Write-Host -NoNewline -ForegroundColor Green \"`n❯ \"",
      "  return ' ' ",
      "}",
    ].join("\n");
    args = ["-NoLogo", "-NoExit", "-Command", promptScript];
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
      { label: "View status", hint: "Changes and current branch", key: "s" },
      { label: "Pull updates", hint: "git pull", key: "l" },
      { label: "Push changes", hint: "git push", key: "u" },
      { label: "Open project shell", hint: "Starts in the repository folder", key: "t" },
      { label: "Remove from list", hint: "Repository files are kept", key: "r" },
      { label: "Back", key: "b" },
    ];
    const choice = await choose(repoName(repo), `${repo.path}  ·  ${branchLabel(repo.path)}`, actions);
    if (choice < 0 || choice === 5) return;
    if (choice === 0) await showStatus(repo);
    if (choice === 1 || choice === 2) {
      const operation = choice === 1 ? "pull" : "push";
      frame(`${operation === "pull" ? "Pull updates" : "Push changes"}`, repoName(repo));
      const result = spawnSync("git", [operation], { cwd: repo.path, encoding: "utf8", stdio: "inherit", windowsHide: true });
      process.stdout.write(`\n  ${result.status === 0 ? green("Operation complete.") : red("Operation failed.")}\n`);
      await waitKey();
    }
    if (choice === 3) {
      await openShell(repo);
    }
    if (choice === 4) {
      const ok = await prompt("Type yes to remove this project from the list");
      if (ok.toLowerCase() === "yes") {
        saveRepos(repos.filter((r) => r !== repo));
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
      hint: `${branchLabel(repo.path)}  ·  ${path.dirname(repo.path)}`,
    }));
    const items = [...projectItems, { label: "+ Add repository", hint: "From a local path", key: "a" }, { label: "Quit", key: "q" }];
    const choice = await choose("Your repositories", repos.length ? "Select a project to get started" : "Add your first local Git repository", items, 0, true);
    if (choice < 0 || choice === items.length - 1) { clear(); return; }
    if (choice === projectItems.length) await addRepo(repos);
    else if (repos[choice]) await repoMenu(repos[choice], repos);
  }
}

main().catch((error) => {
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch {} }
  console.error(`\nGitDeck: ${error.message}`);
  process.exitCode = 1;
});
