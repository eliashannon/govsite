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
        this.classList = {
            add: name => { this.className += ` ${name}`; },
            toggle: () => {}
        };
        this.value = "";
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return (this.text || "") + this.children.map(child => child.textContent).join(""); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ""; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
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

async function player(preview = false, savedStorage = null, fixture = null) {
    const course = fixture ? structuredClone(fixture) : JSON.parse(source("data/courses.json")).courses[0];
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
    if (!fixture) {
        course.roleAssignments = [{divisionId:"division", branchId:"branch", roleId:"role", required:true}];
        course.status = "ready";
    }

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
        confirm:() => true,
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
    vm.runInNewContext(source("assets/shared/js/course-workflow.js"), context);
    vm.runInNewContext(source("assets/pages/training-courses/training.js"), context);
    await new Promise(resolve => setImmediate(resolve));
    const button = label => descendants(elements.moduleContent).find(element => element.tagName === "BUTTON" && element.textContent === label);
    const sidebar = index => elements.moduleNavigation.children[index].children[0];
    return {course, elements, button, sidebar, localStorage, sessionStorage, window, scrolls, events};
}

test("course player shows module states, renders structured material, and completes a five-module course", async () => {
    const p = await player();
    assert.deepEqual({...p.scrolls.at(-1)}, {top:84, behavior:"auto"});
    assert.equal(p.elements.courseProgressDetail.textContent, "0 of 5 modules continued");
    assert.equal(p.sidebar(0).attributes["aria-current"], "page");
    assert.equal(p.sidebar(1).disabled, true);
    assert.equal(p.sidebar(1).children[0].textContent, "🔒");
    assert.equal(p.sidebar(0).children[1].textContent, "Module 1.1: Welcome and Responsibilities");
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
    assert.deepEqual({...p.scrolls.at(-1)}, {top:84, behavior:"auto"});
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
    assert.deepEqual({...p.scrolls.at(-1)}, {top:0, behavior:"auto"});
    assert.equal(p.button("Course Completed").disabled, true);
    assert.ok(JSON.parse(p.localStorage.getItem("portal.completedCourses")).includes(p.course.id));
    assert.ok(!JSON.parse(p.localStorage.getItem("portal.inProgressCourses")).includes(p.course.id));
    p.sidebar(0).click();
    assert.equal(p.elements.courseProgressLabel.textContent, "100%");
    assert.equal(p.sidebar(0).disabled, false);
    const reopened = await player(false, p.localStorage);
    assert.equal(reopened.elements.courseCompletion.hidden, false);
    assert.equal(reopened.elements.courseProgressLabel.textContent, "100%");
    p.elements.resetCourseProgress.click();
    assert.equal(p.elements.courseProgressLabel.textContent, "0%");
    assert.equal(p.elements.courseCompletion.hidden, true);
    assert.ok(!JSON.parse(p.localStorage.getItem("portal.completedCourses")).includes(p.course.id));
    assert.ok(!JSON.parse(p.localStorage.getItem("portal.inProgressCourses")).includes(p.course.id));
});

test("preview has learner navigation without changing learner progress and no approval controls", async () => {
    const p = await player(true);
    assert.equal(p.elements.courseReviewControls.hidden, false);
    assert.equal(p.elements.approvePreviewCourse, undefined);
    assert.equal(p.elements.rejectPreviewCourse, undefined);
    for (let index = 0; index < 4; index += 1) p.button("Continue").click();
    p.button("Mark Complete").click();
    assert.equal(p.elements.courseCompletionReturn.href, "ai-training-content-manager.html");
    assert.equal(p.localStorage.getItem("trainingProgress"), null);
    assert.equal(p.localStorage.getItem("portal.completedCourses"), null);
    assert.equal(p.localStorage.getItem("portal.inProgressCourses"), null);
    assert.equal(JSON.parse(p.sessionStorage.getItem("trainingPreviewProgress"))[p.course.id].courseCompleted, true);
    assert.match(p.elements.courseReviewNotice.textContent, /Published Courses/);
});

