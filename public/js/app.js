
"use strict";

const API = "/api";

// Real-time collaboration connection
let socket = null;

const $ = (selector) => document.querySelector(selector);

const state = {
  token: localStorage.getItem("taskflowToken"),
  user: JSON.parse(localStorage.getItem("taskflowUser") || "null"),
  boards: [],
  currentBoard: null,
  tasks: [],
  members: [],
  comments: [],
  onlineUsers: [],
  editingTaskId: null,
  commentsTaskId: null
};

// Prevent duplicate real-time events
const processedEvents = new Set();

function isNewEvent(eventId) {
  if (!eventId || processedEvents.has(eventId)) return false;

  processedEvents.add(eventId);

  if (processedEvents.size > 500) {
    const oldest = processedEvents.values().next().value;
    processedEvents.delete(oldest);
  }

  return true;
}

// Join board and update online users
function joinCurrentBoard() {
  if (!socket?.connected || !state.currentBoard?._id) return;

  socket.emit("board:join", state.currentBoard._id, (response) => {
    if (response?.success) {
      state.onlineUsers = response.onlineUsers || [];
      renderOnlineUsers();
      console.log("Board joined:", response);
    } else {
      console.error("Board join failed:", response?.message);
    }
  });
}

function connectSocket() {
  if (!state.token) return;
  if (socket?.connected) return;

  if (socket) socket.disconnect();

  socket = io({
    auth: {
      token: state.token
    }
  });

  socket.on("connect", () => {
    console.log("Real-time connection established:", socket.id);
    joinCurrentBoard();
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("Real-time connection disconnected:", reason);
  });

  // Receive newly created tasks
  socket.on("task:created", (data) => {
    if (!isNewEvent(data.eventId)) return;

    if (String(state.currentBoard?._id) !== String(data.boardId)) return;

    const index = state.tasks.findIndex(
      (task) => task._id === data.task._id
    );

    if (index === -1) {
      state.tasks.unshift(data.task);
    } else {
      state.tasks[index] = data.task;
    }

    renderTasks();
    console.log("Task created:", data.task.title);
  });

  // Receive updated tasks
  socket.on("task:updated", (data) => {
    if (!isNewEvent(data.eventId)) return;

    if (String(state.currentBoard?._id) !== String(data.boardId)) return;

    const index = state.tasks.findIndex(
      (task) => task._id === data.task._id
    );

    if (index !== -1) {
      state.tasks[index] = data.task;
      renderTasks();
    }

    console.log("Task updated:", data.task.title);
  });

  // Receive deleted tasks
  socket.on("task:deleted", (data) => {
    if (!isNewEvent(data.eventId)) return;

    if (String(state.currentBoard?._id) !== String(data.boardId)) return;

    state.tasks = state.tasks.filter(
      (task) => task._id !== data.taskId
    );

    renderTasks();
    console.log("Task deleted:", data.taskId);
  });

  // Receive new comments
  socket.on("comment:created", (data) => {
    if (!isNewEvent(data.eventId)) return;

    if (String(state.currentBoard?._id) !== String(data.boardId)) return;

    const commentTaskId =
      data.comment.task?._id || data.comment.task;

    if (String(state.commentsTaskId) === String(commentTaskId)) {
      const exists = state.comments.some(
        (comment) => comment._id === data.comment._id
      );

      if (!exists) {
        state.comments.push(data.comment);
        renderComments();
      }
    }

    console.log("New comment received");
  });

  // Receive online-user updates
  socket.on("presence:update", (data) => {
    if (String(state.currentBoard?._id) !== String(data.boardId)) return;

    state.onlineUsers = data.onlineUsers || [];
    renderOnlineUsers();

    console.log("Online users updated:", state.onlineUsers);
  });
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

async function request(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let response;

  try {
    response = await fetch(`${API}${url}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Check that your backend is running."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) logout(false);

    throw new Error(
      data.message || data.errors?.[0]?.message || "Request failed."
    );
  }

  return data;
}

function setAuthMode(mode) {
  const signup = mode === "signup";

  $("#nameGroup").classList.toggle("hidden", !signup);
  $("#authName").required = signup;

  $("#authTitle").textContent = signup
    ? "Create your account"
    : "Welcome back";

  $("#authSubtitle").textContent = signup
    ? "Join TaskFlow and organize your projects."
    : "Sign in to continue to your workspace.";

  $("#showSignup").classList.toggle("active", signup);
  $("#showLogin").classList.toggle("active", !signup);

  $("#authSubmit").textContent = signup
    ? "Create account"
    : "Sign in to TaskFlow";

  $("#passwordHint").textContent = signup
    ? "Use at least 8 characters."
    : "Enter your password to sign in.";

  $("#authPassword").autocomplete = signup
    ? "new-password"
    : "current-password";

  $("#authError").textContent = "";
  $("#authForm").dataset.mode = mode;
}

function showApp() {
  connectSocket();

  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  $("#userName").textContent = state.user?.name || "User";
  $("#userEmail").textContent = state.user?.email || "";

  $("#userAvatar").textContent =
    (state.user?.name || "U").charAt(0).toUpperCase();
}

function showAuth() {
  $("#appView").classList.add("hidden");
  $("#authView").classList.remove("hidden");

  $("#authEmail").value = "";
  $("#authPassword").value = "";

  if ($("#authName")) {
    $("#authName").value = "";
  }
}

function logout(notify = true) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  state.token = null;
  state.user = null;
  state.boards = [];
  state.tasks = [];
  state.currentBoard = null;
  state.comments = [];
  state.onlineUsers = [];

  localStorage.removeItem("taskflowToken");
  localStorage.removeItem("taskflowUser");

  showAuth();
  setAuthMode("login");

  if (notify) showToast("You have signed out.");
}

$("#showLogin").addEventListener("click", () => setAuthMode("login"));
$("#showSignup").addEventListener("click", () => setAuthMode("signup"));

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const mode = $("#authForm").dataset.mode || "login";
  const submitButton = $("#authSubmit");
  const errorBox = $("#authError");

  const payload = {
    email: $("#authEmail").value.trim(),
    password: $("#authPassword").value
  };

  if (mode === "signup") {
    payload.name = $("#authName").value.trim();
  }

  errorBox.textContent = "";
  submitButton.disabled = true;

  submitButton.textContent = mode === "signup"
    ? "Creating account..."
    : "Signing in...";

  try {
    const data = await request(`/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.token = data.token;
    state.user = data.user;

    localStorage.setItem("taskflowToken", data.token);
    localStorage.setItem("taskflowUser", JSON.stringify(data.user));

    showApp();
    await loadBoards();

    showToast(
      mode === "signup"
        ? "Account created successfully!"
        : "Welcome back!"
    );
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    setAuthMode(mode);
  }
});

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function loadBoards() {
  try {
    const data = await request("/boards");

    state.boards = data.boards || [];
    renderBoards();

    if (state.currentBoard) {
      const existing = state.boards.find(
        (board) => board._id === state.currentBoard._id
      );

      if (existing) {
        await selectBoard(existing._id);
      } else {
        state.currentBoard = null;
        showBoardEmptyState();
      }
    } else if (state.boards.length) {
      await selectBoard(state.boards[0]._id);
    } else {
      showBoardEmptyState();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderBoards() {
  const list = $("#boardList");

  if (!state.boards.length) {
    list.innerHTML =
      '<p class="muted sidebar-empty">No boards yet. Create your first project!</p>';
    return;
  }

  list.innerHTML = state.boards.map((board) => `
    <button type="button"
      class="board-nav-item ${state.currentBoard?._id === board._id ? "active" : ""}"
      data-board-id="${board._id}">
      <span class="board-nav-icon">▦</span>
      <span>${escapeHTML(board.name)}</span>
    </button>
  `).join("");

  list.querySelectorAll("[data-board-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectBoard(button.dataset.boardId);
    });
  });
}

// Display online users
function renderOnlineUsers() {
  let display = $("#onlineUsersDisplay");

  if (!display) {
    const memberCount = $("#boardMemberCount");

    if (!memberCount) return;

    display = document.createElement("div");
    display.id = "onlineUsersDisplay";
    display.className = "online-users-display";

    memberCount.insertAdjacentElement("afterend", display);
  }

  const names = state.onlineUsers.map(
    (user) => user.name || "Team member"
  );

  display.textContent = names.length
    ? `● Online now (${names.length}): ${names.join(", ")}`
    : "No team members online";
}

function renderComments() {
  const list = $("#commentsList");

  if (!state.comments.length) {
    list.innerHTML =
      '<p class="muted">No comments yet. Start the conversation!</p>';
    return;
  }

  list.innerHTML = state.comments.map((comment) => {
    const author = comment.author?.name || "Team member";

    const date = comment.createdAt
      ? new Date(comment.createdAt).toLocaleString()
      : "";

    return `
      <div class="comment-item">
        <div class="comment-header">
          <strong>${escapeHTML(author)}</strong>
          <time>${escapeHTML(date)}</time>
        </div>
        <p>${escapeHTML(comment.content)}</p>
      </div>
    `;
  }).join("");

  list.scrollTop = list.scrollHeight;
}

function showBoardEmptyState() {
  $("#emptyBoards").classList.toggle(
    "hidden",
    state.boards.length > 0
  );

  $("#boardView").classList.add("hidden");

  $("#welcomeSection").classList.toggle(
    "hidden",
    state.boards.length > 0
  );

  $("#breadcrumbBoard").textContent = "Select a board";
}

async function selectBoard(boardId) {
  const board = state.boards.find(
    (item) => item._id === boardId
  );

  if (!board) return;

  if (socket && state.currentBoard?._id) {
    socket.emit("board:leave", state.currentBoard._id);
  }

  state.currentBoard = board;
  state.comments = [];
  state.onlineUsers = [];

  // Clear previous online-user display
  const onlineDisplay = $("#onlineUsersDisplay");

  if (onlineDisplay) {
    onlineDisplay.textContent = "Loading online users...";
  }

  // Join selected board
  joinCurrentBoard();

  renderBoards();

  $("#emptyBoards").classList.add("hidden");
  $("#welcomeSection").classList.add("hidden");
  $("#boardView").classList.remove("hidden");

  $("#boardTitle").textContent = board.name;
  $("#boardDescription").textContent = board.description || "";
  $("#breadcrumbBoard").textContent = board.name;

  try {
    const data = await request(`/boards/${boardId}`);

    state.members = data.board.members || [];

    $("#boardMemberCount").textContent =
      `${state.members.length} member${state.members.length === 1 ? "" : "s"}`;

    fillAssignees();
    await loadTasks();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadTasks() {
  if (!state.currentBoard) return;

  try {
    const data = await request(
      `/tasks/board/${state.currentBoard._id}`
    );

    state.tasks = data.tasks || [];
    renderTasks();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderTasks() {
  const search = ($("#taskSearch").value || "").toLowerCase();
  const priority = $("#priorityFilter").value;

  const statuses = ["Pending", "In Progress", "Completed"];

  statuses.forEach((status) => {
    const container = document.querySelector(
      `[data-task-list="${status}"]`
    );

    const tasks = state.tasks.filter((task) => {
      const matchesStatus = task.status === status;

      const matchesSearch =
        `${task.title} ${task.description || ""}`
          .toLowerCase()
          .includes(search);

      const matchesPriority =
        priority === "all" || task.priority === priority;

      return matchesStatus && matchesSearch && matchesPriority;
    });

    container.innerHTML = tasks.map((task) => `
      <article class="task-card"
        draggable="true"
        data-task-card="${task._id}">

        <div class="task-card-top">
          <span class="priority-badge priority-${task.priority || "Medium"}">
            ${escapeHTML(task.priority || "Medium")}
          </span>

          <button type="button"
            class="task-more"
            data-edit-task="${task._id}"
            aria-label="Edit task">•••</button>
        </div>

        <h3>${escapeHTML(task.title)}</h3>

        ${task.description
          ? `<p>${escapeHTML(task.description)}</p>`
          : ""}

        <div class="task-card-meta">
          <span>
            ${task.dueDate
              ? `Due ${escapeHTML(String(task.dueDate).slice(0, 10))}`
              : "No due date"}
          </span>

          <span>
            ${task.assignee
              ? escapeHTML(task.assignee.name)
              : "Unassigned"}
          </span>
        </div>

        <div class="task-card-bottom">
          <button type="button"
            data-comments-task="${task._id}">Comments</button>

          <span>${escapeHTML(task.createdBy?.name || "")}</span>
        </div>
      </article>
    `).join("");

    container.querySelectorAll("[data-edit-task]").forEach((button) => {
      button.addEventListener("click", () => {
        openTaskDialog(button.dataset.editTask);
      });
    });

    container.querySelectorAll("[data-comments-task]").forEach((button) => {
      button.addEventListener("click", () => {
        openComments(button.dataset.commentsTask);
      });
    });

    container.querySelectorAll("[data-task-card]").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData(
          "text/plain",
          card.dataset.taskCard
        );
      });
    });

    const count = document.querySelector(
      `[data-count="${status}"]`
    );

    if (count) count.textContent = tasks.length;
  });

  $("#taskCount").textContent =
    `${state.tasks.length} task${state.tasks.length === 1 ? "" : "s"}`;
}

// Drag and drop task status updates
document.querySelectorAll(".kanban-column").forEach((column) => {
  column.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  column.addEventListener("drop", async (event) => {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("text/plain");
    const newStatus = column.dataset.status;

    const task = state.tasks.find(
      (item) => item._id === taskId
    );

    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;

    task.status = newStatus;
    renderTasks();

    try {
      await request(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });

      showToast("Task status updated.");
    } catch (error) {
      task.status = oldStatus;
      renderTasks();
      showToast(error.message, true);
    }
  });
});

