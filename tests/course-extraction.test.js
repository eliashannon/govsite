const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.join(__dirname, "..");
const context = {window: {}, URL};
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/shared/js/course-schema.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/document-processing.js"), "utf8"), context);

const metadataLines = [
    "Course ID: workplace-ergonomics-basics",
    "Course Title: Workplace Ergonomics and Safe Computer Use",
    "Short Description: An introductory course on safe and comfortable computer workstation practices.",
    "Category: Workplace Safety",
    "Difficulty: Beginner",
    "Duration Minutes: 45",
    "Version: 1.0",
    "Division: Operations",
    "Branch: Administrative Support",
    "Role: Office Support Specialist"
];
const courseText = metadata => `COURSE\n${metadata}\nCOURSE DESCRIPTION\nDescription\n`;
const extractTextCourse = text => context.window.HandbookProcessor.extractCourse({name:"example.txt", text:async () => text});

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

test("recognizes all supported module heading forms", async () => {
    const text = [
        courseText(metadataLines.join("\n")),
        "MODULE 1.1: First", "CONTENT", "Text",
        "1.2 Second", "CONTENT", "Text",
        "1.3: Third", "CONTENT", "Text",
        "MODULE 1.4 Fourth", "CONTENT", "Text"
    ].join("\n");
    const course = await extractTextCourse(text);
    assert.deepEqual(Array.from(course.modules, module => module.title), ["First", "Second", "Third", "Fourth"]);
});

test("parses line-separated and flattened course metadata independently", async () => {
    for (const separator of ["\n", ""]) {
        const text = `${courseText(metadataLines.join(separator))}Category: Not metadata\nMODULE 1.1: First\nCONTENT\nRole: Content\n`;
        const course = await extractTextCourse(text);
        assert.deepEqual(JSON.parse(JSON.stringify({
            id:course.id, title:course.title, shortDescription:course.shortDescription,
            category:course.category, difficulty:course.difficulty, durationMinutes:course.durationMinutes,
            version:course.version, roleAssignments:course.roleAssignments
        })), {
            id:"workplace-ergonomics-basics", title:"Workplace Ergonomics and Safe Computer Use",
            shortDescription:"An introductory course on safe and comfortable computer workstation practices.",
            category:"Workplace Safety", difficulty:"Beginner", durationMinutes:45, version:"1.0",
            roleAssignments:[{divisionId:"operations", branchId:"administrative-support", roleId:"office-support-specialist", required:true}]
        });
        assert.equal(course.description, "Description Category: Not metadata");
        assert.equal(course.modules[0].content[0].text, "Role: Content");
    }
});

test("rejects missing or invalid required metadata with actionable errors", async () => {
    for (const [index, label] of [[0,"Course ID"], [1,"Course Title"], [2,"Short Description"],
        [3,"Category"], [4,"Difficulty"], [5,"Duration Minutes"]]) {
        const lines = metadataLines.filter((_, position) => position !== index);
        await assert.rejects(extractTextCourse(courseText(lines.join("\n"))), new RegExp(`${label} is required`));
    }
    for (const value of ["Uppercase", "-leading", "trailing-", "two--hyphens", "has spaces", "one_two"]) {
        const lines = [...metadataLines];
        lines[0] = `Course ID: ${value}`;
        await assert.rejects(extractTextCourse(courseText(lines.join("\n"))), /Course ID must be a lowercase slug/);
    }
    for (const value of ["0", "-1", "1.5", "1e2", "999999999999999999999"]) {
        const lines = [...metadataLines];
        lines[5] = `Duration Minutes: ${value}`;
        await assert.rejects(extractTextCourse(courseText(lines.join("\n"))), /Duration Minutes must be a positive whole number/);
    }
    await assert.rejects(extractTextCourse(`COURSE\n${metadataLines.join("\n")}`), /Missing COURSE DESCRIPTION heading/);
    await assert.rejects(extractTextCourse(metadataLines.join("\n")), /Missing COURSE heading/);
    await assert.rejects(extractTextCourse(courseText(`${metadataLines.join("\n")}\nCategory: Extra`)), /Duplicate Category field/);
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

    const assessedCourse = structuredClone(builtIn[0]);
    assessedCourse.modules[0].assessment = {questions:[{
        prompt:"Which choice is correct?",
        choices:["Correct","Incorrect"],
        answerIndex:0
    }]};
    assert.equal(schema.validateCourse(assessedCourse).length, 0);
    assessedCourse.modules[0].assessment.questions[0].answerIndex = 2;
    assert.ok(schema.validateCourse(assessedCourse).some(error => /valid correct answer/.test(error)));
    assessedCourse.modules[0].assessment.questions[0].answerIndex = 0;
    assessedCourse.modules[0].assessments = [
        {id:"exam-one", title:"First exam", questions:[{prompt:"First?", choices:["Yes","No"], answerIndex:0}]},
        {id:"exam-two", title:"Second exam", questions:[{prompt:"Second?", choices:["Yes","No"], answerIndex:1}]}
    ];
    assert.equal(schema.validateCourse(assessedCourse).length, 0);
    assessedCourse.modules[0].assessments[1].id = "exam-one";
    assert.ok(schema.validateCourse(assessedCourse).some(error => /Duplicate assessment ID/.test(error)));
});

