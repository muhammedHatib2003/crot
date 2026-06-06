const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const desktopRoot = path.join(__dirname, "..");
const defaultOutputDir = path.join(desktopRoot, "dist");
const unpackedDir = path.join(defaultOutputDir, "win-unpacked");
const outputMarkerFile = path.join(desktopRoot, ".electron-builder-output");

function run(command) {
  try {
    execSync(command, { stdio: "ignore", shell: true });
  } catch {
    // Process may not be running.
  }
}

function sleep(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // busy wait
  }
}

function tryRemoveDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return true;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return true;
    } catch {
      sleep(400);
    }
  }

  return false;
}

if (process.platform === "win32") {
  run("taskkill /F /IM RestaurantPOS.exe /T");
  run('taskkill /F /IM "Restaurant POS Desktop.exe" /T');
  run("taskkill /F /IM electron.exe /T");
  sleep(800);
}

let outputDir = defaultOutputDir;

if (!tryRemoveDir(unpackedDir)) {
  const backupDir = path.join(defaultOutputDir, `win-unpacked-locked-${Date.now()}`);

  try {
    fs.renameSync(unpackedDir, backupDir);
    console.warn(`Moved locked build folder to ${path.basename(backupDir)}`);
  } catch {
    outputDir = path.join(defaultOutputDir, `pkg-${Date.now()}`);
    console.warn(
      `Previous build is still locked. Using fresh output folder:\n  ${path.relative(desktopRoot, outputDir)}`
    );
  }
}

const relativeOutput = path.relative(desktopRoot, outputDir).split(path.sep).join("/");
fs.writeFileSync(outputMarkerFile, relativeOutput, "utf8");
