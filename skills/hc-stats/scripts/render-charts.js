#!/usr/bin/env node
/**
 * HC 进度可视化入口。
 * Windows：调用 render-charts.ps1（System.Drawing，中文清晰）
 * 其他平台：纯 Node PNG 回退
 *
 * Usage:
 *   echo '{"jobs":[...]}' | node render-charts.js --out media/hc-stats.png
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

function parseArgs(argv) {
  const opts = { title: "岗位招聘进度", out: "media/hc-stats.png", jsonFile: null, cleanupAfterSeconds: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--title" && argv[i + 1]) opts.title = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (argv[i] === "--json-file" && argv[i + 1]) opts.jsonFile = argv[++i];
    else if (argv[i] === "--cleanup-after-seconds" && argv[i + 1]) opts.cleanupAfterSeconds = Number(argv[++i]);
  }
  return opts;
}

function scheduleCleanup(outPath, opts) {
  const delaySeconds = Number(opts.cleanupAfterSeconds);
  if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) return;

  const targets = [];
  const mediaRoot = `${path.resolve(process.cwd(), "media")}${path.sep}`;
  const resolvedOut = path.resolve(outPath);
  if (resolvedOut.startsWith(mediaRoot)) targets.push(resolvedOut);

  if (opts.jsonFile) {
    const tempRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
    const resolvedJson = path.resolve(process.cwd(), opts.jsonFile);
    if (resolvedJson.startsWith(tempRoot)) targets.push(resolvedJson);
  }
  if (!targets.length) return;

  const worker = [
    "const fs=require('fs');",
    "const targets=JSON.parse(process.argv[1]);",
    "const delay=Number(process.argv[2]);",
    "setTimeout(()=>{for(const target of targets){try{fs.unlinkSync(target)}catch(error){if(error.code!=='ENOENT')process.exitCode=1}}},delay);",
  ].join("");
  const child = spawn(process.execPath, ["-e", worker, JSON.stringify(targets), String(delaySeconds * 1000)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function finishRender(displayPath, outPath, opts) {
  console.log(displayPath);
  scheduleCleanup(outPath, opts);
}

function readInput(opts) {
  if (opts.jsonFile) {
    return Promise.resolve(fs.readFileSync(path.resolve(process.cwd(), opts.jsonFile), "utf8").replace(/^\uFEFF/, ""));
  }
  return readStdin();
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    if (process.stdin.isTTY) {
      reject(new Error("请通过 stdin 传入 JSON（含 jobs 数组）"));
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function renderViaPowerShell(json, title, outPath) {
  const ps1 = path.join(__dirname, "render-charts.ps1");
  const tmp = path.join(require("os").tmpdir(), `hc-stats-${Date.now()}.json`);
  // UTF-8 BOM：Windows PowerShell 5.x 的 Get-Content -Encoding UTF8 需要 BOM 才能正确读中文
  fs.writeFileSync(tmp, "\uFEFF" + json, "utf8");
  try {
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        ps1,
        "-Title",
        title || "岗位招聘进度",
        "-Out",
        outPath,
        "-JsonFile",
        tmp,
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
    if (r.status !== 0) {
      throw new Error((r.stderr || r.stdout || "PowerShell 渲染失败").trim());
    }
    const line = (r.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();
    return line || outPath;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

/* ---------- Node fallback ---------- */

const COLORS = {
  bg: [248, 250, 252],
  card: [255, 255, 255],
  title: [15, 23, 42],
  subtitle: [100, 116, 139],
  axis: [148, 163, 184],
  grid: [226, 232, 240],
  label: [51, 65, 85],
  target: [37, 99, 235],
  accepted: [16, 185, 129],
  r1: [59, 130, 246],
  r2: [14, 165, 233],
  offer: [245, 158, 11],
};

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createCanvas(width, height, bg) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

function setPixel(canvas, x, y, rgb, alpha = 255) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  if (alpha >= 255) {
    canvas.rgba[i] = rgb[0];
    canvas.rgba[i + 1] = rgb[1];
    canvas.rgba[i + 2] = rgb[2];
    canvas.rgba[i + 3] = 255;
    return;
  }
  const a = alpha / 255;
  canvas.rgba[i] = Math.round(rgb[0] * a + canvas.rgba[i] * (1 - a));
  canvas.rgba[i + 1] = Math.round(rgb[1] * a + canvas.rgba[i + 1] * (1 - a));
  canvas.rgba[i + 2] = Math.round(rgb[2] * a + canvas.rgba[i + 2] * (1 - a));
  canvas.rgba[i + 3] = 255;
}

