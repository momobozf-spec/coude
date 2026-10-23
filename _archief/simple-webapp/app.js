const STORAGE_KEY = "simple-webapp-tasks";

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const count = document.getElementById("task-count");
const emptyState = document.getElementById("empty-state");
const template = document.getElementById("task-template");

let tasks = loadTasks();

renderTasks();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  tasks.unshift({
    id: crypto.randomUUID(),
    text,
    done: false,
  });

  persistTasks();
  renderTasks();
  form.reset();
  input.focus();
});

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function renderTasks() {
  list.innerHTML = "";

  if (tasks.length === 0) {
    emptyState.hidden = false;
    count.textContent = "0 taken";
    return;
  }

  emptyState.hidden = true;

  tasks.forEach((task) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const toggle = node.querySelector(".task-toggle");
    const text = node.querySelector(".task-text");
    const remove = node.querySelector(".delete-button");

    toggle.checked = task.done;
    text.textContent = task.text;
    node.classList.toggle("is-done", task.done);

    toggle.addEventListener("change", () => {
      tasks = tasks.map((item) =>
        item.id === task.id ? { ...item, done: toggle.checked } : item
      );

      persistTasks();
      renderTasks();
    });

    remove.addEventListener("click", () => {
      tasks = tasks.filter((item) => item.id !== task.id);
      persistTasks();
      renderTasks();
    });

    list.appendChild(node);
  });

  const completedCount = tasks.filter((task) => task.done).length;
  count.textContent = `${tasks.length} taken, ${completedCount} klaar`;
}
