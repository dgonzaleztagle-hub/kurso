import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const scanDirs = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "supabase", "functions"),
];

const supabaseTypesPath = path.join(repoRoot, "src", "integrations", "supabase", "types.ts");
const supabaseConfigPath = path.join(repoRoot, "supabase", "config.toml");

const fileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (fileExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectMatches(content, regex) {
  const matches = [];
  for (const match of content.matchAll(regex)) {
    const value = match[1] || match[2];
    if (value) {
      matches.push(value);
    }
  }
  return matches;
}

function extractTables(content) {
  return collectMatches(content, /\.from\('([a-zA-Z0-9_]+)'\)|\.from\("([a-zA-Z0-9_]+)"\)/g);
}

function extractRpcs(content) {
  return collectMatches(content, /\.rpc\('([a-zA-Z0-9_]+)'\)|\.rpc\("([a-zA-Z0-9_]+)"\)/g);
}

function extractInvokes(content) {
  return collectMatches(content, /functions\.invoke\('([a-zA-Z0-9_-]+)'\)|functions\.invoke\("([a-zA-Z0-9_-]+)"\)/g);
}

function extractTypeBlockKeys(content, blockName) {
  const blockStart = content.indexOf(`${blockName}: {`);
  if (blockStart === -1) {
    return new Set();
  }

  let depth = 0;
  let blockContent = "";
  for (let index = blockStart; index < content.length; index += 1) {
    const char = content[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        blockContent += char;
        break;
      }
    }
    blockContent += char;
  }

  const keys = new Set();
  for (const match of blockContent.matchAll(/^\s{6}([a-zA-Z0-9_]+): \{/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

function extractConfiguredFunctions(content) {
  const configured = new Set();
  for (const match of content.matchAll(/^\[functions\.([a-zA-Z0-9_-]+)\]/gm)) {
    configured.add(match[1]);
  }
  return configured;
}

function summarizeUsage(usages) {
  return Array.from(usages.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, refs]) => ({
      name,
      count: refs.length,
      refs: refs.slice(0, 5).map((ref) => path.relative(repoRoot, ref)),
    }));
}

function buildUsageMap(files, extractor) {
  const usage = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const names = extractor(content);
    for (const name of names) {
      const refs = usage.get(name) ?? [];
      refs.push(filePath);
      usage.set(name, refs);
    }
  }

  return usage;
}

const files = scanDirs.flatMap((dir) => walk(dir));
const typesContent = fs.readFileSync(supabaseTypesPath, "utf8");
const configContent = fs.readFileSync(supabaseConfigPath, "utf8");

const tableUsage = buildUsageMap(files, extractTables);
const rpcUsage = buildUsageMap(files, extractRpcs);
const invokeUsage = buildUsageMap(files, extractInvokes);

const knownTables = extractTypeBlockKeys(typesContent, "Tables");
const knownRpcs = extractTypeBlockKeys(typesContent, "Functions");
const configuredFunctions = extractConfiguredFunctions(configContent);

const missingTables = Array.from(tableUsage.keys()).filter((name) => !knownTables.has(name)).sort();
const missingRpcs = Array.from(rpcUsage.keys()).filter((name) => !knownRpcs.has(name)).sort();
const missingInvokes = Array.from(invokeUsage.keys()).filter((name) => !configuredFunctions.has(name)).sort();

const report = {
  summary: {
    scannedFiles: files.length,
    tableRefs: tableUsage.size,
    rpcRefs: rpcUsage.size,
    edgeFunctionRefs: invokeUsage.size,
    missingTables: missingTables.length,
    missingRpcs: missingRpcs.length,
    missingEdgeFunctions: missingInvokes.length,
  },
  tables: {
    used: summarizeUsage(tableUsage),
    missingFromTypes: missingTables,
  },
  rpcs: {
    used: summarizeUsage(rpcUsage),
    missingFromTypes: missingRpcs,
  },
  edgeFunctions: {
    used: summarizeUsage(invokeUsage),
    missingFromConfig: missingInvokes,
  },
};

console.log(JSON.stringify(report, null, 2));
