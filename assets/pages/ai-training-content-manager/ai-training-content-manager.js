document.addEventListener("DOMContentLoaded", async () => {
    const accountStorageKey = "govsiteAccountProfile";
    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem(accountStorageKey) || "null");
    } catch (error) {
        console.error("Unable to read the current account profile.", error);
    }
    if (!profile || profile.isMaster !== true || typeof profile.email !== "string"
        || profile.email.toLowerCase() !== "elias@navy.mil") {
        window.location.replace("tqs-support.html");
        return;
    }

    await window.PortalDataReady;

    const store = window.TrainingContentStore;
    const notice = document.getElementById("managerNotice");
    const uploadForm = document.getElementById("handbookUploadForm");
    const fileInput = document.getElementById("handbookFiles");
    const handbookList = document.getElementById("handbookList");
    const documentCount = document.getElementById("documentCount");
    const contentExplorer = document.getElementById("contentExplorer");
    const contentCount = document.getElementById("contentCount");
    const contentSearch = document.getElementById("contentSearch");
    const categoryFilter = document.getElementById("categoryFilter");
    const reviewFilter = document.getElementById("reviewFilter");
    const selectionCount = document.getElementById("selectionCount");
    const approveSelectedButton = document.getElementById("approveSelectedButton");
    const rejectSelectedButton = document.getElementById("rejectSelectedButton");
    const createModuleButton = document.getElementById("createModuleButton");
    const moduleList = document.getElementById("moduleList");
    const moduleCount = document.getElementById("moduleCount");
    const previewPanel = document.getElementById("sourcePreview");
    const viewOriginalButton = document.getElementById("viewOriginalButton");
    const moduleDialog = document.getElementById("moduleDialog");
    const moduleForm = document.getElementById("moduleForm");
    const moduleDialogNotice = document.getElementById("moduleDialogNotice");
    const selectedContentIds = new Set();
    const maximumFileSize = 75 * 1024 * 1024;
    const state = {
        documents: [],
        sourceContent: [],
        organizationMetadata: [],
        reviews: [],
        modules: [],
        activePreviewId: null
    };

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
    const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const dateTime = value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
    };
    const showNotice = (message, isError = false, target = notice) => {
        target.textContent = message;
        target.hidden = !message;
        target.classList.toggle("is-error", isError);
    };
    const statusClass = status => ({
        "Processed": "status-processed",
        "Needs review": "status-review",
        "Processing": "status-pending",
        "Stored": "status-pending",
        "Extraction error": "status-error",
        "Pending Review": "status-pending",
        "Approved": "status-approved",
        "Rejected": "status-rejected",
        "Unpublished": "status-unpublished",
        "Published": "status-published"
    }[status] || "");
    const statusBadge = status => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
    const findMetadata = contentId => state.organizationMetadata.find(item => item.contentId === contentId);
    const findReview = contentId => state.reviews.find(item => item.contentId === contentId)
        || {contentId, status: "Pending Review", reviewedAt: null, reviewer: ""};
    const findDocument = documentId => state.documents.find(item => item.id === documentId);
    const selectedAreApproved = () => {
        const selected = [...selectedContentIds];
        return selected.length > 0 && selected.every(id =>
            state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
        );
    };
    const updateSelectionControls = () => {
        selectionCount.textContent = `${selectedContentIds.size} selected`;
        approveSelectedButton.disabled = selectedContentIds.size === 0;
        rejectSelectedButton.disabled = selectedContentIds.size === 0;
        createModuleButton.disabled = !selectedAreApproved();
    };

    const renderDocuments = () => {
        documentCount.textContent = `${state.documents.length} ${state.documents.length === 1 ? "document" : "documents"}`;
        if (!state.documents.length) {
            handbookList.innerHTML = '<div class="handbook-empty">Uploaded handbooks will remain available here for review.</div>';
            return;
        }
        handbookList.innerHTML = state.documents.map(documentRecord => {
            const processingStatus = documentRecord.status === "processed"
                ? "Processed"
                : documentRecord.status === "needs-review"
                    ? "Needs review"
                    : documentRecord.status === "processing"
                        ? "Processing"
                        : documentRecord.status === "error" ? "Extraction error" : "Stored";
            const warningText = documentRecord.processingMessage
                ? `<p>${escapeHtml(documentRecord.processingMessage)}</p>`
                : "";
            return `
                <article class="handbook-document">
                    <div><h3>${escapeHtml(documentRecord.fileName)}</h3>
                        <p>${escapeHtml(documentRecord.fileType.toUpperCase())} · Uploaded ${escapeHtml(dateTime(documentRecord.uploadedAt))} · ${statusBadge(processingStatus)}</p>
                        ${warningText}
                    </div>
                    <div class="handbook-document-actions">
                        <button class="manager-small-button" type="button" data-view-document="${escapeHtml(documentRecord.id)}">View original</button>
                        <button class="manager-small-button" type="button" data-download-document="${escapeHtml(documentRecord.id)}">Download original</button>
                        ${documentRecord.status === "error" ? `<button class="manager-small-button" type="button" data-reprocess-document="${escapeHtml(documentRecord.id)}">Retry extraction</button>` : ""}
                    </div>
                </article>`;
        }).join("");
    };

    const updateCategoryOptions = () => {
        const currentCategory = categoryFilter.value || "All";
        const categories = [...new Set(state.organizationMetadata.map(item => item.category).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right));
        categoryFilter.innerHTML = `<option value="All">All categories</option>${categories.map(category =>
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        ).join("")}`;
        categoryFilter.value = categories.includes(currentCategory) ? currentCategory : "All";
    };

    const isContentPublished = contentId => state.modules.some(module =>
        module.publicationStatus === "Published" && module.sourceContentIds.includes(contentId)
    );

    const renderSourceItem = item => {
        const metadata = findMetadata(item.id) || {};
        const review = findReview(item.id);
        const documentRecord = findDocument(item.documentId);
        const heading = (metadata.headingPath || []).join(" / ");
        const excerpt = item.sourceText.length > 190 ? `${item.sourceText.slice(0, 190)}...` : item.sourceText;
        const publicationStatus = isContentPublished(item.id) ? "Published" : "Unpublished";
        return `
            <article class="source-content-item">
                <input type="checkbox" data-select-content="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(metadata.contentType || "content")} from ${escapeHtml(item.originalDocumentName)}" ${selectedContentIds.has(item.id) ? "checked" : ""}>
                <div class="source-content-copy">
                    <button class="source-item-preview" type="button" data-preview-content="${escapeHtml(item.id)}">${escapeHtml(heading || item.sectionNumber || metadata.contentType || "Source text")}</button>
                    <p>${escapeHtml(excerpt)}</p>
                    <div class="content-meta">
                        <span>${escapeHtml(documentRecord?.fileName || item.originalDocumentName)}</span>
                        <span>${item.pageNumber ? `Page ${escapeHtml(item.pageNumber)}` : "Page unavailable"}</span>
                        ${item.sectionNumber ? `<span>Section ${escapeHtml(item.sectionNumber)}</span>` : ""}
                        <span>${escapeHtml(metadata.contentType || "Text")}</span>
                        <span>${escapeHtml(metadata.confidence || "Needs review")}</span>
                        ${statusBadge(review.status)}
                        ${statusBadge(publicationStatus)}
                    </div>
                </div>
                <div class="source-item-actions">
                    <button class="manager-small-button" type="button" data-review-content="${escapeHtml(item.id)}" data-review-status="Approved" ${review.status === "Approved" ? "disabled" : ""}>Approve</button>
                    <button class="manager-small-button" type="button" data-review-content="${escapeHtml(item.id)}" data-review-status="Rejected" ${review.status === "Rejected" ? "disabled" : ""}>Reject</button>
                </div>
            </article>`;
    };

    const renderContent = () => {
        const query = contentSearch.value.trim().toLocaleLowerCase();
        const selectedCategory = categoryFilter.value;
        const selectedReview = reviewFilter.value;
        const visibleItems = state.sourceContent.filter(item => {
            const metadata = findMetadata(item.id) || {};
            const review = findReview(item.id);
            const documentRecord = findDocument(item.documentId);
            const searchable = [
                item.sourceText,
                item.originalDocumentName,
                item.sectionNumber,
                ...(metadata.headingPath || [])
            ].join(" ").toLocaleLowerCase();
            return (!query || searchable.includes(query))
                && (selectedCategory === "All" || metadata.category === selectedCategory)
                && (selectedReview === "All" || review.status === selectedReview);
        });
        contentCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "item" : "items"}`;
        if (!visibleItems.length) {
            contentExplorer.innerHTML = '<div class="handbook-empty">No extracted source items match these filters. Upload a handbook or adjust the filters.</div>';
            updateSelectionControls();
            return;
        }
        const grouped = new Map();
        visibleItems.forEach(item => {
            const metadata = findMetadata(item.id) || {};
            const category = metadata.category || "Reference material";
            if (!grouped.has(category)) grouped.set(category, []);
            grouped.get(category).push(item);
        });
        contentExplorer.innerHTML = [...grouped.entries()].map(([category, items]) => {
            const chapters = new Map();
            items.forEach(item => {
                const metadata = findMetadata(item.id) || {};
                const path = metadata.headingPath || [];
                const chapterTitle = path[0] || item.originalDocumentName;
                const chapterKey = `${item.documentId}::${chapterTitle}`;
                if (!chapters.has(chapterKey)) chapters.set(chapterKey, {title: chapterTitle, items: []});
                chapters.get(chapterKey).items.push(item);
            });
            const chapterMarkup = [...chapters.entries()].map(([chapterKey, chapter]) => {
                const sections = new Map();
                chapter.items.forEach(item => {
                    const path = findMetadata(item.id)?.headingPath || [];
                    const sectionTitle = path.length > 1 ? path.slice(1).join(" / ") : "";
                    const sectionKey = sectionTitle || `${chapterKey}::chapter-items`;
                    if (!sections.has(sectionKey)) sections.set(sectionKey, {title: sectionTitle, items: []});
                    sections.get(sectionKey).items.push(item);
                });
                const chapterSelectionIds = visibleItems
                    .filter(item => item.documentId === chapter.items[0].documentId
                        && (findMetadata(item.id)?.headingPath?.[0] || item.originalDocumentName) === chapter.title)
                    .map(item => item.id);
                const hasChapterHeading = chapter.items.some(item => (findMetadata(item.id)?.headingPath || []).length > 0);
                return `
                    <section class="content-chapter-group">
                        <div class="content-chapter-heading">
                            <strong>${escapeHtml(chapter.title)}</strong>
                            <button class="ai-text-button" type="button" data-select-group="${escapeHtml(JSON.stringify(chapterSelectionIds))}">Select ${hasChapterHeading ? "chapter" : "document"}</button>
                        </div>
                        ${[...sections.values()].map(section => {
                            const sectionIds = visibleItems
                                .filter(item => {
                                    const path = findMetadata(item.id)?.headingPath || [];
                                    return item.documentId === chapter.items[0].documentId
                                        && (path[0] || item.originalDocumentName) === chapter.title
                                        && path.slice(1).join(" / ") === section.title;
                                })
                                .map(item => item.id);
                            return `
                                <section class="content-section-group">
                                    ${section.title ? `<div class="content-section-heading"><span>${escapeHtml(section.title)}</span><button class="ai-text-button" type="button" data-select-group="${escapeHtml(JSON.stringify(sectionIds))}">Select section</button></div>` : ""}
                                    ${section.items.map(renderSourceItem).join("")}
                                </section>`;
                        }).join("")}
                    </section>`;
            }).join("");
            return `
                <details class="content-category" open>
                    <summary>${escapeHtml(category)} <span class="content-category-count">${items.length} ${items.length === 1 ? "item" : "items"}</span></summary>
                    ${chapterMarkup}
                </details>`;
        }).join("");
        updateSelectionControls();
    };

    const renderModules = () => {
        moduleCount.textContent = `${state.modules.length} ${state.modules.length === 1 ? "module" : "modules"}`;
        if (!state.modules.length) {
            moduleList.innerHTML = '<div class="handbook-empty">No modules have been assembled. Approve extracted source items before creating a module.</div>';
            return;
        }
        moduleList.innerHTML = [...state.modules]
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(module => {
                const validSourceCount = module.sourceContentIds.filter(id =>
                    state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
                ).length;
                const isPublished = module.publicationStatus === "Published" && validSourceCount === module.sourceContentIds.length;
                return `
                    <article class="module-card">
                        <div class="module-card-copy">
                            <h3>${escapeHtml(module.title)}</h3>
                            <p>${escapeHtml(module.category)} · Created ${escapeHtml(dateTime(module.createdAt))}</p>
                            <p class="module-source-count">${validSourceCount} of ${module.sourceContentIds.length} source items remain approved · Roles: ${escapeHtml(module.roleIds.join(", "))}</p>
                            <div class="module-card-meta">${statusBadge(isPublished ? "Published" : "Unpublished")}
                                <span>${module.tqsRequirementIds.length} linked TQS ${module.tqsRequirementIds.length === 1 ? "requirement" : "requirements"}</span>
                            </div>
                        </div>
                        <div class="module-actions">
                            <button class="manager-small-button" type="button" data-preview-module="${escapeHtml(module.id)}">Preview sources</button>
                            ${isPublished
                                ? `<button class="manager-small-button" type="button" data-unpublish-module="${escapeHtml(module.id)}">Unpublish</button>`
                                : `<button class="manager-small-button" type="button" data-publish-module="${escapeHtml(module.id)}" ${validSourceCount !== module.sourceContentIds.length ? "disabled" : ""}>Publish locally</button>`}
                        </div>
                    </article>`;
            }).join("");
    };

    const render = () => {
        renderDocuments();
        updateCategoryOptions();
        renderContent();
        renderModules();
    };

    const openOriginal = async (documentId, pageNumber = null, shouldDownload = false) => {
        try {
            const storedFile = await store.getOriginal(documentId);
            const documentRecord = findDocument(documentId);
            if (!storedFile || !storedFile.blob || !documentRecord) {
                throw new Error("The original handbook file is not available in local storage.");
            }
            const objectUrl = URL.createObjectURL(storedFile.blob);
            if (shouldDownload) {
                const anchor = document.createElement("a");
                anchor.href = objectUrl;
                anchor.download = documentRecord.fileName;
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                return;
            }
            const pageFragment = pageNumber && documentRecord.fileType === "pdf" ? `#page=${pageNumber}` : "";
            const openedWindow = window.open(`${objectUrl}${pageFragment}`, "_blank");
            if (!openedWindow) {
                URL.revokeObjectURL(objectUrl);
                throw new Error("The original handbook could not be opened. Allow pop-ups for this portal and try again.");
            }
            openedWindow.opener = null;
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
        } catch (error) {
            console.error("Unable to open the original handbook.", error);
            showNotice(error.message, true);
        }
    };

    const previewContent = contentId => {
        const item = state.sourceContent.find(candidate => candidate.id === contentId);
        if (!item) {
            showNotice("The selected source item is no longer available.", true);
            return;
        }
        const metadata = findMetadata(contentId) || {};
        const review = findReview(contentId);
        const documentRecord = findDocument(item.documentId);
        const relatedModules = state.modules.filter(module => module.sourceContentIds.includes(contentId));
        const fields = [
            ["Content ID", item.id],
            ["Original document", documentRecord?.fileName || item.originalDocumentName],
            ["Original page", item.pageNumber || "Unavailable for this file"],
            ["Original section", item.sectionNumber || "Not identified"],
            ["Category", metadata.category || "Not classified"],
            ["Content type", metadata.contentType || "Text"],
            ["Processing confidence", metadata.confidence || "Needs review"],
            ["Approval status", review.status],
            ["Publication status", relatedModules.some(module => module.publicationStatus === "Published") ? "Published" : "Unpublished"]
        ];
        document.getElementById("previewTitle").textContent = metadata.headingPath?.join(" / ")
            || item.sectionNumber || metadata.contentType || "Extracted source";
        document.getElementById("previewMetadata").innerHTML = fields.map(([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
        ).join("");
        const warnings = [...(metadata.warnings || []), ...(documentRecord?.processingMessage ? [documentRecord.processingMessage] : [])];
        const warningsElement = document.getElementById("previewWarnings");
        warningsElement.textContent = [...new Set(warnings)].join(" ");
        warningsElement.hidden = warnings.length === 0;
        document.getElementById("previewText").textContent = item.sourceText;
        state.activePreviewId = contentId;
        viewOriginalButton.hidden = !documentRecord;
        viewOriginalButton.textContent = item.pageNumber ? `View original page ${item.pageNumber}` : "View original document";
        previewPanel.hidden = false;
        previewPanel.scrollIntoView({behavior: "smooth", block: "start"});
    };

    const syncPublishedState = async modulesToSave => {
        await store.saveMany({modules: modulesToSave});
        modulesToSave.forEach(updated => {
            const index = state.modules.findIndex(module => module.id === updated.id);
            if (index === -1) state.modules.push(updated);
            else state.modules[index] = updated;
        });
        render();
    };

    const updateReviewStatus = async (contentIds, status) => {
        const validIds = [...new Set(contentIds)].filter(id => state.sourceContent.some(item => item.id === id));
        if (!validIds.length) return;
        const reviewedAt = new Date().toISOString();
        const reviewRecords = validIds.map(contentId => ({
            contentId,
            status,
            reviewedAt,
            reviewer: profile.email
        }));
        const affectedModules = status === "Rejected"
            ? state.modules
                .filter(module => module.publicationStatus === "Published"
                    && module.sourceContentIds.some(id => validIds.includes(id)))
                .map(module => ({...module, publicationStatus: "Unpublished", unpublishedAt: reviewedAt}))
            : [];
        await store.saveMany({reviews: reviewRecords, modules: affectedModules});
        reviewRecords.forEach(updated => {
            const index = state.reviews.findIndex(review => review.contentId === updated.contentId);
            if (index === -1) state.reviews.push(updated);
            else state.reviews[index] = updated;
        });
        affectedModules.forEach(updated => {
            const index = state.modules.findIndex(module => module.id === updated.id);
            if (index !== -1) state.modules[index] = updated;
        });
        validIds.forEach(id => selectedContentIds.delete(id));
        render();
        showNotice(affectedModules.length
            ? `${validIds.length} source item(s) rejected. Published modules containing rejected text were unpublished from this browser's catalog.`
            : `${validIds.length} source item(s) ${status.toLowerCase()}.`);
    };

    const beginProcessing = async documentRecord => {
        const processingRecord = {...documentRecord, status: "processing", processingMessage: "", processingStartedAt: new Date().toISOString()};
        await store.saveMany({documents: [processingRecord]});
        const documentIndex = state.documents.findIndex(item => item.id === processingRecord.id);
        if (documentIndex === -1) state.documents.unshift(processingRecord);
        else state.documents[documentIndex] = processingRecord;
        renderDocuments();
        showNotice(`Extracting text from ${documentRecord.fileName} locally. No AI or remote processing service is used.`);

        try {
            const storedFile = await store.getOriginal(documentRecord.id);
            if (!storedFile?.blob) throw new Error("The original file could not be read from local storage.");
            const result = await window.HandbookProcessor.extract(storedFile.blob);
            const sourceRecords = result.blocks.map((block, index) => ({
                id: `${documentRecord.id}-source-${index + 1}`,
                documentId: documentRecord.id,
                originalDocumentName: documentRecord.fileName,
                pageNumber: block.pageNumber,
                sectionNumber: block.sectionNumber,
                sourceText: block.sourceText,
                tableCells: block.tableCells
            }));
            const metadataRecords = result.blocks.map((block, index) => ({
                contentId: `${documentRecord.id}-source-${index + 1}`,
                category: block.category,
                contentType: block.contentType,
                headingPath: block.headingPath,
                confidence: block.confidence,
                warnings: [...result.warnings, ...block.warnings]
            }));
            const reviewRecords = sourceRecords.map(item => ({
                contentId: item.id,
                status: "Pending Review",
                reviewedAt: null,
                reviewer: ""
            }));
            const hasWarnings = result.warnings.length > 0
                || metadataRecords.some(item => item.confidence !== "High" || item.warnings.length > 0);
            const completedRecord = {
                ...processingRecord,
                status: hasWarnings ? "needs-review" : "processed",
                processingMessage: result.warnings.join(" "),
                pageCount: result.pageCount,
                processedAt: new Date().toISOString(),
                contentItemCount: sourceRecords.length
            };
            await store.saveMany({
                documents: [completedRecord],
                sourceContent: sourceRecords,
                organizationMetadata: metadataRecords,
                reviews: reviewRecords
            });
            state.documents[state.documents.findIndex(item => item.id === completedRecord.id)] = completedRecord;
            state.sourceContent.push(...sourceRecords);
            state.organizationMetadata.push(...metadataRecords);
            state.reviews.push(...reviewRecords);
            render();
            showNotice(`${documentRecord.fileName}: extracted ${sourceRecords.length} source item(s). Review the original text, references, and warnings before approving anything.`);
        } catch (error) {
            console.error(`Unable to extract ${documentRecord.fileName}.`, error);
            const failedRecord = {
                ...processingRecord,
                status: "error",
                processingMessage: error instanceof Error ? error.message : String(error),
                processedAt: new Date().toISOString()
            };
            await store.saveMany({documents: [failedRecord]});
            const index = state.documents.findIndex(item => item.id === failedRecord.id);
            if (index === -1) state.documents.unshift(failedRecord);
            else state.documents[index] = failedRecord;
            render();
            showNotice(`${documentRecord.fileName}: ${failedRecord.processingMessage}`, true);
        }
    };

    const uploadFiles = async files => {
        for (const file of files) {
            const extension = file.name.toLowerCase().split(".").pop();
            if (!["pdf", "docx"].includes(extension)) {
                showNotice(`${file.name}: only PDF and DOCX handbooks are supported.`, true);
                continue;
            }
            if (file.size === 0 || file.size > maximumFileSize) {
                showNotice(`${file.name}: choose a non-empty file smaller than 75 MB.`, true);
                continue;
            }
            const id = makeId("handbook");
            const documentRecord = {
                id,
                fileName: file.name,
                fileType: extension,
                fileSize: file.size,
                uploadedAt: new Date().toISOString(),
                uploadedBy: profile.email,
                status: "stored",
                processingMessage: ""
            };
            try {
                await store.saveMany({
                    documents: [documentRecord],
                    originalFiles: [{id, blob: file}]
                });
                state.documents.unshift(documentRecord);
                renderDocuments();
                await beginProcessing(documentRecord);
            } catch (error) {
                console.error(`Unable to store or process ${file.name}.`, error);
                showNotice(`${file.name}: ${error instanceof Error ? error.message : String(error)}`, true);
            }
        }
        fileInput.value = "";
    };

    const openModuleDialog = () => {
        const sourceIds = [...selectedContentIds];
        if (!selectedAreApproved()) {
            showNotice("Select one or more approved source items before creating a module.", true);
            return;
        }
        const roleIds = [...new Set(window.PortalData.courses
            .filter(course => !course.id.startsWith("HANDBOOK-") && Array.isArray(course.roles))
            .flatMap(course => course.roles))].sort((left, right) => left.localeCompare(right));
        const tqsRequirements = window.PortalData.courses.filter(course =>
            course.requirement === "Required" && !course.id.startsWith("HANDBOOK-")
        );
        document.getElementById("moduleSourceSummary").textContent =
            `${sourceIds.length} approved item(s) will be included as extracted. Their source text cannot be edited in this manager.`;
        document.getElementById("moduleTitle").value = "";
        document.getElementById("moduleRoleOptions").innerHTML = roleIds.map(role => `
            <label class="module-option"><input type="checkbox" name="moduleRole" value="${escapeHtml(role)}"><span>${escapeHtml(role)}</span></label>
        `).join("");
        document.getElementById("moduleTqsOptions").innerHTML = tqsRequirements.map(course => `
            <label class="module-option"><input type="checkbox" name="moduleTqs" value="${escapeHtml(course.id)}"><span>${escapeHtml(course.id)} — ${escapeHtml(course.title)}</span></label>
        `).join("");
        showNotice("", false, moduleDialogNotice);
        moduleDialog.showModal();
    };

    const createModule = async event => {
        event.preventDefault();
        const title = document.getElementById("moduleTitle").value.trim();
        const roleIds = [...moduleForm.querySelectorAll('input[name="moduleRole"]:checked')].map(input => input.value);
        const tqsRequirementIds = [...moduleForm.querySelectorAll('input[name="moduleTqs"]:checked')].map(input => input.value);
        const sourceContentIds = [...selectedContentIds].filter(id => findReview(id).status === "Approved");
        if (!title || !roleIds.length || !sourceContentIds.length) {
            showNotice("Enter a module title, select at least one role, and keep at least one approved source item selected.", true, moduleDialogNotice);
            return;
        }
        const categories = [...new Set(sourceContentIds.map(id => findMetadata(id)?.category).filter(Boolean))];
        const module = {
            id: makeId("module"),
            title,
            category: categories.length === 1 ? categories[0] : "Handbook-based",
            sourceContentIds,
            roleIds,
            tqsRequirementIds,
            createdAt: new Date().toISOString(),
            createdBy: profile.email,
            publicationStatus: "Unpublished",
            publishedAt: null
        };
        try {
            await store.saveMany({modules: [module]});
            state.modules.unshift(module);
            sourceContentIds.forEach(id => selectedContentIds.delete(id));
            moduleDialog.close();
            render();
            showNotice(`Module "${module.title}" saved as unpublished. Publish it explicitly after reviewing its source links.`);
        } catch (error) {
            console.error("Unable to save the training module.", error);
            showNotice(error instanceof Error ? error.message : String(error), true, moduleDialogNotice);
        }
    };

    const changePublication = async (moduleId, shouldPublish) => {
        const module = state.modules.find(item => item.id === moduleId);
        if (!module) return;
        if (shouldPublish) {
            const allApproved = module.sourceContentIds.length > 0 && module.sourceContentIds.every(id =>
                state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
            );
            if (!allApproved) {
                showNotice("This module cannot be published until every source item is available and approved.", true);
                return;
            }
            if (!module.roleIds.length) {
                showNotice("This module cannot be published until at least one role is linked.", true);
                return;
            }
        }
        const changedAt = new Date().toISOString();
        const updated = {
            ...module,
            publicationStatus: shouldPublish ? "Published" : "Unpublished",
            publishedAt: shouldPublish ? changedAt : null,
            unpublishedAt: shouldPublish ? null : changedAt
        };
        try {
            await syncPublishedState([updated]);
            showNotice(shouldPublish
                ? `Published "${updated.title}" to this browser's training catalog. It is not deployed to other users.`
                : `Unpublished "${updated.title}" from this browser's training catalog.`);
        } catch (error) {
            console.error("Unable to update module publication status.", error);
            showNotice(error instanceof Error ? error.message : String(error), true);
        }
    };

    const previewModule = moduleId => {
        const module = state.modules.find(item => item.id === moduleId);
        if (!module) {
            showNotice("The selected module is no longer available.", true);
            return;
        }
        const sources = module.sourceContentIds
            .map(id => state.sourceContent.find(item => item.id === id))
            .filter(Boolean);
        document.getElementById("previewTitle").textContent = module.title;
        document.getElementById("previewMetadata").innerHTML = [
            ["Module ID", module.id],
            ["Category", module.category],
            ["Roles", module.roleIds.join(", ")],
            ["TQS links", module.tqsRequirementIds.join(", ") || "None"],
            ["Source items", `${sources.length} of ${module.sourceContentIds.length}`],
            ["Publication", module.publicationStatus]
        ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
        const warning = document.getElementById("previewWarnings");
        warning.textContent = "The module body is the source text below, joined with separators for display. No instructional text has been generated or edited.";
        warning.hidden = false;
        document.getElementById("previewText").textContent = sources.map(item => item.sourceText).join("\n\n");
        state.activePreviewId = null;
        viewOriginalButton.hidden = true;
        previewPanel.hidden = false;
        previewPanel.scrollIntoView({behavior: "smooth", block: "start"});
    };

    const exportPackage = async () => {
        try {
            const records = await store.readAll();
            const packageData = {
                schemaVersion: 1,
                exportedAt: new Date().toISOString(),
                prototypeNotice: "Original binary handbooks are stored separately in this browser. Download each original from the handbook library. This JSON preserves extracted text, organizational metadata, approvals, and modules.",
                originalHandbooks: records.documents,
                extractedSourceContent: records.sourceContent,
                organizationalMetadata: records.organizationMetadata,
                administratorReviews: records.reviews,
                trainingModules: records.modules
            };
            const blob = new Blob([JSON.stringify(packageData, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `training-content-source-${new Date().toISOString().slice(0, 10)}.json`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
            showNotice("Source package exported. Download and commit the JSON and original handbooks through your approved source-control workflow.");
        } catch (error) {
            console.error("Unable to export the handbook source package.", error);
            showNotice(error instanceof Error ? error.message : String(error), true);
        }
    };

    uploadForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!fileInput.files.length) {
            showNotice("Choose at least one PDF or DOCX handbook.", true);
            return;
        }
        document.getElementById("uploadHandbooksButton").disabled = true;
        try {
            await uploadFiles([...fileInput.files]);
        } finally {
            document.getElementById("uploadHandbooksButton").disabled = false;
        }
    });
    handbookList.addEventListener("click", event => {
        const button = event.target.closest("[data-view-document], [data-download-document], [data-reprocess-document]");
        if (!button) return;
        const documentId = button.dataset.viewDocument || button.dataset.downloadDocument || button.dataset.reprocessDocument;
        if (button.dataset.viewDocument) openOriginal(documentId);
        else if (button.dataset.downloadDocument) openOriginal(documentId, null, true);
        else {
            const documentRecord = findDocument(documentId);
            if (documentRecord) beginProcessing(documentRecord).catch(error => {
                console.error("Unable to retry handbook extraction.", error);
                showNotice(error instanceof Error ? error.message : String(error), true);
            });
        }
    });
    contentExplorer.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-select-content]");
        if (!checkbox) return;
        if (checkbox.checked) selectedContentIds.add(checkbox.dataset.selectContent);
        else selectedContentIds.delete(checkbox.dataset.selectContent);
        updateSelectionControls();
    });
    contentExplorer.addEventListener("click", event => {
        const groupButton = event.target.closest("[data-select-group]");
        if (groupButton) {
            try {
                const ids = JSON.parse(groupButton.dataset.selectGroup);
                const shouldSelect = !ids.every(id => selectedContentIds.has(id));
                ids.forEach(id => {
                    if (shouldSelect) selectedContentIds.add(id);
                    else selectedContentIds.delete(id);
                });
                renderContent();
            } catch (error) {
                console.error("Unable to select the requested handbook section.", error);
                showNotice(error instanceof Error ? error.message : String(error), true);
            }
            return;
        }
        const previewButton = event.target.closest("[data-preview-content]");
        if (previewButton) {
            previewContent(previewButton.dataset.previewContent);
            return;
        }
        const reviewButton = event.target.closest("[data-review-content]");
        if (reviewButton) {
            updateReviewStatus([reviewButton.dataset.reviewContent], reviewButton.dataset.reviewStatus)
                .catch(error => {
                    console.error("Unable to update source approval.", error);
                    showNotice(error instanceof Error ? error.message : String(error), true);
                });
        }
    });
    contentSearch.addEventListener("input", renderContent);
    categoryFilter.addEventListener("change", renderContent);
    reviewFilter.addEventListener("change", renderContent);
    document.querySelector("[data-handbook-search]").addEventListener("input", event => {
        contentSearch.value = event.target.value;
        renderContent();
    });
    document.getElementById("selectAllVisibleButton").addEventListener("click", () => {
        const visibleCheckboxes = [...contentExplorer.querySelectorAll("[data-select-content]")];
        const selectAll = visibleCheckboxes.some(checkbox => !checkbox.checked);
        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
            if (selectAll) selectedContentIds.add(checkbox.dataset.selectContent);
            else selectedContentIds.delete(checkbox.dataset.selectContent);
        });
        updateSelectionControls();
    });
    approveSelectedButton.addEventListener("click", () => updateReviewStatus([...selectedContentIds], "Approved")
        .catch(error => {
            console.error("Unable to approve selected source content.", error);
            showNotice(error instanceof Error ? error.message : String(error), true);
        }));
    rejectSelectedButton.addEventListener("click", () => updateReviewStatus([...selectedContentIds], "Rejected")
        .catch(error => {
            console.error("Unable to reject selected source content.", error);
            showNotice(error instanceof Error ? error.message : String(error), true);
        }));
    createModuleButton.addEventListener("click", openModuleDialog);
    viewOriginalButton.addEventListener("click", () => {
        const item = state.sourceContent.find(candidate => candidate.id === state.activePreviewId);
        if (item) openOriginal(item.documentId, item.pageNumber);
    });
    moduleList.addEventListener("click", event => {
        const previewButton = event.target.closest("[data-preview-module]");
        if (previewButton) {
            previewModule(previewButton.dataset.previewModule);
            return;
        }
        const publishButton = event.target.closest("[data-publish-module]");
        if (publishButton) {
            changePublication(publishButton.dataset.publishModule, true);
            return;
        }
        const unpublishButton = event.target.closest("[data-unpublish-module]");
        if (unpublishButton) changePublication(unpublishButton.dataset.unpublishModule, false);
    });
    document.getElementById("exportPackageButton").addEventListener("click", exportPackage);
    document.getElementById("closeModuleDialog").addEventListener("click", () => moduleDialog.close());
    document.getElementById("cancelModuleButton").addEventListener("click", () => moduleDialog.close());
    moduleDialog.addEventListener("click", event => {
        if (event.target === moduleDialog) moduleDialog.close();
    });
    moduleForm.addEventListener("submit", event => {
        createModule(event).catch(error => {
            console.error("Unable to create the training module.", error);
            showNotice(error instanceof Error ? error.message : String(error), true, moduleDialogNotice);
        });
    });

    try {
        const records = await store.readAll();
        state.documents = records.documents;
        state.sourceContent = records.sourceContent;
        state.organizationMetadata = records.organizationMetadata;
        state.reviews = records.reviews;
        state.modules = records.modules;
        render();
    } catch (error) {
        console.error("Unable to load the local handbook workspace.", error);
        showNotice(error instanceof Error ? error.message : String(error), true);
        uploadForm.querySelector("button[type=submit]").disabled = true;
    }
});
