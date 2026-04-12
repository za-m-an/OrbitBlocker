import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const manifestPath = path.join(repoRoot, "manifest.json");

const errors = [];

function addError(message) {
  errors.push(message);
}

function ensurePathExists(relativePath, expectedType) {
  const absolutePath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    addError(`Missing required ${expectedType}: ${relativePath}`);
    return;
  }

  const stats = fs.statSync(absolutePath);
  if (expectedType === "file" && !stats.isFile()) {
    addError(`Expected a file but found something else: ${relativePath}`);
  }

  if (expectedType === "directory" && !stats.isDirectory()) {
    addError(`Expected a directory but found something else: ${relativePath}`);
  }
}

function readJson(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    addError(`Unable to parse JSON: ${path.relative(repoRoot, jsonPath)} (${error.message})`);
    return null;
  }
}

ensurePathExists("manifest.json", "file");
ensurePathExists("LICENSE", "file");
ensurePathExists("README.md", "file");
ensurePathExists("assets", "directory");
ensurePathExists("src", "directory");

const manifest = readJson(manifestPath);

if (manifest) {
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || ""))) {
    addError("manifest.json version must follow semantic version format (x.y.z)");
  }

  const dnr = manifest.declarative_net_request;
  const ruleResources = dnr && Array.isArray(dnr.rule_resources) ? dnr.rule_resources : null;

  if (!ruleResources || ruleResources.length === 0) {
    addError("manifest.json declarative_net_request.rule_resources is missing or empty");
  } else {
    const seenIds = new Set();

    for (const rule of ruleResources) {
      const ruleId = String(rule.id || "").trim();
      const rulePath = String(rule.path || "").trim();

      if (!ruleId) {
        addError("A ruleset entry is missing an id");
      } else if (seenIds.has(ruleId)) {
        addError(`Duplicate ruleset id found: ${ruleId}`);
      } else {
        seenIds.add(ruleId);
      }

      if (!rulePath) {
        addError(`Ruleset '${ruleId || "(missing-id)"}' is missing a path`);
        continue;
      }

      if (path.isAbsolute(rulePath) || rulePath.includes("..")) {
        addError(`Ruleset path must be repository-relative and safe: ${rulePath}`);
        continue;
      }

      ensurePathExists(rulePath, "file");
    }
  }
}

if (errors.length > 0) {
  console.error("Release validation failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Release validation passed.");
