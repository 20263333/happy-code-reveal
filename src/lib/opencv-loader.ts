/** Lazy loader for OpenCV.js (WASM build served from CDN). UI/CV only — no backend. */
declare global {
  interface Window {
    cv?: any;
  }
}

const CDN = "https://docs.opencv.org/4.10.0/opencv.js";
let promise: Promise<any> | null = null;

export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (promise) return promise;

  promise = new Promise<any>((resolve, reject) => {
    const ready = (cv: any) => resolve(cv);

    if (window.cv?.Mat) return ready(window.cv);

    const existing = document.querySelector<HTMLScriptElement>(`script[data-opencv]`);
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = CDN;
      script.async = true;
      script.dataset.opencv = "true";
      document.head.appendChild(script);
    }

    const started = Date.now();
    const poll = window.setInterval(() => {
      const cv = window.cv;
      if (cv?.Mat) {
        window.clearInterval(poll);
        ready(cv);
      } else if (cv && typeof cv.then === "function") {
        window.clearInterval(poll);
        cv.then(ready).catch(reject);
      } else if (Date.now() - started > 30000) {
        window.clearInterval(poll);
        reject(new Error("OpenCV load timeout"));
      }
    }, 120);

    script.onerror = () => {
      window.clearInterval(poll);
      promise = null;
      reject(new Error("OpenCV script failed"));
    };
  });

  return promise;
}

export {};
