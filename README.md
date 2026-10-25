# Scrapper-engine

## Demo

[![Watch Demo](https://img.shields.io/badge/▶%20Watch%20Demo-Click%20Here-blue?style=for-the-badge&logo=video&logoColor=white)](https://tarun-nitin-pahade.neetorecord.com/watch/f4fd1fb8867d30b39661)

> Click the badge above to watch a full walkthrough of the scraper engine in action.

---

This is uvicorn
uvicorn main:app --reload




todo
Free (or open‑source) options by captcha type, with realism:

Image/Text/Math captchas: Tesseract OCR, EasyOCR, PaddleOCR (all free). You may need preprocessing (binarize/denoise/deskew) and custom training for good accuracy.
Slider captchas: OpenCV contour/template matching; some open-source solvers exist per site but usually brittle and site-specific.
Audio captchas (including ReCAPTCHA audio): Download audio and run a speech-to-text model (Vosk, Whisper small), then submit; this is fragile and site-specific, and may violate terms.
ReCAPTCHA v2/v3, hCaptcha, Turnstile, FunCaptcha: There is no reliable free solver. Open-source “bypass” scripts exist (e.g., using audio endpoints), but they’re unstable, often against ToS, and break frequently.
Custom math/text captchas rendered as images: same as image/math above with OCR; sometimes regex post-processing improves accuracy.

---

## SDK

The backend is also available as an npm package: [`packages/browsera-sdk`](packages/browsera-sdk).

```bash
npm install browsera-sdk
```

```ts
import { BrowseraClient, isSuccess } from "browsera-sdk";

const client = new BrowseraClient("http://localhost:8000");

const loaded = await client.runNode<{ dataframeRef: string }>("loadCSV", { fileRef: "./data.csv" });
if (isSuccess(loaded)) console.log(loaded.result.dataframeRef);
```

Thin typed client over `/run-node`, `/run-multiple-nodes`, `/workflow`, auth, and PDF endpoints — ESM + CJS, zero runtime dependencies. See [`packages/browsera-sdk/README.md`](packages/browsera-sdk/README.md) for the full API.