function fillRect(canvas, x, y, w, h, rgb, alpha = 255) {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(canvas.width, (x + w) | 0);
  const y1 = Math.min(canvas.height, (y + h) | 0);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) setPixel(canvas, px, py, rgb, alpha);
  }
}

const GLYPHS = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [14, 17, 1, 6, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 17, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 17, 14],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "-": [0, 0, 0, 14, 0, 0, 0],
  A: [14, 17, 17, 31, 17, 17, 17],
  C: [14, 17, 16, 16, 16, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  P: [30, 17, 17, 30, 16, 16, 16],
  R: [30, 17, 17, 30, 20, 18, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  F: [31, 16, 16, 30, 16, 16, 16],
  E: [31, 16, 16, 30, 16, 16, 31],
  T: [31, 4, 4, 4, 4, 4, 4],
  G: [14, 17, 16, 19, 17, 17, 14],
  S: [14, 17, 16, 14, 1, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  N: [17, 25, 21, 19, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  L: [16, 16, 16, 16, 16, 16, 31],
  U: [17, 17, 17, 17, 17, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  M: [17, 27, 21, 17, 17, 17, 17],
  W: [17, 17, 17, 21, 21, 21, 10],
  Y: [17, 17, 10, 4, 4, 4, 4],
  B: [30, 17, 17, 30, 17, 17, 30],
};

function measureText(text, scale = 2) {
  return [...text].length * (5 * scale + scale);
}

function drawText(canvas, text, x, y, rgb, scale = 2) {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) {
      fillRect(canvas, cx, y, 5 * scale, 7 * scale, rgb, 80);
      cx += 5 * scale + scale;
      continue;
    }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (16 >> col)) {
          fillRect(canvas, cx + col * scale, y + row * scale, scale, scale, rgb);
        }
      }
    }
    cx += 5 * scale + scale;
  }
}

function fillRoundRect(canvas, x, y, w, h, r, rgb) {
  if (w <= 0 || h <= 0) return;
  fillRect(canvas, x + r, y, Math.max(0, w - 2 * r), h, rgb);
  fillRect(canvas, x, y + r, w, Math.max(0, h - 2 * r), rgb);
}

function countAxisMax(n) {
  return Math.max(1, Math.ceil(Math.max(0, n) / 4)) * 4;
}

