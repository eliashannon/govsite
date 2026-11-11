document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    if (!button || !menu) return;
    button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        menu.hidden = expanded;
    });
    document.addEventListener("click", event => {
        if (!button.contains(event.target) && !menu.contains(event.target)) {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
        }
    });
});
