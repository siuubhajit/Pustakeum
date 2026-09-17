export class DocumentCanvasPainter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
  }

  public paintPlaceholder(pageNumber: number, mode: "parchment" | "dark" | "plain") {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background color based on mode
    if (mode === "parchment") {
      ctx.fillStyle = "#FFFDF9";
    } else if (mode === "dark") {
      ctx.fillStyle = "#121824";
    } else {
      ctx.fillStyle = "#FFFFFF";
    }
    ctx.fillRect(0, 0, w, h);

    // Subtle paper edge border
    ctx.strokeStyle = mode === "dark" ? "#243048" : "#E2D7C2";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Page indicator
    ctx.fillStyle = mode === "dark" ? "#64748B" : "#8C8477";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`— Page ${pageNumber} —`, w / 2, h - 30);
  }
}

