const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
for (const ext of [".ts", ".tsx"])
  require.extensions[ext] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    });
    module._compile(result.outputText, filename);
  };
require(path.resolve(process.argv[2]));
