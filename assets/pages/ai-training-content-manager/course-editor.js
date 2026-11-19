document.addEventListener("DOMContentLoaded", () => {
    let profile;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the current account profile.", error);
    }
    if (!profile || profile.isMaster !== true || typeof profile.email !== "string"
        || profile.email.toLowerCase() !== "elias@navy.mil") return;
    const STORAGE_KEY = "trainingManagerCourses";
    const dialog = document.getElementById("courseDraftDialog");
    let draft = null;
    let editingCourseId = null;

    const slug = value => String(value || "").toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

    const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const readDraftStore = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            console.error("The local course draft store was repaired.", error);
            return {};
        }
    };

    function loadLocalCourses() {
        return readDraftStore();
    }

    function saveLocalCourse(course, key = course?.id) {
        if (!course || typeof course.id !== "string") return;
        const records = loadLocalCourses();
        records[key] = course;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function getLocalCourse(courseId) {
        const courses = loadLocalCourses();
        return Object.hasOwn(courses, courseId) ? courses[courseId] : null;
    }

    function deleteLocalCourse(courseId) {
        if (!courseId) return;
        const records = loadLocalCourses();
        delete records[courseId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function archiveLocalCourse(courseId) {
        const course = getLocalCourse(courseId);
        if (!course) return;
        course.status = "archived";
        saveLocalCourse(course);
    }

    function formatModuleSourceText(module) {
        const lines = [`${module.sourceModuleNumber ? `${module.sourceModuleNumber} ` : ""}${module.title || "Untitled module"}`];
        (Array.isArray(module.content) ? module.content : []).forEach(block => {
            if (!block || typeof block !== "object") return;
            if (block.type === "heading" || block.type === "paragraph") lines.push(block.text || "");
            else if (block.type === "list") lines.push(...(Array.isArray(block.items) ? block.items : []));
            else if (block.type === "callout") lines.push([block.title, block.text].filter(Boolean).join(": "));
            else if (block.type === "link") lines.push(`${block.text || "Link"}: ${block.url || ""}`);
            else if (block.type === "image") lines.push(block.alt || "Image");
            else if (block.type === "table") {
                if (Array.isArray(block.headers)) lines.push(block.headers.join(" | "));
                (Array.isArray(block.rows) ? block.rows : []).forEach(row => {
                    if (Array.isArray(row)) lines.push(row.join(" | "));
                });
            }
        });
        return lines.filter(line => typeof line === "string" && line.trim()).join("\n\n");
    }

    async function sendCourseToContentExplorer(course, reviewStatus, previousCourseId = "") {
        if (!window.TrainingContentStore || !Array.isArray(course.modules) || !course.modules.length) {
            throw new Error("Course Builder storage is unavailable or the course has no modules.");
        }
        await window.PortalDataReady;
        const contentId = `structured-course-${course.id}`;
        const records = [{
            source: {
                id: contentId,
                documentId: contentId,
                originalDocumentName: course.source?.fileName || `${course.id}.json`,
                pageNumber: null,
                sectionNumber: "",
                sourceText: course.modules.map(formatModuleSourceText).join("\n\n"),
                structuredCourseId: course.id
            },
            metadata: {
                contentId,
                category: course.category || "Imported course",
                contentType: "Structured course",
                headingPath: [course.title || course.id],
                confidence: "Needs review",
                warnings: ["Review the complete course against its source before approval."]
            },
            review: {contentId, status: reviewStatus, reviewedAt: null, reviewer: ""}
        }];
        const oldIds = previousCourseId && previousCourseId !== course.id ? [`structured-course-${previousCourseId}`] : [];
        await window.TrainingContentStore.saveMany({
            sourceContent: records.map(item => item.source),
            organizationMetadata: records.map(item => item.metadata),
            reviews: records.map(item => item.review)
        }, oldIds.length ? {sourceContent:oldIds, organizationMetadata:oldIds, reviews:oldIds} : {});
        if (oldIds.length) window.dispatchEvent(new CustomEvent("training-content-removed", {detail:{contentIds:oldIds}}));
        window.dispatchEvent(new CustomEvent("training-content-imported", {
            detail: {
                sourceContent: records.map(item => item.source),
                organizationMetadata: records.map(item => item.metadata),
                reviews: records.map(item => item.review)
            }
        }));
        return records.length;
    }

    const saveDraftStore = () => {
        if (!draft) return;
        const key = draft.id || editingCourseId || makeId("draft");
        const records = loadLocalCourses();
        if (["__proto__", "constructor", "prototype"].includes(key.toLowerCase())) {
            throw new Error("Choose a course ID that is not a reserved name.");
        }
        if (Object.hasOwn(records, key) && key !== editingCourseId) {
            throw new Error("Course ID already exists in local storage. Choose a different ID.");
        }
        const course = canonicalCourse();
        if (editingCourseId && editingCourseId !== key) delete records[editingCourseId];
        records[key] = course;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return key;
    };

    const showDraftNotice = (message, isError = false) => {
        const notice = document.getElementById(dialog.open ? "courseDraftNotice" : "managerNotice");
        notice.textContent = message;
        notice.hidden = !message;
        notice.classList.toggle("is-error", isError);
    };

    const canEditCourse = course => {
        if (!course) return true;
        try {
            if (window.CourseWorkflow.zone(course) === "course") return true;
            showDraftNotice("Unpublish and move this course back to Course Builder before editing it.", true);
        } catch (error) {
            console.error("Unable to determine the course location.", error);
            showDraftNotice(error instanceof Error ? error.message : "Unable to determine the course location.", true);
        }
        return false;
    };

    const createBlankDraft = fileName => ({
        id: "",
        title: "",
        shortDescription: "",
        description: "",
        category: "",
        durationMinutes: 0,
        difficulty: "",
        learningObjectives: [],
        version: "1.0",
        roleAssignments: [],
        status: "draft",
        source: {fileName: fileName || ""},
        modules: [],
        warnings: []
    });

    const normalizeParsedDraft = parsed => {
        const normalized = {...createBlankDraft(parsed.source?.fileName || ""), ...parsed};
        normalized.modules = (Array.isArray(parsed.modules) ? parsed.modules : []).map((module, index) => ({
            id: module.id || "",
            sourceModuleNumber: module.sourceModuleNumber || String(index + 1),
            title: module.title || "",
            order: index + 1,
            estimatedMinutes: Number.isFinite(Number(module.estimatedMinutes)) ? Number(module.estimatedMinutes) : 10,
            learningObjectives: Array.isArray(module.learningObjectives) ? module.learningObjectives : [],
            content: Array.isArray(module.content) ? module.content : [],
            ...(isObject(module.assessment) ? {assessment:JSON.parse(JSON.stringify(module.assessment))} : {}),
            ...(Array.isArray(module.assessments) ? {assessments:JSON.parse(JSON.stringify(module.assessments))} : {}),
            source: module.source || {fileName: parsed.source?.fileName || ""}
        }));
        normalized.roleAssignments = (Array.isArray(parsed.roleAssignments) ? parsed.roleAssignments : []).map(item => ({
            divisionId: slug(item.divisionId || ""),
            branchId: slug(item.branchId || ""),
            roleId: slug(item.roleId || ""),
            required: item.required !== false
        })).filter(item => item.divisionId && item.branchId && item.roleId);
        return normalized;
    };

    const readCourseFields = () => {
        draft.id = document.getElementById("courseEditorId").value.trim();
        draft.title = document.getElementById("courseEditorTitle").value.trim();
        draft.shortDescription = document.getElementById("courseEditorShortDescription").value.trim();
        draft.description = document.getElementById("courseEditorDescription").value.trim();
        draft.category = document.getElementById("courseEditorCategory").value.trim();
        draft.difficulty = document.getElementById("courseEditorDifficulty").value;
        draft.durationMinutes = Number(document.getElementById("courseEditorDuration").value) || 0;
        draft.version = document.getElementById("courseEditorVersion").value.trim();
        draft.learningObjectives = document.getElementById("courseEditorObjectives").value
            .split(/\n/).map(item => item.trim()).filter(Boolean);
        draft.status = document.getElementById("courseDraftStatus").value;
    };

    const populateCourseFields = () => {
        document.getElementById("courseEditorId").value = draft.id || "";
        document.getElementById("courseEditorTitle").value = draft.title || "";
        document.getElementById("courseEditorShortDescription").value = draft.shortDescription || "";
        document.getElementById("courseEditorDescription").value = draft.description || "";
        document.getElementById("courseEditorCategory").value = draft.category || "";
        document.getElementById("courseEditorDifficulty").value = draft.difficulty || "";
        document.getElementById("courseEditorDuration").value = draft.durationMinutes || "";
        document.getElementById("courseEditorVersion").value = draft.version || "1.0";
        document.getElementById("courseEditorSourceFile").value = draft.source?.fileName || "";
        document.getElementById("courseEditorObjectives").value = (draft.learningObjectives || []).join("\n");
        document.getElementById("courseDraftStatus").value = draft.status || "draft";
    };

    const contentBlockEditor = (block, moduleIndex, blockIndex) => {
        const type = ["heading","paragraph","list","callout","link","image","table"].includes(block.type) ? block.type : "paragraph";
        const wrapper = document.createElement("div");
        wrapper.className = "course-content-block";
        wrapper.dataset.moduleIndex = String(moduleIndex);
        wrapper.dataset.blockIndex = String(blockIndex);

        const select = document.createElement("select");
        select.className = "form-control";
        select.setAttribute("aria-label", `Content block ${blockIndex + 1} type`);
        ["heading","paragraph","list","callout","link","image","table"].forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            option.selected = value === type;
            select.append(option);
        });

        const fields = document.createElement("div");
        fields.className = "course-block-fields";
        const renderFields = () => {
            fields.replaceChildren();
            const current = draft.modules[moduleIndex].content[blockIndex];
            const addTextField = (label, property, value) => {
                const fieldLabel = document.createElement("label");
                fieldLabel.textContent = label;
                const input = document.createElement("textarea");
                input.className = "form-control";
                input.rows = property === "items" || property === "headers" || property === "rows" ? 3 : 2;
                input.value = Array.isArray(value) ? value.join("\n") : value || "";
                input.dataset.property = property;
                input.addEventListener("input", () => {
                    if (property === "items" || property === "headers" || property === "rows") {
                        current[property] = input.value.split(/\n/).map(item => item.trim()).filter(Boolean);
                        if (property === "rows") current.rows = input.value ? input.value.split(/\n/).map(line => line.split("|").map(item => item.trim())) : [];
                    } else if (property === "level") {
                        current[property] = Number(input.value) || 2;
                    } else current[property] = input.value;
                    validateDraftCourse();
                });
                fieldLabel.append(input);
                fields.append(fieldLabel);
            };
            if (current.type === "heading") {
                addTextField("Heading level", "level", String(current.level || 2));
                addTextField("Heading text", "text", current.text);
            } else if (current.type === "paragraph") addTextField("Paragraph", "text", current.text);
            else if (current.type === "list") {
                addTextField("List style (unordered or ordered)", "style", current.style || "unordered");
                addTextField("List items (one per line)", "items", current.items);
            } else if (current.type === "callout") {
                addTextField("Callout variant", "variant", current.variant || "info");
                addTextField("Callout title", "title", current.title);
                addTextField("Callout text", "text", current.text);
            } else if (current.type === "link") {
                addTextField("Link text", "text", current.text);
                addTextField("Safe HTTP, HTTPS, or relative URL", "url", current.url);
            } else if (current.type === "image") {
                addTextField("Relative image source", "src", current.src);
                addTextField("Alternative text", "alt", current.alt);
            } else if (current.type === "table") {
                addTextField("Table headers (one per line)", "headers", current.headers);
                addTextField("Table rows (pipe-separated, one row per line)", "rows", (current.rows || []).map(row => row.join("|")));
            }
        };
        select.addEventListener("change", () => {
            const selected = select.value;
            draft.modules[moduleIndex].content[blockIndex] = selected === "heading" ? {type:selected,level:2,text:""}
                : selected === "list" ? {type:selected,style:"unordered",items:[""]}
                : selected === "callout" ? {type:selected,variant:"info",title:"",text:""}
                : selected === "link" ? {type:selected,text:"",url:""}
                : selected === "image" ? {type:selected,src:"",alt:""}
                : selected === "table" ? {type:selected,headers:[],rows:[[]]}
                : {type:selected,text:""};
            renderModules();
            validateDraftCourse();
        });
        renderFields();

        const actions = document.createElement("div");
        actions.className = "course-block-actions";
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.setAttribute("aria-label", `Delete content block ${blockIndex + 1}`);
        deleteButton.addEventListener("click", () => {
            if (!window.confirm("Delete this content block?")) return;
            draft.modules[moduleIndex].content.splice(blockIndex, 1);
            renderModules();
            validateDraftCourse();
        });
        actions.append(deleteButton);
        wrapper.append(select, fields, actions);
        return wrapper;
    };

    const renderAssignments = () => {
        const list = document.getElementById("courseAssignmentList");
        list.replaceChildren();
        draft.roleAssignments.forEach((assignment, index) => {
            const item = document.createElement("div");
            item.className = "course-assignment-item";
            const text = document.createElement("span");
            text.textContent = `${assignment.divisionId} / ${assignment.branchId} / ${assignment.roleId} — ${assignment.required ? "Required" : "Recommended"}`;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "manager-small-button";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove assignment ${text.textContent}`);
            remove.addEventListener("click", () => {
                draft.roleAssignments.splice(index, 1);
                renderAssignments();
                validateDraftCourse();
            });
            item.append(text, remove);
            list.append(item);
        });
    };

    const renderModules = () => {
        const container = document.getElementById("courseModuleEditor");
        container.replaceChildren();
        draft.modules.forEach((module, moduleIndex) => {
            const card = document.createElement("section");
            card.className = "course-module-card";
            card.dataset.moduleIndex = String(moduleIndex);
            const header = document.createElement("div");
            header.className = "course-module-card-header";
            const idLabel = document.createElement("label");
            idLabel.textContent = "Module ID";
            const moduleId = document.createElement("input");
            moduleId.className = "form-control";
            moduleId.value = module.id || "";
            moduleId.addEventListener("input", () => { module.id = moduleId.value.trim(); validateDraftCourse(); });
            idLabel.append(moduleId);
            const titleLabel = document.createElement("label");
            titleLabel.textContent = "Module title";
            const title = document.createElement("input");
            title.className = "form-control";
            title.value = module.title || "";
            title.addEventListener("input", () => { module.title = title.value; validateDraftCourse(); });
            titleLabel.append(title);
            const sourceLabel = document.createElement("label");
            sourceLabel.textContent = "Source number";
            const source = document.createElement("input");
            source.className = "form-control";
            source.value = module.sourceModuleNumber || "";
            source.addEventListener("input", () => { module.sourceModuleNumber = source.value; });
            sourceLabel.append(source);
            const durationLabel = document.createElement("label");
            durationLabel.textContent = "Minutes";
            const duration = document.createElement("input");
            duration.className = "form-control";
            duration.type = "number";
            duration.min = "1";
            duration.value = module.estimatedMinutes || 10;
            duration.addEventListener("input", () => { module.estimatedMinutes = Number(duration.value) || 0; });
            durationLabel.append(duration);
            const actions = document.createElement("div");
            actions.className = "course-module-card-actions";
            const action = (text, label, handler) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = text;
                button.setAttribute("aria-label", label);
                button.addEventListener("click", handler);
                actions.append(button);
            };
            action("↑", "Move module up", () => {
                if (moduleIndex === 0) return;
                [draft.modules[moduleIndex - 1], draft.modules[moduleIndex]] =
                    [draft.modules[moduleIndex], draft.modules[moduleIndex - 1]];
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                renderModules();
            });
            action("↓", "Move module down", () => {
                if (moduleIndex === draft.modules.length - 1) return;
                [draft.modules[moduleIndex + 1], draft.modules[moduleIndex]] =
                    [draft.modules[moduleIndex], draft.modules[moduleIndex + 1]];
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                renderModules();
            });
            action("Split", "Split module at half of its content", () => {
                if (module.content.length < 2) return showDraftNotice("Add at least two content blocks before splitting.", true);
                if (!window.confirm("Split this module into two modules?")) return;
                const midpoint = Math.ceil(module.content.length / 2);
                const firstContent = module.content.slice(0, midpoint);
                const secondContent = module.content.slice(midpoint);
                module.content = firstContent;
                const split = {
                    ...structuredClone(module),
                    id: makeId(`${draft.id || "course"}-module`),
                    sourceModuleNumber: `${module.sourceModuleNumber || moduleIndex + 1}-split`,
                    title: `${module.title || "Module"} (continued)`,
                    learningObjectives: [],
                    content: secondContent,
                    source: {...module.source, section: `${module.sourceModuleNumber || ""} split`}
                };
                delete module.assessment;
                delete module.assessments;
                draft.modules.splice(moduleIndex + 1, 0, split);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                draft.warnings.push("A module split may have ambiguous source attribution; verify source traceability.");
                renderModules();
                validateDraftCourse();
            });
            action("Merge", "Merge with the next module", () => {
                if (moduleIndex === draft.modules.length - 1) return;
                if (!window.confirm("Merge this module with the next module?")) return;
                const next = draft.modules[moduleIndex + 1];
                module.content.push(...next.content);
                module.learningObjectives = [...new Set([...module.learningObjectives, ...next.learningObjectives])];
                const moduleAssessments = Array.isArray(module.assessments)
                    ? module.assessments
                    : Array.isArray(module.assessment?.questions)
                        ? [{id:`legacy-${module.id}`, title:"Knowledge Check", questions:module.assessment.questions}]
                        : [];
                const nextAssessments = Array.isArray(next.assessments)
                    ? next.assessments
                    : Array.isArray(next.assessment?.questions)
                        ? [{id:`legacy-${next.id}`, title:"Knowledge Check", questions:next.assessment.questions}]
                        : [];
                if (moduleAssessments.length || nextAssessments.length) {
                    module.assessments = [...moduleAssessments, ...nextAssessments];
                    delete module.assessment;
                }
                draft.modules.splice(moduleIndex + 1, 1);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                draft.warnings.push("Merged modules may have ambiguous source attribution; verify source traceability.");
                renderModules();
                validateDraftCourse();
            });
            action("Delete", "Delete module", () => {
                if (!window.confirm("Delete this module and all of its content blocks?")) return;
                draft.modules.splice(moduleIndex, 1);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                renderModules();
                validateDraftCourse();
            });
            header.append(idLabel, titleLabel, sourceLabel, durationLabel, actions);

            const objectives = document.createElement("div");
            objectives.className = "course-module-objectives";
            const objectiveLabel = document.createElement("label");
            objectiveLabel.textContent = "Module learning objectives (one per line)";
            const objectiveInput = document.createElement("textarea");
            objectiveInput.className = "form-control";
            objectiveInput.rows = 3;
            objectiveInput.value = (module.learningObjectives || []).join("\n");
            objectiveInput.addEventListener("input", () => {
                module.learningObjectives = objectiveInput.value.split(/\n/).map(item => item.trim()).filter(Boolean);
            });
            objectiveLabel.append(objectiveInput);
            objectives.append(objectiveLabel);

            const contentEditor = document.createElement("div");
            contentEditor.className = "course-module-content-editor";
            (module.content || []).forEach((block, blockIndex) => contentEditor.append(contentBlockEditor(block, moduleIndex, blockIndex)));
            const addBlock = document.createElement("button");
            addBlock.type = "button";
            addBlock.className = "btn btn-secondary";
            addBlock.textContent = "Add content block";
            addBlock.addEventListener("click", () => {
                module.content.push({type:"paragraph",text:""});
                renderModules();
                validateDraftCourse();
            });
            contentEditor.append(addBlock);
            card.append(header, objectives, contentEditor);
            container.append(card);
        });
    };

    function validateDraftCourse() {
        if (!draft) return {errors:[],warnings:[]};
        readCourseFields();
        const errors = window.CourseSchema.validateCourse(draft, {complete:true, hierarchy:window.PortalData?.organizationHierarchy});
        if (draft.id && getLocalCourse(draft.id) && draft.id !== editingCourseId) errors.push("Course ID already exists in local storage.");
        const warnings = [...(draft.warnings || [])];
        if (!draft.source?.fileName) warnings.push("No source filename was recorded.");
        if (!draft.modules.some(module => (module.learningObjectives || []).length)) warnings.push("No module objectives were found.");
        draft.modules.forEach(module => {
            if (!module.sourceModuleNumber) warnings.push(`Module "${module.title || "Untitled"}" has no source module number.`);
            if ((module.content || []).length === 1) warnings.push(`Module "${module.title || "Untitled"}" is unusually short.`);
        });
        const summary = document.getElementById("courseValidationSummary");
        summary.replaceChildren();
        if (errors.length) {
            const heading = document.createElement("strong");
            heading.textContent = `${errors.length} issue(s) must be resolved before approval.`;
            const list = document.createElement("ul");
            errors.forEach(errorText => {
                const item = document.createElement("li");
                item.textContent = errorText;
                list.append(item);
            });
            summary.append(heading, list);
            summary.classList.add("has-errors");
        } else summary.classList.remove("has-errors");
        if (warnings.length) {
            const warning = document.createElement("p");
            warning.textContent = `Warnings: ${[...new Set(warnings)].join(" ")}`;
            summary.append(warning);
        }
        document.getElementById("reviewCourseDraftButton").disabled = errors.length > 0 || draft.status === "archived";
        document.getElementById("exportCourseDraftButton").disabled =
            !["approved","published"].includes(draft.status);
        return {errors, warnings};
    }

    const canonicalCourse = () => {
        readCourseFields();
        const modules = draft.modules.map((module, index) => ({
            id: module.id,
            sourceModuleNumber: module.sourceModuleNumber,
            title: module.title,
            order: index + 1,
            estimatedMinutes: Number(module.estimatedMinutes) || 10,
            learningObjectives: [...module.learningObjectives],
            content: JSON.parse(JSON.stringify(module.content)),
            ...(isObject(module.assessment) ? {assessment:JSON.parse(JSON.stringify(module.assessment))} : {}),
            ...(Array.isArray(module.assessments) ? {assessments:JSON.parse(JSON.stringify(module.assessments))} : {}),
            source: {
                fileName: module.source?.fileName || draft.source?.fileName || "",
                ...(module.source?.page ? {page:module.source.page} : {}),
                ...(module.sourceModuleNumber ? {section:module.sourceModuleNumber} : {})
            }
        }));
        return {
            id: draft.id,
            title: draft.title,
            shortDescription: draft.shortDescription,
            description: draft.description,
            category: draft.category,
            durationMinutes: draft.durationMinutes,
            difficulty: draft.difficulty,
            prerequisites: [],
            learningObjectives: [...draft.learningObjectives],
            version: draft.version || "1.0",
            roleAssignments: draft.roleAssignments.map(item => ({...item, required:item.required !== false})),
            status: draft.status,
            managerZone: "course",
            source: {...draft.source},
            warnings: [...(draft.warnings || [])],
            modules
        };
    };

    const populateAssignmentDivision = () => {
        const divisionSelect = document.getElementById("courseAssignmentDivision");
        const hierarchy = window.PortalData?.organizationHierarchy || {};
        divisionSelect.replaceChildren();
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Select Division";
        divisionSelect.append(blank);
        Object.keys(hierarchy).forEach(name => {
            const option = document.createElement("option");
            option.value = slug(name);
            option.dataset.displayName = name;
            option.textContent = name;
            divisionSelect.append(option);
        });
        const branchSelect = document.getElementById("courseAssignmentBranch");
        branchSelect.disabled = true;
        branchSelect.replaceChildren();
        const roleSelect = document.getElementById("courseAssignmentRole");
        roleSelect.disabled = true;
        roleSelect.replaceChildren();
    };

    const populateAssignmentBranches = () => {
        const hierarchy = window.PortalData?.organizationHierarchy || {};
        const divisionSelect = document.getElementById("courseAssignmentDivision");
        const divisionName = [...divisionSelect.options].find(option => option.value === divisionSelect.value)?.dataset.displayName || "";
        const branches = hierarchy[divisionName] || {};
        const branchSelect = document.getElementById("courseAssignmentBranch");
        branchSelect.replaceChildren();
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Select Branch";
        branchSelect.append(blank);
        Object.keys(branches).forEach(name => {
            const option = document.createElement("option");
            option.value = slug(name);
            option.dataset.displayName = name;
            option.textContent = name;
            branchSelect.append(option);
        });
        branchSelect.disabled = !divisionSelect.value;
        const roleSelect = document.getElementById("courseAssignmentRole");
        roleSelect.disabled = true;
        roleSelect.replaceChildren();
    };

    const populateAssignmentRoles = () => {
        const hierarchy = window.PortalData?.organizationHierarchy || {};
        const divisionSelect = document.getElementById("courseAssignmentDivision");
        const branchSelect = document.getElementById("courseAssignmentBranch");
        const divisionName = [...divisionSelect.options].find(option => option.value === divisionSelect.value)?.dataset.displayName || "";
        const branchName = [...branchSelect.options].find(option => option.value === branchSelect.value)?.dataset.displayName || "";
        const roles = hierarchy[divisionName]?.[branchName] || [];
        const roleSelect = document.getElementById("courseAssignmentRole");
        roleSelect.replaceChildren();
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Select Role";
        roleSelect.append(blank);
        roles.forEach(name => {
            const option = document.createElement("option");
            option.value = slug(name);
            option.dataset.displayName = name;
            option.textContent = name;
            roleSelect.append(option);
        });
        roleSelect.disabled = !branchSelect.value;
    };

    const addCourseAssignment = () => {
        const division = document.getElementById("courseAssignmentDivision").value;
        const branch = document.getElementById("courseAssignmentBranch").value;
        const role = document.getElementById("courseAssignmentRole").value;
        if (!division || !branch || !role) {
            showDraftNotice("Select a Division, Branch, and Role before adding an assignment.", true);
            return;
        }
        const key = `${division}|${branch}|${role}`;
        if (draft.roleAssignments.some(item => `${item.divisionId}|${item.branchId}|${item.roleId}` === key)) {
            showDraftNotice("That role assignment already exists.", true);
            return;
        }
        draft.roleAssignments.push({
            divisionId: division,
            branchId: branch,
            roleId: role,
            required: document.getElementById("courseAssignmentRequired").value === "true"
        });
        renderAssignments();
        validateDraftCourse();
        showDraftNotice("Role assignment added.");
    };

    const openDraftEditor = (parsedDraft, savedCourseId = null) => {
        draft = normalizeParsedDraft(parsedDraft || createBlankDraft());
        editingCourseId = savedCourseId;
        populateCourseFields();
        populateAssignmentDivision();
        renderAssignments();
        renderModules();
        const result = validateDraftCourse();
        dialog.showModal();
        if (result.errors.length) {
            const firstMissing = [
                ["courseEditorId", draft.id], ["courseEditorTitle", draft.title],
                ["courseEditorDescription", draft.description], ["courseEditorCategory", draft.category],
                ["courseEditorDifficulty", draft.difficulty], ["courseEditorDuration", draft.durationMinutes],
                ["courseEditorObjectives", draft.learningObjectives.length]
            ].find(([, value]) => !value);
            if (firstMissing) document.getElementById(firstMissing[0]).focus();
        }
    };

    const downloadJson = (data, fileName) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    const saveDraft = async () => {
        if (!draft) return;
        readCourseFields();
        if (draft.id && getLocalCourse(draft.id) && draft.id !== editingCourseId) {
            showDraftNotice("Course ID already exists in local storage. Choose a different ID.", true);
            return;
        }
        const previous = getLocalCourse(editingCourseId);
        if (!canEditCourse(previous)) return;
        const previousStore = localStorage.getItem(STORAGE_KEY);
        const previousEditingId = editingCourseId;
        const previousStatus = draft.status;
        draft.status = "draft";
        document.getElementById("courseDraftStatus").value = "draft";
        try {
            editingCourseId = saveDraftStore();
            if (previous?.id && previous.id !== draft.id) await removeCourseEntries([previous.id]);
        } catch (error) {
            if (previousStore === null) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, previousStore);
            editingCourseId = previousEditingId;
            draft.status = previousStatus;
            document.getElementById("courseDraftStatus").value = previousStatus;
            showDraftNotice(error instanceof Error ? error.message : "Unable to save the course draft.", true);
            return;
        }
        window.dispatchEvent(new Event("training-course-changed"));
        validateDraftCourse();
        showDraftNotice("Draft saved in browser storage only. It is not an authoritative or secure repository.");
    };

    const statusTransition = async status => {
        if (!draft) return;
        const current = getLocalCourse(editingCourseId);
        if (!canEditCourse(current)) return;
        if (status === "needs-review") {
            const result = validateDraftCourse();
            if (result.errors.length) {
                showDraftNotice(`Submission blocked: ${result.errors.join(" ")}`, true);
                return;
            }
        }
        const previousStore = localStorage.getItem(STORAGE_KEY);
        const previousEditingId = editingCourseId;
        const previous = getLocalCourse(previousEditingId);
        const previousStatus = draft.status;
        draft.status = status;
        document.getElementById("courseDraftStatus").value = status;
        try {
            editingCourseId = saveDraftStore();
        } catch (error) {
            draft.status = previousStatus;
            document.getElementById("courseDraftStatus").value = previousStatus;
            throw error;
        }
        if (status === "needs-review") {
            try {
                await sendCourseToContentExplorer(canonicalCourse(), "Pending Review", previous?.id);
                renderSavedLocalCourses();
                dialog.close();
                showDraftNotice(`"${draft.title}" is in Course Builder for review. It is not yet in Training Courses.`);
                return;
            } catch (error) {
                if (previousStore === null) localStorage.removeItem(STORAGE_KEY);
                else localStorage.setItem(STORAGE_KEY, previousStore);
                draft.status = previousStatus;
                document.getElementById("courseDraftStatus").value = draft.status;
                editingCourseId = previousEditingId;
                validateDraftCourse();
                console.error("Unable to submit the course to Course Builder.", error);
                showDraftNotice(`Unable to submit the course: ${error.message}`, true);
                return;
            }
            if (previous?.id && previous.id !== draft.id) {
                try {
                    await removeCourseEntries([previous.id]);
                } catch (error) {
                    if (previousStore === null) localStorage.removeItem(STORAGE_KEY);
                    else localStorage.setItem(STORAGE_KEY, previousStore);
                    draft.status = previousStatus;
                    document.getElementById("courseDraftStatus").value = previousStatus;
                    editingCourseId = previousEditingId;
                    throw error;
                }
            }
        }
        validateDraftCourse();
        window.dispatchEvent(new Event("training-course-changed"));
        showDraftNotice(`Course status set to ${draft.status}.`);
    };

    document.getElementById("createCourseDraftButton").addEventListener("click", async () => {
        const input = document.getElementById("handbookFiles");
        if (!input.files.length) {
            showDraftNotice("Choose one DOCX, TXT, or Markdown file before creating a course draft.", true);
            return;
        }
        if (input.files.length > 1) {
            showDraftNotice("Choose one source file for this course draft.", true);
            return;
        }
        const file = input.files[0];
        const extension = file.name.toLowerCase().split(".").pop();
        if (!["docx","txt","md"].includes(extension)) {
            showDraftNotice("Course parsing supports DOCX, TXT, and Markdown files.", true);
            return;
        }
        if (file.size === 0 || file.size > 75 * 1024 * 1024) {
            showDraftNotice("Choose a non-empty course document smaller than 75 MB.", true);
            return;
        }
        showDraftNotice("Processing the course document locally. No AI service is used.");
        try {
            const parsed = await window.HandbookProcessor.extractCourse(file);
            openDraftEditor(parsed);
            showDraftNotice("Structured draft created locally. Review every extracted field before approval.");
        } catch (error) {
            console.error("Unable to create a course draft.", error);
            showDraftNotice(error instanceof Error ? error.message : "The course document could not be processed.", true);
        }
    });

    const openTrainingPreview = () => {
        if (!draft) {
            const records = readDraftStore();
            const courseIds = Object.keys(records);
            if (courseIds.length) openDraftEditor(records[courseIds[courseIds.length - 1]], courseIds[courseIds.length - 1]);
            else {
                showDraftNotice("Create or open a course draft before previewing it.", true);
                return;
            }
        }
        const course = canonicalCourse();
        if (!course.id || !course.title || !course.modules.length || course.modules.some(module => !module.title)) {
            showDraftNotice("Add a course ID, title, and at least one titled module before previewing.", true);
            return;
        }
        try {
            sessionStorage.setItem("trainingEditorPreview", JSON.stringify(course));
            const preview = window.open(`training.html?preview=editor&course=${encodeURIComponent(course.id)}`, "_blank");
            if (!preview) throw new Error("The preview could not be opened. Allow pop-ups and try again.");
        } catch (error) {
            console.error("Unable to open the course preview.", error);
            showDraftNotice(error instanceof Error ? error.message : "Unable to open the course preview.", true);
        }
    };
    document.getElementById("previewCourseDraftButton").addEventListener("click", openTrainingPreview);
    document.getElementById("previewEditingCourseButton").addEventListener("click", openTrainingPreview);
    document.getElementById("closeCourseDraftDialog").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    document.getElementById("courseAssignmentDivision").addEventListener("change", populateAssignmentBranches);
    document.getElementById("courseAssignmentBranch").addEventListener("change", populateAssignmentRoles);
    document.getElementById("addCourseAssignmentButton").addEventListener("click", addCourseAssignment);
    document.getElementById("addCourseModuleButton").addEventListener("click", () => {
        if (!draft) return;
        draft.modules.push({
            id: makeId(`${draft.id || "course"}-module`),
            sourceModuleNumber: String(draft.modules.length + 1),
            title: "",
            order: draft.modules.length + 1,
            estimatedMinutes: 10,
            learningObjectives: [],
            content: [{type:"paragraph",text:""}],
            source: {fileName:draft.source?.fileName || ""}
        });
        renderModules();
        validateDraftCourse();
    });
    document.getElementById("saveCourseDraftButton").addEventListener("click", saveDraft);
    document.getElementById("reviewCourseDraftButton").addEventListener("click", () => statusTransition("needs-review")
        .catch(error => showDraftNotice(error instanceof Error ? error.message : "Unable to submit for review.", true)));
    document.getElementById("archiveCourseDraftButton").addEventListener("click", () => statusTransition("archived")
        .catch(error => showDraftNotice(error instanceof Error ? error.message : "Unable to archive course.", true)));
    document.getElementById("exportCourseDraftButton").addEventListener("click", () => {
        if (!draft) return;
        if (!["approved","published"].includes(draft.status)) {
            showDraftNotice("Export is available after approval or publishing.", true);
            return;
        }
        const result = validateDraftCourse();
        if (result.errors.length) {
            showDraftNotice(`Export blocked: ${result.errors.join(" ")}`, true);
            return;
        }
        const course = canonicalCourse();
        downloadJson(course, `${course.id}.json`);
        showDraftNotice(`Exported approved course ${course.id}. Place it manually in data/courses.json or merge it into the courses wrapper.`);
    });
    ["courseEditorId","courseEditorTitle","courseEditorShortDescription","courseEditorDescription","courseEditorCategory",
     "courseEditorDifficulty","courseEditorDuration","courseEditorVersion","courseEditorObjectives","courseDraftStatus"]
        .forEach(id => document.getElementById(id).addEventListener("input", validateDraftCourse));

    const exportCourseJson = courseId => {
        const course = courseId ? getLocalCourse(courseId) : draft ? canonicalCourse() : null;
        if (!course) {
            showDraftNotice("Select a saved local course to export.", true);
            return;
        }
        downloadJson(course, `${course.id || "training-course"}.json`);
        showDraftNotice(`Exported backup JSON for ${course.id || "the selected course"}.`);
    };

    const renderSavedLocalCourses = () => {
        const select = document.getElementById("savedLocalCourses");
        select.replaceChildren();
        const records = loadLocalCourses();
        Object.entries(records).forEach(([key, course]) => {
            if (!course || typeof course !== "object") return;
            const option = document.createElement("option");
            option.value = key;
            option.textContent = `${course.title || course.id || "Untitled draft"} — ${course.status || "draft"} — v${course.version || "1.0"}`;
            select.append(option);
        });
        const hasSelection = Boolean(select.value);
        document.getElementById("openSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("deleteSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("archiveSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("exportSelectedLocalCourseButton").disabled = !hasSelection;
    };

    document.getElementById("viewLocalCoursesButton").addEventListener("click", () => {
        renderSavedLocalCourses();
        showDraftNotice("Saved local prototype courses are listed below.");
    });
    document.getElementById("savedLocalCourses").addEventListener("change", event => {
        const hasSelection = Boolean(event.target.value);
        document.getElementById("openSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("deleteSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("archiveSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("exportSelectedLocalCourseButton").disabled = !hasSelection;
    });
    document.getElementById("savedLocalCourses").addEventListener("dblclick", event => {
        const course = getLocalCourse(event.target.value);
        if (course) {
            openDraftEditor(course, event.target.value);
            showDraftNotice(`Opened local course ${course.id || "(no ID yet)"}.`);
        }
    });
    document.getElementById("openSelectedLocalCourseButton").addEventListener("click", () => {
        const key = document.getElementById("savedLocalCourses").value;
        const course = getLocalCourse(key);
        if (course) {
            openDraftEditor(course, key);
            showDraftNotice(`Opened local course ${course.id || "(no ID yet)"}.`);
        } else showDraftNotice("The selected course is no longer available.", true);
    });
    async function removeCourseEntries(courseIds) {
        const contentIds = courseIds.map(id => `structured-course-${id}`);
        await window.TrainingContentStore.saveMany({}, {
            sourceContent: contentIds, organizationMetadata: contentIds, reviews: contentIds
        });
        window.dispatchEvent(new CustomEvent("training-content-removed", {detail: {contentIds}}));
    }

    document.getElementById("deleteSelectedLocalCourseButton").addEventListener("click", async () => {
        const courseId = document.getElementById("savedLocalCourses").value;
        if (!courseId) return;
        if (getLocalCourse(courseId)?.status === "published") {
            showDraftNotice("Unpublish this course in Published Courses before deleting it.", true);
            return;
        }
        if (!window.confirm(`Delete local prototype course "${courseId}"?`)) return;
        try {
            await removeCourseEntries([courseId]);
            deleteLocalCourse(courseId);
            window.dispatchEvent(new Event("training-course-changed"));
            if (editingCourseId === courseId) { draft = null; editingCourseId = null; }
            renderSavedLocalCourses();
            showDraftNotice(`Deleted local course ${courseId}.`);
        } catch (error) {
            console.error("Unable to delete the local course.", error);
            showDraftNotice(error instanceof Error ? error.message : "Unable to delete the local course.", true);
        }
    });
    document.getElementById("archiveSelectedLocalCourseButton").addEventListener("click", () => {
        const courseId = document.getElementById("savedLocalCourses").value;
        if (!courseId) return;
        const course = getLocalCourse(courseId);
        if (!canEditCourse(course)) return;
        archiveLocalCourse(courseId);
        renderSavedLocalCourses();
        window.dispatchEvent(new Event("training-course-changed"));
        showDraftNotice(`Archived local course ${courseId}.`);
    });
    document.getElementById("clearLocalCoursesButton").addEventListener("click", async () => {
        if (Object.values(loadLocalCourses()).some(course => course?.status === "published")) {
            showDraftNotice("Unpublish all published courses before clearing prototype storage.", true);
            return;
        }
        if (!window.confirm("Clear all prototype courses from trainingManagerCourses? This cannot be undone.")) return;
        try {
            await removeCourseEntries(Object.keys(loadLocalCourses()));
            localStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new Event("training-course-changed"));
            draft = null;
            editingCourseId = null;
            renderSavedLocalCourses();
            showDraftNotice("Cleared all prototype courses from this browser.");
        } catch (error) {
            console.error("Unable to clear local courses.", error);
            showDraftNotice(error instanceof Error ? error.message : "Unable to clear local courses.", true);
        }
    });
    document.getElementById("exportSelectedLocalCourseButton").addEventListener("click", () => {
        exportCourseJson(document.getElementById("savedLocalCourses").value);
    });
    document.getElementById("importLocalCourseButton").addEventListener("click", () => {
        document.getElementById("importLocalCourseFile").click();
    });
    document.getElementById("importLocalCourseFile").addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showDraftNotice("The imported course JSON is too large.", true);
            event.target.value = "";
            return;
        }
        try {
            const parsed = JSON.parse(await file.text());
            const course = parsed && Array.isArray(parsed.courses) ? parsed.courses[0] : parsed;
            if (!course || typeof course !== "object" || typeof course.id !== "string") {
                throw new Error("The JSON does not contain a valid course object.");
            }
            const normalized = normalizeParsedDraft(course);
            if (getLocalCourse(normalized.id)) throw new Error("Course ID already exists in local storage. Delete or rename the existing course before importing.");
            normalized.status = "draft";
            normalized.managerZone = "course";
            saveLocalCourse(normalized);
            renderSavedLocalCourses();
            openDraftEditor(normalized, normalized.id);
            if (document.getElementById("sendImportToExplorer").checked) await statusTransition("needs-review");
            else showDraftNotice(`Imported ${normalized.id} as a draft.`);
        } catch (error) {
            showDraftNotice(error instanceof Error ? error.message : "Unable to import course JSON.", true);
        } finally {
            event.target.value = "";
        }
    });

    renderSavedLocalCourses();
});
