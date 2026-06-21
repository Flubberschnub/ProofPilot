import type { GeneratedFile, GeneratedPackageCheck } from "../types.js";

const requiredFiles = [
  "README.md",
  "demo-script.md",
  "claim-check-report.md",
  "frontend/package.json",
  "frontend/index.html",
  "frontend/src/main.tsx",
  "frontend/src/App.tsx",
  "frontend/src/style.css",
  "backend/package.json",
  "backend/src/server.js"
];

export function validateGeneratedPackage(files: GeneratedFile[]): GeneratedPackageCheck {
  const checks: GeneratedPackageCheck["checks"] = [];
  const fileMap = new Map(files.map((file) => [normalizePath(file.path), file]));

  for (const path of requiredFiles) {
    checks.push(fileMap.has(path)
      ? { name: `required:${path}`, status: "passed", message: `${path} was generated.` }
      : { name: `required:${path}`, status: "failed", message: `${path} is missing.` });
  }

  for (const packagePath of ["frontend/package.json", "backend/package.json"]) {
    const file = fileMap.get(packagePath);
    if (!file) continue;
    try {
      JSON.parse(file.content);
      checks.push({ name: `json:${packagePath}`, status: "passed", message: `${packagePath} contains valid JSON.` });
    } catch (err) {
      checks.push({
        name: `json:${packagePath}`,
        status: "failed",
        message: err instanceof Error ? err.message : `${packagePath} contains invalid JSON.`
      });
    }
  }

  const appFile = fileMap.get("frontend/src/App.tsx");
  checks.push(appFile?.content.includes("Source-grounded claims")
    ? { name: "demo:claims", status: "passed", message: "Generated app renders source-grounded claims." }
    : { name: "demo:claims", status: "warning", message: "Generated app may not expose claim review copy." });

  return {
    status: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.some((check) => check.status === "warning")
        ? "warning"
        : "passed",
    checks
  };
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

export function validateCodeIntegrity(files: GeneratedFile[]): { passed: boolean; errorMsg: string } {
  const appFile = files.find(f => f.path.endsWith("App.tsx"));
  if (!appFile) {
    return { passed: true, errorMsg: "" };
  }

  const content = appFile.content;

  // 1. Stack-based JSX tag check
  // Strip out comments first to avoid false positives
  const noComments = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  // Strip all curly brace expressions inside tags to avoid '>' in arrow functions breaking the tag match
  let cleanJsx = "";
  let braceCount = 0;
  let inTag = false;
  
  for (let i = 0; i < noComments.length; i++) {
    const char = noComments[i];
    if (char === "<") {
      inTag = true;
    }
    if (char === ">" && braceCount === 0) {
      inTag = false;
    }
    
    if (inTag) {
      if (char === "{") {
        braceCount++;
        continue;
      }
      if (char === "}") {
        braceCount--;
        continue;
      }
      if (braceCount > 0) {
        continue; // skip characters inside braces inside a tag
      }
    }
    cleanJsx += char;
  }

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const stack: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(cleanJsx)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    
    // Ignore self-closing tags like <br/>, <input ... />, or <hr/>
    if (fullTag.endsWith("/>")) {
      continue;
    }
    
    if (fullTag.startsWith("</")) {
      // Closing tag
      if (stack.length === 0) {
        return { passed: false, errorMsg: `Unbalanced JSX: closing tag </${tagName}> has no matching opening tag.` };
      }
      const lastOpen = stack.pop();
      if (lastOpen !== tagName) {
        return { passed: false, errorMsg: `Unbalanced JSX: closing tag </${tagName}> mismatches opening tag <${lastOpen}>.` };
      }
    } else {
      // Opening tag
      stack.push(tagName);
    }
  }
  
  if (stack.length > 0) {
    return { passed: false, errorMsg: `Unbalanced JSX: opening tags <${stack.join(", ")}> are not closed.` };
  }

  // 2. Scan for unresolved function references (e.g. escapeForTemplate)
  // Identify all variables, functions, and state setters defined in the file
  const defined = new Set<string>();
  
  // Find standard functions: function name(...)
  const funcRegex = /\bfunction\s+([a-zA-Z0-9_]+)\b/g;
  while ((match = funcRegex.exec(content)) !== null) {
    defined.add(match[1]);
  }

  // Find arrow functions and variable assignments: const name = ...
  const constRegex = /\bconst\s+([a-zA-Z0-9_]+)\b\s*=/g;
  while ((match = constRegex.exec(content)) !== null) {
    defined.add(match[1]);
  }

  // Find state setter functions: const [x, setX] = useState(...)
  const stateRegex = /\bconst\s*\[\s*[a-zA-Z0-9_]+\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*useState\b/g;
  while ((match = stateRegex.exec(content)) !== null) {
    defined.add(match[1]);
  }

  // Find destructured function parameter props: function Name({ a, b, c })
  const paramRegex = /function\s+[a-zA-Z0-9_]+\s*\(\s*\{\s*([^}]+)\s*\}\s*\)/g;
  while ((match = paramRegex.exec(content)) !== null) {
    const params = match[1].split(",");
    for (const param of params) {
      defined.add(param.trim());
    }
  }

  // Standard React / global built-in functions
  const allowedGlobals = new Set([
    "useState",
    "useEffect",
    "useMemo",
    "React",
    "ReactDOM",
    "JSON",
    "Math",
    "Buffer",
    "Date",
    "Map",
    "Set",
    "parseInt",
    "parseFloat",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "console",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Error",
    "Promise",
    "FieldTable",
    "WeatherDashboard",
    "RequestConfigurator",
    "onSend"
  ]);

  // Find all function calls: name(...) or object.method(...)
  const jsKeywords = new Set([
    "if", "for", "switch", "while", "catch", "return", "await", "yield",
    "import", "export", "class", "super", "new", "typeof", "instanceof", "in", "var"
  ]);
  
  const cleanJs = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .replace(/"[\s\S]*?"/g, "")
    .replace(/'[\s\S]*?'/g, "")
    .replace(/`[\s\S]*?`/g, "")
    .replace(/>[^<{]*</g, "><");

  const callRegex = /(\.)?([a-zA-Z0-9_]+)\s*\(/g;
  while ((match = callRegex.exec(cleanJs)) !== null) {
    const isMethod = match[1] === ".";
    const callName = match[2];
    if (isMethod || jsKeywords.has(callName)) {
      continue;
    }
    // If it's a function call that isn't defined or allowed, fail validation
    if (!defined.has(callName) && !allowedGlobals.has(callName)) {
      return { passed: false, errorMsg: `ReferenceError: ${callName} is not defined in App.tsx.` };
    }
  }

  return { passed: true, errorMsg: "" };
}
