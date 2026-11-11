document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-portal-search]").forEach(input => {
        input.addEventListener("input", () => {
            const query = input.value.toLowerCase().trim();
            const targets = document.querySelectorAll("[data-searchable]");
            let visible = 0;
            targets.forEach(target => {
                const match = target.textContent.toLowerCase().includes(query);
                target.hidden = !match;
                if (match) visible++;
            });
            const empty = document.getElementById("searchEmptyState");
            if (empty) empty.hidden = visible !== 0 || query === "";
        });
    });
});
