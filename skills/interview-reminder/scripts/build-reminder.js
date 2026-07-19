#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const FIELD_SPECS = {
  candidate: { name: "候选人姓名", id: "fTxDpU" },
  role: { name: "应聘岗位", id: "fuSx02" },
  r1Time: { name: "一面时间", id: "fiAYNL" },
  r1Interviewer: { name: "一面面试官", id: "fENKNa" },
  r1Result: { name: "一面结果", id: "fLcCeK" },
  r2Time: { name: "二面时间", id: "frdYrS" },
  r2Interviewer: { name: "二面面试官", id: "fhuQVX" },
  r2Result: { name: "二面结果", id: "fYT8aR" },
};

const TERMINAL_RESULTS = new Set(["通过", "未通过", "取消"]);

function parseArgs(argv) {
  const opts = { jsonFile: null, date: null, timezone: "Asia/Shanghai" };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--json-file" && argv[i + 1]) opts.jsonFile = argv[++i];
    else if (argv[i] === "--date" && argv[i + 1]) opts.date = argv[++i];
    else if (argv[i] === "--timezone" && argv[i + 1]) opts.timezone = argv[++i];
  }
  return opts;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    if (process.stdin.isTTY) return reject(new Error("请通过 --json-file 或 stdin 传入记录 JSON"));
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function readInput(opts) {
  if (opts.jsonFile) {
    return fs.readFileSync(path.resolve(process.cwd(), opts.jsonFile), "utf8").replace(/^\uFEFF/, "");
  }
  return (await readStdin()).replace(/^\uFEFF/, "");
}

function findRecords(payload) {
  const candidates = [
    payload,
    payload?.records,
    payload?.data?.records,
    payload?.result?.records,
    payload?.data?.data?.records,
    payload?.result?.data?.records,
  ];
  const records = candidates.find(Array.isArray);
  return records || [];
}

function flattenText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("、");
  if (typeof value !== "object") return "";

  if (value.string_value !== undefined) return flattenText(value.string_value);
  if (value.text !== undefined) return flattenText(value.text);
  if (value.value !== undefined && value.value !== value) return flattenText(value.value);
  if (Array.isArray(value.items)) return flattenText(value.items);
  if (value.text_value?.items) return flattenText(value.text_value.items);
  if (value.option_value?.items) return flattenText(value.option_value.items);
  if (value.user_value?.items) return flattenText(value.user_value.items);
  return "";
}

function fieldContainers(record) {
  return [record, record?.values, record?.fields, record?.field_values, record?.data].filter(Boolean);
}

function getField(record, spec) {
  for (const container of fieldContainers(record)) {
    if (Array.isArray(container)) {
      const item = container.find((entry) =>
        entry && [entry.field, entry.field_name, entry.name].includes(spec.name)
        || entry && [entry.field_id, entry.id].includes(spec.id));
      if (item) return flattenText(item);
    } else if (typeof container === "object") {
      if (Object.prototype.hasOwnProperty.call(container, spec.name)) return flattenText(container[spec.name]);
      if (Object.prototype.hasOwnProperty.call(container, spec.id)) return flattenText(container[spec.id]);
    }
  }
  return "";
}

function parseTimestamp(value) {
  const text = flattenText(value);
  if (!text) return null;
  if (/^\d{10,13}$/.test(text)) {
    const raw = Number(text);
    const ms = text.length === 10 ? raw * 1000 : raw;
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateParts(timestamp, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function dateKey(timestamp, timezone) {
  const p = dateParts(timestamp, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

function todayKey(timezone) {
  return dateKey(Date.now(), timezone);
}

function timeLabel(timestamp, timezone) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function displayDate(key) {
  const [, month, day] = key.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function collectInterviews(records, targetDate, timezone) {
  const interviews = [];
  const rounds = [
    { label: "一面", time: FIELD_SPECS.r1Time, interviewer: FIELD_SPECS.r1Interviewer, result: FIELD_SPECS.r1Result },
    { label: "二面", time: FIELD_SPECS.r2Time, interviewer: FIELD_SPECS.r2Interviewer, result: FIELD_SPECS.r2Result },
  ];

  for (const record of records) {
    for (const round of rounds) {
      const timestamp = parseTimestamp(getField(record, round.time));
      if (!timestamp || dateKey(timestamp, timezone) !== targetDate) continue;
      const result = getField(record, round.result);
      if (TERMINAL_RESULTS.has(result)) continue;
      interviews.push({
        timestamp,
        round: round.label,
        candidate: getField(record, FIELD_SPECS.candidate) || "未填写候选人",
        role: getField(record, FIELD_SPECS.role) || "未填写岗位",
        interviewer: getField(record, round.interviewer) || "⚠️ 未填写",
      });
    }
  }

  return interviews.sort((a, b) => a.timestamp - b.timestamp || a.candidate.localeCompare(b.candidate, "zh-CN"));
}

function collectSchedulingActions(records) {
  const actions = [];
  for (const record of records) {
    const candidate = getField(record, FIELD_SPECS.candidate) || "未填写候选人";
    const role = getField(record, FIELD_SPECS.role) || "未填写岗位";
    const r1Time = parseTimestamp(getField(record, FIELD_SPECS.r1Time));
    const r1Result = getField(record, FIELD_SPECS.r1Result);
    const r2Time = parseTimestamp(getField(record, FIELD_SPECS.r2Time));
    const r2Result = getField(record, FIELD_SPECS.r2Result);

    if (!r1Time && !r1Result && !r2Time && !r2Result) {
      actions.push({ candidate, role, stage: 1, text: "初筛通过，待安排一面" });
    } else if (r1Result === "通过" && !r2Time && !r2Result) {
      actions.push({ candidate, role, stage: 2, text: "一面通过，待安排二面" });
    }
  }
  return actions.sort((a, b) => a.stage - b.stage || a.candidate.localeCompare(b.candidate, "zh-CN"));
}

function formatReminder(interviews, actions, targetDate, timezone) {
  const lines = [`📅 面试事项提醒｜${displayDate(targetDate)}`];
  if (!interviews.length && !actions.length) return `${lines[0]}\n今日无已安排面试，也无待安排事项。`;

  if (interviews.length) {
    lines.push("", `【今日面试｜${interviews.length}场】`);
    interviews.forEach((item) => {
      lines.push(`• ${timeLabel(item.timestamp, timezone)}｜${item.round}｜${item.candidate}（${item.role}）`);
      lines.push(`  面试官：${item.interviewer}`);
    });
  } else {
    lines.push("", "【今日面试】无已安排面试");
  }

  if (actions.length) {
    lines.push("", `【待安排面试｜${actions.length}人】`);
    actions.forEach((item) => {
      lines.push(`• ${item.candidate}（${item.role}）｜${item.text}`);
    });
  }
  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) throw new Error("--date 必须为 YYYY-MM-DD");
  const raw = await readInput(opts);
  const payload = JSON.parse(raw);
  const records = findRecords(payload);
  const targetDate = opts.date || todayKey(opts.timezone);
  process.stdout.write(`${formatReminder(
    collectInterviews(records, targetDate, opts.timezone),
    collectSchedulingActions(records),
    targetDate,
    opts.timezone,
  )}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`面试提醒生成失败：${error.message}`);
    process.exit(1);
  });
}

module.exports = { collectInterviews, collectSchedulingActions, dateKey, findRecords, formatReminder, getField, parseTimestamp };
