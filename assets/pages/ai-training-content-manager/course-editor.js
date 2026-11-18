document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "trainingManagerCourses";
    const dialog = document.getElementById("courseDraftDialog");
    const previewDialog = document.getElementById("coursePreviewDialog");
    let draft = null;
    let publishedCourseIds = new Set();

    const slug = value => String(value || "").toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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

    function saveLocalCourse(course) {
        if (!course || typeof course.id !== "string") return;
        const records = loadLocalCourses();
        records[course.id] = course;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function getLocalCourse(courseId) {
        return loadLocalCourses()[courseId] || null;
    }

    function deleteLocalCourse(courseId) {
        if (!courseId) return;
        const records = loadLocalCourses();
        delete records[courseId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function publishLocalCourse(courseId) {
        const course = getLocalCourse(courseId);
        if (!course) return;
        course.status = "published";
        saveLocalCourse(course);
    }

    function archiveLocalCourse(courseId) {
        const course = getLocalCourse(courseId);
        if (!course) return;
        course.status = "archived";
        saveLocalCourse(course);
    }

    const saveDraftStore = () => {
        if (!draft) return;
        if (!draft.id) {
            const suggestedId = slug(draft.title);
            draft.id = suggestedId || `draft-course-${Date.now().toString(36)}`;
            document.getElementById("courseEditorId").value = draft.id;
        }
        const course = canonicalCourse();
        saveLocalCourse(course);
    };

    const showDraftNotice = (message, isError = false) => {
        const notice = document.getElementById("courseDraftNotice");
        notice.textContent = message;
        notice.hidden = !message;
        notice.classList.toggle("is-error", isError);
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
            id: module.id || makeId("module"),
            sourceModuleNumber: module.sourceModuleNumber || String(index + 1),
            title: module.title || "",
            order: index + 1,
            estimatedMinutes: Number.isFinite(Number(module.estimatedMinutes)) ? Number(module.estimatedMinutes) : 10,
            learningObjectives: Array.isArray(module.learningObjectives) ? module.learningObjectives : [],
            content: Array.isArray(module.content) ? module.content : [],
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
                draft.modules.splice(moduleIndex + 1, 0, split);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                draft.warnings.push("A module split may have ambiguous source attribution; verify source traceability.");
                renderModules();
            });
            action("Merge", "Merge with the next module", () => {
                if (moduleIndex === draft.modules.length - 1) return;
                if (!window.confirm("Merge this module with the next module?")) return;
                const next = draft.modules[moduleIndex + 1];
                module.content.push(...next.content);
                module.learningObjectives = [...new Set([...module.learningObjectives, ...next.learningObjectives])];
                draft.modules.splice(moduleIndex + 1, 1);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                draft.warnings.push("Merged modules may have ambiguous source attribution; verify source traceability.");
                renderModules();
            });
            action("Delete", "Delete module", () => {
                if (!window.confirm("Delete this module and all of its content blocks?")) return;
                draft.modules.splice(moduleIndex, 1);
                draft.modules.forEach((item, index) => { item.order = index + 1; });
                renderModules();
            });
            header.append(titleLabel, sourceLabel, durationLabel, actions);

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
            });
            contentEditor.append(addBlock);
            card.append(header, objectives, contentEditor);
            container.append(card);
        });
    };

    const isValidCourseId = value => /^[a-z0-9][a-z0-9_-]*$/.test(value);
    const isSafeProtocol = urlValue => {
        if (typeof urlValue !== "string" || !urlValue.trim()) return false;
        const value = urlValue.trim();
        if (/^(javascript|data|vbscript):/i.test(value)) return false;
        if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
            try {
                const protocol = new URL(value).protocol;
                return protocol === "http:" || protocol === "https:";
            } catch (_) {
                return false;
            }
        }
        return value.startsWith("/") || value.includes("/") || value.includes(".") || true;
    };

    function validateDraftCourse() {
        if (!draft) return {errors:[],warnings:[]};
        readCourseFields();
        const errors = [];
        if (!draft.id) errors.push("Missing course ID.");
        else if (!isValidCourseId(draft.id)) errors.push("Course ID must use lowercase letters, numbers, hyphens, or underscores.");
        if (!draft.title) errors.push("Missing course title.");
        if (!draft.description) errors.push("Missing course description.");
        if (!draft.category) errors.push("Missing course category.");
        if (!draft.difficulty) errors.push("Missing course difficulty.");
        if (!Number.isFinite(draft.durationMinutes) || draft.durationMinutes <= 0) errors.push("Duration must be a positive number of minutes.");
        if (!draft.learningObjectives.length) errors.push("Add at least one course learning objective.");
        if (!draft.modules.length) errors.push("Add at least one module.");
        if (!draft.roleAssignments.length) errors.push("Add at least one Division, Branch, and Role assignment.");

        const moduleIds = new Set();
        draft.modules.forEach((module, index) => {
            const label = `Module ${module.sourceModuleNumber || index + 1}`;
            if (!module.id) errors.push(`${label} has no valid module ID.`);
            if (moduleIds.has(module.id)) errors.push(`Duplicate module ID: ${module.id}.`);
            moduleIds.add(module.id);
            if (!module.title) errors.push(`${label} has no title.`);
            if (!Array.isArray(module.content) || !module.content.length) errors.push(`${label} has no content.`);
            module.content.forEach((block, blockIndex) => {
                if (!["heading","paragraph","list","callout","link","image","table"].includes(block.type)) {
                    errors.push(`${label} block ${blockIndex + 1} has an unsupported type.`);
                }
                if (block.type === "link" && !isSafeProtocol(block.url)) errors.push(`${label} contains an unsafe or missing link.`);
                if (block.type === "image" && (typeof block.src !== "string" || !block.src.trim())) errors.push(`${label} has an image with no source.`);
            });
        });
        const duplicateAssignments = new Set();
        draft.roleAssignments.forEach(assignment => {
            const key = `${assignment.divisionId}|${assignment.branchId}|${assignment.roleId}`;
            if (duplicateAssignments.has(key)) errors.push(`Duplicate role assignment: ${key.replace(/\|/g," / ")}.`);
            duplicateAssignments.add(key);
        });
        publishedCourseIds.forEach(id => {
            if (id !== draft.id && false) errors.push("");
        });
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
        document.getElementById("approveCourseDraftButton").disabled = errors.length > 0 || draft.status === "archived";
        document.getElementById("publishCourseDraftButton").disabled = draft.status !== "approved";
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
            content: module.content.map(block => {
                if (!["heading","paragraph","list","callout","link","image","table"].includes(block.type)) return null;
                if (block.type === "link" && !isSafeProtocol(block.url)) return null;
                if (block.type === "image" && (!block.src || !block.src.trim())) return null;
                return JSON.parse(JSON.stringify(block));
            }).filter(Boolean),
            source: {
                fileName: draft.source?.fileName || "",
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
            source: draft.source?.fileName ? {fileName:draft.source.fileName} : {},
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

    const openDraftEditor = parsedDraft => {
        draft = normalizeParsedDraft(parsedDraft || createBlankDraft());
        populateCourseFields();
        populateAssignmentDivision();
        renderAssignments();
        renderModules();
        validateDraftCourse();
        dialog.showModal();
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

    const safePreviewText = (element, text) => {
        element.textContent = typeof text === "string" ? text : "";
    };

    const renderCoursePreview = () => {
        if (!draft) return;
        readCourseFields();
        const preview = document.getElementById("coursePreviewContent");
        preview.replaceChildren();
        const heading = document.createElement("h3");
        heading.textContent = draft.title || "Untitled course";
        const description = document.createElement("p");
        description.textContent = draft.description || "";
        const meta = document.createElement("div");
        meta.className = "course-preview-meta";
        [["Category",draft.category],["Difficulty",draft.difficulty],["Duration",draft.durationMinutes ? `${draft.durationMinutes} minutes` : ""]]
            .filter(([,value]) => value).forEach(([label,value]) => {
                const span = document.createElement("span");
                span.textContent = `${label}: ${value}`;
                meta.append(span);
            });
        const layout = document.createElement("div");
        layout.className = "course-preview-layout";
        const sidebar = document.createElement("aside");
        sidebar.className = "course-preview-sidebar";
        const content = document.createElement("article");
        content.className = "course-preview-module";
        const showModule = index => {
            [...sidebar.querySelectorAll("button")].forEach((button, buttonIndex) => {
                button.classList.toggle("current", buttonIndex === index);
            });
            content.replaceChildren();
            const module = draft.modules[index];
            if (!module) return;
            const title = document.createElement("h4");
            title.textContent = module.title || "Untitled module";
            content.append(title);
            (module.content || []).forEach(block => {
                let element = null;
                if (block.type === "heading") {
                    element = document.createElement(`h${Math.max(2, Math.min(4, Number(block.level) || 2))}`);
                    safePreviewText(element, block.text);
                } else if (block.type === "paragraph") {
                    element = document.createElement("p");
                    safePreviewText(element, block.text);
                } else if (block.type === "list") {
                    element = document.createElement(block.style === "ordered" ? "ol" : "ul");
                    (block.items || []).forEach(text => {
                        const item = document.createElement("li");
                        safePreviewText(item, text);
                        element.append(item);
                    });
                } else if (block.type === "callout") {
                    element = document.createElement("aside");
                    element.className = "training-callout";
                    const label = document.createElement("strong");
                    safePreviewText(label, block.title);
                    const text = document.createElement("p");
                    safePreviewText(text, block.text);
                    element.append(label, text);
                } else if (block.type === "link" && isSafeProtocol(block.url)) {
                    element = document.createElement("a");
                    safePreviewText(element, block.text || block.url);
                    element.href = block.url;
                    if (/^https?:\/\//i.test(block.url)) {
                        element.target = "_blank";
                        element.rel = "noopener noreferrer";
                    }
                } else if (block.type === "image" && block.src) {
                    element = document.createElement("img");
                    element.src = block.src;
                    element.alt = typeof block.alt === "string" ? block.alt : "";
                } else if (block.type === "table") {
                    element = document.createElement("table");
                    const head = document.createElement("thead");
                    const headRow = document.createElement("tr");
                    (block.headers || []).forEach(headerText => {
                        const th = document.createElement("th");
                        safePreviewText(th, headerText);
                        headRow.append(th);
                    });
                    head.append(headRow);
                    const body = document.createElement("tbody");
                    (block.rows || []).forEach(row => {
                        const tr = document.createElement("tr");
                        row.forEach(cell => {
                            const td = document.createElement("td");
                            safePreviewText(td, cell);
                            tr.append(td);
                        });
                        body.append(tr);
                    });
                    element.append(head, body);
                }
                if (element) {
                    element.classList?.add("course-preview-content-block");
                    content.append(element);
                }
            });
        };
        draft.modules.forEach((module, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = `${index + 1}. ${module.title || "Untitled module"}`;
            button.addEventListener("click", () => showModule(index));
            sidebar.append(button);
        });
        layout.append(sidebar, content);
        preview.append(heading, description, meta, layout);
        showModule(0);
        previewDialog.showModal();
    };

    const saveDraft = () => {
        if (!draft) return;
        readCourseFields();
        draft.status = "draft";
        document.getElementById("courseDraftStatus").value = "draft";
        saveDraftStore();
        validateDraftCourse();
        showDraftNotice("Draft saved in browser storage only. It is not an authoritative or secure repository.");
    };

    const statusTransition = status => {
        if (!draft) return;
        if (status === "published" && draft.status !== "approved") {
            showDraftNotice("Publishing requires an approved course.", true);
            return;
        }
        if (status === "needs-review") {
            const result = validateDraftCourse();
            if (result.errors.length) {
                showDraftNotice(`Submission blocked: ${result.errors.join(" ")}`, true);
                return;
            }
        }
        if (status === "approved") {
            const result = validateDraftCourse();
            if (result.errors.length) {
                showDraftNotice(`Approval blocked: ${result.errors.join(" ")}`, true);
                return;
            }
            draft.status = "approved";
            document.getElementById("courseDraftStatus").value = "approved";
        } else if (status === "published") {
            if (draft.status !== "approved") {
                showDraftNotice("Publishing requires an approved course.", true);
                return;
            }
            draft.status = "published";
            document.getElementById("courseDraftStatus").value = "published";
        } else {
            draft.status = status;
            document.getElementById("courseDraftStatus").value = status;
        }
        saveDraftStore();
        validateDraftCourse();
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

    document.getElementById("previewCourseDraftButton").addEventListener("click", () => {
        if (!draft) {
            const records = readDraftStore();
            const courseIds = Object.keys(records);
            if (courseIds.length) openDraftEditor(records[courseIds[courseIds.length - 1]]);
            else openDraftEditor(createBlankDraft());
        }
        renderCoursePreview();
    });
    document.getElementById("closeCourseDraftDialog").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    document.getElementById("closeCoursePreviewDialog").addEventListener("click", () => previewDialog.close());
    previewDialog.addEventListener("click", event => {
        if (event.target === previewDialog) previewDialog.close();
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
    document.getElementById("reviewCourseDraftButton").addEventListener("click", () => statusTransition("needs-review"));
    document.getElementById("approveCourseDraftButton").addEventListener("click", () => statusTransition("approved"));
    document.getElementById("publishCourseDraftButton").addEventListener("click", () => statusTransition("published"));
    document.getElementById("archiveCourseDraftButton").addEventListener("click", () => statusTransition("archived"));
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
        Object.values(records).forEach(course => {
            if (!course || typeof course !== "object") return;
            const option = document.createElement("option");
            option.value = course.id;
            option.textContent = `${course.title || course.id} — ${course.status || "draft"} — v${course.version || "1.0"}`;
            select.append(option);
        });
        const hasSelection = Boolean(select.value);
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
        document.getElementById("deleteSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("archiveSelectedLocalCourseButton").disabled = !hasSelection;
        document.getElementById("exportSelectedLocalCourseButton").disabled = !hasSelection;
    });
    document.getElementById("savedLocalCourses").addEventListener("dblclick", event => {
        const course = getLocalCourse(event.target.value);
        if (course) {
            openDraftEditor(course);
            showDraftNotice(`Opened local course ${course.id}.`);
        }
    });
    document.getElementById("deleteSelectedLocalCourseButton").addEventListener("click", () => {
        const courseId = document.getElementById("savedLocalCourses").value;
        if (!courseId) return;
        if (!window.confirm(`Delete local prototype course "${courseId}"?`)) return;
        deleteLocalCourse(courseId);
        renderSavedLocalCourses();
        showDraftNotice(`Deleted local course ${courseId}.`);
    });
    document.getElementById("archiveSelectedLocalCourseButton").addEventListener("click", () => {
        const courseId = document.getElementById("savedLocalCourses").value;
        if (!courseId) return;
        archiveLocalCourse(courseId);
        renderSavedLocalCourses();
        showDraftNotice(`Archived local course ${courseId}.`);
    });
    document.getElementById("clearLocalCoursesButton").addEventListener("click", () => {
        if (!window.confirm("Clear all prototype courses from trainingManagerCourses? This cannot be undone.")) return;
        localStorage.removeItem(STORAGE_KEY);
        renderSavedLocalCourses();
        showDraftNotice("Cleared all prototype courses from this browser.");
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
            normalized.status = ["draft","needs-review","approved","published","archived"].includes(normalized.status)
                ? normalized.status : "draft";
            saveLocalCourse(normalized);
            renderSavedLocalCourses();
            openDraftEditor(normalized);
            showDraftNotice(`Imported local course ${normalized.id}.`);
        } catch (error) {
            showDraftNotice(error instanceof Error ? error.message : "Unable to import course JSON.", true);
        } finally {
            event.target.value = "";
        }
    });

    fetch("data/courses.json").then(response => {
        if (!response.ok) throw new Error("Existing course IDs could not be checked.");
        return response.json();
    }).then(data => {
        if (Array.isArray(data?.courses)) {
            data.courses.forEach(course => {
                if (typeof course?.id === "string") publishedCourseIds.add(course.id);
            });
        }
    }).catch(error => console.error("Unable to load existing course IDs for duplicate validation.", error));
    renderSavedLocalCourses();
});
