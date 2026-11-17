document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    if (!button || !menu) return;

    if (!menu.querySelector('[href="account.html"]')) {
        const signInLink = document.createElement("a");
        signInLink.href = "account.html";
        signInLink.textContent = "Sign in";
        menu.prepend(signInLink);
    }

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

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !menu.hidden) {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.focus();
        }
    });
});
