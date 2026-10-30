const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const canAnimate = !reducedMotion.matches && 'IntersectionObserver' in window;

/* Theme */

const themeToggle = document.getElementById('theme-toggle');

function isDark() {
  return root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches;
}

function syncThemeToggle() {
  themeToggle.setAttribute('aria-pressed', String(isDark()));
}

function setTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {}
  syncThemeToggle();
}

themeToggle.addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  if (document.startViewTransition && !reducedMotion.matches) {
    document.startViewTransition(() => setTheme(theme));
  } else {
    setTheme(theme);
  }
});
darkQuery.addEventListener('change', syncThemeToggle);
syncThemeToggle();

/* Hero readout: count the measured results up once the intro has played. */

if (!reducedMotion.matches) {
  document.querySelectorAll('[data-count]').forEach((counter) => {
    const target = Number(counter.dataset.count);
    const sign = target < 0 ? '−' : '+';
    const size = Math.abs(target);
    const delay = 750;
    const duration = 1400;
    const start = performance.now();

    counter.textContent = `${sign}0%`;
    const tick = (now) => {
      const progress = Math.min(Math.max((now - start - delay) / duration, 0), 1);
      counter.textContent = `${sign}${Math.round(size * (1 - (1 - progress) ** 4))}%`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

/* Waterfall */

/** Month offsets in the waterfall count from January of this year. */
const AXIS_START_YEAR = 2016;
const waterfall = document.querySelector('.waterfall');

if (waterfall) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const nowOffset = (now.getFullYear() - AXIS_START_YEAR) * 12 + now.getMonth() + now.getDate() / daysInMonth;

  waterfall.querySelectorAll('.wf-row[data-ongoing]').forEach((row) => {
    row.style.setProperty('--e', nowOffset.toFixed(2));
  });

  const axis = waterfall.querySelector('.wf-axis');
  const span = Math.max(Number(getComputedStyle(waterfall).getPropertyValue('--span')), Math.ceil((nowOffset + 2) / 12) * 12);
  waterfall.style.setProperty('--span', String(span));

  for (let offset = axis.children.length * 12; offset < span; offset += 12) {
    const tick = document.createElement('li');
    tick.style.setProperty('--m', String(offset));
    tick.textContent = String(AXIS_START_YEAR + offset / 12);
    axis.append(tick);
  }

  if (canAnimate) {
    waterfall.classList.add('is-armed');
    const waterfallObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          waterfall.classList.add('is-playing');
          waterfallObserver.disconnect();
        }
      },
      { rootMargin: '0px 0px -20% 0px' },
    );
    waterfallObserver.observe(waterfall);
  }
}

/* Scroll reveals: only content that starts below the fold is hidden, so nothing visible on load flickers. */

if (canAnimate) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, index) => {
          entry.target.style.setProperty('--reveal-delay', `${index * 90}ms`);
          entry.target.classList.add('reveal-in');
          revealObserver.unobserve(entry.target);
        });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );

  document
    .querySelectorAll('.section__head, .about__body, .role, .project, .earlier, .praise__feature, .praise__list li, .skill-group, .practices, .credential-group, .contact__main, .contact__links')
    .forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('reveal-pending');
        revealObserver.observe(element);
      }
    });
}

/* Header state and the nav indicator that tracks the section in view. */

const header = document.querySelector('.site-header');
const navLinks = [...document.querySelectorAll('.nav a')];
const navIndicator = document.querySelector('.nav__indicator');
const sections = [...document.querySelectorAll('main > section[id]')];
let activeLink = null;

function placeNavIndicator() {
  if (!activeLink) {
    navIndicator.classList.remove('is-visible');
    return;
  }
  navIndicator.style.setProperty('--x', `${activeLink.offsetLeft}px`);
  navIndicator.style.setProperty('--w', `${activeLink.offsetWidth}px`);
  navIndicator.classList.add('is-visible');
}

function updateScrollState() {
  header.classList.toggle('is-at-top', window.scrollY < 8);

  const readingLine = window.innerHeight * 0.35;
  const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 4;
  let current = atBottom ? sections.at(-1) : null;
  if (!atBottom) {
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= readingLine) {
        current = section;
      }
    });
  }

  const link = navLinks.find((navLink) => current && navLink.hash === `#${current.id}`) ?? null;
  if (link === activeLink) {
    return;
  }
  activeLink?.removeAttribute('aria-current');
  link?.setAttribute('aria-current', 'location');
  activeLink = link;
  placeNavIndicator();
}

let scrollFrame = 0;
window.addEventListener(
  'scroll',
  () => {
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateScrollState();
      });
    }
  },
  { passive: true },
);
window.addEventListener('resize', placeNavIndicator);
document.fonts?.ready.then(placeNavIndicator);
updateScrollState();

/* Contact */

const copyButton = document.getElementById('copy-email');
const copyStatus = document.getElementById('copy-status');
const emailLink = document.getElementById('email-address');
let clearStatusTimer;

copyButton.addEventListener('click', async () => {
  const email = emailLink.textContent.trim();
  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = 'Email address copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(emailLink);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatus.textContent = 'Selected. Press Ctrl+C or ⌘C to copy.';
  }
  clearTimeout(clearStatusTimer);
  clearStatusTimer = setTimeout(() => {
    copyStatus.textContent = '';
  }, 4000);
});
