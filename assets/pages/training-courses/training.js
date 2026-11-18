document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "trainingProgress";
    let courses = [];
    let selectedCourse = null;
    let progress = null;
    let currentModuleIndex = 0;

    const app = document.getElementById("trainingApp");
    const errorBox = document.getElementById("trainingError");

    function showError(message) {
        app.hidden = true;
        errorBox.hidden = false;
        errorBox.textContent = "";
        const text = document.createElement("p");
        text.textContent = message;
        const link = document.createElement("a");
        link.href = "required-training.html";
        link.textContent = "Return to Training Courses";
        errorBox.append(text, link);
    }

    function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function validateCourse(course) {
        if (!isPlainObject(course) || typeof course.id !== "string" || !course.id.trim()) return false;
        if (typeof course.title !== "string" || !course.title.trim()) return false;
        if (!Array.isArray(course.modules) || course.modules.length === 0) return false;
        const moduleIds = new Set();
        for (const module of course.modules) {
            if (!isPlainObject(module) || typeof module.id !== "string" || !module.id.trim()) return false;
            if (typeof module.title !== "string" || !module.title.trim()) return false;
            if (!Number.isFinite(module.order) || !Number.isFinite(module.estimatedMinutes)) return false;
            if (!Array.isArray(module.content)) return false;
            if (moduleIds.has(module.id)) return false;
            moduleIds.add(module.id);
        }
        return true;
    }

    async function loadCourses() {
        try {
            const response = await fetch("data/courses.json", { cache: "no-store" });
            if (!response.ok) throw new Error(`Courses could not be loaded (${response.status}).`);
            const data = await response.json();
            if (!isPlainObject(data) || !Array.isArray(data.courses)) throw new Error("The course file has an invalid structure.");
            courses = data.courses.filter(validateCourse);
            if (courses.length === 0) throw new Error("No valid courses were found.");
            return true;
        } catch (error) {
            showError(error instanceof Error ? `Unable to load course data: ${error.message}` : "Unable to load course data.");
            return false;
        }
    }

    function getCourseFromUrl() {
        return new URLSearchParams(window.location.search).get("course");
    }

    function findCourseById(courseId) {
        return courses.find(course => course.id === courseId) || null;
    }

    function readProgressStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return isPlainObject(parsed) ? parsed : {};
        } catch (error) {
            console.error("Training progress storage is invalid JSON and will be repaired.", error);
            return {};
        }
    }

    // Progress arrays are strings and module IDs are validated against the selected course.
    // Unlocked modules are recalculated in course order rather than trusting stored arrays.
    function loadCourseProgress(course) {
        const store = readProgressStore();
        const raw = isPlainObject(store[course.id]) ? store[course.id] : {};
        const validIds = new Set(course.modules.map(module => module.id));
        const sanitize = value => Array.isArray(value)
            ? [...new Set(value.filter(id => typeof id === "string" && validIds.has(id)))]
            : [];
        const rawContinued = sanitize(raw.continuedModuleIds);
        const continued = [];

        // First-time continuation is determined by whether a module enters the ordered prefix.
        for (const module of course.modules) {
            if (rawContinued.includes(module.id)) continued.push(module.id);
            else break;
        }

        const continuedIds = new Set(continued);
        const completed = continued;
        const unlocked = [];
        for (let index = 0; index < course.modules.length; index += 1) {
            if (index === 0) unlocked.push(course.modules[index].id);
            else if (continuedIds.has(course.modules[index - 1].id)) unlocked.push(course.modules[index].id);
        }
        if (course.modules.every(module => continuedIds.has(module.id))) unlocked.push(...course.modules.map(module => module.id));

        const state = {
            continuedModuleIds: [...new Set(continued)],
            completedModuleIds: [...new Set(completed)],
            unlockedModuleIds: [...new Set(unlocked)],
            currentModuleId: typeof raw.currentModuleId === "string" && validIds.has(raw.currentModuleId)
                ? raw.currentModuleId : continued.length ? course.modules[continued.length]?.id || course.modules[course.modules.length - 1].id : course.modules[0].id,
            lastViewedModuleId: typeof raw.lastViewedModuleId === "string" && validIds.has(raw.lastViewedModuleId)
                ? raw.lastViewedModuleId : course.modules[0].id,
            courseCompleted: raw.courseCompleted === true && continued.length === course.modules.length
        };
        store[course.id] = state;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to persist training progress.", error);
        }
        return state;
    }

    function saveCourseProgress() {
        const store = readProgressStore();
        store[selectedCourse.id] = progress;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to persist training progress.", error);
        }
    }

    function getFirstIncompleteModule() {
        return selectedCourse.modules.find(module => !progress.continuedModuleIds.includes(module.id))
            || selectedCourse.modules[selectedCourse.modules.length - 1];
    }

    function isModuleUnlocked(moduleId) {
        return progress.unlockedModuleIds.includes(moduleId);
    }

    function isSafeProtocol(urlValue, allowRelative) {
        if (typeof urlValue !== "string" || !urlValue.trim()) return false;
        const value = urlValue.trim();
        if (/^(javascript|data|vbscript):/i.test(value)) return false;
        if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
            try {
                const parsed = new URL(value);
                return parsed.protocol === "https:" || parsed.protocol === "http:";
            } catch (_) {
                return false;
            }
        }
        return allowRelative;
    }

    function renderCourseHeader() {
        document.title = `${selectedCourse.title} | Training Portal`;
        document.getElementById("courseTitle").textContent = selectedCourse.title;
        document.getElementById("courseDescription").textContent =
            typeof selectedCourse.description === "string" ? selectedCourse.description : selectedCourse.shortDescription || "";
        document.getElementById("courseCategory").textContent = selectedCourse.category || "Unspecified";
        document.getElementById("courseDifficulty").textContent = selectedCourse.difficulty || "Not specified";
        document.getElementById("courseDuration").textContent =
            Number.isFinite(selectedCourse.durationMinutes) ? `${selectedCourse.durationMinutes} minutes` : "Not specified";
        const objectives = document.getElementById("courseObjectives");
        objectives.replaceChildren();
        const objectiveList = Array.isArray(selectedCourse.learningObjectives) ? selectedCourse.learningObjectives : [];
        objectiveList.forEach(objective => {
            if (typeof objective !== "string") return;
            const item = document.createElement("li");
            item.textContent = objective;
            objectives.append(item);
        });
    }

    function renderProgress() {
        const total = selectedCourse.modules.length;
        const completedCount = progress.continuedModuleIds.length;
        const rawPercent = total ? (completedCount / total) * 100 : 0;
        const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
        document.getElementById("courseProgressLabel").textContent = `${percent}%`;
        document.getElementById("courseProgressFill").style.width = `${percent}%`;
        const track = document.getElementById("courseProgressBar");
        track.setAttribute("aria-valuenow", String(percent));
        track.setAttribute("aria-valuetext", `${percent}% of course modules completed`);
    }

    function renderModuleSidebar() {
        const list = document.getElementById("moduleNavigation");
        list.replaceChildren();
        selectedCourse.modules.forEach((module, index) => {
            const item = document.createElement("li");
            const completed = progress.completedModuleIds.includes(module.id);
            const unlocked = isModuleUnlocked(module.id);
            const current = index === currentModuleIndex;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "training-module-button";
            if (current) button.classList.add("current");
            if (completed) button.classList.add("completed");
            if (!unlocked) button.classList.add("locked");
            button.disabled = !unlocked;
            if (current) button.setAttribute("aria-current", "page");
            button.setAttribute("aria-label",
                `Module ${index + 1} of ${selectedCourse.modules.length}: ${module.title}${completed ? ", completed" : !unlocked ? ", locked" : ""}`);

            const position = document.createElement("span");
            position.className = "training-module-position";
            position.textContent = completed ? "✓" : String(index + 1);
            const title = document.createElement("span");
            title.className = "training-module-title";
            title.textContent = module.title;
            const state = document.createElement("span");
            state.className = "training-module-state";
            state.textContent = completed ? "Completed" : current ? "Current" : !unlocked ? "Locked" : "Available";
            button.append(position, title, state);
            if (unlocked) button.addEventListener("click", () => navigateToModule(index, true));
            item.append(button);
            list.append(item);
        });
    }

    function appendTextContent(container, block) {
        if (typeof block.text !== "string") return;
        container.textContent = block.text;
    }

    function renderContentBlock(block) {
        if (!isPlainObject(block) || typeof block.type !== "string") return null;
        if (block.type === "heading") {
            const level = Number.isInteger(block.level) ? Math.max(2, Math.min(4, block.level)) : 2;
            const heading = document.createElement(`h${level}`);
            appendTextContent(heading, block);
            return heading;
        }
        if (block.type === "paragraph") {
            const paragraph = document.createElement("p");
            appendTextContent(paragraph, block);
            return paragraph;
        }
        if (block.type === "list") {
            const list = document.createElement(block.style === "ordered" ? "ol" : "ul");
            if (Array.isArray(block.items)) {
                block.items.forEach(item => {
                    if (typeof item !== "string") return;
                    const li = document.createElement("li");
                    li.textContent = item;
                    list.append(li);
                });
            }
            return list;
        }
        if (block.type === "callout") {
            const callout = document.createElement("aside");
            callout.className = `training-callout training-callout-${block.variant === "warning" ? "warning" : "info"}`;
            if (typeof block.title === "string") {
                const title = document.createElement("strong");
                title.textContent = block.title;
                callout.append(title);
            }
            if (typeof block.text === "string") {
                const text = document.createElement("p");
                text.textContent = block.text;
                callout.append(text);
            }
            return callout;
        }
        if (block.type === "link") {
            if (!isSafeProtocol(block.url, true)) return null;
            const link = document.createElement("a");
            link.textContent = typeof block.text === "string" ? block.text : block.url;
            link.href = block.url;
            const absolute = /^[a-z][a-z0-9+.-]*:/i.test(block.url);
            if (absolute) {
                try {
                    if (new URL(block.url).protocol.startsWith("http")) {
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                    }
                } catch (_) {}
            }
            return link;
        }
        if (block.type === "image") {
            if (!isSafeProtocol(block.src, true)) return null;
            const image = document.createElement("img");
            image.src = block.src;
            image.alt = typeof block.alt === "string" ? block.alt : "";
            return image;
        }
        // Unsupported blocks are skipped rather than interpreted as HTML.
        return null;
    }

    function handleContinue() {
        const module = selectedCourse.modules[currentModuleIndex];
        if (currentModuleIndex === selectedCourse.modules.length - 1) return;
        if (!progress.continuedModuleIds.includes(module.id)) {
            progress.continuedModuleIds.push(module.id);
            progress.completedModuleIds = [...new Set([...progress.completedModuleIds, module.id])];
            const next = selectedCourse.modules[currentModuleIndex + 1];
            progress.unlockedModuleIds = [...new Set([...progress.unlockedModuleIds, next.id])];
        }
        navigateToModule(currentModuleIndex + 1, true);
    }

    function handleMarkComplete() {
        if (currentModuleIndex !== selectedCourse.modules.length - 1) return;
        const finalModule = selectedCourse.modules[currentModuleIndex];
        if (!progress.continuedModuleIds.includes(finalModule.id)) {
            progress.continuedModuleIds.push(finalModule.id);
        }
        progress.completedModuleIds = [...new Set([...progress.completedModuleIds, finalModule.id])];
        progress.courseCompleted = true;
        progress.unlockedModuleIds = selectedCourse.modules.map(module => module.id);
        progress.currentModuleId = finalModule.id;
        progress.lastViewedModuleId = finalModule.id;
        saveCourseProgress();
        renderProgress();
        renderModuleSidebar();
        renderModuleContent();
    }

    function renderModuleContent() {
        const module = selectedCourse.modules[currentModuleIndex];
        const content = document.getElementById("moduleContent");
        content.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = module.title;
        content.append(heading);

        const objectivesLabel = document.createElement("h3");
        objectivesLabel.textContent = "Module Objectives";
        content.append(objectivesLabel);
        const objectiveList = document.createElement("ul");
        if (Array.isArray(module.learningObjectives)) {
            module.learningObjectives.forEach(objective => {
                if (typeof objective !== "string") return;
                const item = document.createElement("li");
                item.textContent = objective;
                objectiveList.append(item);
            });
        }
        content.append(objectiveList);

        if (Array.isArray(module.content)) {
            module.content.forEach(block => {
                const element = renderContentBlock(block);
                if (element) content.append(element);
            });
        }

        // Future test/SQL database integration can be inserted here before handleContinue advances.
        const controls = document.createElement("div");
        controls.className = "training-module-controls";
        if (currentModuleIndex > 0) {
            const back = document.createElement("button");
            back.type = "button";
            back.className = "btn btn-secondary";
            back.textContent = "Go Back";
            back.addEventListener("click", () => navigateToModule(currentModuleIndex - 1, true));
            controls.append(back);
        }

        if (currentModuleIndex < selectedCourse.modules.length - 1) {
            const next = document.createElement("button");
            next.type = "button";
            next.className = "btn btn-primary";
            next.textContent = "Continue";
            next.addEventListener("click", handleContinue);
            controls.append(next);
        } else {
            const complete = document.createElement("button");
            complete.type = "button";
            complete.className = "btn btn-primary";
            if (progress.courseCompleted) {
                complete.textContent = "Course Completed";
                complete.disabled = true;
                const success = document.createElement("p");
                success.className = "training-success";
                success.setAttribute("role", "status");
                success.textContent = "Success: this course is complete.";
                content.append(success);
            } else {
                complete.textContent = "Mark Complete";
                complete.addEventListener("click", handleMarkComplete);
            }
            controls.append(complete);
        }
        content.append(controls);
    }

    function navigateToModule(index, addHistory) {
        if (!Number.isInteger(index) || index < 0 || index >= selectedCourse.modules.length) return;
        const module = selectedCourse.modules[index];
        if (!isModuleUnlocked(module.id)) {
            const permitted = getFirstIncompleteModule();
            const permittedIndex = selectedCourse.modules.findIndex(item => item.id === permitted.id);
            navigateToModule(permittedIndex, addHistory);
            return;
        }
        currentModuleIndex = index;
        progress.currentModuleId = module.id;
        progress.lastViewedModuleId = module.id;
        saveCourseProgress();
        renderModuleSidebar();
        renderModuleContent();
        renderProgress();
        const url = new URL(window.location.href);
        url.searchParams.set("course", selectedCourse.id);
        url.searchParams.set("module", module.id);
        if (addHistory) history.pushState({ courseId: selectedCourse.id, moduleId: module.id }, "", url);
        else history.replaceState({ courseId: selectedCourse.id, moduleId: module.id }, "", url);
        document.getElementById("moduleContent").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function resetCourseProgress() {
        if (!window.confirm("Reset progress for this course only?")) return;
        const store = readProgressStore();
        delete store[selectedCourse.id];
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to reset training progress.", error);
        }
        progress = loadCourseProgress(selectedCourse);
        const url = new URL(window.location.href);
        url.searchParams.set("course", selectedCourse.id);
        url.searchParams.delete("module");
        history.replaceState({}, "", url);
        navigateToModule(0, false);
        renderProgress();
    }

    window.addEventListener("popstate", () => {
        if (!selectedCourse) return;
        const requestedId = new URLSearchParams(window.location.search).get("module");
        const requestedIndex = selectedCourse.modules.findIndex(module => module.id === requestedId);
        if (requestedIndex >= 0 && isModuleUnlocked(requestedId)) {
            navigateToModule(requestedIndex, false);
        } else {
            const permitted = getFirstIncompleteModule();
            const permittedIndex = selectedCourse.modules.findIndex(module => module.id === permitted.id);
            navigateToModule(permittedIndex, false);
        }
    });

    async function initialize() {
        const loaded = await loadCourses();
        if (!loaded) return;
        const courseId = getCourseFromUrl();
        if (!courseId) {
            showError("No course was selected.");
            window.setTimeout(() => { window.location.replace("required-training.html"); }, 1500);
            return;
        }
        selectedCourse = findCourseById(courseId);
        if (!selectedCourse) {
            showError("The requested course could not be found.");
            window.setTimeout(() => { window.location.replace("required-training.html"); }, 1500);
            return;
        }
        progress = loadCourseProgress(selectedCourse);
        renderCourseHeader();
        renderProgress();
        app.hidden = false;

        const requestedId = new URLSearchParams(window.location.search).get("module");
        let initialIndex = -1;
        if (requestedId) {
            const requestedIndex = selectedCourse.modules.findIndex(module => module.id === requestedId);
            if (requestedIndex >= 0 && isModuleUnlocked(requestedId)) initialIndex = requestedIndex;
        }
        if (initialIndex < 0) {
            const permitted = getFirstIncompleteModule();
            initialIndex = selectedCourse.modules.findIndex(module => module.id === permitted.id);
        }
        document.getElementById("resetCourseProgress").addEventListener("click", resetCourseProgress);
        navigateToModule(initialIndex, false);
    }

    initialize();
});
