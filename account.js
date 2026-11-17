document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    if (!button) return;

    // The account control is the direct entry point to the sign-in page.
    button.addEventListener("click", () => {
        window.location.href = "account.html";
    });

    // Keep any existing menu links available on keyboard/menu-enabled layouts.
    if (!menu) return;
    document.addEventListener("click", event => {
        if (!button.contains(event.target) && !menu.contains(event.target)) {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !menu.hidden) {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.focus();
        }
    });
});
