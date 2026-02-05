export class WebviewRenderTracker {
  private lastRenderedAt: number | null = null;

  markRendered(): void {
    this.lastRenderedAt = Date.now();
  }

  getLastRenderedAt(): number | null {
    return this.lastRenderedAt;
  }
}
