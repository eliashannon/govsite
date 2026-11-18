const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");

class Element {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.events = {};
        this.className = "";
        this.classList = {add: name => { this.className += ` ${name}`; }};
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return (this.text || "") + this.children.map(child => child.textContent).join(""); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ""; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    click() { if (!this.disabled) this.events.click?.(); }
    focus() { this.focused = true; }
}

function storage(initial = {}) {
    const values = {...initial};
    return {
        getItem: key => values[key] ?? null,
        setItem: (key, value) => { values[key] = String(value); }
    };
}

function descendants(element) {
    return [element, ...element.children.flatMap(descendants)];
}

async function player(preview = false, savedStorage = null) {
    const course = JSON.parse(source("data/courses.json")).courses[0];
    course.modules = Array.from({length:5}, (_, index) => ({
        ...structuredClone(course.modules[index % course.modules.length]),
        id:`module-${index + 1}`,
        sourceModuleNumber:`${index < 2 ? 1 : 2}.${index < 2 ? index + 1 : index - 1}`
    }));
    course.modules[0].content.push(
        {type:"table", headers:["Heading"], rows:[["Cell"]]},
        {type:"link", text:"Guide", url:"https://example.test/guide"},
        {type:"image", alt:"Diagram", src:"data:image/png;base64,AAAA"}
    );
    course.roleAssignments = [{divisionId:"division", branchId:"branch", roleId:"role", required:true}];
    course.status = "needs-review";

    const html = source("training.html");
    const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const document = {
        getElementById: id => elements[id] || null,
        createElement: tag => new Element(tag),
        addEventListener: (event, callback) => { if (event === "DOMContentLoaded") callback(); }
    };
    const localStorage = savedStorage || storage(preview ? {trainingManagerCourses:JSON.stringify({[course.id]:course})} : {});
    const sessionStorage = storage(preview ? {govsiteAccountProfile:JSON.stringify({isMaster:true, email:"elias@navy.mil"})} : {});
    const url = new URL(`https://example.test/training.html?course=${course.id}${preview ? "&preview=1" : ""}`);
    const scrolls = [];
    const events = {};
    const window = {
        location:url,
        PortalData:{courses:[]},
        TrainingContentStore:{saveMany:async () => {}},
        matchMedia:() => ({matches:true}),
        scrollTo: options => scrolls.push(options),
        addEventListener:(event, callback) => { events[event] = callback; }
    };
    const history = {
        pushState:(_state, _title, next) => { window.location = new URL(next); },
        replaceState:(_state, _title, next) => { window.location = new URL(next); }
    };
    const context = {
        window, document, localStorage, sessionStorage, history, URL, URLSearchParams, console,
        performance:{getEntriesByType:() => []},
        fetch:async () => ({ok:true, json:async () => ({courses:[course]})})
    };
    vm.runInNewContext(source("assets/shared/js/course-schema.js"), context);
    vm.runInNewContext(source("assets/pages/training-courses/training.js"), context);
    await new Promise(resolve => setImmediate(resolve));
    const button = label => descendants(elements.moduleContent).find(element => element.tagName === "BUTTON" && element.textContent === label);
    const sidebar = index => elements.moduleNavigation.children[index].children[0];
    return {course, elements, button, sidebar, localStorage, sessionStorage, window, scrolls, events};
}

