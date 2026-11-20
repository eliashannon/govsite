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

    const storageKey = window.TqsStore.storageKey;
    const sourceDialog = document.getElementById("tqsSourceDialog");
    const dialog = document.getElementById("tqsDraftDialog");
    const editor = document.getElementById("tqsModuleEditor");
    const unassignedEditor = document.getElementById("tqsUnassignedEditor");
    const draftList = document.getElementById("tqsDraftList");
    const publishedList = document.getElementById("publishedTqsList");
    const roleSelect = document.getElementById("tqsEditorRole");
    const sourceSelect = document.getElementById("tqsSourceSelect");
    const hierarchy = window.PortalData.organizationHierarchy;
    const roles = Object.entries(hierarchy).flatMap(([division, branches]) =>
        Object.entries(branches).flatMap(([branch, names]) => names.map(role => ({division, branch, role}))));
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    let draft = null;
    let originalDraft = null;
    let documents = [];
    const selectedDrafts = new Set();
    const selectedPublished = new Set();

    const showNotice = (id, message, isError = false) => {
        const notice = document.getElementById(id);
        notice.textContent = message;
        notice.hidden = !message;
        notice.classList.toggle("is-error", isError);
    };
    const readDrafts = () => window.TqsStore.readAll();
    const roleIndex = assignment => roles.findIndex(role =>
        role.division === assignment?.division && role.branch === assignment?.branch && role.role === assignment?.role);
    const showStorageError = error => {
        console.error("Unable to access TQS draft storage.", error);
        showNotice("managerNotice", "TQS drafts could not be read or saved in this browser.", true);
    };
    const renderList = () => {
        try {
            const records = Object.values(readDrafts());
            const drafts = records.filter(item => item.managerZone !== "published" && item.status !== "published");
            const published = records.filter(item => item.managerZone === "published" || item.status === "published");
            for (const id of selectedDrafts) if (!drafts.some(item => item.id === id)) selectedDrafts.delete(id);
            for (const id of selectedPublished) if (!published.some(item => item.id === id)) selectedPublished.delete(id);
            const card = (item, selected, stage) => `
                <article class="exam-builder-course">
                  <input type="checkbox" data-select-tqs="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.title || "Untitled TQS")}" ${selected.has(item.id) ? "checked" : ""}>
                  <div class="exam-builder-course-copy"><h3>${escapeHtml(item.title || "Untitled TQS")}</h3>
                    <p>${escapeHtml(item.identifier || "No TQS ID")} · ${escapeHtml(item.assignment?.role || "No role")} · ${item.status === "published" ? "Published" : "Unpublished"}</p></div>
                  ${stage === "builder" ? `<button class="manager-small-button" type="button" data-edit-tqs="${escapeHtml(item.id)}">View / edit</button>` : ""}
                </article>`;
            draftList.innerHTML = drafts.length ? drafts.map(item => card(item, selectedDrafts, "builder")).join("")
                : '<div class="handbook-empty">No TQS drafts saved in this browser.</div>';
            publishedList.innerHTML = published.length ? published.map(item => card(item, selectedPublished, "published")).join("")
                : '<div class="handbook-empty">No TQS are in Published TQS.</div>';
            document.getElementById("tqsDraftCount").textContent = `${drafts.length} TQS`;
            document.getElementById("publishedTqsCount").textContent = `${published.length} TQS`;
            document.getElementById("tqsDraftSelectionCount").textContent = `${selectedDrafts.size} selected`;
            document.getElementById("publishedTqsSelectionCount").textContent = `${selectedPublished.size} selected`;
            document.getElementById("deleteSelectedTqsDrafts").disabled = !selectedDrafts.size;
            document.getElementById("moveSelectedTqsToPublished").disabled = !selectedDrafts.size;
            const selected = published.filter(item => selectedPublished.has(item.id));
            document.getElementById("publishSelectedTqs").disabled = !selected.some(item => item.status !== "published");
            document.getElementById("unpublishSelectedTqs").disabled = !selected.some(item => item.status === "published");
            document.getElementById("returnSelectedTqs").disabled = !selected.length || selected.some(item => item.status === "published");
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
                <div class="module-actions">
                  <button class="manager-small-button" type="button" data-move-module="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Move up</button>
                  <button class="manager-small-button" type="button" data-move-module="${index}" data-direction="1" ${index === draft.modules.length - 1 ? "disabled" : ""}>Move down</button>
                  <button class="manager-small-button" type="button" data-remove-module="${index}">Remove module</button>
                </div>
              </div>
              ${module.requirements.map((requirement, requirementIndex) => `
                <div class="course-content-block tqs-requirement-fields">
                  <label>Requirement number<input class="form-control" data-module="${index}" data-requirement="${requirementIndex}" data-field="requirementNumber" value="${escapeHtml(requirement.requirementNumber)}"></label>
                  <label>Requirement text<textarea class="form-control" data-module="${index}" data-requirement="${requirementIndex}" data-field="requirementText">${escapeHtml(requirement.requirementText)}</textarea></label>
                  <div class="module-actions">
                    <label><input type="checkbox" data-module="${index}" data-requirement="${requirementIndex}" data-field="required" ${requirement.required !== false ? "checked" : ""}> Required</label>
                    <button class="manager-small-button" type="button" data-move-requirement="${index}" data-index="${requirementIndex}" data-direction="-1" ${requirementIndex === 0 ? "disabled" : ""}>Move up</button>
                    <button class="manager-small-button" type="button" data-move-requirement="${index}" data-index="${requirementIndex}" data-direction="1" ${requirementIndex === module.requirements.length - 1 ? "disabled" : ""}>Move down</button>
                    <button class="manager-small-button" type="button" data-remove-requirement="${index}" data-index="${requirementIndex}">Remove</button>
                  </div>
                </div>`).join("")}
              <button class="manager-small-button" type="button" data-add-requirement="${index}">Add requirement</button>
            </div>`).join("");
        unassignedEditor.innerHTML = draft.unassignedRequirements.map((requirement, index) => `
            <div class="course-content-block tqs-requirement-fields">
              <label>Unassigned number<input class="form-control" data-unassigned="${index}" data-field="requirementNumber" value="${escapeHtml(requirement.requirementNumber)}"></label>
              <label>Requirement text<textarea class="form-control" data-unassigned="${index}" data-field="requirementText">${escapeHtml(requirement.requirementText)}</textarea></label>
              <div><label>Assign to module<select class="form-control" data-assignment="${index}">
                ${draft.modules.map((module, moduleIndex) => `<option value="${moduleIndex}">${escapeHtml(`${module.moduleNumber} ${module.moduleTitle}`.trim() || "Untitled module")}</option>`).join("")}
              </select></label><button class="manager-small-button" type="button" data-assign-requirement="${index}" ${draft.modules.length ? "" : "disabled"}>Assign</button>
              <button class="manager-small-button" type="button" data-remove-unassigned="${index}">Remove</button></div>
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
        originalDraft = JSON.stringify(record);
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
            const records = readDrafts();
            records[record.id] = record;
            localStorage.setItem(storageKey, JSON.stringify(records));
            renderList();
            if (sourceDialog.open) sourceDialog.close();
            openEditor(record);
            showNotice("tqsDraftNotice", "Draft added to TQS Builder. Select a role and review all extracted content before saving.");
            showNotice(noticeId, "");
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
        } else if (moduleIndex !== undefined && requirementIndex !== undefined && ["requirementNumber", "requirementText", "required"].includes(field)) {
            draft.modules[Number(moduleIndex)].requirements[Number(requirementIndex)][field] = field === "required" ? event.target.checked : event.target.value;
        } else if (moduleIndex !== undefined && ["moduleNumber", "moduleTitle"].includes(field)) {
            draft.modules[Number(moduleIndex)][field] = event.target.value;
        }
    };
    editor.addEventListener("input", updateBlock);
    editor.addEventListener("change", updateBlock);
    unassignedEditor.addEventListener("input", updateBlock);
    editor.addEventListener("click", event => {
        const add = event.target.closest("[data-add-requirement]");
        const remove = event.target.closest("[data-remove-requirement]");
        const removeModule = event.target.closest("[data-remove-module]");
        const moveModule = event.target.closest("[data-move-module]");
        const moveRequirement = event.target.closest("[data-move-requirement]");
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
        } else if (moveModule) {
            const index = Number(moveModule.dataset.moveModule);
            const destination = index + Number(moveModule.dataset.direction);
            if (destination < 0 || destination >= draft.modules.length) return;
            [draft.modules[index], draft.modules[destination]] = [draft.modules[destination], draft.modules[index]];
        } else if (moveRequirement) {
            const requirements = draft.modules[Number(moveRequirement.dataset.moveRequirement)].requirements;
            const index = Number(moveRequirement.dataset.index);
            const destination = index + Number(moveRequirement.dataset.direction);
            if (destination < 0 || destination >= requirements.length) return;
            [requirements[index], requirements[destination]] = [requirements[destination], requirements[index]];
        } else return;
        renderBlocks();
    });
    unassignedEditor.addEventListener("click", event => {
        const remove = event.target.closest("[data-remove-unassigned]");
        if (remove) {
            draft.unassignedRequirements.splice(Number(remove.dataset.removeUnassigned), 1);
            renderBlocks();
            return;
        }
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
            const current = records[draft.id];
            if (!current || current.status === "published" || current.managerZone === "published") {
                throw new Error("This TQS is no longer in TQS Builder. Return it before editing.");
            }
            if (JSON.stringify(current) !== originalDraft) {
                throw new Error("This TQS changed in another tab. Reopen it before saving.");
            }
            records[draft.id] = draft;
            localStorage.setItem(storageKey, JSON.stringify(records));
            originalDraft = JSON.stringify(draft);
            renderList();
            showNotice("tqsDraftNotice", "TQS draft saved in this browser.");
        } catch (error) {
            console.error("Unable to save the TQS draft.", error);
            showNotice("tqsDraftNotice", error.message || "The TQS draft could not be saved in this browser.", true);
        }
    });
    draftList.addEventListener("click", event => {
        const button = event.target.closest("[data-edit-tqs]");
        if (!button) return;
        try {
            const record = readDrafts()[button.dataset.editTqs];
            if (!record || record.status === "published" || record.managerZone === "published") throw new Error("Draft not found in TQS Builder.");
            openEditor(record);
        } catch (error) {
            showStorageError(error);
        }
    });
    const inPublished = item => item.managerZone === "published" || item.status === "published";
    const selectFrom = (list, selected, published) => list.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-select-tqs]");
        if (!checkbox) return;
        try {
            const record = readDrafts()[checkbox.dataset.selectTqs];
            if (!record || inPublished(record) !== published) throw new Error("The TQS is no longer in this section.");
            if (checkbox.checked) selected.add(record.id);
            else selected.delete(record.id);
            renderList();
        } catch (error) {
            showStorageError(error);
            renderList();
        }
    });
    selectFrom(draftList, selectedDrafts, false);
    selectFrom(publishedList, selectedPublished, true);
    const selectAll = (selected, published) => {
        try {
            const records = Object.values(readDrafts()).filter(item => inPublished(item) === published);
            if (records.length && records.every(item => selected.has(item.id))) selected.clear();
            else records.forEach(item => selected.add(item.id));
            renderList();
        } catch (error) {
            showStorageError(error);
        }
    };
    document.getElementById("selectAllTqsDrafts").addEventListener("click", () => selectAll(selectedDrafts, false));
    document.getElementById("selectAllPublishedTqs").addEventListener("click", () => selectAll(selectedPublished, true));

    const updateSelected = action => {
        const selected = action === "delete" || action === "move" ? selectedDrafts : selectedPublished;
        if (!selected.size) return;
        if (action === "delete" && !window.confirm("Delete the selected TQS drafts? Their source documents and saved checkoffs will remain.")) return;
        try {
            const records = readDrafts();
            const items = [...selected].map(id => {
                const item = records[id];
                if (!item || inPublished(item) !== (selected === selectedPublished)) {
                    throw new Error("A selected TQS is no longer in this section. Refresh and try again.");
                }
                return item;
            });
            if (action === "return" && items.some(item => item.status === "published")) {
                throw new Error("Unpublish the selected TQS before returning it to TQS Builder.");
            }
            if (action === "publish") {
                const candidates = items.filter(item => item.status !== "published");
                if (!candidates.length) throw new Error("Select at least one unpublished TQS.");
                for (const item of candidates) {
                    const errors = window.TqsStore.validate(item, hierarchy);
                    if (errors.length) throw new Error(`TQS validation failed: ${errors.join(" ")}`);
                    if (Object.values(records).some(other => other.id !== item.id
                        && (other.status === "published" || candidates.includes(other))
                        && window.TqsStore.sameRole(other.assignment, item.assignment))) {
                        throw new Error("Only one TQS can be published for each role. Unpublish the existing TQS first.");
                    }
                }
            }
            for (const item of items) {
                if (action === "delete") delete records[item.id];
                else if (action === "move") records[item.id] = {...item, managerZone:"published"};
                else if (action === "return") records[item.id] = {...item, managerZone:"builder"};
                else if (action === "publish" && item.status !== "published") {
                    records[item.id] = {...item, managerZone:"published", status:"published", publishedAt:new Date().toISOString()};
                } else if (action === "unpublish" && item.status === "published") {
                    records[item.id] = {...item, status:"draft", unpublishedAt:new Date().toISOString()};
                }
            }
            localStorage.setItem(storageKey, JSON.stringify(records));
            selected.clear();
            renderList();
            const messages = {
                delete:"Selected TQS drafts deleted.", move:"Selected TQS moved to Published TQS.",
                return:"Selected TQS returned to TQS Builder.", publish:"Selected TQS published in this browser.",
                unpublish:"Selected TQS unpublished in this browser."
            };
            showNotice("managerNotice", messages[action]);
        } catch (error) {
            console.error("Unable to update TQS workflow.", error);
            showNotice("managerNotice", error.message || "The TQS workflow could not be updated in this browser.", true);
        }
    };
    document.getElementById("deleteSelectedTqsDrafts").addEventListener("click", () => updateSelected("delete"));
    document.getElementById("moveSelectedTqsToPublished").addEventListener("click", () => updateSelected("move"));
    document.getElementById("publishSelectedTqs").addEventListener("click", () => updateSelected("publish"));
    document.getElementById("unpublishSelectedTqs").addEventListener("click", () => updateSelected("unpublish"));
    document.getElementById("returnSelectedTqs").addEventListener("click", () => updateSelected("return"));
    window.addEventListener("storage", event => {
        if (event.key === storageKey || event.key === null) renderList();
    });
    renderList();
});
