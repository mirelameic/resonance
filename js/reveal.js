export function observeReveals(root = document) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = root.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach((el) => observer.observe(el));
}