function fillAssignees() {
  const select = $("#taskAssigneeInput");

  select.innerHTML = '<option value="">Unassigned</option>';

  state.members.forEach((entry) => {
    const user = entry.user;

    if (!user?._id) return;

    const option = document.createElement("option");

    option.value = user._id;
    option.textContent = user.name || user.email;

    select.appendChild(option);
  });
}

function openTaskDialog(taskId = null, status = "Pending") {
  if (!state.currentBoard) {
    showToast("Create or select a board first.", true);
    return;
  }

  const task = taskId
    ? state.tasks.find((item) => item._id === taskId)
    : null;

  state.editingTaskId = task?._id || null;

  $("#taskForm").reset();
  $("#taskError").textContent = "";

  $("#taskDialogTitle").textContent =
    task ? "Edit task" : "Create a task";

  $("#taskIdInput").value = task?._id || "";
  $("#taskTitleInput").value = task?.title || "";
  $("#taskDescriptionInput").value = task?.description || "";
  $("#taskStatusInput").value = task?.status || status;
  $("#taskPriorityInput").value = task?.priority || "Medium";

  $("#taskDueDateInput").value = task?.dueDate
    ? String(task.dueDate).slice(0, 10)
    : "";

  $("#taskAssigneeInput").value =
    task?.assignee?._id || "";

  $("#deleteTaskButton").classList.toggle("hidden", !task);

  $("#taskDialog").showModal();
}

