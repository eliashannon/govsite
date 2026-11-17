document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("referenceList");
    if (!container || !window.PortalData) return;
    const references = window.PortalData.references;
    function render(category="All", query="") {
        const filtered = references.filter(ref => {
            const categoryMatch = category === "All" || ref.category === category;
            const text = [ref.title,ref.description,ref.category,ref.id].join(" ").toLowerCase();
            return categoryMatch && text.includes(query.toLowerCase());
        });
        container.innerHTML = filtered.map(ref => `
            <article class="list-item" data-searchable"><div><h4>${ref.title}</h4><p>${ref.description}</p><p>${ref.id} · ${ref.category} · ${ref.revision}</p></div><a class="btn btn-secondary btn-small" href="${ref.link}">Open</a></article>`).join("");
        const empty = document.getElementById("referenceEmptyState");
        if (empty) empty.hidden = filtered.length !== 0;
    }
    const category = document.getElementById("referenceCategory");
    const search = document.getElementById("referenceSearch");
    const update = () => render(category ? category.value : "All", search ? search.value : "");
    if (category) category.addEventListener("change", update);
    if (search) search.addEventListener("input", update);
    render();
});
