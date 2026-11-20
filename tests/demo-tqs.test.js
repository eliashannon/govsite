const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "assets/pages/tqs-support/demo-tqs.js"), "utf8");
const trackerScript = fs.readFileSync(path.join(root, "assets/pages/tqs-support/tqs-support.js"), "utf8");
const page = fs.readFileSync(path.join(root, "tqs-support.html"), "utf8");
const key = "portal.demoTqsProgress:demo%40navy.mil:DEMO-TQS-001";
const role = {division: "Demo: D", branch: "Demo D", role: "Demo D"};
const profile = {email: "demo@navy.mil", firstName: "Demo", lastName: "User"};

async function setup({selectedRole = role, account = profile, values = {}, failWrite = false, actualPage = false} = {}) {
    class Element {
        constructor() {
            this.hidden = true;
            this.events = {};
            this.innerHTML = "";
            this.textContent = "";
            this.value = "";
            this.style = {};
            this.attributes = {};
            this.classList = {add() {}, remove() {}};
        }
        addEventListener(name, callback) { this.events[name] = callback; }
        querySelector() { return {focus() {}}; }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
    }
    const elements = Object.fromEntries([...page.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const search = new Element();
    const track = new Element();
    const localStorage = {
        getItem: name => name === "portal.selectedRole" ? JSON.stringify(selectedRole) : values[name] ?? null,
        setItem: (name, value) => {
            if (failWrite) throw new Error("Storage unavailable");
            values[name] = value;
        }
    };
    const sessionStorage = {getItem: () => JSON.stringify(account)};
    let initialize;
    const document = {
        getElementById: id => elements[id],
        querySelector: selector => selector === "[data-tqs-search]" ? search : track,
        addEventListener: (name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
    };
    const events = {};
    const window = {
        PortalDataReady: Promise.resolve(),
        PortalData: {courses: [{id:"COURSE-1", title:"Existing course", description:"Course", category:"Training",
            requirement:"Required", roles:["Other"]}], publishedTrainingModules:[]},
        addEventListener: (name, callback) => { events[name] = callback; }
    };
    const context = {window, document, localStorage, sessionStorage, console, Intl, Date};
    vm.runInNewContext(script, context);
    if (actualPage) {
        vm.runInNewContext(trackerScript, context);
        await initialize();
    } else if (window.DemoTqs.matches(account, selectedRole)) window.DemoTqs.start(account, selectedRole);
    const check = (number, checked) => {
        const checkbox = {dataset: {demoRequirement: number}, checked};
        elements.demoTqsModules.events.change({target: {closest: () => checkbox}});
        return checkbox;
    };
    return {elements, values, check, search, track, events};
}

test("demo role displays two ordered modules with five numbered requirements each", async () => {
    assert.match(page, /id="demoTqs"/);
    assert.match(page, /src="assets\/pages\/tqs-support\/demo-tqs\.js\?/);
    assert.ok(page.indexOf('id="selectedRoleName"') < page.indexOf('id="progressTitle"'));
    assert.ok(page.indexOf('id="progressTitle"') < page.indexOf('id="demoTqs"'));
    const app = await setup();
    assert.equal(app.elements.demoTqs.hidden, false);
    const html = app.elements.demoTqsModules.innerHTML;
    assert.match(html, /1\.0 ORIENTATION AND COMMUNICATION/);
    assert.match(html, /2\.0 SAFETY AND RECORDS/);
    assert.equal((html.match(/data-demo-requirement=/g) || []).length, 10);
    assert.deepEqual([...html.matchAll(/data-demo-requirement="([^"]+)"/g)].map(match => match[1]),
        ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5"]);
    assert.equal(app.elements.progressSummary.textContent, "0/10 requirements completed");
    assert.equal(app.elements.progressPercent.textContent, "0%");
    assert.equal(app.elements.notStartedCount.textContent, "10");
    assert.doesNotMatch(page, /Role-Required Training|courseTqsRequirements/);
});

test("demo checkoffs persist separately, show the user and date, and can be cleared", async () => {
    const values = {"portal.tqsProgress:existing": "unchanged"};
    const app = await setup({values});
    app.check("1.1.1", true);
    const saved = JSON.parse(values[key]);
    assert.equal(saved["1.1.1"].checkedBy, "Demo User");
    const date = new Intl.DateTimeFormat("en-US", {day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"})
        .format(new Date(saved["1.1.1"].checkedAt));
    assert.match(date, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.ok(app.elements.demoTqsModules.innerHTML.includes(date));
    assert.match(app.elements.progressSummary.textContent, /^1\/10/);
    const reloaded = await setup({values});
    assert.match(reloaded.elements.demoTqsModules.innerHTML, /Demo User/);
    reloaded.check("1.1.1", false);
    assert.deepEqual(JSON.parse(values[key]), {});
    assert.equal(values["portal.tqsProgress:existing"], "unchanged");
});

test("overall progress reflects nine checkoffs and adjusts on unchecking", async () => {
    const app = await setup();
    for (const number of ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "2.1.1", "2.1.2", "2.1.3", "2.1.4"]) {
        app.check(number, true);
    }
    assert.equal(app.elements.progressSummary.textContent, "9/10 requirements completed");
    assert.equal(app.elements.progressPercent.textContent, "90%");
    assert.equal(app.elements.progressBar.style.width, "90%");
    assert.equal(app.elements.notStartedCount.textContent, "1");
    assert.equal(app.track.attributes["aria-valuenow"], "90");
    app.check("2.1.5", true);
    assert.equal(app.elements.progressSummary.textContent, "10/10 requirements completed");
    assert.equal(app.elements.progressPercent.textContent, "100%");
    app.check("2.1.5", false);
    app.check("1.1.1", false);
    assert.equal(app.elements.progressSummary.textContent, "8/10 requirements completed");
    assert.equal(app.elements.progressPercent.textContent, "80%");
});

test("check dates display as month/day/year and search does not alter progress", async () => {
    const values = {[key]: JSON.stringify({"1.1.1": {checkedBy: "Demo User", checkedAt: "2026-11-19T23:00:00.000Z"}})};
    const app = await setup({values});
    assert.match(app.elements.demoTqsModules.innerHTML, /11\/19\/2026/);
    app.search.value = "2.1.3";
    app.search.events.input();
    assert.match(app.elements.demoTqsModules.innerHTML, /2\.1\.3/);
    assert.doesNotMatch(app.elements.demoTqsModules.innerHTML, /1\.1\.1/);
    assert.equal(app.elements.progressSummary.textContent, "1/10 requirements completed");
});

test("sample is limited to the demo account with the Demo D role selected", async () => {
    for (const options of [{account: {...profile, email: "other@example.test"}}, {selectedRole: {...role, role: "Other"}}]) {
        const app = await setup(options);
        assert.equal(app.elements.demoTqs.hidden, true);
    }
});

test("page selects the sample tracker and reports no TQS for other roles", async () => {
    const demo = await setup({actualPage:true});
    assert.equal(demo.elements.tqsTracker.hidden, false);
    assert.equal(demo.elements.demoTqs.hidden, false);
    assert.equal(demo.elements.progressSummary.textContent, "0/10 requirements completed");
    const values = {"portal.tqsProgress:other%40example.test:Other": '{"COURSE-1":{"status":"Completed"}}'};
    const other = await setup({actualPage:true, values, account:{...profile, email:"other@example.test"},
        selectedRole:{division:"Other", branch:"Other", role:"Other"}});
    assert.equal(other.elements.demoTqs.hidden, true);
    assert.equal(other.elements.tqsUnavailable.hidden, false);
    assert.equal(other.elements.progressSummary.textContent, "No TQS available for this role.");
    assert.equal(values["portal.tqsProgress:other%40example.test:Other"], '{"COURSE-1":{"status":"Completed"}}');
});

test("TQS progress refreshes when checkoffs change in another tab", async () => {
    const values = {};
    const app = await setup({values});
    values[key] = JSON.stringify({"1.1.1": {checkedBy:"Demo User", checkedAt:"2026-11-19T23:00:00.000Z"}});
    app.events.storage({key});
    assert.equal(app.elements.progressSummary.textContent, "1/10 requirements completed");
    assert.match(app.elements.demoTqsModules.innerHTML, /11\/19\/2026/);
});

test("failed writes leave the checkbox and saved progress unchanged", async () => {
    const app = await setup({failWrite: true});
    const checkbox = app.check("1.1.1", true);
    assert.equal(checkbox.checked, false);
    assert.equal(app.values[key], undefined);
    assert.match(app.elements.demoTqsNotice.textContent, /could not be saved/);
});

test("invalid saved progress is not overwritten and disables sample checkoffs", async () => {
    const values = {[key]: "{invalid"};
    const app = await setup({values});
    assert.match(app.elements.demoTqsModules.innerHTML, /disabled/);
    assert.match(app.elements.demoTqsNotice.textContent, /could not be read/);
    assert.equal(app.elements.progressSummary.textContent, "Progress unavailable");
    assert.equal(app.elements.progressPercent.textContent, "N/A");
    assert.equal(values[key], "{invalid");
});
