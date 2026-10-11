var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WeekPilotPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// model.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = { plannerFolder: "WeekPilot/Weeks", defaultWeekStart: 1 };
var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
var parseDate = (v) => /* @__PURE__ */ new Date(`${v}T12:00:00`);
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(v, n) {
  const d = typeof v === "string" ? parseDate(v) : new Date(v);
  d.setDate(d.getDate() + n);
  return d;
}
function formatRange(a, b) {
  return `${parseDate(a).toLocaleDateString(void 0, { day: "numeric", month: "short" })} \u2014 ${parseDate(b).toLocaleDateString(void 0, { day: "numeric", month: "short" })}`;
}
function monthLabel(k) {
  return parseDate(`${k}-01`).toLocaleDateString(void 0, { month: "long", year: "numeric" });
}
function buildMonthWeeks(month, start) {
  const [y, m] = month.split("-").map(Number), first = new Date(y, m - 1, 1, 12), last = new Date(y, m, 0, 12);
  let cur = addDays(first, -((first.getDay() - start + 7) % 7));
  const out = [];
  while (cur <= last) {
    out.push({ start: dateKey(cur), end: dateKey(addDays(cur, 6)) });
    cur = addDays(cur, 7);
  }
  return out;
}
function encode(v) {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary);
}
function decode(v) {
  try {
    const b = atob(v);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
  } catch (e) {
    return null;
  }
}
function yaml(raw) {
  if (!raw) return "";
  const v = raw.trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch (e) {
      return v.replace(/^"|"$/g, "");
    }
  }
  return v;
}
var blankReview = () => ({ wins: "", friction: "", lesson: "", score: 0, closed: false });
var WeekPilotStore = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.writing = /* @__PURE__ */ new Set();
  }
  updateSettings(s) {
    this.settings = s;
  }
  isPlannerPath(path) {
    const root = (0, import_obsidian.normalizePath)(this.settings.plannerFolder.split("/")[0]);
    return path === root || path.startsWith(`${root}/`);
  }
  isInternalWrite(path) {
    if (!this.writing.has(path)) return false;
    this.writing.delete(path);
    return true;
  }
  async loadWeeks() {
    const folder = (0, import_obsidian.normalizePath)(this.settings.plannerFolder), files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(`${folder}/`));
    const weeks = (await Promise.all(files.map((f) => this.parseWeek(f)))).filter((w) => !!w);
    return weeks.sort((a, b) => a.start.localeCompare(b.start) || a.order - b.order);
  }
  async parseWeek(file) {
    const source = await this.app.vault.read(file), fm = source.match(/^---\n([\s\S]*?)\n---/);
    if (!fm || !/^weekpilot:\s*true\s*$/m.test(fm[1])) return null;
    const get = (k) => {
      var _a;
      return (_a = fm[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m"))) == null ? void 0 : _a[1];
    }, id = yaml(get("id")), start = yaml(get("start"));
    if (!id || !start) return null;
    const state = decode(yaml(get("state"))) || {}, tasks = [];
    const pattern = /^- \[([ xX])\] .*? <!-- weekpilot:([A-Za-z0-9+/=]+) -->$/gm;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const meta = decode(match[2]);
      if (!(meta == null ? void 0 : meta.id) || !meta.title) continue;
      const completed = match[1].toLowerCase() === "x";
      tasks.push({ ...meta, completed, stage: completed ? "done" : meta.stage || "next", projectId: meta.projectId || void 0 });
    }
    return { id, title: yaml(get("title")) || "Untitled week", start, end: yaml(get("end")) || dateKey(addDays(start, 6)), order: Number(yaml(get("order")) || 0), monthKey: yaml(get("monthKey")) || void 0, tasks: tasks.sort((a, b) => a.order - b.order), outcomes: state.outcomes || [], review: { ...blankReview(), ...state.review || {} }, filePath: file.path };
  }
  async saveWeek(w) {
    await this.ensureFolder((0, import_obsidian.normalizePath)(this.settings.plannerFolder));
    if (!w.filePath) w.filePath = (0, import_obsidian.normalizePath)(`${this.settings.plannerFolder}/${w.start}-${w.id.slice(0, 8)}.md`);
    w.tasks.forEach((t, i) => t.order = i);
    const source = this.serialize(w);
    this.writing.add(w.filePath);
    const file = this.app.vault.getAbstractFileByPath(w.filePath);
    if (file instanceof import_obsidian.TFile) await this.app.vault.modify(file, source);
    else await this.app.vault.create(w.filePath, source);
  }
  serialize(w) {
    const state = encode({ outcomes: w.outcomes, review: w.review });
    const tasks = w.tasks.map((t) => {
      const meta = encode({ id: t.id, title: t.title, description: t.description, priority: t.priority, stage: t.completed ? "done" : t.stage, projectId: t.projectId, order: t.order, createdAt: t.createdAt });
      return `- [${t.completed ? "x" : " "}] ${t.title.replace(/[\r\n]+/g, " ").replace(/<!--/g, "\u2039")} <!-- weekpilot:${meta} -->`;
    });
    return ["---", "weekpilot: true", "version: 2", `id: ${JSON.stringify(w.id)}`, `title: ${JSON.stringify(w.title)}`, `start: ${w.start}`, `end: ${w.end}`, `order: ${w.order}`, w.monthKey ? `monthKey: ${w.monthKey}` : "", `state: ${state}`, "---", "", `# ${w.title}`, "", `> ${formatRange(w.start, w.end)}`, "", "## Outcomes", "", ...w.outcomes.length ? w.outcomes.map((o) => `- [${o.done ? "x" : " "}] ${o.title}`) : ["_No outcomes yet._"], "", "## Actions", "", ...tasks, ""].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
  }
  async deleteWeek(w) {
    if (!w.filePath) return;
    const f = this.app.vault.getAbstractFileByPath(w.filePath);
    if (f instanceof import_obsidian.TFile) await this.app.vault.trash(f, false);
  }
  async loadSystem() {
    const p = (0, import_obsidian.normalizePath)(`${this.settings.plannerFolder.split("/")[0]}/system.json`);
    try {
      return JSON.parse(await this.app.vault.adapter.read(p));
    } catch (e) {
      return { projects: [] };
    }
  }
  async saveSystem(d) {
    const root = (0, import_obsidian.normalizePath)(this.settings.plannerFolder.split("/")[0]);
    await this.ensureFolder(root);
    const p = (0, import_obsidian.normalizePath)(`${root}/system.json`);
    this.writing.add(p);
    await this.app.vault.adapter.write(p, JSON.stringify(d, null, 2));
  }
  async ensureFolder(folder) {
    let current = "";
    for (const part of folder.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
};

// main.ts
var VIEW = "weekpilot-view";
var colors = ["#7c9cff", "#a78bfa", "#2dd4bf", "#fb923c", "#f472b6", "#84cc16"];
var WeekModal = class extends import_obsidian2.Modal {
  constructor(app, existing, submit) {
    super(app);
    this.existing = existing;
    this.submit = submit;
    this.title = "";
    this.start = dateKey(/* @__PURE__ */ new Date());
    if (existing) {
      this.title = existing.title;
      this.start = existing.start;
    }
  }
  onOpen() {
    this.setTitle(this.existing ? "Edit week" : "Create a week");
    this.contentEl.addClass("wf-modal");
    new import_obsidian2.Setting(this.contentEl).setName("Week title").setDesc("Optional theme for the week.").addText((t) => t.setValue(this.title).setPlaceholder("Focus week").onChange((v) => this.title = v));
    new import_obsidian2.Setting(this.contentEl).setName("Starts on").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(this.start).onChange((v) => this.start = v);
    });
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText(this.existing ? "Save" : "Create week").setCta().onClick(() => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.start)) {
        new import_obsidian2.Notice("Choose a valid date.");
        return;
      }
      this.submit(this.title.trim(), this.start);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MonthModal = class extends import_obsidian2.Modal {
  constructor(app, start, submit) {
    super(app);
    this.submit = submit;
    this.month = dateKey(/* @__PURE__ */ new Date()).slice(0, 7);
    this.start = start;
  }
  onOpen() {
    this.setTitle("Build a month map");
    this.contentEl.addClass("wf-modal");
    new import_obsidian2.Setting(this.contentEl).setName("Month").addText((t) => {
      t.inputEl.type = "month";
      t.setValue(this.month).onChange((v) => {
        this.month = v;
        this.draw();
      });
    });
    new import_obsidian2.Setting(this.contentEl).setName("Week starts on").addDropdown((d) => {
      WEEKDAYS.forEach((x, i) => d.addOption(String(i), x));
      d.setValue(String(this.start)).onChange((v) => {
        this.start = Number(v);
        this.draw();
      });
    });
    this.preview = this.contentEl.createDiv({ cls: "wf-month-preview" });
    this.draw();
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText("Create month map").setCta().onClick(() => {
      this.submit(this.month, this.start);
      this.close();
    }));
  }
  draw() {
    if (!this.preview) return;
    this.preview.empty();
    const w = buildMonthWeeks(this.month, this.start);
    this.preview.createEl("strong", { text: `${w.length} weekly checkpoints` });
    w.forEach((x, i) => this.preview.createDiv({ text: `0${i + 1}  ${formatRange(x.start, x.end)}` }));
  }
};
var ProjectModal = class extends import_obsidian2.Modal {
  constructor(app, old, submit) {
    super(app);
    this.old = old;
    this.submit = submit;
    this.name = "";
    this.area = "";
    this.goal = "";
    this.status = "active";
    if (old) {
      this.name = old.name;
      this.area = old.area;
      this.goal = old.goal;
      this.status = old.status;
    }
  }
  onOpen() {
    this.setTitle(this.old ? "Edit project" : "New project");
    this.contentEl.addClass("wf-modal");
    new import_obsidian2.Setting(this.contentEl).setName("Project name").addText((t) => t.setValue(this.name).setPlaceholder("OTP Service").onChange((v) => this.name = v));
    new import_obsidian2.Setting(this.contentEl).setName("Area").setDesc("Work, Learning, Personal\u2026").addText((t) => t.setValue(this.area).setPlaceholder("Learning").onChange((v) => this.area = v));
    new import_obsidian2.Setting(this.contentEl).setName("Desired result").addTextArea((t) => t.setValue(this.goal).setPlaceholder("What does success look like?").onChange((v) => this.goal = v));
    new import_obsidian2.Setting(this.contentEl).setName("Status").addDropdown((d) => d.addOptions({ active: "Active", paused: "Paused", complete: "Complete" }).setValue(this.status).onChange((v) => this.status = v));
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText(this.old ? "Save project" : "Create project").setCta().onClick(() => {
      if (!this.name.trim()) {
        new import_obsidian2.Notice("Name the project.");
        return;
      }
      this.submit({ name: this.name.trim(), area: this.area.trim() || "General", goal: this.goal.trim(), status: this.status });
      this.close();
    }));
  }
};
var OutcomeModal = class extends import_obsidian2.Modal {
  constructor(app, projects, submit) {
    super(app);
    this.projects = projects;
    this.submit = submit;
    this.title = "";
    this.project = "";
  }
  onOpen() {
    this.setTitle("Define an outcome");
    this.contentEl.addClass("wf-modal");
    this.contentEl.createEl("p", { cls: "wf-modal-note", text: "Describe what will be true by the end of the week \u2014 not an activity." });
    new import_obsidian2.Setting(this.contentEl).setName("Outcome").addTextArea((t) => t.setPlaceholder("Concurrency concepts are clear and applied in code").onChange((v) => this.title = v));
    new import_obsidian2.Setting(this.contentEl).setName("Project").addDropdown((d) => {
      d.addOption("", "No project");
      this.projects.filter((p) => p.status === "active").forEach((p) => d.addOption(p.id, p.name));
      d.onChange((v) => this.project = v);
    });
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText("Add outcome").setCta().onClick(() => {
      if (!this.title.trim()) {
        new import_obsidian2.Notice("Describe the outcome.");
        return;
      }
      this.submit(this.title.trim(), this.project || void 0);
      this.close();
    }));
  }
};
var ActionModal = class extends import_obsidian2.Modal {
  constructor(app, projects, old, submit) {
    super(app);
    this.projects = projects;
    this.old = old;
    this.submit = submit;
    this.title = (old == null ? void 0 : old.title) || "";
    this.description = (old == null ? void 0 : old.description) || "";
    this.priority = (old == null ? void 0 : old.priority) || "medium";
    this.stage = (old == null ? void 0 : old.stage) || "next";
    this.project = (old == null ? void 0 : old.projectId) || "";
  }
  onOpen() {
    this.setTitle(this.old ? "Edit action" : "Add an action");
    this.contentEl.addClass("wf-modal");
    new import_obsidian2.Setting(this.contentEl).setName("Action").addText((t) => {
      t.setValue(this.title).setPlaceholder("Implement request endpoint").onChange((v) => this.title = v);
      window.setTimeout(() => t.inputEl.focus(), 50);
    });
    new import_obsidian2.Setting(this.contentEl).setName("Definition of done").addTextArea((t) => t.setValue(this.description).setPlaceholder("Optional context").onChange((v) => this.description = v));
    new import_obsidian2.Setting(this.contentEl).setName("Project").addDropdown((d) => {
      d.addOption("", "No project");
      this.projects.filter((p) => p.status === "active").forEach((p) => d.addOption(p.id, p.name));
      d.setValue(this.project).onChange((v) => this.project = v);
    });
    new import_obsidian2.Setting(this.contentEl).setName("Lane").addDropdown((d) => d.addOptions({ now: "Now", next: "Next", done: "Done" }).setValue(this.stage).onChange((v) => this.stage = v));
    new import_obsidian2.Setting(this.contentEl).setName("Priority").addDropdown((d) => d.addOptions({ high: "High", medium: "Medium", low: "Low" }).setValue(this.priority).onChange((v) => this.priority = v));
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText(this.old ? "Save action" : "Add action").setCta().onClick(() => {
      if (!this.title.trim()) {
        new import_obsidian2.Notice("Name the action.");
        return;
      }
      this.submit({ title: this.title.trim(), description: this.description.trim(), priority: this.priority, stage: this.stage, projectId: this.project || void 0 });
      this.close();
    }));
  }
};
var ReviewModal = class extends import_obsidian2.Modal {
  constructor(app, week, submit) {
    super(app);
    this.week = week;
    this.submit = submit;
    this.wins = week.review.wins;
    this.friction = week.review.friction;
    this.lesson = week.review.lesson;
    this.score = week.review.score || 7;
  }
  onOpen() {
    this.setTitle(`Review \xB7 ${this.week.title}`);
    this.contentEl.addClass("wf-modal");
    new import_obsidian2.Setting(this.contentEl).setName("Wins").addTextArea((t) => t.setValue(this.wins).setPlaceholder("What moved forward?").onChange((v) => this.wins = v));
    new import_obsidian2.Setting(this.contentEl).setName("Friction").addTextArea((t) => t.setValue(this.friction).setPlaceholder("What slowed you down?").onChange((v) => this.friction = v));
    new import_obsidian2.Setting(this.contentEl).setName("Lesson").addTextArea((t) => t.setValue(this.lesson).setPlaceholder("What changes next week?").onChange((v) => this.lesson = v));
    new import_obsidian2.Setting(this.contentEl).setName("Week score").addSlider((s) => s.setLimits(1, 10, 1).setValue(this.score).setDynamicTooltip().onChange((v) => this.score = v));
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText("Close the week").setCta().onClick(() => {
      this.submit({ wins: this.wins.trim(), friction: this.friction.trim(), lesson: this.lesson.trim(), score: this.score });
      this.close();
    }));
  }
};
var WeekPilotView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.weeks = [];
    this.system = { projects: [] };
    this.screen = "focus";
    this.selected = "";
    this.mapMonth = dateKey(/* @__PURE__ */ new Date()).slice(0, 7);
    this.focusMode = false;
    this.drag = "";
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "WeekPilot OS";
  }
  getIcon() {
    return "orbit";
  }
  async onOpen() {
    await this.refresh();
  }
  async refresh() {
    var _a, _b;
    [this.weeks, this.system] = await Promise.all([this.plugin.store.loadWeeks(), this.plugin.store.loadSystem()]);
    if (!this.selected) this.selected = ((_a = this.current()) == null ? void 0 : _a.id) || ((_b = this.weeks[this.weeks.length - 1]) == null ? void 0 : _b.id) || "";
    this.render();
  }
  current() {
    const t = dateKey(/* @__PURE__ */ new Date());
    return this.weeks.find((w) => w.start <= t && w.end >= t);
  }
  week() {
    return this.weeks.find((w) => w.id === this.selected) || this.current() || this.weeks[this.weeks.length - 1];
  }
  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("wf-view");
    root.toggleClass("is-focus-mode", this.focusMode);
    const shell = root.createDiv({ cls: "wf-shell" });
    this.topbar(shell);
    if (!this.weeks.length) {
      this.empty(shell);
      return;
    }
    if (this.screen === "focus") this.focus(shell);
    if (this.screen === "map") this.map(shell);
    if (this.screen === "projects") this.projects(shell);
    if (this.screen === "review") this.review(shell);
  }
  topbar(shell) {
    const bar = shell.createDiv({ cls: "wf-topbar" }), brand = bar.createDiv({ cls: "wf-brand" }), mark = brand.createDiv({ cls: "wf-brand-mark" });
    (0, import_obsidian2.setIcon)(mark, "orbit");
    const txt = brand.createDiv();
    txt.createEl("strong", { text: "WeekPilot" });
    txt.createSpan({ text: "Weekly operating system" });
    const nav = bar.createDiv({ cls: "wf-nav" });
    [["focus", "crosshair", "Focus"], ["map", "map", "Month map"], ["projects", "blocks", "Projects"], ["review", "bar-chart-3", "Review"]].forEach(([id, icon, label]) => {
      const b = nav.createEl("button", { cls: id === this.screen ? "is-active" : "" });
      (0, import_obsidian2.setIcon)(b.createSpan(), icon);
      b.createSpan({ text: label });
      b.onclick = () => {
        this.screen = id;
        this.focusMode = false;
        this.render();
      };
    });
    const add = bar.createEl("button", { cls: "wf-top-action" });
    (0, import_obsidian2.setIcon)(add, "plus");
    add.onclick = (e) => this.globalMenu(e);
  }
  empty(shell) {
    const z = shell.createDiv({ cls: "wf-zero" });
    (0, import_obsidian2.setIcon)(z.createDiv({ cls: "wf-zero-mark" }), "sparkles");
    z.createEl("h1", { text: "Build a week around outcomes" });
    z.createEl("p", { text: "Start with one week, or generate a month map. Actions support projects and measurable outcomes." });
    const r = z.createDiv({ cls: "wf-zero-actions" });
    this.btn(r, "plus", "Create week", () => this.openWeek());
    this.btn(r, "calendar-plus", "Build month", () => this.openMonth(), true);
  }
  focus(shell) {
    const w = this.week();
    if (!w) return;
    const page = shell.createDiv({ cls: "wf-page" }), head = page.createDiv({ cls: "wf-page-head" }), copy = head.createDiv();
    copy.createDiv({ cls: "wf-kicker", text: `${w.title} \xB7 ${formatRange(w.start, w.end)}` });
    copy.createEl("h1", { text: this.focusMode ? "Deep focus" : "This week\u2019s command center" });
    copy.createEl("p", { text: "Decide what must change, then execute only the work that supports it." });
    const actions = head.createDiv({ cls: "wf-head-actions" });
    this.btn(actions, "plus", "Outcome", () => this.openOutcome(w));
    this.btn(actions, "list-plus", "Action", () => this.openAction(w));
    this.btn(actions, this.focusMode ? "minimize-2" : "maximize-2", this.focusMode ? "Exit focus" : "Focus mode", () => {
      this.focusMode = !this.focusMode;
      this.render();
    }, true);
    const layout = page.createDiv({ cls: "wf-command-grid" }), main = layout.createDiv({ cls: "wf-main-stack" });
    this.outcomes(main, w);
    this.execution(main, w);
    const side = layout.createDiv({ cls: "wf-side-stack" });
    this.momentum(side, w);
    this.pulse(side, w);
    this.carryover(side, w);
  }
  outcomes(parent, w) {
    const card = this.panel(parent, "Weekly outcomes", "The 1\u20133 changes that make this week successful", "target"), body = card.createDiv({ cls: "wf-outcome-list" });
    if (!w.outcomes.length) body.createDiv({ cls: "wf-inline-empty", text: "No outcomes defined. Tasks without outcomes become noise." });
    w.outcomes.forEach((o, i) => {
      const row = body.createDiv({ cls: `wf-outcome ${o.done ? "is-done" : ""}` }), check = row.createEl("button", { cls: "wf-outcome-check" });
      (0, import_obsidian2.setIcon)(check, o.done ? "check" : "circle");
      check.onclick = async () => {
        o.done = !o.done;
        await this.plugin.store.saveWeek(w);
        this.render();
      };
      row.createSpan({ cls: "wf-outcome-number", text: String(i + 1).padStart(2, "0") });
      const c = row.createDiv({ cls: "wf-outcome-copy" });
      c.createEl("strong", { text: o.title, attr: { dir: "auto" } });
      const p = this.project(o.projectId);
      if (p) c.createSpan({ text: p.name });
      const del = row.createEl("button", { cls: "wf-icon" });
      (0, import_obsidian2.setIcon)(del, "x");
      del.onclick = async () => {
        w.outcomes = w.outcomes.filter((x) => x.id !== o.id);
        await this.plugin.store.saveWeek(w);
        this.render();
      };
    });
    if (w.outcomes.length < 3) {
      const add = body.createEl("button", { cls: "wf-add-row" });
      (0, import_obsidian2.setIcon)(add.createSpan(), "plus");
      add.createSpan({ text: "Define outcome" });
      add.onclick = () => this.openOutcome(w);
    }
  }
  execution(parent, w) {
    const card = this.panel(parent, "Execution lanes", "Move actions as your attention changes", "workflow"), board = card.createDiv({ cls: "wf-board" });
    [["now", "Now", "Do these first"], ["next", "Next", "Ready when capacity opens"], ["done", "Done", "Evidence of progress"]].forEach(([stage, label, hint]) => {
      const lane = board.createDiv({ cls: `wf-lane is-${stage}` });
      lane.ondragover = (e) => {
        e.preventDefault();
        lane.addClass("is-over");
      };
      lane.ondragleave = () => lane.removeClass("is-over");
      lane.ondrop = async (e) => {
        e.preventDefault();
        lane.removeClass("is-over");
        const t = w.tasks.find((x) => x.id === this.drag);
        if (t) {
          t.stage = stage;
          t.completed = stage === "done";
          await this.plugin.store.saveWeek(w);
          this.render();
        }
      };
      const h = lane.createDiv({ cls: "wf-lane-head" }), hc = h.createDiv();
      hc.createEl("strong", { text: label });
      hc.createSpan({ text: hint });
      h.createSpan({ cls: "wf-count", text: String(w.tasks.filter((t) => (t.completed ? "done" : t.stage) === stage).length) });
      const list = lane.createDiv({ cls: "wf-action-list" });
      w.tasks.filter((t) => (t.completed ? "done" : t.stage) === stage).forEach((t) => this.actionCard(list, w, t));
      if (!list.childElementCount) list.createDiv({ cls: "wf-lane-empty", text: stage === "now" ? "Choose intentionally" : "Drop actions here" });
    });
  }
  actionCard(parent, w, t) {
    const row = parent.createDiv({ cls: "wf-action-card", attr: { draggable: "true" } });
    row.ondragstart = () => {
      this.drag = t.id;
      row.addClass("is-dragging");
    };
    row.ondragend = () => {
      this.drag = "";
      row.removeClass("is-dragging");
    };
    const top = row.createDiv({ cls: "wf-action-top" });
    top.createSpan({ cls: `wf-dot is-${t.priority}` });
    top.createEl("strong", { text: t.title, attr: { dir: "auto" } });
    const more = top.createEl("button", { cls: "wf-icon" });
    (0, import_obsidian2.setIcon)(more, "ellipsis");
    more.onclick = (e) => this.actionMenu(e, w, t);
    const p = this.project(t.projectId);
    if (p) {
      const tag = row.createDiv({ cls: "wf-project-tag" }), dot = tag.createSpan();
      dot.style.background = p.color;
      tag.createSpan({ text: p.name });
    }
    if (t.description) row.createDiv({ cls: "wf-action-desc", text: t.description, attr: { dir: "auto" } });
    const cycle = row.createEl("button", { cls: "wf-stage-cycle", text: t.completed ? "done" : t.stage });
    cycle.onclick = async () => {
      const next = { now: "next", next: "done", done: "now" };
      t.stage = next[t.completed ? "done" : t.stage];
      t.completed = t.stage === "done";
      await this.plugin.store.saveWeek(w);
      this.render();
    };
  }
  momentum(parent, w) {
    const card = this.panel(parent, "Momentum", "Live signal, not a performance grade", "gauge"), done = w.tasks.filter((t) => t.completed).length, od = w.outcomes.filter((o) => o.done).length, score = Math.round(((w.tasks.length ? done / w.tasks.length : 0) * 0.45 + (w.outcomes.length ? od / w.outcomes.length : 0) * 0.55) * 100), ring = card.createDiv({ cls: "wf-ring" });
    ring.style.setProperty("--score", `${score * 3.6}deg`);
    const inside = ring.createDiv();
    inside.createEl("strong", { text: `${score}%` });
    inside.createSpan({ text: "momentum" });
    const stats = card.createDiv({ cls: "wf-mini-stats" });
    this.metric(stats, String(od), `of ${w.outcomes.length} outcomes`);
    this.metric(stats, String(done), `of ${w.tasks.length} actions`);
  }
  pulse(parent, w) {
    const card = this.panel(parent, "Project pulse", "Where this week creates movement", "activity"), ids = new Set([...w.tasks.map((t) => t.projectId), ...w.outcomes.map((o) => o.projectId)].filter(Boolean)), projects = this.system.projects.filter((p) => ids.has(p.id));
    if (!projects.length) card.createDiv({ cls: "wf-inline-empty", text: "Link actions to projects to see their pulse." });
    projects.forEach((p) => {
      const all = this.allTasks(p.id), done = all.filter((t) => t.completed).length, row = card.createDiv({ cls: "wf-pulse-row" }), name = row.createDiv(), dot = name.createSpan();
      dot.style.background = p.color;
      name.createSpan({ text: p.name });
      row.createSpan({ text: all.length ? `${Math.round(done / all.length * 100)}%` : "New" });
    });
  }
  carryover(parent, w) {
    const card = this.panel(parent, "Decision queue", "Nothing rolls forward without a decision", "git-compare"), old = this.weeks.filter((x) => x.end < w.start).flatMap((x) => x.tasks.filter((t) => !t.completed).map((t) => ({ w: x, t }))).slice(-5);
    if (!old.length) card.createDiv({ cls: "wf-inline-empty", text: "No unresolved work from earlier weeks." });
    old.forEach(({ w: source, t }) => {
      const row = card.createDiv({ cls: "wf-carry" }), copy = row.createDiv();
      copy.createEl("strong", { text: t.title, attr: { dir: "auto" } });
      copy.createSpan({ text: source.title });
      const c = row.createDiv(), move = c.createEl("button");
      (0, import_obsidian2.setIcon)(move, "arrow-right");
      move.onclick = async () => {
        source.tasks = source.tasks.filter((x) => x.id !== t.id);
        t.stage = "next";
        w.tasks.push(t);
        await this.plugin.store.saveWeek(source);
        await this.plugin.store.saveWeek(w);
        this.render();
      };
      const drop = c.createEl("button");
      (0, import_obsidian2.setIcon)(drop, "trash-2");
      drop.onclick = async () => {
        source.tasks = source.tasks.filter((x) => x.id !== t.id);
        await this.plugin.store.saveWeek(source);
        this.render();
      };
    });
  }
  map(shell) {
    const page = shell.createDiv({ cls: "wf-page" }), head = page.createDiv({ cls: "wf-page-head" }), copy = head.createDiv();
    copy.createDiv({ cls: "wf-kicker", text: "MONTH MAP" });
    copy.createEl("h1", { text: monthLabel(this.mapMonth) });
    copy.createEl("p", { text: "A strategic view of outcomes, project movement, and weekly load." });
    const actions = head.createDiv({ cls: "wf-head-actions" });
    this.btn(actions, "chevron-left", "", () => this.shiftMonth(-1));
    this.btn(actions, "chevron-right", "", () => this.shiftMonth(1));
    this.btn(actions, "calendar-plus", "Build month", () => this.openMonth(), true);
    const weeks = this.weeks.filter((w) => (w.monthKey || w.start.slice(0, 7)) === this.mapMonth);
    if (!weeks.length) {
      page.createDiv({ cls: "wf-map-empty", text: "No map exists for this month yet." });
      return;
    }
    const track = page.createDiv({ cls: "wf-map-track" });
    weeks.forEach((w, i) => {
      var _a;
      const col = track.createDiv({ cls: `wf-map-week ${((_a = this.current()) == null ? void 0 : _a.id) === w.id ? "is-current" : ""}` }), h = col.createDiv({ cls: "wf-map-week-head" });
      h.createSpan({ text: `W${String(i + 1).padStart(2, "0")}` });
      h.createEl("strong", { text: formatRange(w.start, w.end) });
      const open = w.tasks.filter((t) => !t.completed).length;
      h.createSpan({ cls: `wf-load ${open > 7 ? "is-heavy" : open > 4 ? "is-medium" : ""}`, text: `${open} open` });
      const outcomes = col.createDiv({ cls: "wf-map-outcomes" });
      if (!w.outcomes.length) outcomes.createDiv({ cls: "wf-map-placeholder", text: "No outcome defined" });
      w.outcomes.forEach((o) => {
        const r = outcomes.createDiv({ cls: o.done ? "is-done" : "" });
        (0, import_obsidian2.setIcon)(r.createSpan(), o.done ? "check-circle-2" : "circle");
        r.createSpan({ text: o.title, attr: { dir: "auto" } });
      });
      const foot = col.createDiv({ cls: "wf-map-foot" });
      foot.createSpan({ text: `${w.tasks.filter((t) => t.completed).length}/${w.tasks.length} actions` });
      const b = foot.createEl("button", { text: "Open" });
      b.onclick = () => {
        this.selected = w.id;
        this.screen = "focus";
        this.render();
      };
    });
  }
  projects(shell) {
    const page = shell.createDiv({ cls: "wf-page" }), head = page.createDiv({ cls: "wf-page-head" }), copy = head.createDiv();
    copy.createDiv({ cls: "wf-kicker", text: "PROJECT PORTFOLIO" });
    copy.createEl("h1", { text: "Projects that need movement" });
    copy.createEl("p", { text: "Progress is calculated from actions across every week." });
    this.btn(head, "plus", "New project", () => this.openProject(), true);
    const grid = page.createDiv({ cls: "wf-project-grid" }), active = this.system.projects.filter((p) => p.status !== "complete");
    if (!active.length) grid.createDiv({ cls: "wf-map-empty", text: "Create a project, then link outcomes and actions to it." });
    active.forEach((p) => {
      const card = grid.createDiv({ cls: "wf-project-card" }), stripe = card.createDiv({ cls: "wf-project-stripe" });
      stripe.style.background = p.color;
      const top = card.createDiv({ cls: "wf-project-head" }), name = top.createDiv();
      name.createSpan({ cls: "wf-area", text: p.area });
      name.createEl("h2", { text: p.name });
      const more = top.createEl("button", { cls: "wf-icon" });
      (0, import_obsidian2.setIcon)(more, "ellipsis");
      more.onclick = (e) => this.projectMenu(e, p);
      if (p.goal) card.createEl("p", { text: p.goal });
      const tasks = this.allTasks(p.id), done = tasks.filter((t) => t.completed).length, progress = tasks.length ? Math.round(done / tasks.length * 100) : 0, line = card.createDiv({ cls: "wf-project-progress-line" });
      line.createEl("strong", { text: `${progress}%` });
      line.createSpan({ text: `${done} of ${tasks.length} actions complete` });
      const tr = card.createDiv({ cls: "wf-project-track" }), bar = tr.createDiv();
      bar.style.width = `${progress}%`;
      const touched = new Set(this.weeks.filter((w) => w.tasks.some((t) => t.projectId === p.id) || w.outcomes.some((o) => o.projectId === p.id)).map((w) => w.id)).size, stats = card.createDiv({ cls: "wf-project-stats" });
      this.metric(stats, String(touched), "weeks touched");
      this.metric(stats, String(tasks.filter((t) => !t.completed).length), "open actions");
    });
  }
  review(shell) {
    const page = shell.createDiv({ cls: "wf-page" }), head = page.createDiv({ cls: "wf-page-head" }), copy = head.createDiv();
    copy.createDiv({ cls: "wf-kicker", text: "WEEKLY REVIEW" });
    copy.createEl("h1", { text: "Turn activity into insight" });
    copy.createEl("p", { text: "Close loops, choose what moves forward, and improve the next week." });
    const weeks = [...this.weeks].reverse(), w = this.week(), select = head.createEl("select", { cls: "wf-week-select" });
    weeks.forEach((x) => select.createEl("option", { text: `${x.title} \xB7 ${formatRange(x.start, x.end)}`, value: x.id }));
    if (w) select.value = w.id;
    select.onchange = () => {
      this.selected = select.value;
      this.render();
    };
    if (!w) return;
    const summary = page.createDiv({ cls: "wf-review-grid" }), score = summary.createDiv({ cls: "wf-review-score" });
    score.createSpan({ text: w.review.closed ? "CLOSED WEEK" : "OPEN WEEK" });
    score.createEl("strong", { text: w.review.score ? `${w.review.score}/10` : "\u2014" });
    score.createEl("p", { text: w.review.closed ? "Review saved. Use the lesson in your next plan." : "A week is not finished until loose ends have decisions." });
    this.btn(score, "clipboard-check", "Run review", () => this.openReview(w), true);
    const ins = summary.createDiv({ cls: "wf-review-insights" });
    this.reviewBlock(ins, "Wins", w.review.wins, "What created progress?");
    this.reviewBlock(ins, "Friction", w.review.friction, "What resisted execution?");
    this.reviewBlock(ins, "Lesson", w.review.lesson, "What changes next week?");
    const unresolved = w.tasks.filter((t) => !t.completed), decisions = page.createDiv({ cls: "wf-review-decisions" }), dh = decisions.createDiv({ cls: "wf-section-heading" });
    dh.createEl("h2", { text: "Unresolved decisions" });
    dh.createSpan({ text: `${unresolved.length} actions need a choice` });
    if (!unresolved.length) decisions.createDiv({ cls: "wf-inline-empty", text: "Clean close. Nothing is waiting for a decision." });
    unresolved.forEach((t) => {
      const row = decisions.createDiv({ cls: "wf-decision-row" });
      row.createEl("strong", { text: t.title, attr: { dir: "auto" } });
      const c = row.createDiv(), next = this.weeks.find((x) => x.start > w.start);
      if (next) {
        const move = c.createEl("button", { text: "Move forward" });
        move.onclick = async () => {
          w.tasks = w.tasks.filter((x) => x.id !== t.id);
          next.tasks.push({ ...t, stage: "next" });
          await this.plugin.store.saveWeek(w);
          await this.plugin.store.saveWeek(next);
          this.render();
        };
      }
      const done = c.createEl("button", { text: "Mark done" });
      done.onclick = async () => {
        t.completed = true;
        t.stage = "done";
        await this.plugin.store.saveWeek(w);
        this.render();
      };
      const drop = c.createEl("button", { text: "Drop" });
      drop.onclick = async () => {
        w.tasks = w.tasks.filter((x) => x.id !== t.id);
        await this.plugin.store.saveWeek(w);
        this.render();
      };
    });
  }
  panel(p, title, sub, icon) {
    const card = p.createDiv({ cls: "wf-panel" }), h = card.createDiv({ cls: "wf-panel-head" }), mark = h.createDiv({ cls: "wf-panel-icon" });
    (0, import_obsidian2.setIcon)(mark, icon);
    const c = h.createDiv();
    c.createEl("h2", { text: title });
    c.createSpan({ text: sub });
    return card;
  }
  metric(p, v, l) {
    const m = p.createDiv({ cls: "wf-metric" });
    m.createEl("strong", { text: v });
    m.createSpan({ text: l });
  }
  reviewBlock(p, t, v, ph) {
    const b = p.createDiv({ cls: "wf-review-block" });
    b.createSpan({ text: t });
    b.createEl("p", { text: v || ph, cls: v ? "" : "is-placeholder", attr: { dir: "auto" } });
  }
  btn(p, icon, label, fn, primary = false) {
    const b = p.createEl("button", { cls: `wf-button ${primary ? "is-primary" : ""}` });
    (0, import_obsidian2.setIcon)(b.createSpan(), icon);
    if (label) b.createSpan({ text: label });
    b.onclick = fn;
    return b;
  }
  project(id) {
    return this.system.projects.find((p) => p.id === id);
  }
  allTasks(id) {
    return this.weeks.flatMap((w) => w.tasks).filter((t) => t.projectId === id);
  }
  shiftMonth(n) {
    const d = parseDate(`${this.mapMonth}-01`);
    d.setMonth(d.getMonth() + n);
    this.mapMonth = dateKey(d).slice(0, 7);
    this.render();
  }
  globalMenu(e) {
    const m = new import_obsidian2.Menu();
    m.addItem((i) => i.setTitle("Create week").setIcon("calendar-plus").onClick(() => this.openWeek()));
    m.addItem((i) => i.setTitle("Build month map").setIcon("map").onClick(() => this.openMonth()));
    m.addItem((i) => i.setTitle("New project").setIcon("blocks").onClick(() => this.openProject()));
    m.showAtMouseEvent(e);
  }
  openWeek(old = null) {
    new WeekModal(this.app, old, async (title, start) => {
      if (this.weeks.some((w) => w.start === start && w.id !== (old == null ? void 0 : old.id))) {
        new import_obsidian2.Notice("A week already starts on that date.");
        return;
      }
      if (old) {
        old.title = title || `Week of ${parseDate(start).toLocaleDateString(void 0, { day: "numeric", month: "short" })}`;
        old.start = start;
        old.end = dateKey(addDays(start, 6));
        await this.plugin.store.saveWeek(old);
      } else {
        const w = { id: uid(), title: title || `Week of ${parseDate(start).toLocaleDateString(void 0, { day: "numeric", month: "short" })}`, start, end: dateKey(addDays(start, 6)), order: this.weeks.length, tasks: [], outcomes: [], review: { wins: "", friction: "", lesson: "", score: 0, closed: false } };
        await this.plugin.store.saveWeek(w);
        this.selected = w.id;
      }
      await this.refresh();
    }).open();
  }
  openMonth() {
    new MonthModal(this.app, this.plugin.settings.defaultWeekStart, async (month, start) => {
      const ranges = buildMonthWeeks(month, start);
      let made = 0;
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        if (this.weeks.some((w) => w.start === r.start)) continue;
        await this.plugin.store.saveWeek({ id: uid(), title: `Week ${i + 1}`, start: r.start, end: r.end, order: i, monthKey: month, tasks: [], outcomes: [], review: { wins: "", friction: "", lesson: "", score: 0, closed: false } });
        made++;
      }
      this.plugin.settings.defaultWeekStart = start;
      await this.plugin.saveSettings();
      this.mapMonth = month;
      this.screen = "map";
      await this.refresh();
      new import_obsidian2.Notice(`${made} weekly checkpoints created.`);
    }).open();
  }
  openProject(old = null) {
    new ProjectModal(this.app, old, async (v) => {
      if (old) Object.assign(old, v);
      else this.system.projects.push({ id: uid(), ...v, color: colors[this.system.projects.length % colors.length], createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await this.plugin.store.saveSystem(this.system);
      this.render();
    }).open();
  }
  openOutcome(w) {
    if (w.outcomes.length >= 3) {
      new import_obsidian2.Notice("Keep the week focused: maximum three outcomes.");
      return;
    }
    new OutcomeModal(this.app, this.system.projects, async (title, projectId) => {
      w.outcomes.push({ id: uid(), title, projectId, done: false });
      await this.plugin.store.saveWeek(w);
      this.render();
    }).open();
  }
  openAction(w, old = null) {
    new ActionModal(this.app, this.system.projects, old, async (v) => {
      if (old) Object.assign(old, v, { completed: v.stage === "done" });
      else w.tasks.push({ id: uid(), ...v, completed: v.stage === "done", order: w.tasks.length, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await this.plugin.store.saveWeek(w);
      this.render();
    }).open();
  }
  openReview(w) {
    new ReviewModal(this.app, w, async (v) => {
      w.review = { ...v, closed: true };
      await this.plugin.store.saveWeek(w);
      this.render();
    }).open();
  }
  actionMenu(e, w, t) {
    const m = new import_obsidian2.Menu();
    m.addItem((i) => i.setTitle("Edit").setIcon("pencil").onClick(() => this.openAction(w, t)));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Delete").setIcon("trash-2").onClick(async () => {
      w.tasks = w.tasks.filter((x) => x.id !== t.id);
      await this.plugin.store.saveWeek(w);
      this.render();
    }));
    m.showAtMouseEvent(e);
  }
  projectMenu(e, p) {
    const m = new import_obsidian2.Menu();
    m.addItem((i) => i.setTitle("Edit project").setIcon("pencil").onClick(() => this.openProject(p)));
    m.addItem((i) => i.setTitle(p.status === "paused" ? "Resume" : "Pause").setIcon("pause").onClick(async () => {
      p.status = p.status === "paused" ? "active" : "paused";
      await this.plugin.store.saveSystem(this.system);
      this.render();
    }));
    m.addItem((i) => i.setTitle("Mark complete").setIcon("check").onClick(async () => {
      p.status = "complete";
      await this.plugin.store.saveSystem(this.system);
      this.render();
    }));
    m.showAtMouseEvent(e);
  }
};
var SettingsTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [{ name: "Planner folder", desc: "All system data stays inside this vault.", control: { type: "text", key: "plannerFolder", defaultValue: DEFAULT_SETTINGS.plannerFolder } }, { name: "Default week start", control: { type: "dropdown", key: "defaultWeekStart", options: Object.fromEntries(WEEKDAYS.map((day, index) => [String(index), day])) } }];
  }
  getControlValue(key) {
    return key === "defaultWeekStart" ? String(this.plugin.settings.defaultWeekStart) : this.plugin.settings.plannerFolder;
  }
  async setControlValue(key, value) {
    if (key === "plannerFolder") this.plugin.settings.plannerFolder = String(value).trim() || DEFAULT_SETTINGS.plannerFolder;
    if (key === "defaultWeekStart") {
      const start = Number(value);
      if (Number.isInteger(start) && start >= 0 && start < WEEKDAYS.length) this.plugin.settings.defaultWeekStart = start;
    }
    await this.plugin.saveSettings();
  }
  display() {
    this.containerEl.empty();
    new import_obsidian2.Setting(this.containerEl).setName("Planner folder").setDesc("All system data stays inside this vault.").addText((t) => t.setValue(this.plugin.settings.plannerFolder).onChange(async (v) => {
      this.plugin.settings.plannerFolder = v.trim() || DEFAULT_SETTINGS.plannerFolder;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(this.containerEl).setName("Default week start").addDropdown((d) => {
      WEEKDAYS.forEach((x, i) => d.addOption(String(i), x));
      d.setValue(String(this.plugin.settings.defaultWeekStart)).onChange(async (v) => {
        this.plugin.settings.defaultWeekStart = Number(v);
        await this.plugin.saveSettings();
      });
    });
  }
};
var WeekPilotPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    await this.loadSettings();
    this.store = new WeekPilotStore(this.app, this.settings);
    this.registerView(VIEW, (l) => new WeekPilotView(l, this));
    this.addRibbonIcon("orbit", "Open WeekPilot OS", () => void this.activate());
    this.addCommand({ id: "open-operating-system", name: "Open operating system", callback: () => void this.activate() });
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerEvent(this.app.vault.on("modify", (f) => void this.changed(f.path)));
    this.registerEvent(this.app.vault.on("create", (f) => void this.changed(f.path)));
    this.registerEvent(this.app.vault.on("delete", (f) => void this.changed(f.path)));
  }
  async changed(path) {
    if (!this.store.isPlannerPath(path) || this.store.isInternalWrite(path)) return;
    const leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if ((leaf == null ? void 0 : leaf.view) instanceof WeekPilotView) await leaf.view.refresh();
  }
  async activate() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    var _a;
    await this.saveData(this.settings);
    (_a = this.store) == null ? void 0 : _a.updateSettings(this.settings);
  }
};