async function overviewPage(page, localStorage) {
    const html = source(page === "dashboard" ? "index.html" : "required-training.html");
    const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
    for (const id of ["trainingCategory", "trainingStatus"]) if (elements[id]) elements[id].value = "All";
    if (elements.trainingSort) elements.trainingSort.value = "name-asc";
    const document = {
        getElementById: id => elements[id] || null,
        querySelector: () => null,
        addEventListener: (event, callback) => { if (event === "DOMContentLoaded") callback(); }
    };
    const sessionStorage = storage({govsiteAccountProfile:JSON.stringify({firstName:"Test", lastName:"User", email:"test@example.test"})});
    const window = {
        PortalData:{
            courses:[],
            organizationHierarchy:{"Test Division":{"Test Branch":["Test Role"]}},
            announcements:[]
        },
        location:{search:"", href:"https://example.test/required-training.html"}
    };
    const context = {
        window, document, localStorage, sessionStorage, URL, URLSearchParams, console,
        fetch:async () => ({ok:true, json:async () => ({courses:[]})})
    };
    vm.runInNewContext(source("assets/shared/js/course-schema.js"), context);
    vm.runInNewContext(source("assets/shared/js/course-catalog.js"), context);
    vm.runInNewContext(source(page === "dashboard"
        ? "assets/pages/dashboard/dashboard.js" : "assets/pages/training-courses/required-training.js"), context);
    await new Promise(resolve => setImmediate(resolve));
    return elements;
}

test("catalog and dashboard agree when a published course is started, completed, and reset", async () => {
    const fixture = structuredClone(JSON.parse(source("data/courses.json")).courses[0]);
    fixture.id = "published-test";
    fixture.modules = Array.from({length:5}, (_, index) => ({
        ...structuredClone(fixture.modules[index % fixture.modules.length]),
        id:`module-${index + 1}`
    }));
    fixture.roleAssignments = [{divisionId:"test-division", branchId:"test-branch", roleId:"test-role", required:true}];
    fixture.status = "published";
    const saved = storage({
        "portal.selectedRole":JSON.stringify({division:"Test Division", branch:"Test Branch", role:"Test Role"}),
        "portal.completedCourses":"[]",
        trainingManagerCourses:JSON.stringify({[fixture.id]:fixture})
    });

    let catalog = await overviewPage("catalog", saved);
    assert.match(catalog.trainingList.innerHTML, /Start Course/);
    const link = {dataset:{viewCourse:fixture.id}, getAttribute:() => `training.html?course=${fixture.id}`};
    catalog.trainingList.events.click({target:{closest:() => link}});
    const p = await player(false, saved, fixture);
    assert.equal(p.elements.courseProgressLabel.textContent, "0%");
    catalog = await overviewPage("catalog", saved);
    let dashboard = await overviewPage("dashboard", saved);
    assert.match(catalog.trainingList.innerHTML, /Continue Course/);
    assert.equal(catalog.inProgressStat.textContent, "1");
    assert.equal(dashboard.inProgressCourses.textContent, "1");
    assert.match(dashboard.activeCourseList.innerHTML, /published-test/);
    assert.match(dashboard.activeCourseList.innerHTML, /training\.html\?course=published-test/);
    assert.equal(dashboard.trainingProgressSummary.textContent, catalog.roleProgressSummary.textContent);

    p.elements.resetCourseProgress.click();
    catalog = await overviewPage("catalog", saved);
    dashboard = await overviewPage("dashboard", saved);
    assert.match(catalog.trainingList.innerHTML, /Start Course/);
    assert.equal(dashboard.inProgressCourses.textContent, "0");
    assert.doesNotMatch(dashboard.activeCourseList.innerHTML, /published-test/);
    catalog.trainingList.events.click({target:{closest:() => link}});
    const restarted = await player(false, saved, fixture);
    for (let index = 0; index < 4; index += 1) restarted.button("Continue").click();
    restarted.button("Mark Complete").click();
    catalog = await overviewPage("catalog", saved);
    dashboard = await overviewPage("dashboard", saved);
    assert.match(catalog.trainingList.innerHTML, /Review Course/);
    assert.equal(catalog.completedStat.textContent, "1");
    assert.equal(dashboard.completedCourses.textContent, "1");
    assert.equal(dashboard.overallProgress.textContent, catalog.roleProgressPercent.textContent);
    assert.doesNotMatch(dashboard.activeCourseList.innerHTML, /published-test/);

    restarted.elements.resetCourseProgress.click();
    catalog = await overviewPage("catalog", saved);
    dashboard = await overviewPage("dashboard", saved);
    assert.match(catalog.trainingList.innerHTML, /Start Course/);
    assert.equal(catalog.notStartedStat.textContent, "1");
    assert.equal(dashboard.notStartedCourses.textContent, "1");
    assert.equal(dashboard.overallProgress.textContent, catalog.roleProgressPercent.textContent);
    assert.doesNotMatch(dashboard.activeCourseList.innerHTML, /published-test/);

    saved.setItem("trainingProgress", JSON.stringify({
        [fixture.id]:{courseCompleted:true, continuedModuleIds:fixture.modules.map(module => module.id)}
    }));
    catalog = await overviewPage("catalog", saved);
    dashboard = await overviewPage("dashboard", saved);
    assert.match(catalog.trainingList.innerHTML, /Review Course/);
    assert.equal(dashboard.completedCourses.textContent, "1");
    assert.equal(dashboard.overallProgress.textContent, catalog.roleProgressPercent.textContent);
});

