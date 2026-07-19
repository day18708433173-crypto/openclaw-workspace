#!/usr/bin/env node
/**
 * 渠道统计可视化入口。
 * Windows：调用 render-charts.ps1（System.Drawing，中文清晰）
 * 其他平台：纯 Node PNG 回退（ASCII/有限中文点阵）
 *
 * Usage:
 *   echo '{"channels":[...]}' | node render-charts.js --title "渠道来源统计 — 2026年7月" --out media/channel-stats.png
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

function parseArgs(argv) {
  const opts = { title: "渠道来源统计", out: "media/channel-stats.png", jsonFile: null, cleanupAfterSeconds: 0 };
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
      reject(new Error("请通过 stdin 传入 JSON（含 channels 数组）"));
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
  const tmp = path.join(
    require("os").tmpdir(),
        `channel-stats-${Date.now()}.json`
  );
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

/* ---------- Node fallback (no System.Drawing) ---------- */

const COLORS = {
  bg: [248, 250, 252],
  card: [255, 255, 255],
  title: [15, 23, 42],
  subtitle: [100, 116, 139],
  axis: [148, 163, 184],
  grid: [226, 232, 240],
  barApplied: [37, 99, 235],
  barRate: [16, 185, 129],
  label: [51, 65, 85],
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
  B: [30, 17, 17, 30, 17, 17, 30],
  O: [14, 17, 17, 17, 17, 17, 14],
  S: [14, 17, 16, 14, 1, 17, 14],
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
};

const NAME_ALIAS = { 猎聘: "Liepin", 内推: "Referral", 校招: "Campus", 未知: "Unknown" };

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

function countAxisMax(n) {
  return Math.max(1, Math.ceil(Math.max(0, n) / 4)) * 4;
}

function fillRoundRect(canvas, x, y, w, h, r, rgb) {
  fillRect(canvas, x + r, y, w - 2 * r, h, rgb);
  fillRect(canvas, x, y + r, w, h - 2 * r, rgb);
}

function drawBarPanel(canvas, opts) {
  const { x, y, w, h, title, labels, values, color, valueFormatter, fixedMax } = opts;
  fillRoundRect(canvas, x, y, w, h, 12, COLORS.card);
  drawText(canvas, title, x + 20, y + 18, COLORS.title, 2);
  const plotX = x + 48;
  const plotY = y + 56;
  const plotW = w - 72;
  const plotH = h - 110;
  const maxVal = fixedMax || countAxisMax(Math.max(...values, 0));
  const n = labels.length || 1;
  const gap = 16;
  const barW = Math.max(18, Math.min(56, (plotW - gap * (n + 1)) / n));
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + plotH - (plotH * i) / 4;
    fillRect(canvas, plotX, gy, plotW, 1, COLORS.grid);
    drawText(canvas, valueFormatter((maxVal * i) / 4), x + 12, gy - 6, COLORS.subtitle, 1);
  }
  fillRect(canvas, plotX, plotY + plotH, plotW, 2, COLORS.axis);
  labels.forEach((label, i) => {
    const val = values[i] || 0;
    const bh = Math.round((val / maxVal) * plotH);
    const bx = plotX + gap + i * (barW + gap);
    const by = plotY + plotH - bh;
    fillRoundRect(canvas, bx, by, barW, Math.max(bh, 2), 6, color);
    const vLabel = valueFormatter(val);
    drawText(canvas, vLabel, bx + Math.max(0, (barW - measureText(vLabel, 1)) / 2), by - 14, COLORS.label, 1);
    drawText(canvas, label, bx + Math.max(0, (barW - measureText(label, 1)) / 2), plotY + plotH + 12, COLORS.label, 1);
  });
}

function renderNodeFallback(stats, title) {
  const channels = (stats.channels || []).filter((c) => (c.applied || 0) > 0);
  const hasData = channels.length > 0;
  const canvas = createCanvas(1000, 720, COLORS.bg);
  const safeTitle = title.replace(/[^\x20-\x7E]/g, " ").trim() || "Channel Stats";
  drawText(canvas, safeTitle, 40, 28, COLORS.title, 3);
  drawText(canvas, "Applications & Offer Rate", 40, 62, COLORS.subtitle, 2);
  const labels = channels.map((c) => NAME_ALIAS[c.name] || String(c.name || "?").slice(0, 8));
  const applied = channels.map((c) => Number(c.applied) || 0);
  const rates = channels.map((c) => {
    const a = Number(c.applied) || 0;
    const o = Number(c.offer) || 0;
    return a > 0 ? (o / a) * 100 : 0;
  });
  drawBarPanel(canvas, {
    x: 32, y: 100, w: 452, h: 560, title: "Applied", labels, values: applied,
    color: COLORS.barApplied, valueFormatter: (v) => String(Math.round(v)),
  });
  drawBarPanel(canvas, {
    x: 516, y: 100, w: 452, h: 560, title: "Offer Rate", labels, values: rates,
    color: COLORS.barRate, valueFormatter: (v) => `${v.toFixed(1)}%`, fixedMax: 100,
  });
  if (!hasData) {
    drawText(canvas, "No data in selected period", 146, 370, COLORS.subtitle, 2);
    drawText(canvas, "No data in selected period", 630, 370, COLORS.subtitle, 2);
  }
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
  if (!stats || !Array.isArray(stats.channels)) {
    console.error('JSON 需包含 channels 数组');
    process.exit(1);
  }

  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (process.platform === "win32") {
    try {
      const payload = {
        ...stats,
        title: stats.title || opts.title,
        subtitle: stats.subtitle || "投递人数  &  OFFER转化率",
        leftTitle: stats.leftTitle || "投递人数",
        rightTitle: stats.rightTitle || "OFFER转化率",
        emptyText: stats.emptyText || "该周期暂无数据",
      };
      const produced = renderViaPowerShell(
        JSON.stringify(payload),
        "channel-stats",
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