$("#newTaskButton").addEventListener("click", () => {
  openTaskDialog();
});

document.querySelectorAll("[data-add-status]").forEach((button) => {
  button.addEventListener("click", () => {
    openTaskDialog(null, button.dataset.addStatus);
  });
});

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.currentBoard) return;

  const taskId = state.editingTaskId;

  const payload = {
    title: $("#taskTitleInput").value.trim(),
    description: $("#taskDescriptionInput").value.trim(),
    status: $("#taskStatusInput").value,
    priority: $("#taskPriorityInput").value,
    dueDate: $("#taskDueDateInput").value || null,
    assignee: $("#taskAssigneeInput").value || null
  };

  if (!taskId) {
    payload.boardId = state.currentBoard._id;
  }

  $("#saveTaskButton").disabled = true;
  $("#taskError").textContent = "";

  try {
    await request(taskId ? `/tasks/${taskId}` : "/tasks", {
      method: taskId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });

    $("#taskDialog").close();

    await loadTasks();

    showToast(taskId ? "Task updated." : "Task created.");
  } catch (error) {
    $("#taskError").textContent = error.message;
  } finally {
    $("#saveTaskButton").disabled = false;
  }
});

$("#deleteTaskButton").addEventListener("click", async () => {
  if (
    !state.editingTaskId ||
    !confirm("Delete this task permanently?")
  ) return;

  try {
    await request(`/tasks/${state.editingTaskId}`, {
      method: "DELETE"
    });

    $("#taskDialog").close();

    await loadTasks();

    showToast("Task deleted.");
  } catch (error) {
    $("#taskError").textContent = error.message;
  }
});

