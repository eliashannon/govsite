document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    const storageKey = "govsiteAccountProfile";
    if (!button) return;

    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch (error) {
        sessionStorage.removeItem(storageKey);
    }

    const avatar = button.querySelector(".account-avatar");
    const label = button.querySelector("span:last-child");
    if (profile) {
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Account";
        if (avatar) avatar.textContent = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
        if (label) label.textContent = `${name} ▾`;
        button.setAttribute("aria-expanded", "false");

        if (menu && !menu.querySelector("[data-sign-out]")) {
            const signOut = document.createElement("button");
            signOut.type = "button";
            signOut.dataset.signOut = "true";
            signOut.className = "account-menu-action";
            signOut.textContent = "Sign out";
            signOut.addEventListener("click", () => {
                sessionStorage.removeItem(storageKey);
                window.location.href = "account.html";
            });
            menu.append(signOut);
        }
        button.addEventListener("click", () => {
            if (!menu) return;
            const expanded = button.getAttribute("aria-expanded") === "true";
            button.setAttribute("aria-expanded", String(!expanded));
            menu.hidden = expanded;
        });
    } else {
        button.addEventListener("click", () => {
            window.location.href = "account.html";
        });
    }

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
