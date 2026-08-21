const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll("[data-kind]");
const nav = document.getElementById("site-nav");
const menuBtn = document.querySelector("[data-menu]");

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const kind = button.dataset.filter;
    cards.forEach((card) => {
      const show = kind === "all" || card.dataset.kind === kind;
      card.classList.toggle("hidden", !show);
    });
  });
});

document.querySelectorAll("[data-print]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    window.print();
  });
});

if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}
