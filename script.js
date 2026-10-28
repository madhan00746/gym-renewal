// ===============================
// LOAD MEMBERS
// ===============================

let members = JSON.parse(localStorage.getItem("gymMembers")) || [];
let firebaseListenerStarted = false;

// ===============================
// SAVE MEMBERS LOCALLY
// ===============================

function saveMembers() {
    localStorage.setItem("gymMembers", JSON.stringify(members));
}

// ===============================
// HELPERS
// ===============================

function todayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getMember(memberId) {
    return members.find(member => String(member.id) === String(memberId));
}

function firebaseReady() {
    return !!(
        window.firebaseDB &&
        window.firebaseCollection &&
        window.firebaseAddDoc &&
        window.firebaseDoc &&
        window.firebaseUpdateDoc &&
        window.firebaseDeleteDoc &&
        window.firebaseOnSnapshot
    );
}

function showMessage(message) {
    alert(message);
}

// ===============================
// ADD MEMBER FORM
// ===============================

function showAddMember() {
    document.getElementById("memberForm").style.display = "block";
}

function hideAddMember() {
    document.getElementById("memberForm").style.display = "none";
}

// ===============================
// CALCULATE EXPIRY DATE
// ===============================

function calculateExpiryDate(startDate, plan) {
    const date = new Date(startDate + "T12:00:00");

    if (plan === "1 Month") date.setMonth(date.getMonth() + 1);
    else if (plan === "3 Months") date.setMonth(date.getMonth() + 3);
    else if (plan === "6 Months") date.setMonth(date.getMonth() + 6);
    else if (plan === "1 Year") date.setFullYear(date.getFullYear() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ===============================
// MEMBERSHIP STATUS
// ===============================

function getMembershipStatus(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate + "T00:00:00");
    expiry.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil((expiry - today) / 86400000);

    if (daysLeft < 0) {
        return { text: "Expired", className: "expired-status", daysLeft };
    }

    if (daysLeft <= 7) {
        return { text: "Renewal Due", className: "renewal-status", daysLeft };
    }

    return { text: "Active", className: "active-status", daysLeft };
}

// ===============================
// ADD MEMBER
// ===============================

async function addMember() {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const plan = document.getElementById("plan").value;
    const startDate = document.getElementById("startDate").value;
    const amountText = document.getElementById("amount").value;
    const amount = Number(amountText);

    if (!name || !phone || !plan || !startDate || amountText === "") {
        showMessage("Please fill all details.");
        return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
        showMessage("Please enter a valid amount.");
        return;
    }

    if (members.some(member => member.phone === phone)) {
        showMessage("This member is already added!");
        return;
    }

    if (!firebaseReady()) {
        showMessage("Firebase is not connected. Member was not saved.");
        return;
    }

    const member = {
        id: Date.now(),
        name,
        phone,
        plan,
        startDate,
        expiryDate: calculateExpiryDate(startDate, plan),
        amount,
        payment: "Pending",
        paymentDate: null
    };

    try {
        const docRef = await window.firebaseAddDoc(
            window.firebaseCollection(window.firebaseDB, "members"),
            member
        );

        member.firestoreId = docRef.id;
        members.push(member);
        saveMembers();

        document.getElementById("name").value = "";
        document.getElementById("phone").value = "";
        document.getElementById("plan").value = "";
        document.getElementById("startDate").value = "";
        document.getElementById("amount").value = "";

        hideAddMember();
        displayMembers();
        showMessage("Member saved successfully!");
    } catch (error) {
        console.error("Add member error:", error);
        showMessage("Could not save member to Firebase.");
    }
}

// ===============================
// MEMBER CARD
// ===============================

function createMemberCard(member) {
    const status = getMembershipStatus(member.expiryDate);
    const div = document.createElement("div");
    const safeName = escapeHTML(member.name);
    const safePhone = escapeHTML(member.phone);
    const safePlan = escapeHTML(member.plan);
    const safeStart = escapeHTML(member.startDate);
    const safeExpiry = escapeHTML(member.expiryDate);
    const payment = member.payment === "Paid" ? "Paid" : "Pending";

    div.innerHTML = `
        <div class="member-card">
            <h3>${safeName}</h3>
            <p>📱 ${safePhone}</p>
            <p>Plan: ${safePlan}</p>
            <p>Start Date: ${safeStart}</p>
            <p>Expiry Date: ${safeExpiry}</p>
            <p>Amount: ₹${Number(member.amount) || 0}</p>

            <p>Status:
                <strong class="${status.className}">${status.text}</strong>
            </p>

            ${
                status.daysLeft >= 0
                    ? `<p>⏳ ${status.daysLeft} days remaining</p>`
                    : `<p>⚠️ Membership expired</p>`
            }

            <p>Payment:
                <strong class="${payment === "Paid" ? "paid-status" : "pending-status"}">
                    ${payment}
                </strong>
            </p>

            ${
                payment === "Paid"
                    ? `<p>📅 Payment Date: ${escapeHTML(member.paymentDate || "-")}</p>`
                    : `<button class="pay-btn" onclick="markAsPaid(${Number(member.id)})">
                           ✓ Mark as Paid
                       </button>`
            }

            <div class="member-actions">
                <button class="edit-btn" onclick="editMember(${Number(member.id)})">✏️ Edit</button>
                <button class="delete-btn" onclick="deleteMember(${Number(member.id)})">🗑️ Delete</button>
                <button class="renew-btn" onclick="renewMember(${Number(member.id)})">🔄 Renew</button>
            </div>
        </div>
    `;

    return div;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ===============================
// DISPLAY MEMBERS
// ===============================

function displayMembers() {
    const memberList = document.getElementById("memberList");
    if (!memberList) {
        updateDashboard();
        return;
    }

    if (members.length === 0) {
        memberList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">👤</div>
                <p>No members added yet.</p>
            </div>
        `;
        updateDashboard();
        return;
    }

    memberList.innerHTML = "";
    members.forEach(member => memberList.appendChild(createMemberCard(member)));
    updateDashboard();
}

// ===============================
// DASHBOARD
// ===============================

function updateDashboard() {
    let activeCount = 0;
    let renewalCount = 0;
    let expiredCount = 0;
    let totalCollection = 0;
    let pendingAmount = 0;

    members.forEach(member => {
        const status = getMembershipStatus(member.expiryDate);

        if (status.text === "Active") activeCount++;
        else if (status.text === "Renewal Due") renewalCount++;
        else expiredCount++;

        const amount = Number(member.amount) || 0;

        if (member.payment === "Paid") {
            totalCollection += amount;
        } else {
            pendingAmount += amount;
        }
    });

    setText("totalMembers", members.length);
    setText("activeMembers", activeCount);
    setText("renewalDue", renewalCount);
    setText("expiredMembers", expiredCount);
    setText("totalCollection", "₹" + totalCollection);
    setText("pendingAmount", "₹" + pendingAmount);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

// ===============================
// MARK PAYMENT AS PAID
// FIRESTORE DATABASE UPDATE
// ===============================

async function markAsPaid(memberId) {
    const member = getMember(memberId);
    if (!member) return;

    if (member.payment === "Paid") {
        showMessage("This payment is already marked as Paid.");
        return;
    }

    if (!member.firestoreId || !firebaseReady()) {
        showMessage("Firebase connection or member database ID is missing.");
        return;
    }

    const paymentDate = todayDate();

    try {
        await window.firebaseUpdateDoc(
            window.firebaseDoc(
                window.firebaseDB,
                "members",
                member.firestoreId
            ),
            {
                payment: "Paid",
                paymentDate: paymentDate
            }
        );

        // Update local display after successful database update
        member.payment = "Paid";
        member.paymentDate = paymentDate;
        saveMembers();
        displayMembers();

        showMessage("Payment saved to Firebase successfully!");
    } catch (error) {
        console.error("Payment update error:", error);
        showMessage("Payment could not be saved. Please try again.");
    }
}

// ===============================
// EDIT MEMBER
// ===============================

async function editMember(memberId) {
    const member = getMember(memberId);
    if (!member) return;

    const newName = prompt("Enter member name:", member.name);
    if (newName === null || !newName.trim()) return;

    const newPhone = prompt("Enter phone number:", member.phone);
    if (newPhone === null || !newPhone.trim()) return;

    const newPlan = prompt(
        "Enter plan:\n\n1 Month\n3 Months\n6 Months\n1 Year",
        member.plan
    );
    if (newPlan === null) return;

    if (!["1 Month", "3 Months", "6 Months", "1 Year"].includes(newPlan)) {
        showMessage("Invalid plan!");
        return;
    }

    const newAmount = prompt("Enter amount:", member.amount);
    if (newAmount === null || newAmount.trim() === "") return;

    if (!Number.isFinite(Number(newAmount)) || Number(newAmount) < 0) {
        showMessage("Please enter a valid amount!");
        return;
    }

    if (members.some(item => item.id !== member.id && item.phone === newPhone.trim())) {
        showMessage("Another member already uses this phone number.");
        return;
    }

    if (!member.firestoreId || !firebaseReady()) {
        showMessage("Firebase ID is missing. Cannot update this member.");
        return;
    }

    const updatedData = {
        name: newName.trim(),
        phone: newPhone.trim(),
        plan: newPlan,
        amount: Number(newAmount),
        expiryDate: calculateExpiryDate(member.startDate, newPlan)
    };

    try {
        await window.firebaseUpdateDoc(
            window.firebaseDoc(window.firebaseDB, "members", member.firestoreId),
            updatedData
        );

        Object.assign(member, updatedData);
        saveMembers();
        displayMembers();
        showMessage("Member updated successfully!");
    } catch (error) {
        console.error("Edit error:", error);
        showMessage("Could not update member.");
    }
}

// ===============================
// DELETE MEMBER
// ===============================

async function deleteMember(memberId) {
    const member = getMember(memberId);
    if (!member) return;

    if (!confirm("Are you sure you want to delete " + member.name + "?")) return;

    if (!member.firestoreId || !firebaseReady()) {
        showMessage("Firebase ID is missing. Cannot safely delete this member.");
        return;
    }

    try {
        await window.firebaseDeleteDoc(
            window.firebaseDoc(window.firebaseDB, "members", member.firestoreId)
        );

        members = members.filter(item => String(item.id) !== String(memberId));
        saveMembers();
        displayMembers();
        showMessage("Member deleted successfully!");
    } catch (error) {
        console.error("Delete error:", error);
        showMessage("Could not delete member.");
    }
}

// ===============================
// RENEW MEMBER
// ===============================

async function renewMember(memberId) {
    const member = getMember(memberId);
    if (!member) return;

    const plans = ["1 Month", "3 Months", "6 Months", "1 Year"];

    // Create plan selection dropdown
    const select = document.createElement("select");

    plans.forEach(function(plan) {
        const option = document.createElement("option");
        option.value = plan;
        option.textContent = plan;

        if (plan === member.plan) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    // Show selection dialog
    const dialog = document.createElement("dialog");
    dialog.style.padding = "25px";
    dialog.style.borderRadius = "12px";
    dialog.style.border = "1px solid #ccc";
    dialog.style.minWidth = "280px";

    const heading = document.createElement("h3");
    heading.textContent = "Select Renewal Plan";

    select.style.width = "100%";
    select.style.padding = "12px";
    select.style.marginBottom = "15px";

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "any";
    amountInput.value = member.amount;
    amountInput.placeholder = "Renewal amount";
    amountInput.style.width = "100%";
    amountInput.style.padding = "10px";
    amountInput.style.boxSizing = "border-box";
    amountInput.style.marginBottom = "15px";

    const renewButton = document.createElement("button");
    renewButton.textContent = "Renew";
    renewButton.style.marginRight = "10px";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";

    dialog.append(heading, select, amountInput, renewButton, cancelButton);
    document.body.appendChild(dialog);

    cancelButton.onclick = function() {
        dialog.close();
        dialog.remove();
    };

    renewButton.onclick = async function() {
        const newPlan = select.value;
        const newAmount = amountInput.value;

        if (newAmount === "" || !Number.isFinite(Number(newAmount)) ||
            Number(newAmount) < 0) {
            alert("Enter a valid renewal amount.");
            return;
        }

        if (!member.firestoreId || !firebaseReady()) {
            alert("Firebase connection or member ID is missing.");
            return;
        }

        const startDate = todayDate();

        const updatedData = {
            plan: newPlan,
            startDate: startDate,
            expiryDate: calculateExpiryDate(startDate, newPlan),
            amount: Number(newAmount),
            payment: "Pending",
            paymentDate: null
        };

        renewButton.disabled = true;

        try {
            await window.firebaseUpdateDoc(
                window.firebaseDoc(
                    window.firebaseDB,
                    "members",
                    member.firestoreId
                ),
                updatedData
            );

            Object.assign(member, updatedData);
            saveMembers();
            displayMembers();

            dialog.close();
            dialog.remove();
            alert("Membership renewed successfully!");
        } catch (error) {
            console.error("Renew error:", error);
            alert("Could not renew membership. Try again.");
            renewButton.disabled = false;
        }
    };

    dialog.showModal();
}

window.renewMember = renewMember;

// ===============================
// SEARCH
// ===============================

function searchMembers() {
    const searchBox = document.getElementById("search");
    const searchText = (searchBox?.value || "").toLowerCase().trim();

    const filteredMembers = members.filter(member =>
        String(member.name || "").toLowerCase().includes(searchText) ||
        String(member.phone || "").includes(searchText)
    );

    displaySearchResults(filteredMembers);
}

function displaySearchResults(filteredMembers) {
    const memberList = document.getElementById("memberList");
    if (!memberList) return;

    if (filteredMembers.length === 0) {
        memberList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">🔍</div>
                <p>No member found.</p>
            </div>
        `;
        return;
    }

    memberList.innerHTML = "";
    filteredMembers.forEach(member => memberList.appendChild(createMemberCard(member)));
}

// ===============================
// FILTER MEMBERS
// ===============================

function filterMembers(type) {
    let filteredMembers = members;

    if (type === "active") {
        filteredMembers = members.filter(member =>
            getMembershipStatus(member.expiryDate).text === "Active"
        );
    } else if (type === "renewal") {
        filteredMembers = members.filter(member =>
            getMembershipStatus(member.expiryDate).text === "Renewal Due"
        );
    } else if (type === "expired") {
        filteredMembers = members.filter(member =>
            getMembershipStatus(member.expiryDate).text === "Expired"
        );
    } else if (type === "pending") {
        filteredMembers = members.filter(member => member.payment !== "Paid");
    } else if (type === "paid") {
        filteredMembers = members.filter(member => member.payment === "Paid");
    }

    displaySearchResults(filteredMembers);
}

// ===============================
// FIREBASE LIVE LOAD
// ===============================

function loadMembersFromFirebase() {
    if (firebaseListenerStarted) return;

    if (!firebaseReady()) {
        console.error("Firebase is not connected. Check your Firebase setup.");
        return;
    }

    firebaseListenerStarted = true;

    window.firebaseOnSnapshot(
        window.firebaseCollection(window.firebaseDB, "members"),
        snapshot => {
            members = snapshot.docs.map(doc => ({
                ...doc.data(),
                firestoreId: doc.id
            }));

            saveMembers();
            displayMembers();
        },
        error => {
            console.error("Firebase load error:", error);
            firebaseListenerStarted = false;
        }
    );
}

// ===============================
// LOGOUT
// ===============================

function logout() {
    localStorage.removeItem("gymAdminLoggedIn");
    window.location.href = "login.html";
}

// ===============================
// INITIALIZE
// ===============================

document.addEventListener("DOMContentLoaded", function () {
    const searchBox = document.getElementById("search");

    if (searchBox) {
        searchBox.addEventListener("input", searchMembers);
    }

    displayMembers();
    loadMembersFromFirebase();
});

// ===============================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ===============================

window.showAddMember = showAddMember;
window.hideAddMember = hideAddMember;
window.addMember = addMember;
window.markAsPaid = markAsPaid;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.filterMembers = filterMembers;
window.renewMember = renewMember;
window.searchMembers = searchMembers;
window.logout = logout;
window.loadMembersFromFirebase = loadMembersFromFirebase;