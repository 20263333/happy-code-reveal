declare module "@paddlejs-models/ocr" {
  export function init(detModelPath?: string, recModelPath?: string): Promise<void>;
  export function detect(image: HTMLCanvasElement | HTMLImageElement): Promise<unknown>;
  export function recognize(
    image: HTMLCanvasElement | HTMLImageElement,
    option?: Record<string, unknown>,
  ): Promise<{ text: (string | string[])[]; points: number[][][] }>;
}
