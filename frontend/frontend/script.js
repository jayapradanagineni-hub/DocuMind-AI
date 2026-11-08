
// ==========================================
// DOCUMIND AI - FRONTEND JAVASCRIPT
// ==========================================

const API_URL = "http://127.0.0.1:8000";

// HTML Elements
const pdfInput = document.getElementById("pdfInput");
const uploadBox = document.getElementById("uploadBox");
const chatArea = document.getElementById("chatArea");
const questionInput = document.getElementById("questionInput");
const sendButton = document.getElementById("sendButton");
const documentStatus = document.getElementById("documentStatus");
const welcomeScreen = document.getElementById("welcomeScreen");
const conversationHistory = document.getElementById("conversationHistory");
const documentHistory = document.getElementById("documentHistory");

// Application State
let currentConversationId = null;
let documentUploaded = false;
let uploadedFilename = null;

// ==========================================
// CREATE NEW CONVERSATION
// ==========================================

async function newChat() {
    try {
        const response = await fetch(`${API_URL}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: "New Conversation"
            })
        });

        if (!response.ok) {
            throw new Error("Could not create conversation");
        }

        const conversation = await response.json();

        currentConversationId = conversation.id;

        clearChat();

        await loadConversations();

        console.log("New conversation created:", conversation.id);

    } catch (error) {
        alert("Backend connection failed. Please start the backend.");
        console.error(error);
    }
}

// ==========================================
// CLEAR CHAT
// ==========================================

function clearChat() {
    chatArea.innerHTML = "";

    chatArea.appendChild(welcomeScreen);

    welcomeScreen.style.display = "flex";

    documentUploaded = false;
    uploadedFilename = null;

    documentStatus.textContent = "📄 No document uploaded";

    questionInput.disabled = true;
    sendButton.disabled = true;

    questionInput.placeholder =
        "Upload a document to start asking questions...";
}

// ==========================================
// LOAD CONVERSATION HISTORY
// ==========================================

async function loadConversations() {
    try {
        const response = await fetch(`${API_URL}/conversations`);

        if (!response.ok) {
            throw new Error("Unable to load conversations");
        }

        const conversations = await response.json();

        conversationHistory.innerHTML = "";

        conversations.forEach(conversation => {
            const item = document.createElement("div");

            item.className = "sidebar-item conversation-item";

            if (conversation.id === currentConversationId) {
                item.classList.add("active");
            }

            item.textContent = "💬 " + conversation.title;

            item.onclick = () => openConversation(conversation.id);

            conversationHistory.appendChild(item);
        });

    } catch (error) {
        console.error("Conversation history error:", error);
    }
}

// ==========================================
// OPEN EXISTING CONVERSATION
// ==========================================

async function openConversation(conversationId) {
    try {
        const response = await fetch(
            `${API_URL}/conversations/${conversationId}`
        );

        if (!response.ok) {
            throw new Error("Could not open conversation");
        }

        const conversation = await response.json();

        currentConversationId = conversation.id;

        chatArea.innerHTML = "";

        welcomeScreen.style.display = "none";

        conversation.messages.forEach(message => {
            displayMessage(message.role, message.content);
        });

        await loadConversations();

        console.log("Conversation opened:", conversationId);

    } catch (error) {
        alert("Unable to open conversation.");
        console.error(error);
    }
}

// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(role, content) {
    const message = document.createElement("div");

    message.className =
        role === "user" ? "user-message" : "assistant-message";

    const messageContent = document.createElement("div");

    messageContent.className = "message-content";

    messageContent.textContent = content;

    message.appendChild(messageContent);

    chatArea.appendChild(message);

    chatArea.scrollTop = chatArea.scrollHeight;

    return message;
}

// ==========================================
// SAVE MESSAGE TO DATABASE
// ==========================================

async function saveMessage(role, content) {
    if (!currentConversationId) {
        return;
    }

    try {
        await fetch(
            `${API_URL}/conversations/${currentConversationId}/messages`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    role: role,
                    content: content
                })
            }
        );

    } catch (error) {
        console.error("Message saving error:", error);
    }
}

// ==========================================
// UPLOAD PDF
// ==========================================

pdfInput.addEventListener("change", async function () {
    const file = pdfInput.files[0];

    if (!file) {
        return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please select a PDF file.");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("PDF must be below 10 MB.");
        return;
    }

    documentStatus.textContent = "⏳ Uploading document...";

    const formData = new FormData();

    formData.append("file", file);

    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Upload failed");
        }

        documentUploaded = true;

        uploadedFilename = file.name;

        documentStatus.textContent =
            `📄 ${file.name} | ${result.chunks} chunks processed`;

        questionInput.disabled = false;
        sendButton.disabled = false;

        questionInput.placeholder = "Ask anything about your document...";

        welcomeScreen.style.display = "none";

        addDocumentToSidebar(file.name);

        alert("PDF uploaded successfully!");

    } catch (error) {
        documentStatus.textContent = "❌ Upload failed";

        alert(error.message);

        console.error(error);
    }

    pdfInput.value = "";
});

// ==========================================
// DOCUMENT SIDEBAR
// ==========================================

function addDocumentToSidebar(filename) {
    const item = document.createElement("div");

    item.className = "sidebar-item";

    item.textContent = "📄 " + filename;

    documentHistory.prepend(item);
}

// ==========================================
// SEND QUESTION
// ==========================================

async function sendQuestion() {
    const question = questionInput.value.trim();

    if (!question || !documentUploaded) {
        return;
    }

    // Automatically create conversation if needed
    if (!currentConversationId) {
        try {
            const response = await fetch(`${API_URL}/conversations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: question.substring(0, 40)
                })
            });

            const conversation = await response.json();

            currentConversationId = conversation.id;

        } catch (error) {
            alert("Could not create conversation.");
            return;
        }
    }

    welcomeScreen.style.display = "none";

    displayMessage("user", question);

    await saveMessage("user", question);

    questionInput.value = "";

    questionInput.disabled = true;
    sendButton.disabled = true;

    const loadingMessage = displayMessage(
        "assistant",
        "Thinking... ✦"
    );

    try {
        const response = await fetch(`${API_URL}/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "AI request failed");
        }

        loadingMessage.querySelector(".message-content").textContent =
            result.answer;

        await saveMessage("assistant", result.answer);

        await loadConversations();

    } catch (error) {
        loadingMessage.querySelector(".message-content").textContent =
            "❌ " + error.message;

        console.error(error);

    } finally {
        questionInput.disabled = false;
        sendButton.disabled = false;

        questionInput.focus();
    }
}

// ==========================================
// SUGGESTION BUTTONS
// ==========================================

function useSuggestion(text) {
    if (!documentUploaded) {
        alert("Please upload a PDF first.");
        return;
    }

    questionInput.value = text;

    sendQuestion();
}

// ==========================================
// ENTER KEY
// ==========================================

questionInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        sendQuestion();
    }
});

// ==========================================
// INITIALIZE APP
// ==========================================

async function initializeApp() {
    await loadConversations();

    console.log("DocuMind AI initialized successfully!");
}

initializeApp();
