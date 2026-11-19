const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");

class Element {
    constructor() {
        this.events = {};
        this.value = "";
        this.innerHTML = "";
        this.classList = {toggle() {}};
    }
    addEventListener(name, callback) { this.events[name] = callback; }
    querySelectorAll() { return []; }
    querySelector() { return new Element(); }
}

async function manager(courses, legacyQueue = [], includeSource = true) {
    const records = Object.fromEntries(courses.map(course => [course.id, course]));
    const values = {
        trainingManagerCourses:JSON.stringify(records),
        trainingExamBuilderCourseIds:JSON.stringify(legacyQueue)
    };
    const localStorage = {
        getItem:key => values[key] ?? null,
        setItem:(key, value) => { values[key] = String(value); }
    };
    const sessionStorage = {getItem:() => JSON.stringify({isMaster:true, email:"elias@navy.mil"})};
    const elements = Object.fromEntries([...source("ai-training-content-manager.html").matchAll(/\bid="([^"]+)"/g)]
        .map(match => [match[1], new Element()]));
    elements.categoryFilter.value = "All";
    const callbacks = {};
    let initialize;
    const document = {
        getElementById:id => elements[id] || null,
        querySelector:() => new Element(),
        addEventListener:(name, callback) => { if (name === "DOMContentLoaded") initialize = callback; }
    };
    const sourceContent = (includeSource ? courses : []).map(course => ({
        id:`structured-course-${course.id}`, documentId:`structured-course-${course.id}`,
        structuredCourseId:course.id, originalDocumentName:course.id, sourceText:course.title
    }));
    const window = {
        PortalDataReady:Promise.resolve(),
        PortalData:{},
        TrainingContentStore:{readAll:async () => ({documents:[], sourceContent, organizationMetadata:[], reviews:[], modules:[]})},
        addEventListener:(name, callback) => { (callbacks[name] ||= []).push(callback); },
        dispatchEvent:event => { (callbacks[event.type] || []).forEach(callback => callback(event)); },
        confirm:() => true,
        location:{},
        open:() => ({})
    };
    const context = {window, document, localStorage, sessionStorage, console, Event, URL, URLSearchParams};
    vm.runInNewContext(source("assets/shared/js/course-schema.js"), context);
    vm.runInNewContext(source("assets/shared/js/course-workflow.js"), context);
    vm.runInNewContext(source("assets/pages/ai-training-content-manager/ai-training-content-manager.js"), context);
    await initialize();
    const target = (selector, dataset, checked = true) => ({
        closest:query => query === selector ? {dataset, checked} : null
    });
    const selectCourse = id => elements.contentExplorer.events.change({
        target:target("[data-select-structured-course]", {selectStructuredCourse:id})
    });
    const selectExam = id => elements.examBuilderList.events.change({
        target:target("[data-select-exam-course]", {selectExamCourse:id})
    });
    const selectPublished = id => elements.publishedCoursesList.events.change({
        target:target("[data-select-published-course]", {selectPublishedCourse:id})
    });
    const publishedAction = (selector, dataset) => elements.publishedCoursesList.events.click({target:target(selector, dataset)});
    return {elements, localStorage, window, selectCourse, selectExam, selectPublished, publishedAction,
        course:id => JSON.parse(localStorage.getItem("trainingManagerCourses"))[id]};
}

function fixture(id, status = "approved") {
    const course = structuredClone(JSON.parse(source("data/courses.json")).courses[0]);
    course.id = id;
    course.title = `Course ${id}`;
    course.status = status;
    course.roleAssignments = [{divisionId:"division", branchId:"branch", roleId:"role", required:true}];
    return course;
}