const element = (tag, text, children = [], attrs = {}) => ({
        nodeType:1, tagName:tag.toUpperCase(), textContent:text, children,
        childNodes:children.length ? children : [{nodeType:3, nodeValue:text}],
        getAttribute:name => attrs[name] || null,
        querySelectorAll(selector) {
            const tags = selector.split(",").map(value => value.trim().toUpperCase());
            const find = node => node.children.flatMap(child => [...(tags.includes(child.tagName) ? [child] : []), ...find(child)]);
            return find(this);
        },
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
});
const extractDocxCourse = async children => {
    const docxContext = {
        window:{mammoth:{convertToHtml:async () => ({value:"synthetic", messages:[]})}, CourseSchema:context.window.CourseSchema},
        Node:{ELEMENT_NODE:1}, DOMParser:class { parseFromString() { return {body:{children}}; } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/document-processing.js"), "utf8"), docxContext);
    return docxContext.window.HandbookProcessor.extractCourse({name:"synthetic.docx", arrayBuffer:async () => new ArrayBuffer(0)});
};

test("converts DOCX headings, lists, tables, links, and images to structured blocks", async () => {
    const link = element("a", "Guide", [], {href:"https://example.test/guide"});
    const image = element("img", "", [], {src:"data:image/png;base64,AAAA", alt:"Diagram"});
    const row = element("tr", "Cell", [element("td", "Cell")]);
    const children = [
        element("p", "COURSE"), ...metadataLines.map(line => element("p", line)), element("p", "COURSE DESCRIPTION"), element("p", "Description"),
        element("h1", "MODULE 1: First"), element("p", "CONTENT"),
        element("h2", "A heading"),
        element("ol", "OneTwo", [element("li", "One"), element("li", "Two")]),
        element("table", "Cell", [row]),
        element("p", "Guide", [link]), element("p", "", [image])
    ];
    const course = await extractDocxCourse(children);
    assert.equal(course.modules[0].sourceModuleNumber, "1");
    const content = course.modules[0].content;
    assert.ok(content.some(block => block.type === "heading" && block.text === "A heading"));
    assert.ok(content.some(block => block.type === "list" && block.style === "ordered" && block.items.length === 2));
    assert.ok(content.some(block => block.type === "table" && block.rows[0][0] === "Cell"));
    assert.ok(content.some(block => block.type === "link" && block.url === "https://example.test/guide"));
    assert.ok(content.some(block => block.type === "image" && block.alt === "Diagram"));
});

test("preserves DOCX runs, paragraph boundaries, and line breaks in metadata", async () => {
    const id = element("p", metadataLines[0], [
        element("strong", "Course "), element("span", "ID: workplace-"), element("em", "ergonomics-basics")
    ]);
    const cell = element("td", metadataLines.slice(1, 5).join(""), metadataLines.slice(1, 5).map(line => element("p", line)));
    const row = element("tr", cell.textContent, [cell]);
    const breaks = element("p", metadataLines.slice(5).join(""), metadataLines.slice(5).flatMap((line, index) =>
        index ? [element("br", ""), element("span", line)] : [element("span", line)]
    ));
    const course = await extractDocxCourse([
        element("p", "COURSE"), id, element("table", cell.textContent, [row]), breaks,
        element("p", "COURSE DESCRIPTION"), element("p", "Description"),
        element("p", "MODULE 1.1: First"), element("p", "CONTENT"), element("p", "Text")
    ]);
    assert.equal(course.id, "workplace-ergonomics-basics");
    assert.equal(course.title, "Workplace Ergonomics and Safe Computer Use");
    assert.equal(course.shortDescription, "An introductory course on safe and comfortable computer workstation practices.");
    assert.equal(course.category, "Workplace Safety");
    assert.equal(course.difficulty, "Beginner");
    assert.equal(course.durationMinutes, 45);
    assert.equal(course.version, "1.0");
    assert.deepEqual(JSON.parse(JSON.stringify(course.roleAssignments)), [
        {divisionId:"operations", branchId:"administrative-support", roleId:"office-support-specialist", required:true}
    ]);
    assert.equal(course.modules[0].content[0].text, "Text");
});

test("Create Structured Draft displays metadata errors and opens a valid draft", async () => {
    class EditorElement {
        constructor() {
            this.events = {};
            this.value = "";
            this.dataset = {};
            this.classList = {add() {}, remove() {}, toggle() {}};
        }
        addEventListener(name, callback) { this.events[name] = callback; }
        append() {}
        replaceChildren() {}
        setAttribute() {}
        showModal() { this.open = true; }
        focus() {}
    }
    const elements = Object.fromEntries([...fs.readFileSync(path.join(root, "ai-training-content-manager.html"), "utf8")
        .matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new EditorElement()]));
    let initialize;
    const editorContext = {
        window:{PortalData:{}, location:{}},
        document:{
            getElementById:id => elements[id] || null,
            createElement:() => new EditorElement(),
            addEventListener:(name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
        },
        sessionStorage:{getItem:() => JSON.stringify({isMaster:true, email:"elias@navy.mil"})},
        localStorage:{getItem:() => null},
        URL, console:{error() {}}
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/shared/js/course-schema.js"), "utf8"), editorContext);
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/document-processing.js"), "utf8"), editorContext);
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/course-editor.js"), "utf8"), editorContext);
    initialize();
    const file = text => ({name:"course.txt", size:text.length, text:async () => text});
    elements.handbookFiles.files = [file(courseText(metadataLines.filter((_, index) => index !== 0).join("\n")))];
    await elements.createCourseDraftButton.events.click();
    assert.match(elements.managerNotice.textContent, /Course ID is required/);
    assert.notEqual(elements.courseDraftDialog.open, true);

    elements.handbookFiles.files = [file(courseText(metadataLines.join("")))];
    await elements.createCourseDraftButton.events.click();
    assert.equal(elements.courseDraftDialog.open, true);
    assert.equal(elements.courseEditorId.value, "workplace-ergonomics-basics");
    assert.equal(elements.courseEditorTitle.value, "Workplace Ergonomics and Safe Computer Use");
    assert.equal(elements.courseEditorDuration.value, 45);
});

test("Course Builder View / edit opens saved course and saves edits to both stores", async () => {
    class EditorElement {
        constructor() {
            this.events = {};
            this.value = "";
            this.dataset = {};
            this.classList = {add() {}, remove() {}, toggle() {}};
        }
        addEventListener(name, callback) { this.events[name] = callback; }
        append() {}
        replaceChildren() {}
        setAttribute() {}
        showModal() { this.open = true; }
        focus() {}
    }
    const elements = Object.fromEntries([...fs.readFileSync(path.join(root, "ai-training-content-manager.html"), "utf8")
        .matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new EditorElement()]));
    const course = {...JSON.parse(fs.readFileSync(path.join(root, "data/courses.json"), "utf8")).courses[0],
        id:"editable", status:"ready", managerZone:"course", modules:[], roleAssignments:[]};
    const values = {trainingManagerCourses:JSON.stringify({editable:course})};
    const localStorage = {
        getItem:key => values[key] ?? null,
        setItem:(key, value) => { values[key] = value; },
        removeItem:key => { delete values[key]; }
    };
    const saved = [];
    let initialize;
    const editorContext = {
        window:{
            PortalData:{}, PortalDataReady:Promise.resolve(),
            TrainingContentStore:{saveMany:async records => saved.push(records)},
            dispatchEvent() {}, location:{}
        },
        document:{
            getElementById:id => elements[id] || null,
            createElement:() => new EditorElement(),
            addEventListener:(name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
        },
        sessionStorage:{getItem:() => JSON.stringify({isMaster:true, email:"elias@navy.mil"})},
        localStorage, URL, Event, CustomEvent:class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        console
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/shared/js/course-schema.js"), "utf8"), editorContext);
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/shared/js/course-workflow.js"), "utf8"), editorContext);
    vm.runInNewContext(fs.readFileSync(path.join(root, "assets/pages/ai-training-content-manager/course-editor.js"), "utf8"), editorContext);
    initialize();
    elements.contentExplorer.events.click({
        target:{closest:selector => selector === "[data-edit-course]" ? {dataset:{editCourse:"editable"}} : null}
    });
    assert.equal(elements.courseDraftDialog.open, true);
    assert.equal(elements.courseEditorTitle.value, course.title);
    elements.courseEditorTitle.value = "Updated title";
    await elements.saveCourseDraftButton.events.click();
    assert.equal(JSON.parse(values.trainingManagerCourses).editable.title, "Updated title");
    assert.equal(saved[0].organizationMetadata[0].headingPath[0], "Updated title");
    assert.equal(saved[0].sourceContent[0].structuredCourseId, "editable");
    values.trainingManagerCourses = "{}";
    await elements.saveCourseDraftButton.events.click();
    assert.equal(JSON.parse(values.trainingManagerCourses).editable, undefined);
    assert.match(elements.courseDraftNotice.textContent, /no longer available/);
});

test("reports incomplete course tables for review", async () => {
    const text = `${courseText(metadataLines.join("\n"))}MODULE 1.1: First\nTABLE: Review\n2 rows x 2 cols\none\ntwo`;
    const course = await context.window.HandbookProcessor.extractCourse({name: "example.txt", text: async () => text});
    assert.match(course.warnings[0], /table could not be fully extracted/i);
});
