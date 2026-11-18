document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    const storageKey = "govsiteAccountProfile";
    const roleStorageKey = "portal.selectedRole";
    const demoCredentials = {
        email: "elias@navy.mil",
        password: "elias"
    };
    const signInForm = document.getElementById("signInForm");
    const signInNotice = document.getElementById("signInNotice");
    const createAccountForm = document.getElementById("createAccountForm");
    const createAccountNotice = document.getElementById("createAccountNotice");
    const signInPanel = document.getElementById("sign-in");
    const createAccountPanel = document.getElementById("create-account");
    const pageTitle = document.getElementById("accountPageTitle");
    const pageDescription = document.getElementById("accountPageDescription");

    const showAccountPanel = (shouldFocus = false) => {
        const creatingAccount = window.location.hash === "#create-account";
        if (signInPanel) signInPanel.hidden = creatingAccount;
        if (createAccountPanel) createAccountPanel.hidden = !creatingAccount;
        if (pageTitle) {
            pageTitle.textContent = creatingAccount ? "Create an account" : "Sign in";
            if (shouldFocus) pageTitle.focus();
        }
        if (pageDescription) {
            pageDescription.textContent = creatingAccount
                ? "Enter the requested details to get started."
                : "Sign in to access your training portal account and personalized resources.";
        }
        document.title = `Training Portal | ${creatingAccount ? "Create an Account" : "Sign In"}`;
    };

    if (signInForm && signInNotice) {
        signInForm.addEventListener("submit", event => {
            event.preventDefault();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;
            if (email !== demoCredentials.email || password !== demoCredentials.password) {
                signInNotice.textContent = "Email or password is incorrect.";
                signInNotice.hidden = false;
                return;
            }

            try {
                sessionStorage.setItem(storageKey, JSON.stringify({
                    firstName: "Elias",
                    lastName: "Hannon",
                    email: demoCredentials.email,
                    isMaster: true
                }));
            } catch (error) {
                console.error("Unable to save the demo account profile.", error);
                signInNotice.textContent = "This browser could not save the sign-in session. Check your browser storage settings and try again.";
                signInNotice.hidden = false;
                return;
            }
            window.location.href = "index.html";
        });
    }

    if (createAccountForm && createAccountNotice) {
        const passcode = createAccountForm.elements.namedItem("passcode");
        const confirmPasscode = createAccountForm.elements.namedItem("confirmPasscode");
        const validatePasscodes = () => {
            confirmPasscode.setCustomValidity(
                confirmPasscode.value && confirmPasscode.value !== passcode.value
                    ? "Passcodes must match."
                    : ""
            );
        };
        passcode.addEventListener("input", validatePasscodes);
        confirmPasscode.addEventListener("input", validatePasscodes);
        createAccountForm.addEventListener("submit", event => {
            event.preventDefault();
            validatePasscodes();
            if (!createAccountForm.reportValidity()) return;
            const formData = new FormData(createAccountForm);
            const newProfile = {
                firstName: formData.get("firstName").trim(),
                lastName: formData.get("lastName").trim(),
                email: formData.get("email").trim()
            };
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(newProfile));
            } catch (error) {
                console.error("Unable to save the temporary account profile.", error);
                createAccountNotice.textContent = "This browser could not save the temporary account details. Please check your browser storage settings and try again.";
                createAccountNotice.hidden = false;
                return;
            }
            window.location.href = "index.html";
        });
    }

    if (signInPanel && createAccountPanel) {
        showAccountPanel();
        window.addEventListener("hashchange", () => showAccountPanel(true));
    }

    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch (error) {
        sessionStorage.removeItem(storageKey);
    }

    const renderAccount = () => {
        if (!button) return;
        if (!profile) {
            const avatar = button.querySelector(".account-avatar");
            const label = button.querySelector("span:last-child");
            if (avatar) avatar.textContent = "U";
            if (label) label.textContent = "Sign in";
            button.setAttribute("aria-expanded", "false");
            return;
        }
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Account";
        const avatar = button.querySelector(".account-avatar");
        const label = button.querySelector("span:last-child");
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
                localStorage.removeItem(roleStorageKey);
                sessionStorage.removeItem(storageKey);
                profile = null;
                window.location.href = "account.html";
            });
            menu.append(signOut);
        }
    };

    renderAccount();
    if (button) {
        button.addEventListener("click", () => {
            if (!profile) {
                window.location.href = "account.html";
                return;
            }
            if (!menu) return;
            const expanded = button.getAttribute("aria-expanded") === "true";
            button.setAttribute("aria-expanded", String(!expanded));
            menu.hidden = expanded;
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
