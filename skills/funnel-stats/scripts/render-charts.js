#!/usr/bin/env node
/**
 * 招聘漏斗可视化入口。
 * Windows：调用 render-charts.ps1（System.Drawing，中文清晰）
 * 其他平台：纯 Node PNG 回退
 *
 * Usage:
 *   echo '{"stages":[...],"rates":[...]}' | node render-charts.js --out media/funnel-stats.png
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

function parseArgs(argv) {
  const opts = { title: "招聘转化复盘", out: "media/funnel-stats.png", jsonFile: null, cleanupAfterSeconds: 0 };
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
      reject(new Error("请通过 stdin 传入 JSON（含 stages / rates）"));
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
  const tmp = path.join(require("os").tmpdir(), `funnel-stats-${Date.now()}.json`);
  fs.writeFileSync(tmp, json, "utf8");
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
        title,
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
  funnel: [
    [37, 99, 235],
    [59, 130, 246],
    [14, 165, 233],
    [16, 185, 129],
  ],
  barRate: [16, 185, 129],
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
  "%": [25, 26, 2, 4, 8, 11, 19],
  ".": [0, 0, 0, 0, 0, 12, 12],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  O: [14, 17, 17, 17, 17, 17, 14],
  F: [31, 16, 16, 30, 16, 16, 16],
  E: [31, 16, 16, 30, 16, 16, 31],
  R: [30, 17, 17, 30, 20, 18, 17],
  A: [14, 17, 17, 31, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  D: [30, 17, 17, 17, 17, 17, 30],
  P: [30, 17, 17, 30, 16, 16, 16],
  T: [31, 4, 4, 4, 4, 4, 4],
  I: [14, 4, 4, 4, 4, 4, 14],
  L: [16, 16, 16, 16, 16, 16, 31],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  Y: [17, 17, 10, 4, 4, 4, 4],
  C: [14, 17, 16, 16, 16, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  G: [14, 17, 16, 19, 17, 17, 14],
  W: [17, 17, 17, 21, 21, 21, 10],
  M: [17, 27, 21, 17, 17, 17, 17],
  S: [14, 17, 16, 14, 1, 17, 14],
  B: [30, 17, 17, 30, 17, 17, 30],
};

const STAGE_ALIAS = {
  初筛通过: "Screen",
  一面通过: "R1 Pass",
  二面通过: "R2 Pass",
  OFFER接受: "Offer",
};
const RATE_ALIAS = {
  一面通过率: "R1",
  二面通过率: "R2",
  OFFER接受率: "Offer",
  总通过率: "Total",
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
  fillRect(canvas, x + r, y, w - 2 * r, h, rgb);
  fillRect(canvas, x, y + r, w, h - 2 * r, rgb);
}

function renderNodeFallback(stats, title) {
  const stages = stats.stages || [];
  const rates = stats.rates || [];
  const canvas = createCanvas(1000, 720, COLORS.bg);
  const safeTitle = title.replace(/[^\x20-\x7E]/g, " ").trim() || "Recruitment Funnel";
  drawText(canvas, safeTitle, 40, 28, COLORS.title, 3);
  drawText(canvas, "Stages & Conversion", 40, 62, COLORS.subtitle, 2);

  fillRoundRect(canvas, 32, 100, 452, 560, 12, COLORS.card);
  drawText(canvas, "Funnel", 52, 118, COLORS.title, 2);
  const maxCount = Math.max(...stages.map((s) => Number(s.count) || 0), 1);
  const hasStageData = stages.some((s) => (Number(s.count) || 0) > 0);
  const n = Math.max(stages.length, 1);
  const rowH = 72;
  const gapY = 18;
  const totalH = n * rowH + (n - 1) * gapY;
  const startY = 170 + Math.max(0, (480 - totalH) / 2);
  const plotLeft = 152;
  const plotW = 296;

  if (hasStageData) stages.forEach((s, i) => {
    const count = Number(s.count) || 0;
    const ratio = count / maxCount;
    const barW = count > 0 ? Math.max(28, Math.round(plotW * (0.35 + 0.65 * ratio))) : 2;
    const bx = plotLeft + (plotW - barW) / 2;
    const by = startY + i * (rowH + gapY);
    const color = COLORS.funnel[Math.min(i, COLORS.funnel.length - 1)];
    const v = `${Math.round(count)}`;
    if (count > 0) {
      fillRoundRect(canvas, bx, by, barW, rowH, 10, color);
      drawText(canvas, v, bx + Math.max(0, (barW - measureText(v, 2)) / 2), by + 28, [255, 255, 255], 2);
    } else {
      drawText(canvas, v, plotLeft + (plotW - measureText(v, 2)) / 2, by + 28, COLORS.label, 2);
    }
    const label = STAGE_ALIAS[s.name] || String(s.name || "?").slice(0, 8);
    drawText(canvas, label, 48, by + 28, COLORS.label, 1);
  });
  else drawText(canvas, "No data in selected period", 146, 370, COLORS.subtitle, 2);

  fillRoundRect(canvas, 516, 100, 452, 560, 12, COLORS.card);
  drawText(canvas, "Pass Rate", 536, 118, COLORS.title, 2);
  const plotX = 572;
  const plotY = 156;
  const plotW2 = 372;
  const plotH = 440;
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + plotH - (plotH * i) / 4;
    fillRect(canvas, plotX, gy, plotW2, 1, COLORS.grid);
    drawText(canvas, `${Math.round((100 * i) / 4)}%`, 526, gy - 6, COLORS.subtitle, 1);
  }
  fillRect(canvas, plotX, plotY + plotH, plotW2, 2, COLORS.axis);

  const rn = Math.max(rates.length, 1);
  const gap = 16;
  const barW = Math.max(18, Math.min(56, (plotW2 - gap * (rn + 1)) / rn));
  const hasAnyRate = rates.some((r) => r.rate !== null && r.rate !== undefined && r.rate !== "");
  if (hasAnyRate) rates.forEach((r, i) => {
    const has = r.rate !== null && r.rate !== undefined && r.rate !== "";
    const val = has ? Number(r.rate) : 0;
    const bh = has ? Math.max(2, Math.round((val / 100) * plotH)) : 2;
    const bx = plotX + gap + i * (barW + gap);
    const by = plotY + plotH - bh;
    fillRoundRect(canvas, bx, by, barW, bh, 6, COLORS.barRate);
    const vLabel = has ? `${val.toFixed(1)}%` : "-";
    drawText(canvas, vLabel, bx + Math.max(0, (barW - measureText(vLabel, 1)) / 2), by - 14, COLORS.label, 1);
    const label = RATE_ALIAS[r.name] || String(r.name || "?").slice(0, 6);
    drawText(canvas, label, bx + Math.max(0, (barW - measureText(label, 1)) / 2), plotY + plotH + 12, COLORS.label, 1);
  });
  else drawText(canvas, "No conversion rates", 650, 370, COLORS.subtitle, 2);

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
  if (!stats || !Array.isArray(stats.stages)) {
    console.error("JSON 需包含 stages 数组");
    process.exit(1);
  }
  if (!Array.isArray(stats.rates)) stats.rates = [];

  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (process.platform === "win32") {
    try {
      const payload = {
        ...stats,
        title: stats.title || opts.title,
        subtitle: stats.subtitle || "阶段人数 & 通过率",
        leftTitle: stats.leftTitle || "转化漏斗",
        rightTitle: stats.rightTitle || "阶段通过率",
        emptyText: stats.emptyText || "该周期暂无数据",
        emptyRateText: stats.emptyRateText || "暂无可计算转化率",
      };
      const produced = renderViaPowerShell(JSON.stringify(payload), "funnel-stats", outPath);
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