function num(v) {
  if (v === null || v === undefined || v === "" || v === "?") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasTarget(v) {
  return v !== null && v !== undefined && v !== "" && v !== "?";
}

function renderNodeFallback(stats, title) {
  const jobs = stats.jobs && stats.jobs.length ? stats.jobs : [{ name: "N/A", target: 0, accepted: 0, waitingR1: 0, waitingR2: 0, waitingOffer: 0 }];
  const canvas = createCanvas(1000, 720, COLORS.bg);
  const safeTitle = title.replace(/[^\x20-\x7E]/g, " ").trim() || "HC Progress";
  drawText(canvas, safeTitle, 40, 28, COLORS.title, 3);
  drawText(canvas, "Target & Accepted / Pipeline", 40, 62, COLORS.subtitle, 2);

  // Left card
  fillRoundRect(canvas, 32, 100, 452, 560, 12, COLORS.card);
  drawText(canvas, "Target vs Offer", 52, 118, COLORS.title, 2);

  const plotX = 80;
  const plotY = 156;
  const plotW = 360;
  const plotH = 440;
  let maxLeft = 0;
  jobs.forEach((j) => {
    maxLeft = Math.max(maxLeft, hasTarget(j.target) ? num(j.target) : 0, num(j.accepted));
  });
  const maxVal = countAxisMax(maxLeft);
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + plotH - (plotH * i) / 4;
    fillRect(canvas, plotX, gy, plotW, 1, COLORS.grid);
    drawText(canvas, String(Math.round((maxVal * i) / 4)), 48, gy - 6, COLORS.subtitle, 1);
  }
  fillRect(canvas, plotX, plotY + plotH, plotW, 2, COLORS.axis);

  const n = Math.max(jobs.length, 1);
  const groupGap = 16;
  const groupW = Math.max(36, Math.min(90, (plotW - groupGap * (n + 1)) / n));
  const barGap = 4;
  const barW = Math.max(12, (groupW - barGap) / 2);
  const totalW = n * groupW + (n - 1) * groupGap;
  const startX = plotX + (plotW - totalW) / 2;

  jobs.forEach((j, i) => {
    const gx = startX + i * (groupW + groupGap);
    const t = hasTarget(j.target) ? num(j.target) : 0;
    const a = num(j.accepted);
    if (hasTarget(j.target)) {
      const bh = Math.max(2, Math.round((t / maxVal) * plotH));
      fillRoundRect(canvas, gx, plotY + plotH - bh, barW, bh, 4, COLORS.target);
      drawText(canvas, String(Math.round(t)), gx + 2, plotY + plotH - bh - 14, COLORS.label, 1);
    }
    const bh2 = Math.max(2, Math.round((a / maxVal) * plotH));
    fillRoundRect(canvas, gx + barW + barGap, plotY + plotH - bh2, barW, bh2, 4, COLORS.accepted);
    drawText(canvas, String(Math.round(a)), gx + barW + barGap + 2, plotY + plotH - bh2 - 14, COLORS.label, 1);
    const label = String(j.name || "?").slice(0, 6).replace(/[^\x20-\x7E]/g, "J");
    drawText(canvas, label || "Job", gx, plotY + plotH + 12, COLORS.label, 1);
  });

  // Right card
  fillRoundRect(canvas, 516, 100, 452, 560, 12, COLORS.card);
  drawText(canvas, "Pipeline", 536, 118, COLORS.title, 2);

  const rPlotX = 616;
  const rPlotY = 156;
  const rPlotW = 300;
  const rPlotH = 440;
  let maxStack = 0;
  jobs.forEach((j) => {
    maxStack = Math.max(maxStack, num(j.waitingR1) + num(j.waitingR2) + num(j.waitingOffer));
  });
  maxStack = countAxisMax(maxStack);

  for (let i = 0; i <= 4; i++) {
    const gx = rPlotX + (rPlotW * i) / 4;
    fillRect(canvas, gx, rPlotY, 1, rPlotH, COLORS.grid);
    drawText(canvas, String(Math.round((maxStack * i) / 4)), gx - 4, rPlotY + rPlotH + 8, COLORS.subtitle, 1);
  }
  fillRect(canvas, rPlotX, rPlotY + rPlotH, rPlotW, 2, COLORS.axis);

  const rowGap = 14;
  const rowH = Math.max(22, Math.min(48, (rPlotH - rowGap * (n - 1)) / n));
  const totalRowsH = n * rowH + (n - 1) * rowGap;
  const rowStartY = rPlotY + (rPlotH - totalRowsH) / 2;

  jobs.forEach((j, i) => {
    const by = rowStartY + i * (rowH + rowGap);
    let cx = rPlotX;
    const segs = [
      { v: num(j.waitingR1), c: COLORS.r1 },
      { v: num(j.waitingR2), c: COLORS.r2 },
      { v: num(j.waitingOffer), c: COLORS.offer },
    ];
    segs.forEach((seg) => {
      if (seg.v <= 0) return;
      const bw = Math.max(2, Math.round((seg.v / maxStack) * rPlotW));
      fillRoundRect(canvas, cx, by, bw, rowH, 4, seg.c);
      if (bw >= 18) {
        drawText(canvas, String(Math.round(seg.v)), cx + 4, by + Math.max(2, (rowH - 10) / 2), [255, 255, 255], 1);
      }
      cx += bw;
    });
    const label = String(j.name || "?").slice(0, 6).replace(/[^\x20-\x7E]/g, "J");
    drawText(canvas, label || "Job", 530, by + Math.max(2, (rowH - 10) / 2), COLORS.label, 1);
  });

  return encodePNG(1000, 720, canvas.rgba);
}

async function main() {
  const opts = parseArgs(process.argv);
  const raw = await readInput(opts);
  let stats;
  try {
    stats = JSON.parse(raw);
  } catch (e) {
    console.error("JSON 解析失败:", e.message);
    process.exit(1);
  }
  if (!stats || !Array.isArray(stats.jobs)) {
    console.error("JSON 需包含 jobs 数组");
    process.exit(1);
  }

  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (process.platform === "win32") {
    try {
      const payload = {
        ...stats,
        title: stats.title || opts.title,
        subtitle: stats.subtitle || "目标 & 已接受  ·  在途构成",
        leftTitle: stats.leftTitle || "目标 vs 已接受",
        rightTitle: stats.rightTitle || "在途构成",
      };
      const produced = renderViaPowerShell(
        JSON.stringify(payload),
        payload.title || opts.title,
        outPath
      );
      finishRender(produced, outPath, opts);
      return;
    } catch (e) {
      console.error("PowerShell 渲染失败，回退 Node:", e.message);
    }
  }

  fs.writeFileSync(outPath, renderNodeFallback(stats, opts.title));
  finishRender(outPath, outPath, opts);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