test("Training Courses no longer exposes catalog-wide division, branch, or role filters", () => {
    const html = source("required-training.html");
    const script = source("assets/pages/training-courses/required-training.js");
    assert.doesNotMatch(html, /\bid="training(Division|Branch|Role)"/);
    assert.doesNotMatch(script, /\btraining(Division|Branch|Role)Filter\b/);
    assert.match(script, /portal\.selectedRole/);
    assert.match(script, /const roleName = hasSignedInAccount \? roleSelection\?\.role/);
});

test("manager provides separate exam and publication controls", () => {
    const explorerHtml = source("ai-training-content-manager.html");
    const explorer = source("assets/pages/ai-training-content-manager/ai-training-content-manager.js");
    const playerHtml = source("training.html");
    const player = source("assets/pages/training-courses/training.js");
    assert.match(explorerHtml, /id="publishedCoursesTitle">Published Courses/);
    assert.match(explorerHtml, /id="examBuilderTitle">Exam Builder/);
    assert.match(explorerHtml, /id="addAnotherExamButton".*Add Another Exam/);
    assert.match(explorerHtml, /addSelectedExamCoursesButton/);
    assert.match(explorerHtml, /returnSelectedExamCoursesButton/);
    assert.match(explorer, /data-select-structured-course/);
    assert.match(explorer, /data-view-exam-course/);
    assert.match(explorerHtml, /Place exam after module/);
    assert.match(explorer, /unpublishStructuredCourses/);
    assert.match(explorer, /data-unpublish-course/);
    assert.match(explorerHtml, /Course Builder/);
    assert.match(playerHtml, /id="courseBackLink"/);
    assert.match(player, /Back to Training Courses/);
    assert.match(player, /Back to Course Builder/);
});

