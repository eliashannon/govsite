document.addEventListener("DOMContentLoaded", () => {
    let profile;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the current account profile.", error);
        return;
    }
    if (!profile || profile.isMaster !== true || typeof profile.email !== "string"
        || profile.email.toLowerCase() !== "elias@navy.mil") return;

    const storageKey = "trainingManagerTqsDrafts";
    const sourceDialog = document.getElementById("tqsSourceDialog");
    const dialog = document.getElementById("tqsDraftDialog");
    const editor = document.getElementById("tqsModuleEditor");
    const unassignedEditor = document.getElementById("tqsUnassignedEditor");
    const draftList = document.getElementById("tqsDraftList");
    const roleSelect = document.getElementById("tqsEditorRole");
    const sourceSelect = document.getElementById("tqsSourceSelect");
    const hierarchy = window.PortalData.organizationHierarchy;
    const roles = Object.entries(hierarchy).flatMap(([division, branches]) =>
        Object.entries(branches).flatMap(([branch, names]) => names.map(role => ({division, branch, role}))));
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    let draft = null;
    let documents = [];

    const showNotice = (id, message, isError = false) => {
        const notice = document.getElementById(id);
        notice.textContent = message;
        notice.hidden = !message;
        notice.classList.toggle("is-error", isError);
    };
    const readDrafts = () => {
        const records = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (!records || typeof records !== "object" || Array.isArray(records)) {
            throw new Error("Invalid TQS draft storage.");
        }
        return records;
    };
    const roleIndex = assignment => roles.findIndex(role =>
        role.division === assignment?.division && role.branch === assignment?.branch && role.role === assignment?.role);
    const showStorageError = error => {
        console.error("Unable to access TQS draft storage.", error);
        showNotice("managerNotice", "TQS drafts could not be read or saved in this browser.", true);
    };
    const renderList = () => {
        try {
            const records = Object.values(readDrafts());
            draftList.innerHTML = records.length ? records.map(item => `
                <div class="module-card">
                  <div class="module-card-copy"><h3>${escapeHtml(item.title || "Untitled TQS")}</h3>
                    <p>${escapeHtml(item.identifier || "No TQS ID")} · ${escapeHtml(item.assignment?.role || "No role")} · Draft</p></div>
                  <button class="manager-small-button" type="button" data-edit-tqs="${escapeHtml(item.id)}">View / edit</button>
                </div>`).join("") : '<div class="handbook-empty">No TQS drafts saved in this browser.</div>';
        } catch (error) {
            showStorageError(error);
        }
    };
    const renderBlocks = () => {
        editor.innerHTML = draft.modules.map((module, index) => `
            <div class="course-module-card">
              <div class="tqs-module-fields">
                <label>Module number<input class="form-control" data-module="${index}" data-field="moduleNumber" value="${escapeHtml(module.moduleNumber)}"></label>
                <label>Module title<input class="form-control" data-module="${index}" data-field="moduleTitle" value="${escapeHtml(module.moduleTitle)}"></label>
                <button class="manager-small-button" type="button" data-remove-module="${index}">Remove module</button>
              </div>
              ${module.requirements.map((requirement, requirementIndex) => `
                <div class="course-content-block tqs-requirement-fields">
                  <label>Requirement number<input class="form-control" data-module="${index}" data-requirement="${requirementIndex}" data-field="requirementNumber" value="${escapeHtml(requirement.requirementNumber)}"></label>
                  <label>Requirement text<textarea class="form-control" data-module="${index}" data-requirement="${requirementIndex}" data-field="requirementText">${escapeHtml(requirement.requirementText)}</textarea></label>
                  <button class="manager-small-button" type="button" data-remove-requirement="${index}" data-index="${requirementIndex}">Remove</button>
                </div>`).join("")}
              <button class="manager-small-button" type="button" data-add-requirement="${index}">Add requirement</button>
            </div>`).join("");
        unassignedEditor.innerHTML = draft.unassignedRequirements.map((requirement, index) => `
            <div class="course-content-block tqs-requirement-fields">
              <label>Unassigned number<input class="form-control" data-unassigned="${index}" data-field="requirementNumber" value="${escapeHtml(requirement.requirementNumber)}"></label>
              <label>Requirement text<textarea class="form-control" data-unassigned="${index}" data-field="requirementText">${escapeHtml(requirement.requirementText)}</textarea></label>
              <div><label>Assign to module<select class="form-control" data-assignment="${index}">
                ${draft.modules.map((module, moduleIndex) => `<option value="${moduleIndex}">${escapeHtml(`${module.moduleNumber} ${module.moduleTitle}`.trim() || "Untitled module")}</option>`).join("")}
              </select></label><button class="manager-small-button" type="button" data-assign-requirement="${index}" ${draft.modules.length ? "" : "disabled"}>Assign</button></div>
            </div>`).join("");
    };
    const renderWarnings = () => {
        const target = document.getElementById("tqsImportWarnings");
        target.innerHTML = draft.warnings.length
            ? `<ul>${draft.warnings.map(warning => `<li>${escapeHtml(warning.line ? `Line ${warning.line}: ` : "")}${escapeHtml(warning.message)}${warning.sourceText ? ` — ${escapeHtml(warning.sourceText)}` : ""}</li>`).join("")}</ul>`
            : "<p>No parsing warnings. Verify the draft against the original document.</p>";
    };
    const openEditor = record => {
        draft = structuredClone(record);
        document.getElementById("tqsEditorIdentifier").value = draft.identifier;
        document.getElementById("tqsEditorTitle").value = draft.title;
        document.getElementById("tqsEditorVersion").value = draft.version;
        document.getElementById("tqsEditorDate").value = draft.effectiveDate;
        document.getElementById("tqsEditorSource").value = draft.source.fileName;
        roleSelect.innerHTML = '<option value="">Select a role</option>' + roles.map((role, index) =>
            `<option value="${index}">${escapeHtml(`${role.division} / ${role.branch} / ${role.role}`)}</option>`).join("");
        const index = roleIndex(draft.assignment);
        roleSelect.value = index < 0 ? "" : String(index);
        renderWarnings();
        renderBlocks();
        showNotice("tqsDraftNotice", "");
        dialog.showModal();
    };
    const createFromFile = async (file, sourceId, persistSource) => {
        const extension = file.name.toLowerCase().split(".").pop();
        if (!["pdf", "docx", "txt", "md"].includes(extension) || !file.size || file.size > 75 * 1024 * 1024) {
            throw new Error("Choose a non-empty PDF, DOCX, TXT, or Markdown file smaller than 75 MB.");
        }
        let text;
        let extractionWarnings = [];
        if (extension === "docx") {
            const result = await window.mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()});
            text = result.value;
            extractionWarnings = (result.messages || []).map(item => item.message);
            extractionWarnings.push("Verify DOCX headers, footers, text boxes, and layout against the original.");
        } else if (extension === "pdf") {
            const result = await window.HandbookProcessor.extract(file);
            text = result.blocks.map(block => block.sourceText).join("\n");
            extractionWarnings = result.warnings;
        } else {
            text = await file.text();
        }
        if (!text.trim()) throw new Error("No readable text was found in the document.");
        const parsed = window.TqsParser.parse(text);
        if (persistSource) {
            await window.TrainingContentStore.saveMany({
                documents: [{id: sourceId, fileName: file.name, fileType: extension, fileSize: file.size,
                    uploadedAt: new Date().toISOString(), uploadedBy: profile.email, status: "stored", processingMessage: ""}],
                originalFiles: [{id: sourceId, blob: file}]
            });
        }
        return {
            id: crypto.randomUUID(), identifier: "", title: "", version: "", effectiveDate: "", assignment: null,
            source: {documentId: sourceId, fileName: file.name}, status: "draft",
            modules: parsed.modules, unassignedRequirements: parsed.unassignedRequirements,
            warnings: [...extractionWarnings.map(message => ({message})), ...parsed.warnings]
        };
    };
    const startDraft = async (file, sourceId, persistSource, noticeId) => {
        const extension = file.name.toLowerCase().split(".").pop();
        if (!["pdf", "docx", "txt", "md"].includes(extension) || !file.size || file.size > 75 * 1024 * 1024) {
            showNotice(noticeId, "Choose a non-empty PDF, DOCX, TXT, or Markdown file smaller than 75 MB.", true);
            return;
        }
        showNotice(noticeId, "Processing the document locally...");
        try {
            const record = await createFromFile(file, sourceId, persistSource);
            if (sourceDialog.open) sourceDialog.close();
            openEditor(record);
            showNotice("tqsDraftNotice", "Draft created. Select a role and review all extracted content before saving.");
        } catch (error) {
            console.error("Unable to create the TQS draft.", error);
            showNotice(noticeId, "The document could not be processed or saved. Check the source and browser storage, then try again.", true);
        }
    };

    document.getElementById("createTqsDraftButton").addEventListener("click", async event => {
        const files = document.getElementById("handbookFiles").files;
        if (files.length > 1) {
            showNotice("managerNotice", "Choose one document for a TQS draft.", true);
            return;
        }
        const button = event.currentTarget;
        button.disabled = true;
        try {
            if (files.length === 1) {
                await startDraft(files[0], crypto.randomUUID(), true, "managerNotice");
                return;
            }
            const result = await window.TrainingContentStore.readAll(["documents"]);
            documents = result.documents.filter(item => ["pdf", "docx", "txt", "md"].includes(item.fileType));
            sourceSelect.innerHTML = '<option value="">Select a document</option>' + documents.map((item, index) =>
                `<option value="${index}">${escapeHtml(item.fileName)}</option>`).join("");
            showNotice("tqsSourceNotice", documents.length ? "" : "Upload a document or choose a file first.", !documents.length);
            sourceDialog.showModal();
        } catch (error) {
            console.error("Unable to list uploaded documents.", error);
            showNotice("managerNotice", "Uploaded documents could not be read from this browser.", true);
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById("openTqsSource").addEventListener("click", async event => {
        const selected = sourceSelect.value === "" ? null : documents[Number(sourceSelect.value)];
        if (!selected) {
            showNotice("tqsSourceNotice", "Select an uploaded document.", true);
            return;
        }
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const original = await window.TrainingContentStore.getOriginal(selected.id);
            if (!original?.blob) throw new Error("The original document is no longer available.");
            const file = new File([original.blob], selected.fileName, {type: original.blob.type});
            await startDraft(file, selected.id, false, "tqsSourceNotice");
        } catch (error) {
            console.error("Unable to read the TQS source.", error);
            showNotice("tqsSourceNotice", "The original document could not be read.", true);
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById("closeTqsSource").addEventListener("click", () => sourceDialog.close());
    document.getElementById("closeTqsDraft").addEventListener("click", () => dialog.close());
    document.getElementById("addTqsModule").addEventListener("click", () => {
        draft.modules.push({id: crypto.randomUUID(), moduleNumber: "", moduleTitle: "", displayOrder: draft.modules.length, requirements: []});
        renderBlocks();
    });
    const updateBlock = event => {
        const {module: moduleIndex, requirement: requirementIndex, unassigned, field} = event.target.dataset;
        if (!field) return;
        if (unassigned !== undefined && ["requirementNumber", "requirementText"].includes(field)) {
            draft.unassignedRequirements[Number(unassigned)][field] = event.target.value;
        } else if (moduleIndex !== undefined && requirementIndex !== undefined && ["requirementNumber", "requirementText"].includes(field)) {
            draft.modules[Number(moduleIndex)].requirements[Number(requirementIndex)][field] = event.target.value;
        } else if (moduleIndex !== undefined && ["moduleNumber", "moduleTitle"].includes(field)) {
            draft.modules[Number(moduleIndex)][field] = event.target.value;
        }
    };
    editor.addEventListener("input", updateBlock);
    unassignedEditor.addEventListener("input", updateBlock);
    editor.addEventListener("click", event => {
        const add = event.target.closest("[data-add-requirement]");
        const remove = event.target.closest("[data-remove-requirement]");
        const removeModule = event.target.closest("[data-remove-module]");
        if (add) {
            draft.modules[Number(add.dataset.addRequirement)].requirements.push({
                id: crypto.randomUUID(), requirementNumber: "", requirementText: "", displayOrder: 0, required: true
            });
        } else if (remove) {
            draft.modules[Number(remove.dataset.removeRequirement)].requirements.splice(Number(remove.dataset.index), 1);
        } else if (removeModule) {
            const index = Number(removeModule.dataset.removeModule);
            draft.unassignedRequirements.push(...draft.modules[index].requirements);
            draft.modules.splice(index, 1);
        } else return;
        renderBlocks();
    });
    unassignedEditor.addEventListener("click", event => {
        const button = event.target.closest("[data-assign-requirement]");
        if (!button) return;
        const index = Number(button.dataset.assignRequirement);
        const select = unassignedEditor.querySelector(`[data-assignment="${index}"]`);
        const module = draft.modules[Number(select.value)];
        if (!module) return;
        const [requirement] = draft.unassignedRequirements.splice(index, 1);
        const insertAt = Number.isInteger(requirement.sourceLine)
            ? module.requirements.findIndex(item => Number.isInteger(item.sourceLine) && item.sourceLine > requirement.sourceLine)
            : -1;
        module.requirements.splice(insertAt < 0 ? module.requirements.length : insertAt, 0, requirement);
        renderBlocks();
    });
    document.getElementById("tqsDraftForm").addEventListener("submit", event => {
        event.preventDefault();
        const selectedRole = roleSelect.value === "" ? null : roles[Number(roleSelect.value)];
        if (!selectedRole) {
            showNotice("tqsDraftNotice", "Select an existing role before saving.", true);
            return;
        }
        draft.identifier = document.getElementById("tqsEditorIdentifier").value.trim();
        draft.title = document.getElementById("tqsEditorTitle").value.trim();
        draft.version = document.getElementById("tqsEditorVersion").value.trim();
        draft.effectiveDate = document.getElementById("tqsEditorDate").value;
        draft.assignment = selectedRole;
        draft.modules.forEach((module, index) => {
            module.displayOrder = index;
            module.requirements.forEach((requirement, requirementIndex) => { requirement.displayOrder = requirementIndex; });
        });
        draft.unassignedRequirements.forEach((requirement, index) => { requirement.displayOrder = index; });
        try {
            const records = readDrafts();
            records[draft.id] = draft;
            localStorage.setItem(storageKey, JSON.stringify(records));
            renderList();
            showNotice("tqsDraftNotice", "TQS draft saved in this browser.");
        } catch (error) {
            console.error("Unable to save the TQS draft.", error);
            showNotice("tqsDraftNotice", "The TQS draft could not be saved in this browser.", true);
        }
    });
    draftList.addEventListener("click", event => {
        const button = event.target.closest("[data-edit-tqs]");
        if (!button) return;
        try {
            const record = readDrafts()[button.dataset.editTqs];
            if (!record) throw new Error("Draft not found.");
            openEditor(record);
        } catch (error) {
            showStorageError(error);
        }
    });
    renderList();
});
