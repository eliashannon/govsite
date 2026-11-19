document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "trainingProgress";
    const previewType = new URLSearchParams(window.location.search).get("preview");
    const previewMode = previewType === "1" || previewType === "editor";
    const progressStorage = previewMode ? sessionStorage : localStorage;
    const progressKey = previewMode ? "trainingPreviewProgress" : STORAGE_KEY;
    let courses = [];
    let selectedCourse = null;
    let progress = null;
    let currentModuleIndex = 0;
    const examStates = new Map();

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

    const isPlainObject = window.CourseSchema.isObject;
    const validateCourse = course => window.CourseSchema.validateCourse(course).length === 0;
    const validatePublishedCourse = course => window.CourseSchema.validateCourse(course, {
        complete:true, hierarchy:window.PortalData?.organizationHierarchy
    });

    async function loadCourses() {
        try {
            if (window.PortalDataReady) await window.PortalDataReady;
            const response = await fetch("data/courses.json", { cache: "no-store" });
            if (!response.ok) throw new Error(`Courses could not be loaded (${response.status}).`);
            const data = await response.json();
            if (!isPlainObject(data) || !Array.isArray(data.courses)) throw new Error("The course file has an invalid structure.");
            courses = data.courses.filter(validateCourse);
            let localStore = {};
            try {
                const parsed = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
                if (isPlainObject(parsed)) localStore = parsed;
            } catch (error) {
                console.error("Unable to load local prototype courses.", error);
            }
            const localCourses = Object.values(localStore).filter(course =>
                isPlainObject(course) && course.status === "published" && validatePublishedCourse(course).length === 0
            );
            const portalCourses = Array.isArray(window.PortalData?.courses)
                ? window.PortalData.courses.filter(validateCourse)
                : [];
            const merged = new Map(courses.map(course => [course.id, course]));
            portalCourses.forEach(course => merged.set(course.id, course));
            localCourses.forEach(course => merged.set(course.id, course));
            courses = [...merged.values()];
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
            const parsed = JSON.parse(progressStorage.getItem(progressKey) || "{}");
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
        if (continued.length === course.modules.length && raw.courseCompleted !== true) continued.pop();

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
            progressStorage.setItem(progressKey, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to persist training progress.", error);
        }
        return state;
    }

    function saveCourseProgress() {
        const store = readProgressStore();
        store[selectedCourse.id] = progress;
        try {
            progressStorage.setItem(progressKey, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to persist training progress.", error);
        }
        syncCatalogStatus();
    }

    function syncCatalogStatus() {
        if (previewMode) return;
        try {
            const completed = JSON.parse(localStorage.getItem("portal.completedCourses") || "[]");
            const inProgress = JSON.parse(localStorage.getItem("portal.inProgressCourses") || "[]");
            let completedIds = Array.isArray(completed) ? completed.filter(id => typeof id === "string") : [];
            let inProgressIds = Array.isArray(inProgress) ? inProgress.filter(id => typeof id === "string") : [];
            if (progress.courseCompleted) {
                completedIds = [...new Set([...completedIds, selectedCourse.id])];
                inProgressIds = inProgressIds.filter(id => id !== selectedCourse.id);
            } else if (progress.continuedModuleIds.length > 0) {
                inProgressIds = [...new Set([...inProgressIds, selectedCourse.id])];
                completedIds = completedIds.filter(id => id !== selectedCourse.id);
            }
            localStorage.setItem("portal.completedCourses", JSON.stringify(completedIds));
            localStorage.setItem("portal.inProgressCourses", JSON.stringify(inProgressIds));
        } catch (error) {
            console.error("Unable to synchronize course status with Training Courses.", error);
        }
    }

    function getFirstIncompleteModule() {
        return selectedCourse.modules.find(module => !progress.continuedModuleIds.includes(module.id))
            || selectedCourse.modules[selectedCourse.modules.length - 1];
    }

    function isModuleUnlocked(moduleId) {
        return progress.unlockedModuleIds.includes(moduleId);
    }

    function renderCourseHeader() {
        document.title = `${selectedCourse.title} | Training Portal`;
        const backLink = document.getElementById("courseBackLink");
        if (previewMode) {
            backLink.href = "ai-training-content-manager.html";
            backLink.textContent = "← Back to Course Builder";
            backLink.setAttribute("aria-label", "Back to Course Builder");
        } else {
            backLink.href = "required-training.html";
            backLink.textContent = "← Back to Training Courses";
            backLink.setAttribute("aria-label", "Back to Training Courses");
        }
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
        document.getElementById("courseProgressDetail").textContent = `${completedCount} of ${total} modules continued`;
        const track = document.getElementById("courseProgressBar");
        track.setAttribute("aria-valuenow", String(percent));
        track.setAttribute("aria-valuetext", `${percent}% of course modules completed`);
        const completion = document.getElementById("courseCompletion");
        completion.hidden = !progress.courseCompleted;
        if (progress.courseCompleted) {
            document.getElementById("courseCompletionTitle").textContent = selectedCourse.title;
            const returnLink = document.getElementById("courseCompletionReturn");
            returnLink.href = previewMode ? "ai-training-content-manager.html" : "required-training.html";
            returnLink.textContent = previewMode ? "Return to Course Builder" : "Return to Training Courses";
        }
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
            const moduleNumber = typeof module.sourceModuleNumber === "string" && module.sourceModuleNumber.trim()
                ? module.sourceModuleNumber : String(index + 1);
            button.setAttribute("aria-label",
                `Module ${moduleNumber}: ${module.title}${current ? ", current" : ""}${completed ? ", completed" : !unlocked ? ", locked" : ""}`);

            const position = document.createElement("span");
            position.className = "training-module-position";
            position.setAttribute("aria-hidden", "true");
            position.textContent = completed ? "✓" : !unlocked ? "🔒" : current ? "●" : String(index + 1);
            const title = document.createElement("span");
            title.className = "training-module-title";
            title.textContent = `Module ${moduleNumber}: ${module.title}`;
            const state = document.createElement("span");
            state.className = "training-module-state";
            state.textContent = current && completed ? "Current · Completed" : current ? "Current module" : completed ? "Completed" : !unlocked ? "Locked" : "Available";
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
        if (block.type === "table") {
            if (!Array.isArray(block.headers) || !Array.isArray(block.rows)) return null;
            const table = document.createElement("table");
            table.className = "training-content-table";
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            block.headers.forEach(headerText => {
                if (typeof headerText !== "string") return;
                const th = document.createElement("th");
                th.scope = "col";
                th.textContent = headerText;
                headerRow.append(th);
            });
            thead.append(headerRow);
            table.append(thead);
            const tbody = document.createElement("tbody");
            block.rows.forEach(row => {
                if (!Array.isArray(row)) return;
                const tr = document.createElement("tr");
                row.forEach(cell => {
                    if (typeof cell !== "string") return;
                    const td = document.createElement("td");
                    td.textContent = cell;
                    tr.append(td);
                });
                tbody.append(tr);
            });
            table.append(tbody);
            return table;
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
            if (!window.CourseSchema.safeUrl(block.url)) return null;
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
            if (!window.CourseSchema.safeUrl(block.src, true)) return null;
            const image = document.createElement("img");
            image.src = block.src;
            image.alt = typeof block.alt === "string" ? block.alt : "";
            return image;
        }
        // Unsupported blocks are skipped rather than interpreted as HTML.
        return null;
    }

    function getModuleExams(module) {
        const assessments = Array.isArray(module?.assessments)
            ? module.assessments.filter(exam =>
                window.CourseSchema.isObject(exam) && Array.isArray(exam.questions) && exam.questions.length > 0
            )
            : [];
        if (Array.isArray(module?.assessment?.questions) && module.assessment.questions.length > 0) {
            assessments.push({id:`legacy-${module.id}`, title:"Knowledge Check", questions:module.assessment.questions});
        }
        return assessments;
    }

    function getExamState(module, assessment) {
        const key = `${module.id}:${assessment.id}`;
        if (!examStates.has(key)) {
            examStates.set(key, {answers:[], submitted:false, passed:false, correct:0, score:0});
        }
        return examStates.get(key);
    }

    function isModulePassed(module) {
        const exams = getModuleExams(module);
        if (!exams.length) return true;
        return progress.continuedModuleIds.includes(module.id)
            || exams.every(assessment => getExamState(module, assessment).passed);
    }

    function submitExam(module, assessment) {
        const exam = getExamState(module, assessment);
        const questions = assessment.questions;
        if (questions.some((_, index) => !Number.isInteger(exam.answers[index]))) return;
        exam.correct = questions.filter((question, index) => exam.answers[index] === question.answerIndex).length;
        exam.score = Math.round((exam.correct / questions.length) * 100);
        exam.passed = exam.correct === questions.length;
        exam.submitted = true;
        renderModuleContent();
        document.getElementById(`examResult-${assessment.id}`)?.focus({preventScroll:true});
    }

    function retryExam(module, assessment) {
        const exam = getExamState(module, assessment);
        exam.answers = [];
        exam.submitted = false;
        exam.passed = false;
        renderModuleContent();
        const heading = document.getElementById(`examHeading-${assessment.id}`);
        if (typeof heading?.scrollIntoView === "function") heading.scrollIntoView({block:"start"});
        heading?.focus({preventScroll:true});
    }

    function handleContinue() {
        const module = selectedCourse.modules[currentModuleIndex];
        if (currentModuleIndex === selectedCourse.modules.length - 1) return;
        if (!isModulePassed(module)) return;
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
        if (!isModulePassed(finalModule)) return;
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
        document.getElementById("courseCompletion").focus({preventScroll:true});
        scrollToPageTop();
    }

    function renderModuleContent() {
        const module = selectedCourse.modules[currentModuleIndex];
        const content = document.getElementById("moduleContent");
        content.replaceChildren();

        const moduleLabel = document.createElement("p");
        moduleLabel.className = "training-module-label";
        const sourceNumber = typeof module.sourceModuleNumber === "string" && module.sourceModuleNumber.trim()
            ? module.sourceModuleNumber : String(currentModuleIndex + 1);
        moduleLabel.textContent = `Module ${sourceNumber}${currentModuleIndex === selectedCourse.modules.length - 1 ? " · Final module" : ""}`;
        content.append(moduleLabel);

        const heading = document.createElement("h2");
        heading.textContent = module.title;
        content.append(heading);

        const objectives = document.createElement("section");
        objectives.className = "training-module-objectives";
        const objectivesLabel = document.createElement("h3");
        objectivesLabel.textContent = "Module Objectives";
        objectives.append(objectivesLabel);
        const objectiveList = document.createElement("ul");
        if (Array.isArray(module.learningObjectives)) {
            module.learningObjectives.forEach(objective => {
                if (typeof objective !== "string") return;
                const item = document.createElement("li");
                item.textContent = objective;
                objectiveList.append(item);
            });
        }
        objectives.append(objectiveList);
        content.append(objectives);

        const material = document.createElement("section");
        material.className = "training-material";
        const materialLabel = document.createElement("h3");
        materialLabel.textContent = "Training Material";
        material.append(materialLabel);
        if (Array.isArray(module.content)) {
            module.content.forEach(block => {
                const element = renderContentBlock(block);
                if (element?.tagName === "TABLE") {
                    const container = document.createElement("div");
                    container.className = "training-table-scroll";
                    container.append(element);
                    material.append(container);
                } else if (element) material.append(element);
            });
        }
        content.append(material);

        if (currentModuleIndex === selectedCourse.modules.length - 1 && !progress.courseCompleted) {
            const reminder = document.createElement("aside");
            reminder.className = "training-callout training-callout-info";
            const title = document.createElement("strong");
            title.textContent = "Ready to complete?";
            const text = document.createElement("p");
            text.textContent = "Review the material above, then select Mark Complete to finish this course.";
            reminder.append(title, text);
            content.append(reminder);
        }

        const assessments = progress.continuedModuleIds.includes(module.id) ? [] : getModuleExams(module);
        const gated = assessments.some(assessment => !getExamState(module, assessment).passed);
        assessments.forEach((assessment, assessmentIndex) => {
            const exam = getExamState(module, assessment);
            const questions = assessment.questions;
            const examSection = document.createElement("section");
            examSection.className = "training-exam";
            const examHeading = document.createElement("h3");
            examHeading.id = `examHeading-${assessment.id}`;
            examHeading.tabIndex = -1;
            examHeading.textContent = assessment.title || (assessments.length > 1 ? `Exam ${assessmentIndex + 1}` : "Knowledge Check");
            let submitButton = null;
            const instructions = document.createElement("p");
            instructions.textContent = "Answer every question. You must score 100% to continue.";
            examSection.append(examHeading, instructions);
            questions.forEach((question, questionIndex) => {
                const fieldset = document.createElement("fieldset");
                fieldset.className = "training-exam-question";
                const legend = document.createElement("legend");
                legend.textContent = `${questionIndex + 1}. ${question.prompt}`;
                fieldset.append(legend);
                question.choices.forEach((choice, choiceIndex) => {
                    const label = document.createElement("label");
                    label.className = "training-exam-choice";
                    const input = document.createElement("input");
                    input.type = "radio";
                    input.name = `exam-question-${assessment.id}-${questionIndex}`;
                    input.value = String(choiceIndex);
                    input.checked = exam.answers[questionIndex] === choiceIndex;
                    input.disabled = exam.submitted;
                    input.addEventListener("change", () => {
                        exam.answers[questionIndex] = choiceIndex;
                        if (submitButton) submitButton.disabled = questions.some((_, index) => !Number.isInteger(exam.answers[index]));
                    });
                    const text = document.createElement("span");
                    text.textContent = choice;
                    label.append(input, text);
                    fieldset.append(label);
                });
                examSection.append(fieldset);
            });
            if (exam.submitted) {
                const result = document.createElement("p");
                result.id = `examResult-${assessment.id}`;
                result.tabIndex = -1;
                result.setAttribute("role", "status");
                if (exam.passed) {
                    result.className = "training-success";
                    result.textContent = assessment.title && assessment.title !== "Knowledge Check"
                        ? `Success: you passed ${assessment.title}.`
                        : "Success: you passed the knowledge check.";
                } else {
                    result.className = "training-exam-fail";
                    result.textContent = `You scored ${exam.score}% (${exam.correct} of ${questions.length} correct). You need 100% to continue.`;
                }
                examSection.append(result);
            }
            if (!exam.passed) {
                submitButton = document.createElement("button");
                submitButton.type = "button";
                submitButton.className = "btn btn-primary";
                if (exam.submitted) {
                    submitButton.textContent = assessments.length > 1 ? `Retry ${examHeading.textContent}` : "Retry";
                    submitButton.addEventListener("click", () => retryExam(module, assessment));
                } else {
                    submitButton.textContent = assessments.length > 1 ? `Submit ${examHeading.textContent}` : "Submit";
                    submitButton.disabled = questions.some((_, index) => !Number.isInteger(exam.answers[index]));
                    submitButton.addEventListener("click", () => submitExam(module, assessment));
                }
                examSection.append(submitButton);
            }
            content.append(examSection);
        });

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

        if (!gated && currentModuleIndex < selectedCourse.modules.length - 1) {
            const next = document.createElement("button");
            next.type = "button";
            next.className = "btn btn-primary";
            next.textContent = "Continue";
            next.addEventListener("click", handleContinue);
            controls.append(next);
        } else if (!gated) {
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

    function scrollToCourseTop() {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({top:0, behavior:reducedMotion ? "auto" : "smooth"});
    }

    function scrollToCourseProgress() {
        const progressSection = document.getElementById("courseProgressSection");
        if (typeof progressSection?.scrollIntoView === "function") {
            const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            progressSection.scrollIntoView({behavior:reducedMotion ? "auto" : "smooth", block:"start"});
        } else {
            const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({top:84, behavior:reducedMotion ? "auto" : "smooth"});
        }
    }

    function scrollToPageTop() {
        scrollToCourseTop();
    }

    function navigateToModule(index, addHistory, recordLastViewed = true) {
        if (!Number.isInteger(index) || index < 0 || index >= selectedCourse.modules.length) return;
        const module = selectedCourse.modules[index];
        if (!isModuleUnlocked(module.id)) {
            const permitted = getFirstIncompleteModule();
            const permittedIndex = selectedCourse.modules.findIndex(item => item.id === permitted.id);
            navigateToModule(permittedIndex, addHistory, recordLastViewed);
            return;
        }
        currentModuleIndex = index;
        progress.currentModuleId = module.id;
        if (recordLastViewed) progress.lastViewedModuleId = module.id;
        saveCourseProgress();
        renderModuleSidebar();
        renderModuleContent();
        renderProgress();
        const url = new URL(window.location.href);
        url.searchParams.set("course", selectedCourse.id);
        url.searchParams.set("module", module.id);
        if (addHistory) history.pushState({ courseId: selectedCourse.id, moduleId: module.id }, "", url);
        else history.replaceState({ courseId: selectedCourse.id, moduleId: module.id }, "", url);
        scrollToCourseProgress();
    }

    function resetCourseProgress() {
        if (!window.confirm("Reset progress for this course only?")) return;
        const store = readProgressStore();
        delete store[selectedCourse.id];
        try {
            progressStorage.setItem(progressKey, JSON.stringify(store));
        } catch (error) {
            console.error("Unable to reset training progress.", error);
        }
        if (!previewMode) {
            try {
                for (const key of ["portal.completedCourses", "portal.inProgressCourses"]) {
                    const ids = JSON.parse(localStorage.getItem(key) || "[]");
                    if (!Array.isArray(ids)) throw new Error(`Invalid course status list: ${key}`);
                    localStorage.setItem(key, JSON.stringify(ids.filter(id => id !== selectedCourse.id)));
                }
            } catch (error) {
                console.error("Unable to reset the course status in Training Courses.", error);
            }
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
        if (previewMode) {
            let profile;
            try {
                profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
                if (previewType === "editor") selectedCourse = JSON.parse(sessionStorage.getItem("trainingEditorPreview") || "null");
                else {
                    const store = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
                    selectedCourse = store[getCourseFromUrl()];
                }
            } catch (error) {
                console.error("Unable to load the course preview.", error);
                showError("Unable to load the course preview from browser storage.");
                return;
            }
            if (!profile || profile.isMaster !== true || typeof profile.email !== "string"
                || profile.email.toLowerCase() !== "elias@navy.mil") {
                showError("Course previews are available only to the master account.");
                return;
            }
            if (!validateCourse(selectedCourse) || selectedCourse.id !== getCourseFromUrl()) {
                showError("The saved course is unavailable or invalid. Return to the Content Manager and submit it again.");
                return;
            }
            const controls = document.getElementById("courseReviewControls");
            controls.hidden = false;
            const approve = document.getElementById("approvePreviewCourse");
            const reject = document.getElementById("rejectPreviewCourse");
            const notice = document.getElementById("courseReviewNotice");
            const renderReviewControls = () => {
                let inCourseBuilder = false;
                try {
                    inCourseBuilder = previewType !== "editor" && window.CourseWorkflow.zone(selectedCourse) === "course";
                } catch (error) {
                    console.error("Unable to determine the course location.", error);
                    notice.textContent = error instanceof Error ? error.message : "Unable to determine the course location.";
                    approve.hidden = reject.hidden = true;
                    return;
                }
                approve.hidden = !inCourseBuilder || selectedCourse.status !== "needs-review";
                reject.hidden = !inCourseBuilder || !["needs-review", "approved"].includes(selectedCourse.status);
                approve.disabled = reject.disabled = false;
                const errors = previewType === "editor" ? [] : validatePublishedCourse(selectedCourse);
                approve.disabled = errors.length > 0;
                notice.textContent = previewType === "editor"
                    ? "Editor preview only. Submit the draft to Course Builder for approval."
                    : errors.length
                        ? `Course validation failed: ${errors.join(" ")}`
                        : `Course status: ${selectedCourse.status}. ${selectedCourse.status === "published" ? "Unpublish in Published Courses before moving or rejecting." : inCourseBuilder && selectedCourse.status === "approved" ? "Move to Published Courses to publish." : ""}`;
            };
            renderReviewControls();
            const decide = async action => {
                approve.disabled = reject.disabled = true;
                try {
                    const currentProfile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
                    if (!currentProfile || currentProfile.isMaster !== true || typeof currentProfile.email !== "string"
                        || currentProfile.email.toLowerCase() !== "elias@navy.mil") {
                        throw new Error("Only the master account can approve or publish a course.");
                    }
                    const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
                    if (JSON.stringify(records[selectedCourse.id]) !== JSON.stringify(selectedCourse)) {
                        throw new Error("The course changed since this preview opened. Return to Course Builder and reopen it.");
                    }
                    if (window.CourseWorkflow.zone(records[selectedCourse.id]) !== "course") {
                        throw new Error("Return the unpublished course to Course Builder before reviewing it.");
                    }
                    if ((action === "approve" && selectedCourse.status !== "needs-review")
                        || (action === "reject" && !["needs-review", "approved"].includes(selectedCourse.status))) {
                        throw new Error("This action is not available for the current course status.");
                    }
                    if (action !== "reject") {
                        const errors = validatePublishedCourse(selectedCourse);
                        if (errors.length) throw new Error(`Course validation failed: ${errors.join(" ")}`);
                    }
                    const updated = {...selectedCourse, status: action === "approve" ? "approved" : "rejected"};
                    records[selectedCourse.id] = updated;
                    localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
                    try {
                        await window.TrainingContentStore.saveMany({reviews: [{
                            contentId: `structured-course-${selectedCourse.id}`,
                            status: action === "approve" ? "Approved" : "Rejected", reviewedAt: new Date().toISOString(), reviewer: profile.email
                        }]});
                    } catch (error) {
                        records[selectedCourse.id] = selectedCourse;
                        localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
                        throw error;
                    }
                    selectedCourse = updated;
                    renderReviewControls();
                } catch (error) {
                    console.error("Unable to save the course decision.", error);
                    notice.textContent = error instanceof Error ? error.message : "Unable to save the course decision.";
                    if (!/changed since this preview|Only the master account/.test(notice.textContent)) {
                        reject.disabled = false;
                        approve.disabled = validatePublishedCourse(selectedCourse).length > 0;
                    }
                }
            };
            approve.addEventListener("click", () => decide("approve"));
            reject.addEventListener("click", () => decide("reject"));
        } else {
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
        }
        progress = loadCourseProgress(selectedCourse);
        syncCatalogStatus();
        renderCourseHeader();
        renderProgress();
        app.hidden = false;

        const requestedId = new URLSearchParams(window.location.search).get("module");
        let initialIndex = -1;
        const isReload = performance.getEntriesByType?.("navigation")[0]?.type === "reload";
        if (requestedId && !isReload) {
            const requestedIndex = selectedCourse.modules.findIndex(module => module.id === requestedId);
            if (requestedIndex >= 0 && isModuleUnlocked(requestedId)) initialIndex = requestedIndex;
        }
        if (initialIndex < 0) {
            const permitted = getFirstIncompleteModule();
            initialIndex = selectedCourse.modules.findIndex(module => module.id === permitted.id);
        }
        document.getElementById("resetCourseProgress").addEventListener("click", resetCourseProgress);
        navigateToModule(initialIndex, false, false);
    }

    initialize();
});
