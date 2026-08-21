const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".study-card");

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
