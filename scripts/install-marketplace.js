const { execSync } = require("child_process");
const path = require("path");

const pkg = require(path.join(__dirname, "..", "package.json"));
const targetId = `${pkg.publisher}.${pkg.name}`;
const targetVersion = pkg.version;

const maxAttempts = Number(process.env.MARKET_INSTALL_ATTEMPTS || 10);
const delayMs = Number(process.env.MARKET_INSTALL_DELAY_MS || 30000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInstalledVersion() {
  const output = execSync("code-insiders --list-extensions --show-versions", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const line = output
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().startsWith(targetId.toLowerCase() + "@"));
  if (!line) {
    return null;
  }
  const parts = line.split("@");
  return parts[1] || null;
}

(async () => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execSync(`code-insiders --install-extension ${targetId} --force`, {
        stdio: "inherit",
      });
    } catch (error) {
      // Install may fail before Marketplace propagation; keep retrying.
    }

    const installed = getInstalledVersion();
    if (installed === targetVersion) {
      console.log(`Installed ${targetId}@${installed}`);
      process.exit(0);
    }

    console.log(
      `Marketplace not updated yet (have ${installed || "none"}, want ${targetVersion}). ` +
        `Retrying in ${Math.round(delayMs / 1000)}s... (${attempt}/${maxAttempts})`,
    );
    await sleep(delayMs);
  }

  console.error(
    `Failed to install ${targetId}@${targetVersion} after ${maxAttempts} attempts. ` +
      `Try again later with bun run install:extension:market`,
  );
  process.exit(1);
})();
