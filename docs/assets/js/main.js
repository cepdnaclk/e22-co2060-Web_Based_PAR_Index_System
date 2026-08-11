(function () {
  "use strict";

  var navbar = document.querySelector(".navbar");
  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));

  // Sticky nav background on scroll
  function onScroll() {
    if (window.scrollY > 8) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  if (toggle && mobileMenu) {
    toggle.addEventListener("click", function () {
      var open = mobileMenu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileMenu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  // Active nav link on scroll (IntersectionObserver)
  if ("IntersectionObserver" in window && sections.length) {
    var byId = {};
    navLinks.forEach(function (a) {
      var id = a.getAttribute("href").replace("#", "");
      byId[id] = a;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = byId[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (a) { a.classList.remove("active"); });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  }

  // Scroll-reveal for elements marked .reveal
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  // Animated stat counters
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    var duration = 900;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window) {
    var statObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    document.querySelectorAll("[data-count]").forEach(function (el) {
      statObserver.observe(el);
    });
  }

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ------------------------------------------------------------------
  // Gallery category filters
  // ------------------------------------------------------------------
  var filterChips = Array.prototype.slice.call(document.querySelectorAll(".filter-chip"));
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll("[data-category]"));

  filterChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      filterChips.forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      var cat = chip.getAttribute("data-filter");
      galleryItems.forEach(function (item) {
        var show = cat === "all" || item.getAttribute("data-category") === cat;
        item.style.display = show ? "" : "none";
      });
    });
  });

  // ------------------------------------------------------------------
  // Lightbox — opens any real (non-placeholder) media image full-size
  // ------------------------------------------------------------------
  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lightboxImg = lightbox.querySelector("img");
    var lightboxCaption = lightbox.querySelector(".lightbox-caption");
    var lightboxClose = lightbox.querySelector(".lightbox-close");

    document.querySelectorAll(".media-frame img").forEach(function (img) {
      img.addEventListener("click", function () {
        lightboxImg.src = img.getAttribute("src");
        lightboxImg.alt = img.getAttribute("alt") || "";
        lightboxCaption.textContent = img.getAttribute("alt") || "";
        lightbox.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });

    function closeLightbox() {
      lightbox.classList.remove("open");
      lightboxImg.src = "";
      document.body.style.overflow = "";
    }
    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }
})();
