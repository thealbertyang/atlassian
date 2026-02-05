import * as vscode from "vscode";
import { AtlassianClient, JiraIssue } from "./atlassianClient";

export class AtlassianIssuesProvider implements vscode.TreeDataProvider<IssueItem> {
  private readonly emitter = new vscode.EventEmitter<IssueItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly client: AtlassianClient) {}

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(_element?: IssueItem): Promise<IssueItem[]> {
    try {
      const issues = await this.client.searchMyOpenSprintIssues();
      if (issues.length === 0) {
        return [];
      }
      return issues.map((issue) => new IssueItem(issue));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(`Failed to load Atlassian issues: ${message}`);
      return [];
    }
  }
}

export class IssueItem extends vscode.TreeItem {
  constructor(public readonly issue: JiraIssue) {
    super(`${issue.key}: ${issue.summary}`, vscode.TreeItemCollapsibleState.None);
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
