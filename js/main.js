const navToggle = document.getElementById("nav-toggle");
const mobileNav = document.getElementById("mobile-nav");

if (navToggle && mobileNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mobileNav.classList.toggle("open");
    mobileNav.hidden = !isOpen;
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}