test("courses move exclusively between builders and publication requires explicit unpublishing", async () => {
    const m = await manager([fixture("alpha"), fixture("legacy", "published")]);
    assert.match(m.elements.contentExplorer.innerHTML, /Course alpha/);
    assert.doesNotMatch(m.elements.contentExplorer.innerHTML, /Course legacy/);
    assert.match(m.elements.publishedCoursesList.innerHTML, /Course legacy/);

    m.selectCourse("alpha");
    m.elements.addSelectedExamCoursesButton.events.click();
    assert.doesNotMatch(m.elements.contentExplorer.innerHTML, /Course alpha/);
    assert.match(m.elements.examBuilderList.innerHTML, /Course alpha/);
    assert.equal(m.course("alpha").managerZone, "exam");
    m.selectExam("alpha");
    m.elements.publishSelectedExamCoursesButton.events.click();
    assert.doesNotMatch(m.elements.examBuilderList.innerHTML, /Course alpha/);
    assert.match(m.elements.publishedCoursesList.innerHTML, /Course alpha/);
    m.publishedAction("[data-publish-course]", {publishCourse:"alpha"});
    assert.equal(m.course("alpha").status, "published");
    assert.doesNotMatch(m.elements.publishedCoursesList.innerHTML, /data-move-published-course="alpha"/);
    m.publishedAction("[data-move-published-course]", {movePublishedCourse:"alpha", destination:"course"});
    assert.equal(m.course("alpha").status, "published");
    assert.equal(m.course("alpha").managerZone, "published");
    m.publishedAction("[data-unpublish-course]", {unpublishCourse:"alpha"});
    assert.equal(m.course("alpha").status, "ready");
    assert.match(m.elements.publishedCoursesList.innerHTML, /data-move-published-course="alpha"/);
    m.publishedAction("[data-move-published-course]", {movePublishedCourse:"alpha", destination:"course"});
    assert.match(m.elements.contentExplorer.innerHTML, /Course alpha/);
    assert.doesNotMatch(m.elements.publishedCoursesList.innerHTML, /Course alpha/);
});

test("published courses support bulk selection and unpublishing", async () => {
    const first = fixture("first", "published");
    const second = fixture("second", "published");
    const m = await manager([first, second]);
    m.selectPublished("first");
    m.selectPublished("second");
    assert.equal(m.elements.publishedCoursesSelectionCount.textContent, "2 selected");
    m.elements.unpublishSelectedPublishedCoursesButton.events.click();
    assert.equal(m.course("first").status, "ready");
    assert.equal(m.course("second").status, "ready");
});

test("legacy exam queues remain exclusive after reload and do not override explicit moves", async () => {
    const course = fixture("legacy-exam");
    course.modules[0].assessments = [{
        id:"test-exam", title:"Test exam", questions:[{prompt:"Ready?", choices:["Yes", "No"], answerIndex:0}]
    }];
    const m = await manager([course], [course.id]);
    assert.doesNotMatch(m.elements.contentExplorer.innerHTML, /Course legacy-exam/);
    assert.match(m.elements.examBuilderList.innerHTML, /Course legacy-exam/);
    m.selectExam(course.id);
    m.elements.returnSelectedExamCoursesButton.events.click();
    assert.equal(m.course(course.id).managerZone, "course");
    assert.deepEqual(m.course(course.id).modules[0].assessments, course.modules[0].assessments);
    const reloaded = await manager([m.course(course.id)], [course.id]);
    assert.match(reloaded.elements.contentExplorer.innerHTML, /Course legacy-exam/);
    assert.doesNotMatch(reloaded.elements.examBuilderList.innerHTML, /Course legacy-exam/);
});

test("unpublished courses can move to Exam Builder and return even without an existing source entry", async () => {
    const m = await manager([fixture("recovered", "published")], [], false);
    m.publishedAction("[data-unpublish-course]", {unpublishCourse:"recovered"});
    m.publishedAction("[data-move-published-course]", {movePublishedCourse:"recovered", destination:"exam"});
    assert.match(m.elements.examBuilderList.innerHTML, /Course recovered/);
    assert.doesNotMatch(m.elements.publishedCoursesList.innerHTML, /Course recovered/);
    m.selectExam("recovered");
    m.elements.returnSelectedExamCoursesButton.events.click();
    assert.match(m.elements.contentExplorer.innerHTML, /Course recovered/);
    assert.doesNotMatch(m.elements.examBuilderList.innerHTML, /Course recovered/);
    const reloaded = await manager([m.course("recovered")], [], false);
    assert.match(reloaded.elements.contentExplorer.innerHTML, /Course recovered/);
});

test("publication rejects incomplete courses without changing their saved status", async () => {
    const course = fixture("invalid");
    course.description = "";
    course.managerZone = "published";
    const m = await manager([course]);
    m.publishedAction("[data-publish-course]", {publishCourse:course.id});
    assert.equal(m.course(course.id).status, "approved");
    assert.match(m.elements.managerNotice.textContent, /validation failed/i);
});
