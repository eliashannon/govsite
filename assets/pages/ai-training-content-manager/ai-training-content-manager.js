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
    const documentSelectionCount = document.getElementById("documentSelectionCount");
    const selectAllDocumentsButton = document.getElementById("selectAllDocumentsButton");
    const deleteSelectedDocumentsButton = document.getElementById("deleteSelectedDocumentsButton");
    const contentExplorer = document.getElementById("contentExplorer");
    const contentCount = document.getElementById("contentCount");
    const contentSearch = document.getElementById("contentSearch");
    const categoryFilter = document.getElementById("categoryFilter");
    const reviewFilter = document.getElementById("reviewFilter");
    const selectionCount = document.getElementById("selectionCount");
    const approveSelectedButton = document.getElementById("approveSelectedButton");
    const rejectSelectedButton = document.getElementById("rejectSelectedButton");
    const deleteSelectedContentButton = document.getElementById("deleteSelectedContentButton");
    const addSelectedExamCoursesButton = document.getElementById("addSelectedExamCoursesButton");
    const addSelectedPublishedCoursesButton = document.getElementById("addSelectedPublishedCoursesButton");
    const selectAllVisibleButton = document.getElementById("selectAllVisibleButton");
    const examBuilderList = document.getElementById("examBuilderList");
    const examBuilderCount = document.getElementById("examBuilderCount");
    const examBuilderSelectionCount = document.getElementById("examBuilderSelectionCount");
    const selectAllExamCoursesButton = document.getElementById("selectAllExamCoursesButton");
    const returnSelectedExamCoursesButton = document.getElementById("returnSelectedExamCoursesButton");
    const publishSelectedExamCoursesButton = document.getElementById("publishSelectedExamCoursesButton");
    const publishedCoursesList = document.getElementById("publishedCoursesList");
    const publishedCoursesCount = document.getElementById("publishedCoursesCount");
    const examEditorDialog = document.getElementById("examEditorDialog");
    const examModuleSelect = document.getElementById("examModuleSelect");
    const examTitleInput = document.getElementById("examTitleInput");
    const examQuestionEditor = document.getElementById("examQuestionEditor");
    const examEditorNotice = document.getElementById("examEditorNotice");
    const previewPanel = document.getElementById("sourcePreview");
    const viewOriginalButton = document.getElementById("viewOriginalButton");
    let pendingApprovalModuleId = null;
    const selectedDocumentIds = new Set();
    const selectedContentIds = new Set();
    const selectedStructuredCourseIds = new Set();
    const selectedExamBuilderCourseIds = new Set();
    const selectedModuleIds = new Set();
    const examBuilderCourseIds = new Set();
    let examBuilderStorageAvailable = true;
    let editingExamOriginalCourse = null;
    let editingExamCourse = null;
    let editingExamId = "";
    let editingExamModuleId = "";
    let editingExamQuestions = [];
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
    try {
        const savedIds = JSON.parse(localStorage.getItem("trainingExamBuilderCourseIds") || "[]");
        if (!Array.isArray(savedIds) || !savedIds.every(id => typeof id === "string")) {
            throw new Error("The Exam Builder course queue has an invalid format.");
        }
        savedIds.forEach(id => examBuilderCourseIds.add(id));
    } catch (error) {
        examBuilderStorageAvailable = false;
        console.error("Unable to read the Exam Builder course queue.", error);
        showNotice("The Exam Builder queue could not be read. Clear or repair trainingExamBuilderCourseIds in this browser's local storage before using the Exam Builder.", true);
    }
    const isMasterUser = () => profile.isMaster === true
        && profile.email.toLowerCase() === "elias@navy.mil";
    const requireMaster = target => {
        if (isMasterUser()) return true;
        showNotice("Only the master account can approve or publish training courses.", true, target);
        return false;
    };
    const getStructuredCourse = courseId => {
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            return records && typeof records === "object" && !Array.isArray(records) ? records[courseId] || null : null;
        } catch (error) {
            console.error("Unable to read the structured course.", error);
            showNotice("Unable to read a structured course from local storage.", true);
            return null;
        }
    };
    const isEligibleExamCourse = courseId => getStructuredCourse(courseId)?.status === "approved";
    const moveCourses = (courseIds, source, destination) => {
        if (!examBuilderStorageAvailable) {
            showNotice("The Exam Builder queue is unavailable until its saved data is repaired.", true);
            return false;
        }
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            const uniqueIds = [...new Set(courseIds)];
            if (!uniqueIds.length) throw new Error("Select at least one course.");
            uniqueIds.forEach(id => {
                const course = records[id];
                if (!course || window.CourseWorkflow.zone(course) !== source) {
                    throw new Error("A selected course is no longer in this section. Refresh and try again.");
                }
                records[id] = window.CourseWorkflow.move(course, destination);
            });
            localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
            window.dispatchEvent(new Event("training-course-changed"));
            return true;
        } catch (error) {
            console.error("Unable to move the selected courses.", error);
            showNotice(error instanceof Error ? error.message : "Unable to move the selected courses.", true);
            return false;
        }
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
        "Pending Approval": "status-pending",
        "Unpublished": "status-unpublished",
        "Published": "status-published"
    }[status] || "");
    const statusBadge = status => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
    const findMetadata = contentId => {
        const metadata = state.organizationMetadata.find(item => item.contentId === contentId);
        if (metadata || !contentId.startsWith("structured-course-")) return metadata;
        const course = getStructuredCourse(contentId.slice("structured-course-".length));
        return course ? {category:course.category, headingPath:[course.title || course.id], contentType:"Structured course"} : null;
    };
    const findReview = contentId => {
        const review = state.reviews.find(item => item.contentId === contentId)
            || {contentId, status: "Pending Review", reviewedAt: null, reviewer: ""};
        const item = state.sourceContent.find(source => source.id === contentId);
        const courseId = item?.structuredCourseId || (contentId.startsWith("structured-course-")
            ? contentId.slice("structured-course-".length) : "");
        if (!courseId) return review;
        try {
            const course = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}")[courseId];
            const status = ["approved", "published"].includes(course?.status) ? "Approved" : course?.status === "rejected" ? "Rejected" : "Pending Review";
            return {...review, status};
        } catch (error) {
            console.error("Unable to read the structured course review status.", error);
            return review;
        }
    };
    const unpublishStructuredCourses = courseIds => {
        if (!requireMaster()) return;
        const uniqueIds = [...new Set(courseIds.filter(Boolean))];
        if (!uniqueIds.length) return;
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            let changed = 0;
            uniqueIds.forEach(courseId => {
                const course = records[courseId];
                if (!course || course.status !== "published") return;
                records[courseId] = window.CourseWorkflow.unpublish(course);
                changed += 1;
            });
            if (!changed) {
                showNotice("No published courses were selected.", true);
                return;
            }
            localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
            selectedStructuredCourseIds.clear();
            window.dispatchEvent(new Event("training-course-changed"));
            render();
            showNotice(`Unpublished ${changed} ${changed === 1 ? "course" : "courses"} from Training Courses.`);
        } catch (error) {
            console.error("Unable to unpublish the selected courses.", error);
            showNotice(error instanceof Error ? error.message : "Unable to unpublish the selected courses.", true);
        }
    };
    const findDocument = documentId => state.documents.find(item => item.id === documentId);
    const selectedAreApproved = () => {
        const selected = [...selectedContentIds];
        return selected.length > 0 && selected.every(id =>
            state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
        );
    };
    const updateSelectionControls = () => {
        selectionCount.textContent = `${selectedContentIds.size + selectedStructuredCourseIds.size} selected`;
        approveSelectedButton.disabled = selectedContentIds.size === 0;
        rejectSelectedButton.disabled = selectedContentIds.size === 0;
        deleteSelectedContentButton.disabled = selectedContentIds.size === 0;
        const selectedExamCourseIds = [...selectedStructuredCourseIds].filter(isEligibleExamCourse);
        addSelectedExamCoursesButton.disabled = selectedExamCourseIds.length === 0 || !examBuilderStorageAvailable;
        addSelectedPublishedCoursesButton.disabled = selectedExamCourseIds.length === 0 || !examBuilderStorageAvailable;
        const visibleCheckboxes = [...contentExplorer.querySelectorAll("[data-select-content], [data-select-structured-course]")];
        selectAllVisibleButton.textContent = visibleCheckboxes.length > 0
            && visibleCheckboxes.every(checkbox => checkbox.dataset.selectContent
                ? selectedContentIds.has(checkbox.dataset.selectContent)
                : selectedStructuredCourseIds.has(checkbox.dataset.selectStructuredCourse))
            ? "Deselect visible"
            : "Select all visible";
    };
    const updateModuleSelectionControls = () => {
        const availableIds = new Set(state.modules.map(module => module.id));
        selectedModuleIds.forEach(id => {
            if (!availableIds.has(id)) selectedModuleIds.delete(id);
        });
        moduleSelectionCount.textContent = `${selectedModuleIds.size} selected`;
        deleteSelectedModulesButton.disabled = selectedModuleIds.size === 0;
        selectAllModulesButton.textContent = state.modules.length > 0
            && state.modules.every(module => selectedModuleIds.has(module.id))
            ? "Deselect all"
            : "Select all";
    };
    const updateDocumentSelectionControls = () => {
        const eligibleIds = new Set(state.documents
            .filter(documentRecord => documentRecord.status !== "processing")
            .map(documentRecord => documentRecord.id));
        selectedDocumentIds.forEach(id => {
            if (!eligibleIds.has(id)) selectedDocumentIds.delete(id);
        });
        documentSelectionCount.textContent = `${selectedDocumentIds.size} selected`;
        deleteSelectedDocumentsButton.disabled = selectedDocumentIds.size === 0;
        selectAllDocumentsButton.textContent = eligibleIds.size > 0
            && [...eligibleIds].every(id => selectedDocumentIds.has(id))
            ? "Deselect all"
            : "Select all";
    };

    const renderDocuments = () => {
        documentCount.textContent = `${state.documents.length} ${state.documents.length === 1 ? "document" : "documents"}`;
        if (!state.documents.length) {
            handbookList.innerHTML = '<div class="handbook-empty">Uploaded handbooks will remain available here for review.</div>';
            updateDocumentSelectionControls();
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
                    <label class="handbook-document-select"><input type="checkbox" data-select-document="${escapeHtml(documentRecord.id)}" aria-label="Select ${escapeHtml(documentRecord.fileName)}" ${selectedDocumentIds.has(documentRecord.id) ? "checked" : ""} ${documentRecord.status === "processing" ? "disabled" : ""}>Select</label>
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
        updateDocumentSelectionControls();
    };

    const updateCategoryOptions = () => {
        const currentCategory = categoryFilter.value || "All";
        const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
        const categories = [...new Set([
            ...state.organizationMetadata.map(item => item.category),
            ...Object.values(records).filter(course => course?.managerZone === "course").map(course => course.category)
        ].filter(Boolean))]
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
        if (item.structuredCourseId) {
            let course = null;
            try {
                course = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}")[item.structuredCourseId];
            } catch (error) {
                console.error("Unable to read the structured course.", error);
            }
            const courseStatus = course?.status === "published" ? "Published"
                : course?.status === "approved" ? "Approved"
                : course?.status === "rejected" ? "Rejected"
                : course?.status === "needs-review" ? "Pending Review" : "Unpublished";
            const canSelectForExam = course?.status === "approved";
            return `
                <article class="source-content-item">
                    ${canSelectForExam
                        ? `<input type="checkbox" data-select-structured-course="${escapeHtml(item.structuredCourseId)}" aria-label="Select approved course ${escapeHtml(course.title || item.structuredCourseId)}" ${selectedStructuredCourseIds.has(item.structuredCourseId) ? "checked" : ""}>`
                        : `<span></span>`}
                    <div class="source-content-copy">
                        <button class="source-item-preview" type="button" data-preview-course="${escapeHtml(item.structuredCourseId)}">${escapeHtml(heading || item.structuredCourseId)}</button>
                        <p>${escapeHtml(excerpt)}</p>
                        <div class="content-meta"><span>${escapeHtml(item.originalDocumentName)}</span><span>Structured course</span>${statusBadge(courseStatus)}</div>
                    </div>
                    <div class="source-item-actions">
                        <button class="manager-small-button" type="button" data-preview-course="${escapeHtml(item.structuredCourseId)}">Open course preview</button>
                    </div>
                </article>`;
        }
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
        const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
        const existingCourseIds = new Set(state.sourceContent.map(item => item.structuredCourseId).filter(Boolean));
        const recoveredCourses = Object.values(records).filter(course => course?.managerZone === "course"
            && !existingCourseIds.has(course.id)).map(course => ({
                id:`structured-course-${course.id}`,
                documentId:`structured-course-${course.id}`,
                structuredCourseId:course.id,
                originalDocumentName:course.title || course.id,
                sourceText:(course.modules || []).map(module => module.title || "").join("\n")
            }));
        const visibleItems = [...state.sourceContent, ...recoveredCourses].filter(item => {
            if (item.structuredCourseId) {
                const course = getStructuredCourse(item.structuredCourseId);
                if (course && window.CourseWorkflow.zone(course) !== "course") return false;
            }
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
                    .filter(item => !item.structuredCourseId && item.documentId === chapter.items[0].documentId
                        && (findMetadata(item.id)?.headingPath?.[0] || item.originalDocumentName) === chapter.title)
                    .map(item => item.id);
                const hasChapterHeading = chapter.items.some(item => (findMetadata(item.id)?.headingPath || []).length > 0);
                return `
                    <section class="content-chapter-group">
                        <div class="content-chapter-heading">
                            <strong>${escapeHtml(chapter.title)}</strong>
                            ${chapterSelectionIds.length ? `<button class="ai-text-button" type="button" data-select-group="${escapeHtml(JSON.stringify(chapterSelectionIds))}">Select ${hasChapterHeading ? "chapter" : "document"}</button>` : ""}
                        </div>
                        ${[...sections.values()].map(section => {
                            const sectionIds = visibleItems
                                .filter(item => {
                                    const path = findMetadata(item.id)?.headingPath || [];
                                    return !item.structuredCourseId && item.documentId === chapter.items[0].documentId
                                        && (path[0] || item.originalDocumentName) === chapter.title
                                        && path.slice(1).join(" / ") === section.title;
                                })
                                .map(item => item.id);
                            return `
                                <section class="content-section-group">
                                    ${section.title ? `<div class="content-section-heading"><span>${escapeHtml(section.title)}</span>${sectionIds.length ? `<button class="ai-text-button" type="button" data-select-group="${escapeHtml(JSON.stringify(sectionIds))}">Select section</button>` : ""}</div>` : ""}
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
            updateModuleSelectionControls();
            return;
        }
        moduleList.innerHTML = [...state.modules]
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(module => {
                const sourceContentIds = Array.isArray(module.sourceContentIds) ? module.sourceContentIds : [];
                const roleIds = Array.isArray(module.roleIds) ? module.roleIds : [];
                const validSourceCount = sourceContentIds.filter(id =>
                    state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
                ).length;
                const isPublished = module.publicationStatus === "Published" && validSourceCount === sourceContentIds.length;
                const assignment = module.assignment || {};
                const assignmentLabel = [assignment.division || module.division, assignment.branch || module.branch, assignment.role || roleIds.join(", ")]
                    .filter(Boolean).join(" / ");
                const approvalStatus = module.approvalStatus
                    || (isPublished ? "Approved" : module.publicationStatus === "Pending Approval" ? "Pending Approval" : "Unpublished");
                return `
                    <article class="module-card">
                        <div class="module-card-copy">
                            <label class="module-select"><input type="checkbox" data-select-module="${escapeHtml(module.id)}" aria-label="Select ${escapeHtml(module.title)}" ${selectedModuleIds.has(module.id) ? "checked" : ""}>Select module</label>
                            <h3>${escapeHtml(module.title)}</h3>
                            <p>${escapeHtml(module.category)} · Created ${escapeHtml(dateTime(module.createdAt))}</p>
                            <p class="module-source-count">${validSourceCount} of ${sourceContentIds.length} source items remain approved${assignmentLabel ? ` · Assignment: ${escapeHtml(assignmentLabel)}` : ""}</p>
                            <div class="module-card-meta">${statusBadge(isPublished ? "Published" : "Unpublished")}
                                ${!isPublished ? statusBadge(approvalStatus) : ""}
                                <span>${(module.tqsRequirementIds || []).length} linked TQS ${(module.tqsRequirementIds || []).length === 1 ? "requirement" : "requirements"}</span>
                            </div>
                        </div>
                        <div class="module-actions">
                            <button class="manager-small-button" type="button" data-preview-module="${escapeHtml(module.id)}">Preview sources</button>
                            ${isPublished
                                ? `<button class="manager-small-button" type="button" data-unpublish-module="${escapeHtml(module.id)}">Unpublish</button>`
                                : `<button class="manager-small-button" type="button" data-publish-module="${escapeHtml(module.id)}" ${validSourceCount !== sourceContentIds.length || !sourceContentIds.length ? "disabled" : ""}>Approve &amp; assign</button>`}
                        </div>
                    </article>`;
            }).join("");
        updateModuleSelectionControls();
    };

    const getModuleAssessments = module => {
        const assessments = Array.isArray(module?.assessments)
            ? module.assessments.map((exam, index) => ({
                ...exam,
                id:typeof exam?.id === "string" && exam.id ? exam.id : `${module.id}-assessment-${index + 1}`,
                title:typeof exam?.title === "string" && exam.title.trim() ? exam.title : `Exam ${index + 1}`
            }))
            : [];
        if (Array.isArray(module?.assessment?.questions) && module.assessment.questions.length) {
            assessments.push({
                id:`legacy-${module.id}`,
                title:"Knowledge Check",
                questions:module.assessment.questions,
                legacy:true
            });
        }
        return assessments;
    };

    const normalizeCourseAssessments = course => ({
        ...JSON.parse(JSON.stringify(course)),
        modules:course.modules.map(module => {
            const moduleWithoutAssessments = {...module};
            delete moduleWithoutAssessments.assessment;
            delete moduleWithoutAssessments.assessments;
            const exams = getModuleAssessments(module).map(exam => {
                const normalized = JSON.parse(JSON.stringify(exam));
                delete normalized.legacy;
                return normalized;
            });
            return exams.length ? {...moduleWithoutAssessments, assessments:exams} : moduleWithoutAssessments;
        })
    });

    const updateExamBuilderSelectionControls = () => {
        const availableIds = new Set(examBuilderCourseIds);
        selectedExamBuilderCourseIds.forEach(id => {
            if (!availableIds.has(id)) selectedExamBuilderCourseIds.delete(id);
        });
        examBuilderSelectionCount.textContent = `${selectedExamBuilderCourseIds.size} selected`;
        returnSelectedExamCoursesButton.disabled = selectedExamBuilderCourseIds.size === 0 || !examBuilderStorageAvailable;
        publishSelectedExamCoursesButton.disabled = selectedExamBuilderCourseIds.size === 0 || !examBuilderStorageAvailable;
        selectAllExamCoursesButton.textContent = examBuilderCourseIds.size > 0
            && [...examBuilderCourseIds].every(id => selectedExamBuilderCourseIds.has(id))
            ? "Deselect all"
            : "Select all";
    };

    const renderExamBuilder = () => {
        examBuilderCount.textContent = `${examBuilderCourseIds.size} ${examBuilderCourseIds.size === 1 ? "course" : "courses"}`;
        if (!examBuilderCourseIds.size) {
            examBuilderList.innerHTML = '<div class="handbook-empty">No courses are in the Exam Builder. Select approved courses in Course Builder and add them here.</div>';
            updateExamBuilderSelectionControls();
            return;
        }
        let records = {};
        try {
            const parsed = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("The structured course store has an invalid format.");
            }
            records = parsed;
        } catch (error) {
            console.error("Unable to load courses for the Exam Builder.", error);
            showNotice(error instanceof Error ? error.message : "Unable to load courses for the Exam Builder.", true);
        }
        examBuilderList.innerHTML = [...examBuilderCourseIds].map(courseId => {
            const course = records[courseId];
            if (!course) {
                return `<article class="exam-builder-course">
                    <input type="checkbox" data-select-exam-course="${escapeHtml(courseId)}" aria-label="Select unavailable queued course ${escapeHtml(courseId)}" ${selectedExamBuilderCourseIds.has(courseId) ? "checked" : ""}>
                    <div class="exam-builder-course-copy"><h3>Course unavailable</h3><p>${escapeHtml(courseId)} is no longer saved in Course Builder.</p></div>
                    <div class="exam-builder-course-actions"><button class="manager-small-button" type="button" data-return-exam-course="${escapeHtml(courseId)}">Return to Course Builder</button></div>
                </article>`;
            }
            const eligible = course.status === "approved";
            const exams = (Array.isArray(course.modules) ? course.modules : []).flatMap((module, moduleIndex) =>
                getModuleAssessments(module).map(exam => ({...exam, moduleId:module.id, moduleTitle:module.title || `Module ${moduleIndex + 1}`}))
            );
            const questionCount = exams.reduce((total, exam) => total + (Array.isArray(exam.questions) ? exam.questions.length : 0), 0);
            const examSummary = exams.length
                ? `${exams.length} ${exams.length === 1 ? "exam" : "exams"} · ${questionCount} ${questionCount === 1 ? "question" : "questions"}`
                : "No exams yet";
            return `<article class="exam-builder-course">
                <input type="checkbox" data-select-exam-course="${escapeHtml(courseId)}" aria-label="Select ${escapeHtml(course.title || courseId)} in Exam Builder" ${selectedExamBuilderCourseIds.has(courseId) ? "checked" : ""}>
                <div class="exam-builder-course-copy">
                    <h3>${escapeHtml(course.title || courseId)}</h3>
                    <p>${escapeHtml(examSummary)}</p>
                    <div class="exam-builder-course-meta"><span>${escapeHtml(course.status || "draft")}</span><span>${(course.modules || []).length} ${(course.modules || []).length === 1 ? "module" : "modules"}</span></div>
                    <div class="exam-builder-exams">${exams.length ? exams.map(exam => `
                        <div class="exam-builder-exam-row">
                            <div class="exam-builder-exam-copy"><strong>${escapeHtml(exam.title)}</strong>${escapeHtml(exam.moduleTitle)} · ${(exam.questions || []).length} ${(exam.questions || []).length === 1 ? "question" : "questions"}</div>
                            <div class="exam-builder-exam-actions">
                                <button class="manager-small-button" type="button" data-view-exam-course="${escapeHtml(courseId)}" data-view-exam-module="${escapeHtml(exam.moduleId)}" data-view-exam-id="${escapeHtml(exam.id)}">View / edit</button>
                                <button class="manager-small-button" type="button" data-remove-exam-course="${escapeHtml(courseId)}" data-remove-exam-module="${escapeHtml(exam.moduleId)}" data-remove-exam-id="${escapeHtml(exam.id)}">Remove</button>
                            </div>
                        </div>`).join("") : ""}
                    </div>
                </div>
                <div class="exam-builder-course-actions">
                    <button class="manager-small-button" type="button" data-add-exam-course="${escapeHtml(courseId)}" ${eligible ? "" : "disabled"}>${exams.length ? "Add Another Exam" : "Add Exam"}</button>
                    <button class="manager-small-button" type="button" data-preview-exam-course="${escapeHtml(courseId)}" ${eligible ? "" : "disabled"}>Preview course</button>
                    <button class="manager-small-button" type="button" data-return-exam-course="${escapeHtml(courseId)}">Return to Course Builder</button>
                </div>
            </article>`;
        }).join("");
        updateExamBuilderSelectionControls();
    };

    const renderExamQuestions = () => {
        examQuestionEditor.replaceChildren();
        const questions = editingExamQuestions;
        if (!questions.length) {
            const empty = document.createElement("p");
            empty.className = "handbook-empty";
            empty.textContent = "No questions have been added to this exam.";
            examQuestionEditor.append(empty);
        }
        questions.forEach((question, questionIndex) => {
            const card = document.createElement("section");
            card.className = "exam-question-card";
            const heading = document.createElement("div");
            heading.className = "exam-question-heading";
            const title = document.createElement("strong");
            title.textContent = `Question ${questionIndex + 1}`;
            const removeQuestion = document.createElement("button");
            removeQuestion.type = "button";
            removeQuestion.className = "manager-small-button";
            removeQuestion.textContent = "Remove question";
            removeQuestion.addEventListener("click", () => {
                questions.splice(questionIndex, 1);
                renderExamQuestions();
            });
            heading.append(title, removeQuestion);

            const promptLabel = document.createElement("label");
            promptLabel.textContent = "Question";
            const prompt = document.createElement("textarea");
            prompt.required = true;
            prompt.value = question.prompt || "";
            prompt.addEventListener("input", () => { question.prompt = prompt.value; });
            promptLabel.append(prompt);

            const answerList = document.createElement("div");
            answerList.className = "exam-answer-list";
            const choiceLimit = document.createElement("p");
            choiceLimit.className = "exam-editor-help";
            choiceLimit.textContent = "Enter at least two answer choices and select the correct answer.";
            answerList.append(choiceLimit);
            (Array.isArray(question.choices) ? question.choices : []).forEach((choice, choiceIndex) => {
                const row = document.createElement("label");
                row.className = "exam-answer-choice";
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = `exam-answer-${questionIndex}`;
                radio.checked = question.answerIndex === choiceIndex;
                radio.setAttribute("aria-label", `Mark choice ${choiceIndex + 1} correct`);
                radio.addEventListener("change", () => { question.answerIndex = choiceIndex; });
                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = 500;
                input.required = true;
                input.value = choice;
                input.setAttribute("aria-label", `Answer choice ${choiceIndex + 1}`);
                input.addEventListener("input", () => { question.choices[choiceIndex] = input.value; });
                const removeChoice = document.createElement("button");
                removeChoice.type = "button";
                removeChoice.className = "manager-small-button";
                removeChoice.textContent = "Remove";
                removeChoice.disabled = question.choices.length <= 2;
                removeChoice.addEventListener("click", () => {
                    question.choices.splice(choiceIndex, 1);
                    if (question.answerIndex === choiceIndex) question.answerIndex = -1;
                    else if (question.answerIndex > choiceIndex) question.answerIndex -= 1;
                    renderExamQuestions();
                });
                row.append(radio, input, removeChoice);
                answerList.append(row);
            });
            const questionActions = document.createElement("div");
            questionActions.className = "exam-question-actions";
            const addChoice = document.createElement("button");
            addChoice.type = "button";
            addChoice.className = "manager-small-button";
            addChoice.textContent = "Add answer choice";
            addChoice.addEventListener("click", () => {
                question.choices.push("");
                renderExamQuestions();
            });
            questionActions.append(addChoice);
            answerList.append(questionActions);
            card.append(heading, promptLabel, answerList);
            examQuestionEditor.append(card);
        });
    };

    const openExamEditor = (courseId, moduleId = null, examId = null) => {
        if (!requireMaster(examEditorNotice)) return;
        const course = getStructuredCourse(courseId);
        if (!course || course.status !== "approved" || window.CourseWorkflow.zone(course) !== "exam") {
            showNotice("Only an approved course can be edited in the Exam Builder.", true, examEditorNotice);
            return;
        }
        if (!Array.isArray(course.modules) || !course.modules.length) {
            showNotice("This course has no modules to attach an exam to.", true, examEditorNotice);
            return;
        }
        editingExamOriginalCourse = JSON.parse(JSON.stringify(course));
        editingExamCourse = normalizeCourseAssessments(course);
        const existingExam = examId
            ? editingExamCourse.modules.flatMap(module => getModuleAssessments(module)
                .map(exam => ({moduleId:module.id, exam})))
                .find(item => item.moduleId === moduleId && item.exam.id === examId)
            : null;
        if (examId && !existingExam) {
            showNotice("The selected exam is no longer available. Refresh the Exam Builder and try again.", true, examEditorNotice);
            return;
        }
        editingExamId = existingExam?.exam.id || makeId("exam");
        editingExamModuleId = existingExam?.moduleId
            || (moduleId && course.modules.some(module => module.id === moduleId) ? moduleId : course.modules[0].id);
        editingExamQuestions = Array.isArray(existingExam?.exam.questions)
            ? existingExam.exam.questions.map(question => ({
                ...question,
                prompt:typeof question?.prompt === "string" ? question.prompt : "",
                choices:Array.isArray(question?.choices) ? [...question.choices] : [],
                answerIndex:Number.isInteger(question?.answerIndex) ? question.answerIndex : -1
            }))
            : [];
        examTitleInput.value = existingExam?.exam.title || "";
        examModuleSelect.replaceChildren(...editingExamCourse.modules.map((module, index) => {
            const option = document.createElement("option");
            option.value = module.id;
            option.textContent = `${module.sourceModuleNumber ? `${module.sourceModuleNumber}: ` : `Module ${index + 1}: `}${module.title || "Untitled module"}`;
            option.selected = module.id === editingExamModuleId;
            return option;
        }));
        document.getElementById("examEditorCourseTitle").textContent = course.title || course.id;
        showNotice("", false, examEditorNotice);
        renderExamQuestions();
        examEditorDialog.showModal();
    };

    const validateExamQuestions = questions => {
        if (!Array.isArray(questions) || !questions.length) return ["Add at least one question."];
        const issues = [];
        questions.forEach((question, index) => {
            const label = `Question ${index + 1}`;
            if (!question || typeof question !== "object") {
                issues.push(`${label} is invalid.`);
                return;
            }
            if (typeof question.prompt !== "string" || !question.prompt.trim()) {
                issues.push(`${label} needs question text.`);
            }
            if (!Array.isArray(question.choices) || question.choices.length < 2
                || !question.choices.every(choice => typeof choice === "string" && choice.trim())) {
                issues.push(`${label} needs at least two non-empty answer choices.`);
            }
            if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= (question.choices || []).length) {
                issues.push(`${label} needs one correct answer selected.`);
            }
        });
        return issues;
    };

    const saveExam = keepOpen => {
        if (!requireMaster(examEditorNotice) || !editingExamCourse) return;
        const title = examTitleInput.value.trim();
        if (!title) {
            showNotice("Enter a title for this exam.", true, examEditorNotice);
            return;
        }
        const errors = validateExamQuestions(editingExamQuestions);
        if (errors.length) {
            showNotice(errors.join(" "), true, examEditorNotice);
            return;
        }
        showNotice("", false, examEditorNotice);
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            const current = records[editingExamOriginalCourse.id];
            if (!current || JSON.stringify(current) !== JSON.stringify(editingExamOriginalCourse)) {
                throw new Error("The course changed while the exam was being edited. Close this dialog and reopen the course.");
            }
            if (current.status !== "approved" || window.CourseWorkflow.zone(current) !== "exam") {
                throw new Error("Only an approved course can be updated in the Exam Builder.");
            }
            if (!editingExamCourse.modules.some(module => module.id === examModuleSelect.value)) {
                throw new Error("Choose a module for this exam.");
            }
            const exam = {id:editingExamId, title, questions:JSON.parse(JSON.stringify(editingExamQuestions))};
            const modules = editingExamCourse.modules.map(module => {
                const exams = getModuleAssessments(module).filter(item => item.id !== editingExamId);
                if (module.id === examModuleSelect.value) exams.push(exam);
                const moduleWithoutAssessments = {...module};
                delete moduleWithoutAssessments.assessment;
                delete moduleWithoutAssessments.assessments;
                return exams.length ? {...moduleWithoutAssessments, assessments:exams} : moduleWithoutAssessments;
            });
            const updatedCourse = {
                ...current,
                modules
            };
            const validationErrors = window.CourseSchema.validateCourse(updatedCourse);
            if (validationErrors.length) throw new Error(`Exam validation failed: ${validationErrors.join(" ")}`);
            records[current.id] = updatedCourse;
            localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
            editingExamOriginalCourse = JSON.parse(JSON.stringify(updatedCourse));
            editingExamCourse = normalizeCourseAssessments(updatedCourse);
            window.dispatchEvent(new Event("training-course-changed"));
            render();
            if (keepOpen) {
                editingExamId = makeId("exam");
                editingExamQuestions = [];
                examTitleInput.value = "";
                renderExamQuestions();
                showNotice("Exam saved. Enter another exam title and questions, then choose its module.", false, examEditorNotice);
                return;
            }
            examEditorDialog.close();
            editingExamOriginalCourse = null;
            editingExamCourse = null;
            showNotice("Exam saved. Preview the course, then publish it when ready.");
        } catch (error) {
            console.error("Unable to save the course exam.", error);
            showNotice(error instanceof Error ? error.message : "Unable to save the course exam.", true, examEditorNotice);
        }
    };

    const removeCourseExam = (courseId, moduleId, examId) => {
        if (!requireMaster()) return;
        const course = getStructuredCourse(courseId);
        if (!course || course.status !== "approved" || window.CourseWorkflow.zone(course) !== "exam") {
            showNotice("Only an approved course in Exam Builder can be edited.", true);
            return;
        }
        if (!window.confirm("Remove this exam from the course? This cannot be undone.")) return;
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            const current = records[courseId];
            if (!current || JSON.stringify(current) !== JSON.stringify(course)) {
                throw new Error("The course changed before the exam could be removed. Refresh the Exam Builder and try again.");
            }
            let removed = false;
            const modules = current.modules.map(module => {
                const exams = getModuleAssessments(module);
                const remaining = exams.filter(exam => {
                    if (module.id === moduleId && exam.id === examId) {
                        removed = true;
                        return false;
                    }
                    return true;
                });
                const moduleWithoutAssessments = {...module};
                delete moduleWithoutAssessments.assessment;
                delete moduleWithoutAssessments.assessments;
                return remaining.length ? {...moduleWithoutAssessments, assessments:remaining} : moduleWithoutAssessments;
            });
            if (!removed) throw new Error("The selected exam is no longer available.");
            records[courseId] = {
                ...current,
                modules
            };
            localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
            window.dispatchEvent(new Event("training-course-changed"));
            render();
            showNotice("Exam removed from the course.");
        } catch (error) {
            console.error("Unable to remove the course exam.", error);
            showNotice(error instanceof Error ? error.message : "Unable to remove the course exam.", true);
        }
    };

    const addSelectedCoursesToExamBuilder = () => {
        if (!requireMaster()) return;
        const eligibleIds = [...selectedStructuredCourseIds].filter(isEligibleExamCourse);
        if (!eligibleIds.length) {
            showNotice("Select one or more approved courses in Course Builder first.", true);
            return;
        }
        if (!moveCourses(eligibleIds, "course", "exam")) return;
        eligibleIds.forEach(id => selectedStructuredCourseIds.delete(id));
        render();
        showNotice(`Moved ${eligibleIds.length} course(s) to Exam Builder.`);
    };

    const returnCoursesToCourseBuilder = courseIds => {
        if (!requireMaster()) return;
        const idsToReturn = [...new Set(courseIds)].filter(id => examBuilderCourseIds.has(id));
        if (!idsToReturn.length) return;
        if (!moveCourses(idsToReturn, "exam", "course")) return;
        idsToReturn.forEach(id => selectedExamBuilderCourseIds.delete(id));
        render();
        showNotice(`Returned ${idsToReturn.length} course(s) to Course Builder.`);
    };

    const previewExamCourse = courseId => {
        const course = getStructuredCourse(courseId);
        if (!course || !["approved", "published"].includes(course.status)) {
            showNotice("Only an approved course can be previewed for publishing.", true);
            return;
        }
        const preview = window.open(`training.html?preview=1&course=${encodeURIComponent(courseId)}`, "_blank");
        if (!preview) showNotice("The course preview could not be opened. Allow pop-ups and try again.", true);
        else preview.opener = null;
    };

    const renderPublishedCourses = courses => {
        publishedCoursesCount.textContent = `${courses.length} ${courses.length === 1 ? "course" : "courses"}`;
        publishedCoursesList.innerHTML = courses.length ? courses.map(course => `
            <article class="exam-builder-course">
                <span></span>
                <div class="exam-builder-course-copy"><h3>${escapeHtml(course.title || course.id)}</h3>
                    <p>${course.status === "published" ? "Published in this browser's Training Courses catalog." : "Unpublished and ready to publish or move."}</p>
                    <div class="exam-builder-course-meta">${statusBadge(course.status === "published" ? "Published" : "Approved")}</div>
                </div>
                <div class="exam-builder-course-actions">
                    <button class="manager-small-button" type="button" data-preview-published="${escapeHtml(course.id)}">Preview course</button>
                    ${course.status === "published"
                        ? `<button class="manager-small-button" type="button" data-unpublish-course="${escapeHtml(course.id)}">Unpublish</button>`
                        : `<button class="manager-small-button" type="button" data-publish-course="${escapeHtml(course.id)}">Publish</button>
                           <button class="manager-small-button" type="button" data-move-published-course="${escapeHtml(course.id)}" data-destination="course">Move to Course Builder</button>
                           <button class="manager-small-button" type="button" data-move-published-course="${escapeHtml(course.id)}" data-destination="exam">Move to Exam Builder</button>`}
                </div>
            </article>`).join("") : '<div class="handbook-empty">No courses are in Published Courses. Move an approved course here to publish it.</div>';
    };

    const publishCourse = courseId => {
        if (!requireMaster()) return;
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            const course = records[courseId];
            if (!course) throw new Error("The selected course is no longer available.");
            const updated = window.CourseWorkflow.publish(course);
            const errors = window.CourseSchema.validateCourse(updated, {complete:true, hierarchy:window.PortalData?.organizationHierarchy});
            if (errors.length) throw new Error(`Course validation failed: ${errors.join(" ")}`);
            records[courseId] = updated;
            localStorage.setItem("trainingManagerCourses", JSON.stringify(records));
            window.dispatchEvent(new Event("training-course-changed"));
            showNotice(`Published "${course.title || courseId}" to this browser's Training Courses catalog.`);
        } catch (error) {
            console.error("Unable to publish the course.", error);
            showNotice(error instanceof Error ? error.message : "Unable to publish the course.", true);
        }
    };

    const render = () => {
        try {
            const records = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            if (!records || typeof records !== "object" || Array.isArray(records)) throw new Error("The structured course store has an invalid format.");
            examBuilderCourseIds.clear();
            const published = [];
            Object.values(records).forEach(course => {
                if (!course || typeof course !== "object") return;
                const zone = window.CourseWorkflow.zone(course);
                if (zone === "exam") examBuilderCourseIds.add(course.id);
                else if (zone === "published") published.push(course);
            });
            selectedStructuredCourseIds.forEach(id => {
                if (!records[id] || window.CourseWorkflow.zone(records[id]) !== "course") selectedStructuredCourseIds.delete(id);
            });
            renderPublishedCourses(published);
        } catch (error) {
            console.error("Unable to load course locations.", error);
            showNotice(error instanceof Error ? error.message : "Unable to load course locations.", true);
            return;
        }
        renderDocuments();
        updateCategoryOptions();
        renderContent();
        renderExamBuilder();
    };

    window.addEventListener("training-content-imported", event => {
        const {sourceContent = [], organizationMetadata = [], reviews = []} = event.detail || {};
        const mergeBy = (target, incoming, key) => {
            incoming.forEach(record => {
                const index = target.findIndex(item => item[key] === record[key]);
                if (index < 0) target.push(record);
                else target[index] = record;
            });
        };
        mergeBy(state.sourceContent, sourceContent, "id");
        mergeBy(state.organizationMetadata, organizationMetadata, "contentId");
        mergeBy(state.reviews, reviews, "contentId");
        contentSearch.value = "";
        categoryFilter.value = "All";
        reviewFilter.value = "All";
        render();
        showNotice("Course added to Course Builder for review.");
    });
    window.addEventListener("training-content-removed", event => {
        const ids = new Set(event.detail.contentIds);
        state.sourceContent = state.sourceContent.filter(item => !ids.has(item.id));
        state.organizationMetadata = state.organizationMetadata.filter(item => !ids.has(item.contentId));
        state.reviews = state.reviews.filter(item => !ids.has(item.contentId));
        render();
    });
    window.addEventListener("training-course-changed", render);
    window.addEventListener("storage", event => {
        if (event.key === "trainingManagerCourses" || event.key === "trainingExamBuilderCourseIds") render();
    });

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
        if (!requireMaster()) return;
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

    const deleteSelectedSourceContent = async () => {
        if (!requireMaster()) return;
        const contentIds = [...selectedContentIds].filter(id => state.sourceContent.some(item => item.id === id));
        if (!contentIds.length) return;
        const affectedModules = state.modules
            .filter(module => module.publicationStatus === "Published"
                && Array.isArray(module.sourceContentIds)
                && module.sourceContentIds.some(id => contentIds.includes(id)))
            .map(module => ({...module, publicationStatus: "Unpublished", unpublishedAt: new Date().toISOString()}));
        const confirmation = `Delete ${contentIds.length} selected source item(s)? Original documents will remain.`
            + (affectedModules.length
                ? ` ${affectedModules.length} published module(s) that use this content will be unpublished.`
                : "");
        if (!window.confirm(confirmation)) return;

        await store.saveMany(
            {modules: affectedModules},
            {
                sourceContent: contentIds,
                organizationMetadata: contentIds,
                reviews: contentIds
            }
        );
        const deletedIds = new Set(contentIds);
        state.sourceContent = state.sourceContent.filter(item => !deletedIds.has(item.id));
        state.organizationMetadata = state.organizationMetadata.filter(item => !deletedIds.has(item.contentId));
        state.reviews = state.reviews.filter(item => !deletedIds.has(item.contentId));
        affectedModules.forEach(updated => {
            const index = state.modules.findIndex(module => module.id === updated.id);
            if (index !== -1) state.modules[index] = updated;
        });
        contentIds.forEach(id => selectedContentIds.delete(id));
        if (deletedIds.has(state.activePreviewId)) {
            state.activePreviewId = null;
            previewPanel.hidden = true;
        }
        render();
        showNotice(`Deleted ${contentIds.length} source item(s).${affectedModules.length ? ` Unpublished ${affectedModules.length} dependent module(s).` : ""}`);
    };

    const deleteSelectedDocuments = async () => {
        if (!requireMaster()) return;
        const documentIds = [...selectedDocumentIds].filter(id =>
            state.documents.some(documentRecord => documentRecord.id === id && documentRecord.status !== "processing")
        );
        if (!documentIds.length) return;
        const deletedDocumentIds = new Set(documentIds);
        const sourceItems = state.sourceContent.filter(item => deletedDocumentIds.has(item.documentId));
        const contentIds = sourceItems.map(item => item.id);
        const affectedModules = state.modules
            .filter(module => module.publicationStatus === "Published"
                && Array.isArray(module.sourceContentIds)
                && module.sourceContentIds.some(id => contentIds.includes(id)))
            .map(module => ({...module, publicationStatus: "Unpublished", unpublishedAt: new Date().toISOString()}));
        const confirmation = `Permanently delete ${documentIds.length} handbook(s), their original files, and ${contentIds.length} extracted item(s)?`
            + (affectedModules.length
                ? ` ${affectedModules.length} published module(s) that use this content will be unpublished.`
                : "");
        if (!window.confirm(confirmation)) return;

        await store.saveMany(
            {modules: affectedModules},
            {
                documents: documentIds,
                originalFiles: documentIds,
                sourceContent: contentIds,
                organizationMetadata: contentIds,
                reviews: contentIds
            }
        );
        state.documents = state.documents.filter(documentRecord => !deletedDocumentIds.has(documentRecord.id));
        state.sourceContent = state.sourceContent.filter(item => !deletedDocumentIds.has(item.documentId));
        state.organizationMetadata = state.organizationMetadata.filter(item => !contentIds.includes(item.contentId));
        state.reviews = state.reviews.filter(item => !contentIds.includes(item.contentId));
        affectedModules.forEach(updated => {
            const index = state.modules.findIndex(module => module.id === updated.id);
            if (index !== -1) state.modules[index] = updated;
        });
        documentIds.forEach(id => selectedDocumentIds.delete(id));
        contentIds.forEach(id => selectedContentIds.delete(id));
        if (sourceItems.some(item => item.id === state.activePreviewId)) {
            state.activePreviewId = null;
            previewPanel.hidden = true;
        }
        render();
        showNotice(`Deleted ${documentIds.length} handbook(s) and ${contentIds.length} extracted item(s).${affectedModules.length ? ` Unpublished ${affectedModules.length} dependent module(s).` : ""}`);
    };

    const deleteSelectedModules = async () => {
        if (!requireMaster()) return;
        const moduleIds = [...selectedModuleIds].filter(id => state.modules.some(module => module.id === id));
        if (!moduleIds.length || !window.confirm(`Delete ${moduleIds.length} selected training module(s)? Published courses will be removed from this browser's catalog.`)) {
            return;
        }
        await store.saveMany({}, {modules: moduleIds});
        const deletedIds = new Set(moduleIds);
        state.modules = state.modules.filter(module => !deletedIds.has(module.id));
        moduleIds.forEach(id => selectedModuleIds.delete(id));
        if (deletedIds.has(pendingApprovalModuleId)) {
            assignmentDialog.close();
            pendingApprovalModuleId = null;
        }
        render();
        showNotice(`Deleted ${moduleIds.length} training module(s) from this browser's catalog.`);
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
            if (!["pdf", "docx", "txt", "md"].includes(extension)) {
                showNotice(`${file.name}: only PDF, DOCX, TXT, and Markdown handbooks are supported.`, true);
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
        if (!requireMaster()) return;
        if (!selectedAreApproved()) {
            showNotice("Select one or more approved source items before creating a module.", true);
            return;
        }
        const tqsRequirements = window.PortalData.courses.filter(course =>
            course.requirement === "Required" && !course.id.startsWith("HANDBOOK-")
        );
        document.getElementById("moduleSourceSummary").textContent =
            `${sourceIds.length} approved item(s) will be included as extracted. Their source text cannot be edited in this manager.`;
        document.getElementById("moduleTitle").value = "";
        document.getElementById("moduleTqsOptions").innerHTML = tqsRequirements.map(course => `
            <label class="module-option"><input type="checkbox" name="moduleTqs" value="${escapeHtml(course.id)}"><span>${escapeHtml(course.id)} — ${escapeHtml(course.title)}</span></label>
        `).join("");
        showNotice("", false, moduleDialogNotice);
        moduleDialog.showModal();
    };

    const createModule = async event => {
        event.preventDefault();
        if (!requireMaster(moduleDialogNotice)) return;
        const title = document.getElementById("moduleTitle").value.trim();
        const tqsRequirementIds = [...moduleForm.querySelectorAll('input[name="moduleTqs"]:checked')].map(input => input.value);
        const sourceContentIds = [...selectedContentIds].filter(id => findReview(id).status === "Approved");
        if (!title || !sourceContentIds.length) {
            showNotice("Enter a module title and keep at least one approved source item selected.", true, moduleDialogNotice);
            return;
        }
        const categories = [...new Set(sourceContentIds.map(id => findMetadata(id)?.category).filter(Boolean))];
        const module = {
            id: makeId("module"),
            title,
            category: categories.length === 1 ? categories[0] : "Handbook-based",
            sourceContentIds,
            roleIds: [],
            tqsRequirementIds,
            createdAt: new Date().toISOString(),
            createdBy: profile.email,
            approvalStatus: "Pending Approval",
            approvedAt: null,
            approvedBy: null,
            assignment: null,
            publicationStatus: "Pending Approval",
            publishedAt: null
        };
        try {
            await store.saveMany({modules: [module]});
            state.modules.unshift(module);
            sourceContentIds.forEach(id => selectedContentIds.delete(id));
            moduleDialog.close();
            render();
            showNotice(`Draft "${module.title}" is pending master approval.`);
        } catch (error) {
            console.error("Unable to save the training module.", error);
            showNotice(error instanceof Error ? error.message : String(error), true, moduleDialogNotice);
        }
    };

    const openAssignmentDialog = moduleId => {
        if (!requireMaster(assignmentDialogNotice)) return;
        const module = state.modules.find(item => item.id === moduleId);
        if (!module) return;
        const sourceContentIds = Array.isArray(module.sourceContentIds) ? module.sourceContentIds : [];
        const allApproved = sourceContentIds.length > 0 && sourceContentIds.every(id =>
            state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
        );
        if (!allApproved) {
            showNotice("This course cannot be approved until every source item is available and approved.", true);
            return;
        }
        pendingApprovalModuleId = moduleId;
        const hierarchy = window.PortalData.organizationHierarchy;
        assignmentDivision.innerHTML = '<option value="">Select Division</option>' + Object.keys(hierarchy).map(division =>
            `<option value="${escapeHtml(division)}">${escapeHtml(division)}</option>`
        ).join("");
        assignmentBranch.innerHTML = '<option value="">Select Branch</option>';
        assignmentBranch.disabled = true;
        assignmentRole.innerHTML = '<option value="">Select Role</option>';
        assignmentRole.disabled = true;
        assignmentForm.reset();
        showNotice("", false, assignmentDialogNotice);
        assignmentDialog.showModal();
    };

    const populateAssignmentBranches = () => {
        const hierarchy = window.PortalData.organizationHierarchy;
        const branches = hierarchy[assignmentDivision.value] || {};
        assignmentBranch.innerHTML = '<option value="">Select Branch</option>' + Object.keys(branches).map(branch =>
            `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`
        ).join("");
        assignmentBranch.disabled = !assignmentDivision.value;
        assignmentRole.innerHTML = '<option value="">Select Role</option>';
        assignmentRole.disabled = true;
    };

    const populateAssignmentRoles = () => {
        const roles = window.PortalData.organizationHierarchy[assignmentDivision.value]?.[assignmentBranch.value] || [];
        assignmentRole.innerHTML = '<option value="">Select Role</option>' + roles.map(role =>
            `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`
        ).join("");
        assignmentRole.disabled = !assignmentBranch.value;
    };

    const approveAndPublishModule = async event => {
        event.preventDefault();
        if (!requireMaster(assignmentDialogNotice)) return;
        const module = state.modules.find(item => item.id === pendingApprovalModuleId);
        const {value: division} = assignmentDivision;
        const {value: branch} = assignmentBranch;
        const {value: role} = assignmentRole;
        const hierarchy = window.PortalData.organizationHierarchy;
        if (!module || !division || !branch || !role || !hierarchy[division]?.[branch]?.includes(role)) {
            showNotice("Select a valid Division, Branch, and Role before approving this course.", true, assignmentDialogNotice);
            return;
        }
        const sourceContentIds = Array.isArray(module.sourceContentIds) ? module.sourceContentIds : [];
        const allApproved = sourceContentIds.length > 0 && sourceContentIds.every(id =>
            state.sourceContent.some(item => item.id === id) && findReview(id).status === "Approved"
        );
        if (!allApproved) {
            showNotice("This course cannot be approved until every source item is available and approved.", true, assignmentDialogNotice);
            return;
        }
        const changedAt = new Date().toISOString();
        const updated = {
            ...module,
            approvalStatus: "Approved",
            approvedAt: changedAt,
            approvedBy: profile.email,
            assignment: {division, branch, role},
            division,
            branch,
            role,
            roleIds: [role],
            publicationStatus: "Published",
            publishedAt: changedAt,
            unpublishedAt: null
        };
        try {
            await syncPublishedState([updated]);
            assignmentDialog.close();
            pendingApprovalModuleId = null;
            showNotice(`Approved and published "${updated.title}" for ${division} / ${branch} / ${role} in this browser's training catalog.`);
        } catch (error) {
            console.error("Unable to approve and publish the training course.", error);
            showNotice(error instanceof Error ? error.message : String(error), true, assignmentDialogNotice);
        }
    };

    const unpublishModule = async moduleId => {
        if (!requireMaster()) return;
        const module = state.modules.find(item => item.id === moduleId);
        if (!module) return;
        const changedAt = new Date().toISOString();
        const updated = {
            ...module,
            publicationStatus: "Unpublished",
            publishedAt: null,
            unpublishedAt: changedAt
        };
        try {
            await syncPublishedState([updated]);
            showNotice(`Unpublished "${updated.title}" from this browser's training catalog.`);
        } catch (error) {
            console.error("Unable to unpublish the training course.", error);
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
            ["Assignment", module.assignment
                ? `${module.assignment.division} / ${module.assignment.branch} / ${module.assignment.role}`
                : "Not assigned"],
            ["Approval", module.approvalStatus || "Pending Approval"],
            ["TQS links", (module.tqsRequirementIds || []).join(", ") || "None"],
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
    handbookList.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-select-document]");
        if (!checkbox) return;
        if (checkbox.checked) selectedDocumentIds.add(checkbox.dataset.selectDocument);
        else selectedDocumentIds.delete(checkbox.dataset.selectDocument);
        updateDocumentSelectionControls();
    });
    selectAllDocumentsButton.addEventListener("click", () => {
        const checkboxes = [...handbookList.querySelectorAll("[data-select-document]:not(:disabled)")];
        const allSelected = checkboxes.length > 0
            && checkboxes.every(checkbox => selectedDocumentIds.has(checkbox.dataset.selectDocument));
        checkboxes.forEach(checkbox => {
            checkbox.checked = !allSelected;
            if (allSelected) selectedDocumentIds.delete(checkbox.dataset.selectDocument);
            else selectedDocumentIds.add(checkbox.dataset.selectDocument);
        });
        updateDocumentSelectionControls();
    });
    deleteSelectedDocumentsButton.addEventListener("click", () => deleteSelectedDocuments().catch(error => {
        console.error("Unable to delete selected handbooks.", error);
        showNotice(error instanceof Error ? error.message : String(error), true);
    }));
    contentExplorer.addEventListener("change", event => {
        const courseCheckbox = event.target.closest("[data-select-structured-course]");
        if (courseCheckbox) {
            if (courseCheckbox.checked) selectedStructuredCourseIds.add(courseCheckbox.dataset.selectStructuredCourse);
            else selectedStructuredCourseIds.delete(courseCheckbox.dataset.selectStructuredCourse);
            updateSelectionControls();
            return;
        }
        const checkbox = event.target.closest("[data-select-content]");
        if (!checkbox) return;
        if (checkbox.checked) selectedContentIds.add(checkbox.dataset.selectContent);
        else selectedContentIds.delete(checkbox.dataset.selectContent);
        updateSelectionControls();
    });
    examBuilderList.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-select-exam-course]");
        if (!checkbox) return;
        if (checkbox.checked) selectedExamBuilderCourseIds.add(checkbox.dataset.selectExamCourse);
        else selectedExamBuilderCourseIds.delete(checkbox.dataset.selectExamCourse);
        updateExamBuilderSelectionControls();
    });
    contentExplorer.addEventListener("click", event => {
        const courseButton = event.target.closest("[data-preview-course]");
        if (courseButton) {
            window.location.href = `training.html?preview=1&course=${encodeURIComponent(courseButton.dataset.previewCourse)}`;
            return;
        }
        const groupButton = event.target.closest("[data-select-group]");
        if (groupButton) {
            try {
                const ids = JSON.parse(groupButton.dataset.selectGroup);
                const shouldSelect = !ids.every(id => selectedContentIds.has(id));
                ids.forEach(id => {
                    if (shouldSelect && state.sourceContent.some(item => item.id === id && !item.structuredCourseId)) selectedContentIds.add(id);
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
    examBuilderList.addEventListener("click", event => {
        const addButton = event.target.closest("[data-add-exam-course]");
        if (addButton) {
            openExamEditor(addButton.dataset.addExamCourse);
            return;
        }
        const editButton = event.target.closest("[data-view-exam-course]");
        if (editButton) {
            openExamEditor(editButton.dataset.viewExamCourse, editButton.dataset.viewExamModule, editButton.dataset.viewExamId);
            return;
        }
        const removeButton = event.target.closest("[data-remove-exam-course]");
        if (removeButton) {
            removeCourseExam(removeButton.dataset.removeExamCourse, removeButton.dataset.removeExamModule, removeButton.dataset.removeExamId);
            return;
        }
        const previewButton = event.target.closest("[data-preview-exam-course]");
        if (previewButton) {
            previewExamCourse(previewButton.dataset.previewExamCourse);
            return;
        }
        const returnButton = event.target.closest("[data-return-exam-course]");
        if (returnButton) returnCoursesToCourseBuilder([returnButton.dataset.returnExamCourse]);
    });
    publishedCoursesList.addEventListener("click", event => {
        const unpublish = event.target.closest("[data-unpublish-course]");
        if (unpublish) return unpublishStructuredCourses([unpublish.dataset.unpublishCourse]);
        const publish = event.target.closest("[data-publish-course]");
        if (publish) return publishCourse(publish.dataset.publishCourse);
        const move = event.target.closest("[data-move-published-course]");
        if (move) {
            if (moveCourses([move.dataset.movePublishedCourse], "published", move.dataset.destination)) {
                showNotice(`Moved course to ${move.dataset.destination === "exam" ? "Exam Builder" : "Course Builder"}.`);
            }
            return;
        }
        const preview = event.target.closest("[data-preview-published]");
        if (preview) previewExamCourse(preview.dataset.previewPublished);
    });
    contentSearch.addEventListener("input", renderContent);
    categoryFilter.addEventListener("change", renderContent);
    reviewFilter.addEventListener("change", renderContent);
    document.querySelector("[data-handbook-search]").addEventListener("input", event => {
        contentSearch.value = event.target.value;
        renderContent();
    });
    selectAllVisibleButton.addEventListener("click", () => {
        const visibleCheckboxes = [...contentExplorer.querySelectorAll("[data-select-content]")];
        const visibleCourseCheckboxes = [...contentExplorer.querySelectorAll("[data-select-structured-course]")];
        const selectAll = visibleCheckboxes.some(checkbox => !checkbox.checked)
            || visibleCourseCheckboxes.some(checkbox => !checkbox.checked);
        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
            if (selectAll) selectedContentIds.add(checkbox.dataset.selectContent);
            else selectedContentIds.delete(checkbox.dataset.selectContent);
        });
        visibleCourseCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
            if (selectAll) selectedStructuredCourseIds.add(checkbox.dataset.selectStructuredCourse);
            else selectedStructuredCourseIds.delete(checkbox.dataset.selectStructuredCourse);
        });
        updateSelectionControls();
    });
    deleteSelectedContentButton.addEventListener("click", () => deleteSelectedSourceContent().catch(error => {
        console.error("Unable to delete selected source content.", error);
        showNotice(error instanceof Error ? error.message : String(error), true);
    }));
    addSelectedExamCoursesButton.addEventListener("click", addSelectedCoursesToExamBuilder);
    addSelectedPublishedCoursesButton.addEventListener("click", () => {
        const ids = [...selectedStructuredCourseIds].filter(isEligibleExamCourse);
        if (moveCourses(ids, "course", "published")) {
            selectedStructuredCourseIds.clear();
            render();
            showNotice(`Moved ${ids.length} course(s) to Published Courses.`);
        }
    });
    selectAllExamCoursesButton.addEventListener("click", () => {
        const allSelected = examBuilderCourseIds.size > 0
            && [...examBuilderCourseIds].every(id => selectedExamBuilderCourseIds.has(id));
        if (allSelected) examBuilderCourseIds.forEach(id => selectedExamBuilderCourseIds.delete(id));
        else examBuilderCourseIds.forEach(id => selectedExamBuilderCourseIds.add(id));
        renderExamBuilder();
    });
    returnSelectedExamCoursesButton.addEventListener("click", () => {
        returnCoursesToCourseBuilder([...selectedExamBuilderCourseIds]);
    });
    publishSelectedExamCoursesButton.addEventListener("click", () => {
        const ids = [...selectedExamBuilderCourseIds];
        if (moveCourses(ids, "exam", "published")) {
            selectedExamBuilderCourseIds.clear();
            render();
            showNotice(`Moved ${ids.length} course(s) to Published Courses.`);
        }
    });
    document.getElementById("addExamQuestionButton").addEventListener("click", () => {
        editingExamQuestions.push({prompt:"", choices:["","","",""], answerIndex:-1});
        renderExamQuestions();
    });
    document.getElementById("addAnotherExamButton").addEventListener("click", () => saveExam(true));
    document.getElementById("saveExamButton").addEventListener("click", () => saveExam(false));
    document.getElementById("closeExamEditorDialog").addEventListener("click", () => examEditorDialog.close());
    document.getElementById("cancelExamEditorButton").addEventListener("click", () => examEditorDialog.close());
    examEditorDialog.addEventListener("click", event => {
        if (event.target === examEditorDialog) examEditorDialog.close();
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
    viewOriginalButton.addEventListener("click", () => {
        const item = state.sourceContent.find(candidate => candidate.id === state.activePreviewId);
        if (item) openOriginal(item.documentId, item.pageNumber);
    });
    document.getElementById("exportPackageButton").addEventListener("click", exportPackage);
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
