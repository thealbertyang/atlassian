const fs = require("fs");
const path = require("path");

const bumpType = (process.argv[2] || "patch").toLowerCase();
const valid = new Set(["major", "minor", "patch"]);
if (!valid.has(bumpType)) {
  console.error(`Unknown bump type: ${bumpType}. Use major, minor, or patch.`);
  process.exit(1);
}

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const parts = String(pkg.version || "0.0.0").split("-");
const core = parts[0];
const [majorStr, minorStr, patchStr] = core.split(".");
let major = Number(majorStr || 0);
let minor = Number(minorStr || 0);
let patch = Number(patchStr || 0);

if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
  console.error(`Invalid version: ${pkg.version}`);
  process.exit(1);
}

if (bumpType === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

pkg.version = `${major}.${minor}.${patch}`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Bumped version to ${pkg.version}`);
