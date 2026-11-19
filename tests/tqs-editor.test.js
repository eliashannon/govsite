const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {randomUUID} = require("node:crypto");

const root = path.join(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");

test("the document picker offers Create TQS for Role in place of Upload and extract", () => {
    const html = source("ai-training-content-manager.html");
    assert.doesNotMatch(html, /Upload and extract|id="uploadHandbooksButton"/i);
    assert.equal((html.match(/id="createTqsDraftButton"/g) || []).length, 1);
    assert.match(html, /id="createTqsDraftButton"[^>]*>Create TQS for Role/);
});

function setup({master = true, documents = [], original = null} = {}) {
    class Element {
        constructor() {
            this.events = {};
            this.value = "";
            this.innerHTML = "";
            this.textContent = "";
            this.hidden = false;
            this.open = false;
            this.disabled = false;
            this.files = [];
            this.classList = {toggle() {}};
        }
        addEventListener(name, callback) { this.events[name] = callback; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        querySelector() { return {value: "0"}; }
    }
    const elements = Object.fromEntries([...source("ai-training-content-manager.html").matchAll(/\bid="([^"]+)"/g)]
        .map(match => [match[1], new Element()]));
    const values = {};
    const localStorage = {
        getItem: key => values[key] ?? null,
        setItem: (key, value) => { values[key] = String(value); }
    };
    const sessionStorage = {getItem: () => JSON.stringify({isMaster: master, email: "elias@navy.mil"})};
    let initialize;
    const document = {
        getElementById: id => elements[id],
        addEventListener: (name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
    };
    const operations = [];
    const window = {
        PortalData: {organizationHierarchy: {Division: {Branch: ["Role A", "Role B"]}}},
        TrainingContentStore: {
            readAll: async () => ({documents}),
            getOriginal: async () => original,
            saveMany: async records => { operations.push(records); }
        }
    };
    const context = {window, document, localStorage, sessionStorage, console, File, structuredClone, crypto: {randomUUID}};
    vm.runInNewContext(source("assets/pages/tqs-support/tqs-parser.js"), context);
    vm.runInNewContext(source("assets/pages/ai-training-content-manager/tqs-editor.js"), context);
    initialize();
    const click = async id => elements[id].events.click({currentTarget: elements[id]});
    const submit = () => elements.tqsDraftForm.events.submit({preventDefault() {}});
    const target = (selector, dataset) => ({closest: query => query === selector ? {dataset} : null});
    const records = () => JSON.parse(values.trainingManagerTqsDrafts || "{}");
    return {elements, window, operations, click, submit, target, records};
}

test("creates, edits, saves and reopens a role-specific draft without unsafe HTML", async () => {
    const app = setup();
    app.elements.handbookFiles.files = [new File(["3.0 <img src=x onerror=alert(1)>\n3.1.1 Complete training."], "source.txt")];
    await app.click("createTqsDraftButton");
    assert.equal(app.elements.tqsDraftDialog.open, true);
    assert.match(app.elements.tqsModuleEditor.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(app.elements.tqsModuleEditor.innerHTML, /<img/);
    assert.equal(app.operations[0].originalFiles[0].blob.name, "source.txt");

    app.submit();
    assert.match(app.elements.tqsDraftNotice.textContent, /Select an existing role/);
    assert.equal(Object.keys(app.records()).length, 0);
    app.elements.tqsEditorRole.value = "1";
    app.elements.tqsEditorIdentifier.value = "TQS-1";
    app.elements.tqsEditorTitle.value = "Role qualification";
    app.elements.tqsModuleEditor.events.input({target: {dataset: {module: "0", requirement: "0", field: "requirementText"}, value: "Edited requirement"}});
    app.elements.tqsModuleEditor.events.click({target: app.target("[data-add-requirement]", {addRequirement: "0"})});
    app.elements.tqsModuleEditor.events.input({target: {dataset: {module: "0", requirement: "1", field: "requirementNumber"}, value: "3.1.2"}});
    app.elements.tqsModuleEditor.events.input({target: {dataset: {module: "0", requirement: "1", field: "requirementText"}, value: "Second requirement"}});
    app.submit();

    const saved = Object.values(app.records())[0];
    assert.equal(saved.assignment.role, "Role B");
    assert.equal(saved.source.fileName, "source.txt");
    assert.deepEqual(saved.modules[0].requirements.map(item => item.requirementText), ["Edited requirement", "Second requirement"]);
    assert.match(app.elements.tqsDraftList.innerHTML, /Role qualification/);
    app.elements.tqsDraftDialog.close();
    app.elements.tqsDraftList.events.click({target: app.target("[data-edit-tqs]", {editTqs: saved.id})});
    assert.equal(app.elements.tqsDraftDialog.open, true);
    assert.equal(app.elements.tqsEditorRole.value, "1");
    assert.match(app.elements.tqsModuleEditor.innerHTML, /Second requirement/);
});

test("opens an uploaded DOCX, retains warnings and assigns an orphan requirement", async () => {
    const original = {blob: new File(["placeholder"], "source.docx")};
    const app = setup({documents: [{id: "doc-1", fileName: "source.docx", fileType: "docx"}], original});
    app.window.mammoth = {extractRawText: async () => ({
        value: "3.1.1 Orphan\n3.0 Module\n3.1.2 Assigned",
        messages: [{message: "Inspect this document."}]
    })};
    await app.click("createTqsDraftButton");
    assert.equal(app.elements.tqsSourceDialog.open, true);
    app.elements.tqsSourceSelect.value = "0";
    await app.click("openTqsSource");
    assert.equal(app.elements.tqsDraftDialog.open, true);
    assert.match(app.elements.tqsImportWarnings.innerHTML, /Inspect this document/);
    assert.match(app.elements.tqsUnassignedEditor.innerHTML, /Orphan/);
    app.elements.tqsUnassignedEditor.events.click({target: app.target("[data-assign-requirement]", {assignRequirement: "0"})});
    app.elements.tqsEditorRole.value = "0";
    app.submit();
    const saved = Object.values(app.records())[0];
    assert.equal(saved.source.documentId, "doc-1");
    assert.equal(saved.unassignedRequirements.length, 0);
    assert.deepEqual(saved.modules[0].requirements.map(item => item.requirementNumber), ["3.1.1", "3.1.2"]);
    assert.ok(saved.warnings.length >= 2);
    assert.equal(app.operations.length, 0);
});

test("parses PDF text blocks in order and keeps extraction warnings", async () => {
    const app = setup();
    app.window.HandbookProcessor = {extract: async () => ({
        blocks: [{sourceText: "3.0 First"}, {sourceText: "3.1.1 Requirement"}, {sourceText: "4.0 Second"}],
        warnings: ["Check PDF layout."]
    })};
    app.elements.handbookFiles.files = [new File(["pdf"], "source.pdf")];
    await app.click("createTqsDraftButton");
    app.elements.tqsEditorRole.value = "0";
    app.submit();
    const saved = Object.values(app.records())[0];
    assert.deepEqual(saved.modules.map(module => module.moduleNumber), ["3.0", "4.0"]);
    assert.equal(saved.modules[0].requirements[0].requirementNumber, "3.1.1");
    assert.match(app.elements.tqsImportWarnings.innerHTML, /Check PDF layout/);
});

test("keeps module requirements for review when their module is removed", async () => {
    const app = setup();
    app.elements.handbookFiles.files = [new File(["3.0 First\n3.1.1 Requirement"], "source.txt")];
    await app.click("createTqsDraftButton");
    app.elements.tqsModuleEditor.events.click({target: app.target("[data-remove-module]", {removeModule: "0"})});
    app.elements.tqsEditorRole.value = "0";
    app.submit();
    const saved = Object.values(app.records())[0];
    assert.equal(saved.modules.length, 0);
    assert.equal(saved.unassignedRequirements[0].requirementNumber, "3.1.1");
});

test("does not initialize TQS administration for a non-Master prototype account", () => {
    const app = setup({master: false});
    assert.equal(app.elements.createTqsDraftButton.events.click, undefined);
});
