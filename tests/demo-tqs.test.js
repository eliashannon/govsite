const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "assets/pages/tqs-support/demo-tqs.js"), "utf8");
const page = fs.readFileSync(path.join(root, "tqs-support.html"), "utf8");
const key = "portal.demoTqsProgress:demo%40navy.mil:DEMO-TQS-001";
const role = {division: "Demo: D", branch: "Demo D", role: "Demo D"};
const profile = {email: "demo@navy.mil", firstName: "Demo", lastName: "User"};

async function setup({selectedRole = role, account = profile, values = {}, failWrite = false} = {}) {
    class Element {
        constructor() {
            this.hidden = true;
            this.events = {};
            this.innerHTML = "";
            this.textContent = "";
            this.classList = {add() {}, remove() {}};
        }
        addEventListener(name, callback) { this.events[name] = callback; }
        querySelector() { return {focus() {}}; }
    }
    const elements = Object.fromEntries(["demoTqs", "demoTqsModules", "demoTqsNotice", "demoTqsProgress"].map(id => [id, new Element()]));
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
        addEventListener: (name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
    };
    vm.runInNewContext(script, {window: {PortalDataReady: Promise.resolve()}, document, localStorage, sessionStorage, console, Intl, Date});
    await initialize();
    const check = (number, checked) => {
        const checkbox = {dataset: {demoRequirement: number}, checked};
        elements.demoTqsModules.events.change({target: {closest: () => checkbox}});
        return checkbox;
    };
    return {elements, values, check};
}

test("demo role displays two ordered modules with five numbered requirements each", async () => {
    assert.match(page, /id="demoTqs"/);
    assert.match(page, /src="assets\/pages\/tqs-support\/demo-tqs\.js"/);
    const app = await setup();
    assert.equal(app.elements.demoTqs.hidden, false);
    const html = app.elements.demoTqsModules.innerHTML;
    assert.match(html, /1\.0 ORIENTATION AND COMMUNICATION/);
    assert.match(html, /2\.0 SAFETY AND RECORDS/);
    assert.equal((html.match(/data-demo-requirement=/g) || []).length, 10);
    assert.deepEqual([...html.matchAll(/data-demo-requirement="([^"]+)"/g)].map(match => match[1]),
        ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5"]);
    assert.equal(app.elements.demoTqsProgress.textContent, "0 of 10 requirements complete");
});

test("demo checkoffs persist separately, show the user and date, and can be cleared", async () => {
    const values = {"portal.tqsProgress:existing": "unchanged"};
    const app = await setup({values});
    app.check("1.1.1", true);
    const saved = JSON.parse(values[key]);
    assert.equal(saved["1.1.1"].checkedBy, "Demo User");
    const date = new Intl.DateTimeFormat("en-GB", {day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"})
        .format(new Date(saved["1.1.1"].checkedAt));
    assert.match(date, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.ok(app.elements.demoTqsModules.innerHTML.includes(date));
    assert.match(app.elements.demoTqsProgress.textContent, /^1 of 10/);
    const reloaded = await setup({values});
    assert.match(reloaded.elements.demoTqsModules.innerHTML, /Demo User/);
    reloaded.check("1.1.1", false);
    assert.deepEqual(JSON.parse(values[key]), {});
    assert.equal(values["portal.tqsProgress:existing"], "unchanged");
});

test("sample is limited to the demo account with the Demo D role selected", async () => {
    for (const options of [{account: {...profile, email: "other@example.test"}}, {selectedRole: {...role, role: "Other"}}]) {
        const app = await setup(options);
        assert.equal(app.elements.demoTqs.hidden, true);
    }
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
    assert.equal(values[key], "{invalid");
});
