"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const atlassianClient_1 = require("./atlassianClient");
const issueProvider_1 = require("./issueProvider");
const loginPanel_1 = require("./loginPanel");
function activate(context) {
    const client = new atlassianClient_1.AtlassianClient(context);
    const provider = new issueProvider_1.AtlassianIssuesProvider(client);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("atlassianIssues", provider));
    context.subscriptions.push(vscode.commands.registerCommand("atlassian.refresh", () => provider.refresh()), vscode.commands.registerCommand("atlassian.login", async () => {
        await loginPanel_1.LoginPanel.show(context, client, provider);
    }), vscode.commands.registerCommand("atlassian.logout", async () => {
        await client.clearAuth();
        provider.refresh();
        vscode.window.showInformationMessage("Atlassian credentials cleared.");
    }), vscode.commands.registerCommand("atlassian.openIssue", async (issue) => {
        const key = issue?.key || issue?.issue?.key;
        if (!key) {
            return;
        }
        const url = await client.getIssueUrl(key);
        if (!url) {
            vscode.window.showErrorMessage("Please login to open issues.");
            return;
        }
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }));
}
function deactivate() {
    // no-op
}
//# sourceMappingURL=extension.js.map