test("course player shows module states, renders structured material, and completes a five-module course", async () => {
    const p = await player();
    assert.equal(p.elements.courseProgressDetail.textContent, "0 of 5 modules continued");
    assert.equal(p.sidebar(0).attributes["aria-current"], "page");
    assert.equal(p.sidebar(1).disabled, true);
    assert.equal(p.sidebar(1).children[0].textContent, "🔒");
    assert.match(p.elements.moduleContent.textContent, /Module 1\.1/);
    assert.match(p.elements.moduleContent.textContent, /Module Objectives/);
    assert.match(p.elements.moduleContent.textContent, /Training Material/);
    assert.ok(descendants(p.elements.moduleContent).some(element => element.className === "training-table-scroll"));
    assert.ok(descendants(p.elements.moduleContent).some(element => element.className.includes("training-callout")));
    assert.ok(descendants(p.elements.moduleContent).some(element => element.tagName === "A" && element.href === "https://example.test/guide"));
    assert.ok(descendants(p.elements.moduleContent).some(element => element.tagName === "IMG" && element.alt === "Diagram"));
    assert.equal(p.button("Go Back"), undefined);

    p.button("Continue").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "20%");
    assert.ok(JSON.parse(p.localStorage.getItem("portal.inProgressCourses")).includes(p.course.id));
    p.window.location.searchParams.set("module", "module-5");
    p.events.popstate();
    assert.equal(p.window.location.searchParams.get("module"), "module-2");
    assert.equal(p.elements.courseProgressDetail.textContent, "1 of 5 modules continued");
    assert.equal(p.sidebar(0).children[0].textContent, "✓");
    assert.equal(p.sidebar(1).attributes["aria-current"], "page");
    assert.equal(p.window.location.searchParams.get("module"), "module-2");
    assert.deepEqual({...p.scrolls.at(-1)}, {top:0, behavior:"auto"});
    p.sidebar(0).click();
    p.button("Continue").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "20%");

    for (let index = 1; index < 4; index += 1) p.button("Continue").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "80%");
    assert.match(p.elements.moduleContent.textContent, /Final module/);
    assert.match(p.elements.moduleContent.textContent, /Ready to complete\?/);
    assert.ok(p.button("Go Back"));
    assert.ok(p.button("Mark Complete"));
    p.button("Mark Complete").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "100%");
    assert.equal(p.elements.courseCompletion.hidden, false);
    assert.equal(p.elements.courseCompletionTitle.textContent, p.course.title);
    assert.equal(p.elements.courseCompletionReturn.href, "required-training.html");
    assert.equal(p.elements.courseCompletion.focused, true);
    assert.equal(p.button("Course Completed").disabled, true);
    assert.ok(JSON.parse(p.localStorage.getItem("portal.completedCourses")).includes(p.course.id));
    assert.ok(!JSON.parse(p.localStorage.getItem("portal.inProgressCourses")).includes(p.course.id));
    p.sidebar(0).click();
    assert.equal(p.elements.courseProgressLabel.textContent, "100%");
    assert.equal(p.sidebar(0).disabled, false);
    const reopened = await player(false, p.localStorage);
    assert.equal(reopened.elements.courseCompletion.hidden, false);
    assert.equal(reopened.elements.courseProgressLabel.textContent, "100%");
});

test("review preview has learner navigation without changing learner progress and can approve then publish", async () => {
    const p = await player(true);
    assert.equal(p.elements.courseReviewControls.hidden, false);
    for (let index = 0; index < 4; index += 1) p.button("Continue").click();
    p.button("Mark Complete").click();
    assert.equal(p.elements.courseCompletionReturn.href, "ai-training-content-manager.html");
    assert.equal(p.localStorage.getItem("trainingProgress"), null);
    assert.equal(p.localStorage.getItem("portal.completedCourses"), null);
    assert.equal(p.localStorage.getItem("portal.inProgressCourses"), null);
    assert.equal(JSON.parse(p.sessionStorage.getItem("trainingPreviewProgress"))[p.course.id].courseCompleted, true);
    p.elements.approvePreviewCourse.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(p.localStorage.getItem("trainingManagerCourses"))[p.course.id].status, "approved");
    p.elements.publishPreviewCourse.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(p.localStorage.getItem("trainingManagerCourses"))[p.course.id].status, "published");
});

test("reviewers can reject a course from its preview", async () => {
    const p = await player(true);
    p.elements.rejectPreviewCourse.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(p.localStorage.getItem("trainingManagerCourses"))[p.course.id].status, "rejected");
    assert.equal(p.elements.publishPreviewCourse.hidden, true);
});
