document.addEventListener("DOMContentLoaded", () => {
    const storageKey = "govsiteTrainingContent";
    const accountStorageKey = "govsiteAccountProfile";
    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem(accountStorageKey) || "null");
    } catch (error) {
        sessionStorage.removeItem(accountStorageKey);
    }
    if (!profile || profile.isMaster !== true || profile.email?.toLowerCase() !== "elias@navy.mil") {
        window.location.replace("tqs-support.html");
        return;
    }

    const defaultContent = [
        {id:"content-1",title:"Initial Orientation",role:"All roles",category:"Initial",duration:"2 hours",description:"Introduction to organizational processes, responsibilities, and expectations.",status:"Published"},
        {id:"content-2",title:"Annual Information Security",role:"All roles",category:"Mandatory",duration:"1 hour",description:"Information security awareness and responsible handling of information.",status:"Published"},
        {id:"content-3",title:"Role-Specific Qualification",role:"Assigned role",category:"Role-Specific",duration:"Varies",description:"Training associated with the responsibilities of an assigned position.",status:"Draft"}
    ];
    const loadContent = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            return Array.isArray(saved) ? saved : defaultContent;
        } catch (error) {
            console.error("Unable to load managed training content.", error);
            return defaultContent;
        }
    };
    let content = loadContent();
    let generatedDraft = null;

    const list = document.getElementById("contentList");
    const count = document.getElementById("contentCount");
    const search = document.getElementById("contentSearch");
    const filter = document.getElementById("contentFilter");
    const dialog = document.getElementById("contentDialog");
    const form = document.getElementById("contentForm");
    const deleteButton = document.getElementById("deleteContentButton");

    const save = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(content));
        } catch (error) {
            console.error("Unable to save managed training content.", error);
        }
    };
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]));
    const render = () => {
        const term = search.value.trim().toLowerCase();
        const status = filter.value;
        const visible = content.filter(item =>
            (status === "All" || item.status === status) &&
            (!term || `${item.title} ${item.role} ${item.category}`.toLowerCase().includes(term))
        );
        count.textContent = `${visible.length} ${visible.length === 1 ? "item" : "items"}`;
        list.innerHTML = visible.length ? visible.map(item => `
            <article class="ai-content-card">
                <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="ai-content-meta"><span>${escapeHtml(item.role)}</span><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.duration)}</span><span>${escapeHtml(item.status)}</span></div></div>
                <div class="ai-content-actions"><button class="ai-edit-button" type="button" data-edit="${escapeHtml(item.id)}">Edit</button></div>
            </article>`).join("") : '<div class="ai-empty">No training content matches the current filters.</div>';
    };

    const openEditor = item => {
        document.getElementById("contentDialogTitle").textContent = item ? "Edit training content" : "New training content";
        document.getElementById("contentId").value = item?.id || "";
        document.getElementById("contentTitle").value = item?.title || "";
        document.getElementById("contentRole").value = item?.role || "";
        document.getElementById("contentCategory").value = item?.category || "";
        document.getElementById("contentDuration").value = item?.duration || "";
        document.getElementById("contentDescription").value = item?.description || "";
        document.getElementById("contentStatus").value = item?.status || "Draft";
        deleteButton.hidden = !item;
        dialog.showModal();
    };
    document.getElementById("newContentButton").addEventListener("click", () => openEditor(null));
    document.getElementById("closeContentDialog").addEventListener("click", () => dialog.close());
    document.getElementById("cancelContentButton").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    list.addEventListener("click", event => {
        const button = event.target.closest("[data-edit]");
        if (button) openEditor(content.find(item => item.id === button.dataset.edit));
    });

    form.addEventListener("submit", event => {
        event.preventDefault();
        const id = document.getElementById("contentId").value;
        const item = {
            id: id || `content-${Date.now()}`,
            title: document.getElementById("contentTitle").value.trim(),
            role: document.getElementById("contentRole").value.trim(),
            category: document.getElementById("contentCategory").value.trim(),
            duration: document.getElementById("contentDuration").value.trim(),
            description: document.getElementById("contentDescription").value.trim(),
            status: document.getElementById("contentStatus").value
        };
        if (!item.title || !item.role || !item.category || !item.duration || !item.description) return;
        content = id ? content.map(existing => existing.id === id ? item : existing) : [item, ...content];
        save();
        render();
        dialog.close();
    });
    deleteButton.addEventListener("click", () => {
        const id = document.getElementById("contentId").value;
        if (id) content = content.filter(item => item.id !== id);
        save();
        render();
        dialog.close();
    });
    search.addEventListener("input", render);
    filter.addEventListener("change", render);
    document.querySelector("[data-ai-content-search]").addEventListener("input", event => {
        document.getElementById("contentSearch").value = event.target.value;
        render();
    });

    document.getElementById("aiDraftForm").addEventListener("submit", event => {
        event.preventDefault();
        const title = document.getElementById("draftTitle").value.trim();
        const role = document.getElementById("draftRole").value.trim();
        const notes = document.getElementById("draftNotes").value.trim();
        const detail = notes ? ` The course addresses ${notes.charAt(0).toLowerCase()}${notes.slice(1).replace(/[.!?]+$/, "")}.` : "";
        generatedDraft = {
            title,
            role,
            category: "Role-Specific",
            duration: "2 hours",
            description: `This ${title.toLowerCase()} course prepares ${role} personnel to apply required procedures, recognize key responsibilities, and demonstrate safe, compliant performance.${detail}`,
            status: "Draft"
        };
        document.getElementById("draftResultTitle").textContent = generatedDraft.title;
        document.getElementById("draftResultDescription").textContent = generatedDraft.description;
        document.getElementById("draftResultCategory").textContent = generatedDraft.category;
        document.getElementById("draftResultDuration").textContent = generatedDraft.duration;
        document.getElementById("draftResult").hidden = false;
    });
    document.getElementById("useDraftButton").addEventListener("click", () => {
        if (!generatedDraft) return;
        openEditor(generatedDraft);
    });
    render();
});
