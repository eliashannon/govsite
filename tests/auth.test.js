const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {webcrypto} = require("node:crypto");

const root = path.join(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");
const protectedPages = [
    "index.html", "role-overview.html", "required-training.html", "training.html",
    "key-references.html", "tqs-support.html", "faq.html", "contact.html",
    "ai-training-content-manager.html"
];
const profile = {firstName: "Test", lastName: "User", email: "test@example.test"};
const sessionKey = "govsiteAccountProfile";

function storage(initial = {}) {
    const data = {...initial};
    return {
        getItem: key => data[key] ?? null,
        setItem: (key, value) => { data[key] = String(value); },
        removeItem: key => { delete data[key]; }
    };
}

class Element {
    constructor() {
        this.listeners = {};
        this.attributes = {};
        this.children = [];
        this.dataset = {};
        this.hidden = false;
        this.value = "";
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    dispatch(name, event = {}) { return this.listeners[name]?.({preventDefault() {}, ...event}); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    setCustomValidity(value) { this.validationMessage = value; }
    focus() { this.focused = true; }
    append(element) { this.children.push(element); }
    contains(element) { return element === this || this.children.includes(element); }
    querySelector(selector) { return this[selector] || null; }
}

function setup(url, sessionStorage = storage(), localStorage = storage()) {
    const windowEvents = {};
    const documentEvents = {};
    const elements = {};
    const location = new URL(url);
    location.replace = target => { location.replaced = new URL(target, location.href).href; };
    const window = {
        location,
        addEventListener: (name, callback) => { windowEvents[name] = callback; }
    };
    const document = {
        currentScript: {src: new URL("assets/shared/js/auth.js", "https://example.test/govsite/").href},
        documentElement: {style: {}},
        getElementById: id => elements[id] || null,
        createElement: () => new Element(),
        addEventListener: (name, callback) => { documentEvents[name] = callback; }
    };
    const context = {
        window, document, sessionStorage, localStorage, URL, URLSearchParams, TextEncoder,
        crypto: webcrypto, console: {error() {}},
        FormData: class {
            constructor(form) { this.fields = form.fields; }
            get(name) { return this.fields[name].value; }
        }
    };
    vm.runInNewContext(source("assets/shared/js/auth.js"), context);
    return {window, windowEvents, document, documentEvents, elements, sessionStorage, localStorage, context};
}

function accountPage(sessionStorage = storage(), localStorage = storage(), query = "") {
    const app = setup(`https://example.test/govsite/account.html${query}`, sessionStorage, localStorage);
    const ids = ["signInForm", "signInNotice", "createAccountForm", "createAccountNotice", "sign-in",
        "create-account", "accountPageTitle", "accountPageDescription", "email", "password", "demoSignIn"];
    for (const id of ids) app.elements[id] = new Element();
    const signIn = app.elements.signInForm;
    signIn.reportValidity = () => Boolean(app.elements.email.value && app.elements.password.value);
    signIn.requestSubmit = () => { app.pending = signIn.dispatch("submit"); };
    const fields = Object.fromEntries(["firstName", "lastName", "email", "passcode", "confirmPasscode"].map(name => [name, new Element()]));
    const create = app.elements.createAccountForm;
    create.fields = fields;
    create.elements = {namedItem: name => fields[name]};
    create.reportValidity = () => Object.values(fields).every(field => field.value && !field.validationMessage);
    vm.runInNewContext(source("assets/shared/js/account.js"), app.context);
    app.documentEvents.DOMContentLoaded();
    return {...app, fields};
}

test("guard runs early on every protected page and respects GitHub Pages paths", () => {
    for (const page of protectedPages) {
        const html = source(page);
        assert.ok(html.indexOf("assets/shared/js/auth.js") < html.indexOf("<body"));
        const url = `https://example.test/govsite/${page}?course=sample#section`;
        const signedOut = setup(url);
        const target = new URL(signedOut.window.location.replaced);
        assert.equal(target.pathname, "/govsite/account.html");
        assert.equal(target.searchParams.get("next"), `${page}?course=sample#section`);
        assert.equal(signedOut.document.documentElement.style.visibility, "hidden");
        const signedIn = setup(url, storage({[sessionKey]: JSON.stringify(profile)}));
        assert.equal(signedIn.window.location.replaced, undefined);
    }
    const rootPage = setup("https://example.test/govsite/");
    assert.equal(new URL(rootPage.window.location.replaced).searchParams.get("next"), "index.html");
});

test("invalid sessions and redirects cannot bypass the guard", () => {
    for (const value of ["{", "null", "[]", JSON.stringify({email:"test@example.test"}), JSON.stringify({...profile, firstName:" "})]) {
        assert.match(setup("https://example.test/govsite/index.html", storage({[sessionKey]:value})).window.location.replaced, /account\.html/);
    }
    const auth = setup("https://example.test/govsite/account.html").window.PortalAuth;
    for (const value of ["https://malicious.example", "//malicious.example", "javascript:alert(1)", "../index.html",
        "/govsite/index.html", "account.html", "training.html\\@evil.test", "training.html%2fother"]) {
        assert.equal(auth.safeDestination(value), "index.html");
    }
    assert.equal(auth.safeDestination("training.html?course=sample#module"), "training.html?course=sample#module");
    const signedIn = setup("https://example.test/govsite/account.html", storage({[sessionKey]: JSON.stringify(profile)}));
    assert.match(signedIn.window.location.replaced, /\/govsite\/index\.html$/);
    assert.equal(setup("https://example.test/govsite/account.html?switch=1", storage({[sessionKey]: JSON.stringify(profile)})).window.location.replaced, undefined);
});

test("demo sign-in uses a normal session and preserves a safe requested page", async () => {
    const app = accountPage(storage(), storage(), "?next=training.html%3Fcourse%3Dsample");
    app.elements.demoSignIn.dispatch("click");
    await app.pending;
    const session = JSON.parse(app.sessionStorage.getItem(sessionKey));
    assert.equal(session.email, "demo@navy.mil");
    assert.equal(session.isMaster, undefined);
    assert.equal(session.password, undefined);
    assert.equal(app.window.location.replaced, "https://example.test/govsite/training.html?course=sample");
});

test("missing and unknown credentials never create a session", async () => {
    const app = accountPage();
    await app.elements.signInForm.dispatch("submit");
    app.elements.email.value = "unknown@example.test";
    await app.elements.signInForm.dispatch("submit");
    assert.equal(app.sessionStorage.getItem(sessionKey), null);
    app.elements.password.value = "incorrect";
    await app.elements.signInForm.dispatch("submit");
    assert.equal(app.sessionStorage.getItem(sessionKey), null);
    assert.equal(app.elements.signInNotice.textContent, "Invalid username or password.");
});

test("account creation signs in and enables normal sign-in without storing a password", async () => {
    const session = storage();
    const local = storage();
    const app = accountPage(session, local, "?next=training.html");
    Object.assign(app.fields.firstName, {value:"Synthetic"});
    Object.assign(app.fields.lastName, {value:"Learner"});
    Object.assign(app.fields.email, {value:"learner@example.test"});
    Object.assign(app.fields.passcode, {value:"test-passphrase"});
    Object.assign(app.fields.confirmPasscode, {value:"test-passphrase"});
    await app.elements.createAccountForm.dispatch("submit");
    assert.equal(app.window.location.replaced, "https://example.test/govsite/index.html");
    assert.equal(JSON.parse(session.getItem(sessionKey)).email, "learner@example.test");
    assert.doesNotMatch(local.getItem("govsitePrototypeAccounts"), /test-passphrase/);
    session.removeItem(sessionKey);
    const signIn = accountPage(session, local, "?next=%2F%2Fmalicious.example");
    signIn.elements.email.value = "learner@example.test";
    signIn.elements.password.value = "incorrect";
    await signIn.elements.signInForm.dispatch("submit");
    assert.equal(session.getItem(sessionKey), null);
    assert.equal(signIn.elements.signInNotice.textContent, "Invalid username or password.");
    signIn.elements.password.value = "test-passphrase";
    await signIn.elements.signInForm.dispatch("submit");
    assert.equal(JSON.parse(session.getItem(sessionKey)).email, "learner@example.test");
    assert.equal(signIn.window.location.replaced, "https://example.test/govsite/index.html");
});

test("account creation rejects incomplete, mismatched and duplicate accounts", async () => {
    const app = accountPage();
    await app.elements.createAccountForm.dispatch("submit");
    assert.equal(app.sessionStorage.getItem(sessionKey), null);
    for (const [name, value] of Object.entries({firstName:"Test", lastName:"User", email:"demo@navy.mil", passcode:"one", confirmPasscode:"two"})) app.fields[name].value = value;
    await app.elements.createAccountForm.dispatch("submit");
    assert.equal(app.sessionStorage.getItem(sessionKey), null);
    app.fields.confirmPasscode.value = "one";
    await app.elements.createAccountForm.dispatch("submit");
    assert.match(app.elements.createAccountNotice.textContent, /already exists/);
    assert.equal(app.sessionStorage.getItem(sessionKey), null);
});

test("menu keyboard controls and sign-out preserve progress and protect cached pages", () => {
  for (const page of ["index.html", "required-training.html", "tqs-support.html"]) {
    const session = storage({[sessionKey]: JSON.stringify(profile)});
    const local = storage({"portal.selectedRole":"saved-role", "portal.inProgressCourses":"saved-progress"});
    const app = setup(`https://example.test/govsite/${page}`, session, local);
    const button = app.elements.accountButton = new Element();
    const menu = app.elements.accountMenu = new Element();
    menu.hidden = true;
    button[".account-avatar"] = new Element();
    button["span:last-child"] = new Element();
    vm.runInNewContext(source("assets/shared/js/account.js"), app.context);
    app.documentEvents.DOMContentLoaded();
    const signOut = menu.children[0];
    button.dispatch("click");
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(signOut.focused, true);
    app.documentEvents.keydown({key:"Escape"});
    assert.equal(menu.hidden, true);
    assert.equal(button.focused, true);
    button.dispatch("click");
    app.documentEvents.click({target:new Element()});
    assert.equal(menu.hidden, true);
    button.dispatch("click");
    signOut.dispatch("click");
    assert.equal(session.getItem(sessionKey), null);
    assert.equal(local.getItem("portal.inProgressCourses"), "saved-progress");
    assert.equal(local.getItem("portal.selectedRole"), "saved-role");
    assert.match(app.window.location.replaced, /\/govsite\/account\.html$/);
    app.window.location.replaced = undefined;
    app.windowEvents.pageshow({persisted:true});
    assert.match(app.window.location.replaced, /account\.html/);
    assert.equal(app.document.documentElement.style.visibility, "hidden");
    assert.match(setup(`https://example.test/govsite/${page}`, session, local).window.location.replaced, /account\.html/);
  }
});

test("signing out invalidates other open portal tabs and their cached pages", () => {
    const local = storage({"portal.inProgressCourses":"saved-progress"});
    const firstSession = storage({[sessionKey]: JSON.stringify(profile)});
    const secondSession = storage({[sessionKey]: JSON.stringify(profile)});
    const first = setup("https://example.test/govsite/index.html", firstSession, local);
    const second = setup("https://example.test/govsite/training.html?course=sample", secondSession, local);
    const button = first.elements.accountButton = new Element();
    const menu = first.elements.accountMenu = new Element();
    menu.hidden = true;
    button[".account-avatar"] = new Element();
    button["span:last-child"] = new Element();
    vm.runInNewContext(source("assets/shared/js/account.js"), first.context);
    first.documentEvents.DOMContentLoaded();
    menu.children[0].dispatch("click");

    assert.equal(firstSession.getItem(sessionKey), null);
    assert.match(first.window.location.replaced, /\/govsite\/account\.html$/);
    second.windowEvents.storage({key:"govsiteSignOutGeneration", storageArea:local});
    assert.equal(secondSession.getItem(sessionKey), null);
    assert.match(second.window.location.replaced, /\/govsite\/account\.html/);
    assert.equal(second.document.documentElement.style.visibility, "hidden");
    assert.equal(local.getItem("portal.inProgressCourses"), "saved-progress");
    assert.match(setup("https://example.test/govsite/index.html", secondSession, local).window.location.replaced, /account\.html/);
});

test("a stale tab is rejected on reload and a new sign-in remains valid", async () => {
    const local = storage({"portal.inProgressCourses":"saved-progress"});
    const stale = storage({[sessionKey]: JSON.stringify(profile)});
    const legacy = storage({[sessionKey]: JSON.stringify(profile)});
    const signingOut = setup("https://example.test/govsite/index.html", storage({[sessionKey]: JSON.stringify(profile)}), local);
    setup("https://example.test/govsite/index.html", stale, local);
    signingOut.window.PortalAuth.signOut();

    const reloaded = setup("https://example.test/govsite/required-training.html", stale, local);
    assert.match(reloaded.window.location.replaced, /account\.html/);
    assert.equal(stale.getItem(sessionKey), null);
    assert.match(setup("https://example.test/govsite/index.html", legacy, local).window.location.replaced, /account\.html/);
    const login = accountPage(stale, local);
    login.elements.demoSignIn.dispatch("click");
    await login.pending;
    const signedIn = setup("https://example.test/govsite/index.html", stale, local);
    assert.equal(signedIn.window.location.replaced, undefined);
    signedIn.windowEvents.storage({key:"govsiteSignOutGeneration", storageArea:local});
    assert.equal(signedIn.window.location.replaced, undefined);
    assert.equal(local.getItem("portal.inProgressCourses"), "saved-progress");
});

test("sign-out reports a storage failure without hiding the menu", () => {
    const local = storage();
    const session = storage({[sessionKey]: JSON.stringify(profile)});
    const app = setup("https://example.test/govsite/index.html", session, local);
    const button = app.elements.accountButton = new Element();
    const menu = app.elements.accountMenu = new Element();
    menu.hidden = true;
    vm.runInNewContext(source("assets/shared/js/account.js"), app.context);
    app.documentEvents.DOMContentLoaded();
    button.dispatch("click");
    local.setItem = () => { throw new Error("storage unavailable"); };
    menu.children[0].dispatch("click");
    assert.equal(menu.hidden, false);
    assert.match(menu.children[0].textContent, /Unable to sign out/);
    assert.notEqual(session.getItem(sessionKey), null);
    assert.equal(app.window.location.replaced, undefined);
});
