function login() {

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value.trim();

    const error =
        document.getElementById("error");


    // Login details
    const correctUsername = "elete";
    const correctPassword = "4455";


    if (
        username === correctUsername &&
        password === correctPassword
    ) {

        // Save login status
        localStorage.setItem(
            "gymAdminLoggedIn",
            "true"
        );

        // Open dashboard
        window.location.href = "index.html";

    } else {

        error.textContent =
            "Invalid username or password!";

    }
}