test("topbar search markup and shared styles are consistent across pages", () => {
    const pages = ["index.html","role-overview.html","faq.html","key-references.html","contact.html","required-training.html","training.html","tqs-support.html","ai-training-content-manager.html"];
    pages.forEach(page => {
        const html = source(page);
        assert.match(html, /class="topbar-search search-box"/);
        assert.match(html, /<svg[^>]*aria-hidden="true"/);
        assert.match(html, /<input type="search"/);
    });
    const sharedComponents = source("assets/shared/css/components.css");
    const sharedLayout = source("assets/shared/css/layout.css");
    assert.match(sharedComponents, /\.topbar-search\.search-box input\{height:42px/);
    assert.match(sharedComponents, /\.topbar-search\.search-box input:focus/);
    assert.match(sharedLayout, /\.topbar-search\{width:min\(620px,34vw\)\}/);
});

test("protected pages share the account control styles", () => {
    const pages = ["index.html","role-overview.html","faq.html","key-references.html","contact.html","required-training.html","training.html","tqs-support.html","ai-training-content-manager.html"];
    pages.forEach(page => {
        assert.match(source(page), /<span>Sign in<\/span>/);
        assert.match(source(page), /components\.css\?v=20261118-4/);
    });
    const sharedComponents = source("assets/shared/css/components.css");
    const dashboardCss = source("assets/pages/dashboard/dashboard.css");
    assert.match(sharedComponents, /\.account-button\{[^}]*font-size:13px;font-weight:600/);
    assert.match(sharedComponents, /\.account-avatar\{width:36px;height:36px;[^}]*color:var\(--blue-700\)/);
    assert.doesNotMatch(dashboardCss, /\.dashboard-account\s+\.account-(button|avatar)/);
});

test("knowledge checks gate Continue and Mark Complete until every answer is correct", async () => {
    const base = JSON.parse(source("data/courses.json")).courses[0];
    const quiz = {questions:[
        {prompt:"First question?", choices:["A","B","C","D"], answerIndex:2},
        {prompt:"Second question?", choices:["A","B","C","D"], answerIndex:1}
    ]};
    const fixture = {...base, modules:Array.from({length:5}, () => structuredClone(base.modules[0]))};
    fixture.modules[0].assessment = quiz;
    fixture.modules[4].assessment = quiz;
    const p = await player(false, null, fixture);
    const inputs = () => descendants(p.elements.moduleContent).filter(element => element.tagName === "INPUT");
    const choose = (question, choice) => {
        const input = inputs()[question * 4 + choice];
        input.checked = true;
        input.events.change();
    };

    assert.equal(p.button("Continue"), undefined);
    assert.equal(p.button("Submit").disabled, true);
    choose(0, 2);
    assert.equal(p.button("Submit").disabled, true);
    choose(1, 0);
    assert.equal(p.button("Submit").disabled, false);
    p.button("Submit").click();
    assert.match(p.elements.moduleContent.textContent, /You scored 50% \(1 of 2 correct\)\. You need 100% to continue\./);
    assert.equal(p.button("Submit"), undefined);
    assert.equal(p.button("Continue"), undefined);
    assert.ok(inputs().every(input => input.disabled));

    p.button("Retry").click();
    assert.ok(inputs().every(input => input.checked !== true));
    assert.equal(p.button("Submit").disabled, true);
    assert.equal(p.button("Retry"), undefined);

    choose(0, 2);
    choose(1, 1);
    p.button("Submit").click();
    assert.match(p.elements.moduleContent.textContent, /Success: you passed the knowledge check\./);
    assert.equal(p.elements.courseProgressLabel.textContent, "0%");
    p.button("Continue").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "20%");

    for (let index = 1; index < 4; index += 1) p.button("Continue").click();
    assert.match(p.elements.moduleContent.textContent, /Final module/);
    assert.equal(p.button("Mark Complete"), undefined);
    assert.equal(p.button("Submit").disabled, true);
    choose(0, 2);
    choose(1, 1);
    p.button("Submit").click();
    p.button("Mark Complete").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "100%");
});

test("multiple named exams after one module must each be passed before continuing", async () => {
    const base = JSON.parse(source("data/courses.json")).courses[0];
    const fixture = structuredClone(base);
    fixture.modules = Array.from({length:5}, (_, index) => ({
        ...structuredClone(base.modules[index % base.modules.length]),
        id:`fixture-module-${index + 1}`,
        ...(index === 0 ? {} : {assessments:[]})
    }));
    fixture.modules[0].assessments = [
        {id:"exam-one", title:"First exam", questions:[{prompt:"First?", choices:["No","Yes"], answerIndex:1}]},
        {id:"exam-two", title:"Second exam", questions:[{prompt:"Second?", choices:["No","Yes"], answerIndex:1}]}
    ];
    const p = await player(false, null, fixture);
    const choose = (examId, choice) => {
        const input = descendants(p.elements.moduleContent).find(element =>
            element.tagName === "INPUT" && element.name === `exam-question-${examId}-0` && element.value === String(choice)
        );
        assert.ok(input, `expected answer ${choice} for ${examId}`);
        input.checked = true;
        input.events.change();
    };

    assert.equal(p.button("Continue"), undefined);
    choose("exam-one", 1);
    p.button("Submit First exam").click();
    assert.match(p.elements.moduleContent.textContent, /Success: you passed First exam\./);
    assert.equal(p.button("Continue"), undefined);

    choose("exam-two", 0);
    p.button("Submit Second exam").click();
    assert.match(p.elements.moduleContent.textContent, /You scored 0% \(0 of 1 correct\)/);
    p.button("Retry Second exam").click();
    choose("exam-two", 1);
    p.button("Submit Second exam").click();
    assert.match(p.elements.moduleContent.textContent, /Success: you passed Second exam\./);
    p.button("Continue").click();
    assert.equal(p.elements.courseProgressLabel.textContent, "20%");
});
