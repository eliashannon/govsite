const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.join(__dirname, "..");
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/document-processing.js"), "utf8"), context);

test("extracts the handbook course, modules, callouts, table, and references", async () => {
    const text = fs.readFileSync(path.join(root, "HANDBOOKFORMAT.txt"), "utf8");
    const course = await context.window.HandbookProcessor.extractCourse({name: "HANDBOOKFORMAT.txt", text: async () => text});
    assert.equal(course.id, "workplace-ergonomics-basics");
    assert.equal(course.shortDescription, "An introductory course on safe and comfortable computer workstation practices.");
    assert.equal(course.learningObjectives.length, 5);
    assert.equal(course.modules.length, 5);
    assert.equal(course.modules[0].learningObjectives.length, 3);
    assert.equal(course.modules[0].content.filter(block => block.type === "link").length, 2);
    const table = course.modules[1].content.find(block => block.type === "table");
    assert.equal(table.rows.length, 4);
    assert.equal(table.rows[3][0], "Mouse");
    assert.equal(course.modules[1].content.find(block => block.type === "callout").title, "Adjustment Before Replacement");
    assert.equal(course.modules[3].content.find(block => block.type === "callout").variant, "warning");
    assert.equal(course.source["Source Classification"], "UNCLASSIFIED");
    assert.equal(course.warnings.length, 0);
});

test("reports incomplete course tables for review", async () => {
    const text = "COURSE\nCourse Title: Example\nMODULE 1.1: First\nTABLE: Review\n2 rows x 2 cols\none\ntwo";
    const course = await context.window.HandbookProcessor.extractCourse({name: "example.txt", text: async () => text});
    assert.match(course.warnings[0], /table could not be fully extracted/i);
});
