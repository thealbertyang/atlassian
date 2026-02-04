"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const path_1 = require("path");
exports.default = (0, vite_1.defineConfig)({
    root: __dirname,
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: (0, path_1.resolve)(__dirname, "dist"),
        emptyOutDir: true,
    },
});
//# sourceMappingURL=vite.config.js.map