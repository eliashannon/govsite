document.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("faqList");
    const searchInput = document.getElementById("faqSearch");
    const headerSearchInput = document.querySelector("[data-portal-search]");
    const resultCount = document.getElementById("faqResultCount");
    const emptyState = document.getElementById("faqEmptyState");
    const loadError = document.getElementById("faqLoadError");
    const faqs = window.PortalData?.faqs;

    if (!Array.isArray(faqs)) {
        console.error("Unable to load FAQ content.");
        loadError.hidden = false;
        resultCount.textContent = "";
        return;
    }

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

    const render = source => {
        const query = source.value.trim().toLowerCase();
        [searchInput, headerSearchInput].filter(Boolean).forEach(input => {
            if (input !== source) input.value = source.value;
        });
        const matches = faqs.filter(faq =>
            `${faq.question} ${faq.answer} ${faq.category || ""}`.toLowerCase().includes(query)
        );
        list.innerHTML = matches.map((faq, index) => `
            <details class="faq-entry">
                <summary class="faq-question">${escapeHtml(faq.question)}</summary>
                <div class="faq-answer">
                    <span class="faq-category">${escapeHtml(faq.category || "General")}</span>
                    <p>${escapeHtml(faq.answer)}</p>
                </div>
            </details>
        `).join("");
        resultCount.textContent = query
            ? `${matches.length} of ${faqs.length} questions`
            : `${faqs.length} questions`;
        emptyState.hidden = matches.length > 0;
    };

    [searchInput, headerSearchInput].filter(Boolean).forEach(input => {
        input.addEventListener("input", () => render(input));
    });
    render(searchInput);
});
