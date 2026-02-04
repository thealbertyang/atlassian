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
exports.IssueItem = exports.AtlassianIssuesProvider = void 0;
const vscode = __importStar(require("vscode"));
class AtlassianIssuesProvider {
    client;
    emitter = new vscode.EventEmitter();
    onDidChangeTreeData = this.emitter.event;
    constructor(client) {
        this.client = client;
    }
    refresh() {
        this.emitter.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(_element) {
        const authenticated = await this.client.isAuthenticated();
        if (!authenticated) {
            return [];
        }
        try {
            const issues = await this.client.searchMyOpenSprintIssues();
            return issues.map((issue) => new IssueItem(issue));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            vscode.window.showErrorMessage(`Failed to load Atlassian issues: ${message}`);
            return [];
        }
    }
}
exports.AtlassianIssuesProvider = AtlassianIssuesProvider;
class IssueItem extends vscode.TreeItem {
    issue;
    constructor(issue) {
        super(`${issue.key}: ${issue.summary}`, vscode.TreeItemCollapsibleState.None);
        this.issue = issue;
        this.description = issue.status;
        this.contextValue = "atlassianIssue";
        this.tooltip = `${issue.key} • ${issue.status} • ${issue.issueType}`;
        this.command = {
            command: "atlassian.openIssue",
            title: "Open Issue",
            arguments: [issue],
        };
    }
}
exports.IssueItem = IssueItem;
//# sourceMappingURL=issueProvider.js.map