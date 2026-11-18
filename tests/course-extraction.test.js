const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.join(__dirname, "..");
const context = {window: {}, URL};
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/shared/js/course-schema.js"), "utf8"), context);
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
    assert.equal(course.source.classification, "UNCLASSIFIED");
    assert.equal(course.warnings.length, 0);
});

test("recognizes all supported module heading forms without inventing a missing course ID", async () => {
    const text = [
        "COURSE", "Course Title: Example",
        "MODULE 1.1: First", "CONTENT", "Text",
        "1.2 Second", "CONTENT", "Text",
        "1.3: Third", "CONTENT", "Text",
        "MODULE 1.4 Fourth", "CONTENT", "Text"
    ].join("\n");
    const course = await context.window.HandbookProcessor.extractCourse({name:"example.txt", text:async () => text});
    assert.equal(course.id, "");
    assert.deepEqual(Array.from(course.modules, module => module.title), ["First", "Second", "Third", "Fourth"]);
});

test("shared schema rejects incomplete courses and unsafe links but accepts existing built-in courses", () => {
    const schema = context.window.CourseSchema;
    const builtIn = JSON.parse(fs.readFileSync(path.join(root, "data/courses.json"), "utf8")).courses;
    for (const course of builtIn) assert.equal(schema.validateCourse(course).length, 0, course.id);
    const course = structuredClone(builtIn[0]);
    course.roleAssignments = [];
    assert.ok(schema.validateCourse(course, {complete:true}).some(error => /assignment/i.test(error)));
    course.modules[0].content.push({type:"link", text:"unsafe", url:"java\nscript:alert(1)"});
    assert.ok(schema.validateCourse(course).some(error => /unsafe/.test(error)));
    assert.equal(schema.safeUrl("javascript:alert(1)"), false);
    assert.equal(schema.safeUrl("//example.test/path"), false);
    assert.equal(schema.safeUrl("data:image/svg+xml;base64,PHN2Zz4=", true), false);
    assert.equal(schema.safeUrl("data:image/png;base64,AAAA", true), true);
});

test("converts DOCX headings, lists, tables, links, and images to structured blocks", async () => {
    const element = (tag, text, children = [], attrs = {}) => ({
        nodeType:1, tagName:tag.toUpperCase(), textContent:text, children,
        getAttribute:name => attrs[name] || null,
        querySelectorAll(selector) {
            const tags = selector.split(",").map(value => value.trim().toUpperCase());
            const find = node => node.children.flatMap(child => [...(tags.includes(child.tagName) ? [child] : []), ...find(child)]);
            return find(this);
        },
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    });
    const link = element("a", "Guide", [], {href:"https://example.test/guide"});
    const image = element("img", "", [], {src:"data:image/png;base64,AAAA", alt:"Diagram"});
    const row = element("tr", "Cell", [element("td", "Cell")]);
    const children = [
        element("p", "COURSE"), element("p", "Course ID: example"), element("p", "Course Title: Example"),
        element("h1", "MODULE 1.1: First"), element("p", "CONTENT"),
        element("h2", "A heading"),
        element("ol", "OneTwo", [element("li", "One"), element("li", "Two")]),
        element("table", "Cell", [row]),
        element("p", "Guide", [link]), element("p", "", [image])
    ];
    const docxContext = {
        window:{mammoth:{convertToHtml:async () => ({value:"synthetic", messages:[]})}, CourseSchema:context.window.CourseSchema},
        Node:{ELEMENT_NODE:1}, DOMParser:class { parseFromString() { return {body:{children}}; } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/document-processing.js"), "utf8"), docxContext);
    const course = await docxContext.window.HandbookProcessor.extractCourse({name:"synthetic.docx", arrayBuffer:async () => new ArrayBuffer(0)});
    const content = course.modules[0].content;
    assert.ok(content.some(block => block.type === "heading" && block.text === "A heading"));
    assert.ok(content.some(block => block.type === "list" && block.style === "ordered" && block.items.length === 2));
    assert.ok(content.some(block => block.type === "table" && block.rows[0][0] === "Cell"));
    assert.ok(content.some(block => block.type === "link" && block.url === "https://example.test/guide"));
    assert.ok(content.some(block => block.type === "image" && block.alt === "Diagram"));
});

test("reports incomplete course tables for review", async () => {
    const text = "COURSE\nCourse Title: Example\nMODULE 1.1: First\nTABLE: Review\n2 rows x 2 cols\none\ntwo";
    const course = await context.window.HandbookProcessor.extractCourse({name: "example.txt", text: async () => text});
    assert.match(course.warnings[0], /table could not be fully extracted/i);
});