function openBoardDialog() {
  $("#boardForm").reset();
  $("#boardError").textContent = "";
  $("#boardDialog").showModal();
}

["#topNewBoard", "#emptyNewBoard", "#newBoardShortcut"].forEach(
  (selector) => {
    $(selector).addEventListener("click", openBoardDialog);
  }
);

$("#boardForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: $("#boardNameInput").value.trim(),
    description: $("#boardDescriptionInput").value.trim()
  };

  $("#saveBoardButton").disabled = true;
  $("#boardError").textContent = "";

  try {
    const data = await request("/boards", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    $("#boardDialog").close();

    state.boards.unshift(data.board);
    state.currentBoard = null;

    renderBoards();

    await loadBoards();
    await selectBoard(data.board._id);

    showToast("Board created successfully.");
  } catch (error) {
    $("#boardError").textContent = error.message;
  } finally {
    $("#saveBoardButton").disabled = false;
  }
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(
      button.dataset.closeDialog
    );

    if (dialog?.open) dialog.close();
  });
});

$("#taskSearch").addEventListener("input", renderTasks);
$("#priorityFilter").addEventListener("change", renderTasks);

$("#navBoards").addEventListener("click", () => loadBoards());

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// Open task comments
async function openComments(taskId) {
  state.commentsTaskId = taskId;
  state.comments = [];

  const task = state.tasks.find(
    (item) => item._id === taskId
  );

  $("#commentsTaskTitle").textContent =
    task?.title || "Task Comments";

  $("#commentsList").innerHTML =
    '<p class="muted">Loading comments...</p>';

  $("#commentError").textContent = "";
  $("#commentInput").value = "";

  $("#commentsDialog").showModal();

  try {
    const data = await request(`/tasks/${taskId}/comments`);

    if (String(state.commentsTaskId) !== String(taskId)) return;

    state.comments = data.comments || [];

    renderComments();
  } catch (error) {
    $("#commentsList").innerHTML = "";
    $("#commentError").textContent = error.message;
  }
}

// Post comments
$("#commentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const taskId = state.commentsTaskId;
  const content = $("#commentInput").value.trim();

  if (!taskId || !content) return;

  const button = $("#sendCommentButton");

  button.disabled = true;
  $("#commentError").textContent = "";

  try {
    const data = await request(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });

    const comment = data.comment;

    if (comment) {
      const exists = state.comments.some(
        (item) => item._id === comment._id
      );

      if (
        !exists &&
        String(state.commentsTaskId) === String(taskId)
      ) {
        state.comments.push(comment);
        renderComments();
      }
    }

    $("#commentInput").value = "";

    showToast("Comment posted successfully.");
  } catch (error) {
    $("#commentError").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

// Initialize application
async function initialize() {
  setAuthMode("login");

  if (!state.token) {
    showAuth();
    return;
  }

  try {
    const data = await request("/auth/me");

    state.user = data.user;

    localStorage.setItem(
      "taskflowUser",
      JSON.stringify(data.user)
    );

    showApp();

    await loadBoards();
  } catch {
    logout(false);
  }
}

initialize();
