const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const desktopRoot = path.join(__dirname, "..");
const outputMarkerFile = path.join(desktopRoot, ".electron-builder-output");
const outputDir =
  fs.existsSync(outputMarkerFile) && fs.readFileSync(outputMarkerFile, "utf8").trim()
    ? fs.readFileSync(outputMarkerFile, "utf8").trim()
    : "dist";

const extraArgs = process.argv.slice(2).filter(Boolean);
const configArg = `--config.directories.output=${outputDir}`;
const command = ["npx", "electron-builder", ...extraArgs, configArg].join(" ");

execSync(command, {
  cwd: desktopRoot,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: "false"
  }
});

const executablePath = path.join(desktopRoot, outputDir, "win-unpacked", "RestaurantPOS.exe");
if (fs.existsSync(executablePath)) {
  console.log(`\nDesktop app ready:\n  ${executablePath}\n`);
}
