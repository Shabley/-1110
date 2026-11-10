/* =========================================================
   딥컴패스AI연구소 홈페이지 공통 스크립트
   ========================================================= */

/* ---------------------------------------------------------
   [연락처 설정] 여기 한 곳만 채우면 모든 페이지에 반영됩니다.
   - email: 공개할 대표 이메일 (예: "hello@example.com")
     → 채우면 모든 "상담 문의하기" 버튼이 메일 쓰기 화면으로 바로 연결되고,
       문의 페이지·푸터에 이메일이 표시됩니다.
   - kakao: 카카오톡 채널 주소 (예: "https://pf.kakao.com/...")
   - links: 블로그·SNS 주소 (비어 있으면 버튼이 나타나지 않습니다)
   --------------------------------------------------------- */
var SITE = {
  email: "",   /* 입력 필요: 대표 이메일 */
  kakao: "",   /* 입력 필요: 카카오톡 채널 주소 → 넣으면 푸터 아이콘이 나타나고, 오른쪽 아래 "문의하기"가 카카오톡으로 연결됩니다 */
  links: {
    blog: "https://blog.naver.com/emas7788",
    instagram: "https://www.instagram.com/aimaster_toktalk_ksam/",
    youtube: "",   /* 입력 필요: 유튜브 주소 (비워 두면 버튼이 나타나지 않음) */
    place: ""      /* 입력 필요: 네이버 지도·플레이스 주소 (비워 두면 버튼이 나타나지 않음) */
  }
};

(function () {
  var doc = document.documentElement;
  doc.classList.remove("no-js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 첫 화면 등장 */
  window.requestAnimationFrame(function () {
    setTimeout(function () { document.body.classList.add("is-loaded"); }, 60);
  });

  /* 주 버튼: 화살표 3개 넣기 (마우스를 올리면 펼쳐지며 반짝임) */
  var ARROW = "M40.15 3.89 43.98.14a.5.5 0 0 1 .7 0l21.01 20.65a1 1 0 0 1 0 1.43L44.68 42.86a.5.5 0 0 1-.7 0l-3.82-3.75a.5.5 0 0 1 0-.71l16.84-16.54a.5.5 0 0 0 0-.71L40.15 4.61a.5.5 0 0 1 0-.72z";
  document.querySelectorAll(".btn-primary").forEach(function (btn) {
    if (btn.querySelector(".btn-arrow")) return;
    Array.prototype.slice.call(btn.children).forEach(function (el) { if (el.tagName.toLowerCase() === "svg") el.remove(); });
    var span = document.createElement("span");
    span.className = "btn-arrow";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 66 43">' +
      '<path class="one" d="' + ARROW + '"/>' +
      '<g transform="translate(-20 0)"><path class="two" d="' + ARROW + '"/></g>' +
      '<g transform="translate(-40 0)"><path class="three" d="' + ARROW + '"/></g></svg>';
    btn.appendChild(span);
  });

  /* 상단 메뉴: 스크롤하면 유리 배경 */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* 모바일 메뉴 */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* 현재 페이지 메뉴 표시 */
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path) a.setAttribute("aria-current", "page");
    var group = document.body.getAttribute("data-section");
    if (group && href === group) a.setAttribute("aria-current", "page");
  });

  /* 연락처 연결 */
  if (SITE.email) {
    var mail = "mailto:" + SITE.email;
    document.querySelectorAll("[data-contact]").forEach(function (a) {
      var subject = a.getAttribute("data-subject");
      a.setAttribute("href", subject ? mail + "?subject=" + encodeURIComponent(subject) : mail);
    });
    document.querySelectorAll("[data-email-link]").forEach(function (a) {
      a.setAttribute("href", mail);
      a.textContent = SITE.email;
    });
    document.querySelectorAll("[data-email-only]").forEach(function (el) { el.hidden = false; });
  }
  if (SITE.kakao) {
    document.querySelectorAll("[data-kakao]").forEach(function (a) {
      a.setAttribute("href", SITE.kakao);
      a.hidden = false;
    });
  }
  var hasLink = false;
  Object.keys(SITE.links).forEach(function (key) {
    if (!SITE.links[key]) return;
    hasLink = true;
    document.querySelectorAll('[data-link="' + key + '"]').forEach(function (a) {
      a.setAttribute("href", SITE.links[key]);
      a.hidden = false;
    });
  });
  if (hasLink) document.querySelectorAll("[data-links-wrap]").forEach(function (el) { el.hidden = false; });

  /* 오른쪽 아래 고정 "문의하기" 버튼
     카카오톡 채널 → 대표 이메일(메일 앱이 바로 열림) → 둘 다 없으면 문의 페이지 순서로 연결 */
  var fab = document.createElement("a");
  fab.className = "btn btn-primary fab";
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg><span>문의하기</span>';
  if (SITE.kakao) {
    fab.href = SITE.kakao;
    fab.target = "_blank";
    fab.rel = "noopener noreferrer";
    fab.setAttribute("aria-label", "문의하기 (카카오톡 채널, 새 창)");
  } else if (SITE.email) {
    fab.href = "mailto:" + SITE.email + "?subject=" + encodeURIComponent("AI 교육·컨설팅 상담 문의");
    fab.setAttribute("aria-label", "문의하기 (이메일)");
  } else {
    fab.href = "contact.html";
  }
  document.body.appendChild(fab);

  /* 첫 화면 영상·사진(배경): 파일이 있으면 hero--media 클래스 → 옅은 막을 씌워 글자를 또렷하게 */
  var hero = document.querySelector(".hero");
  if (hero) {
    var v = hero.querySelector("video");
    var im = hero.querySelector(".hero-media img");
    function ready(el) { el.classList.add("is-ready"); hero.classList.add("hero--media"); }
    if (v) {
      if (v.readyState >= 2) ready(v);
      v.addEventListener("loadeddata", function () { ready(v); });
      v.addEventListener("error", function () { v.remove(); }, true);
      var src = v.querySelector("source");
      if (src) src.addEventListener("error", function () { v.remove(); });
      if (reduce) v.removeAttribute("autoplay");
    }
    if (im) {
      if (im.complete && im.naturalWidth > 0) ready(im);
      im.addEventListener("load", function () { ready(im); });
      im.addEventListener("error", function () { im.remove(); });
    }
  }

  /* 사진 띠: 사진이 없으면 진한 색 면으로 */
  document.querySelectorAll(".band img").forEach(function (img) {
    function empty() { img.closest(".band").classList.add("is-empty"); img.remove(); }
    if (img.complete && img.naturalWidth === 0) empty();
    img.addEventListener("error", empty);
  });

  /* 스크롤 등장 (카드는 0.08초 간격으로 차례로) */
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      group.querySelectorAll(":scope > .reveal").forEach(function (el, i) {
        el.style.setProperty("--d", (i * 0.08).toFixed(2) + "s");
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* 업무 카드: 마우스를 따라오는 빛 (마우스가 있는 화면에서만) */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce) {
    document.querySelectorAll(".svc-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* 사진 띠: 스크롤에 따라 사진이 천천히 움직임 */
  var bands = document.querySelectorAll(".band-media");
  if (bands.length && !reduce) {
    var ticking = false;
    function parallax() {
      bands.forEach(function (b) {
        var r = b.parentElement.getBoundingClientRect();
        var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        b.style.transform = "translate3d(0," + (p * -40).toFixed(1) + "px,0)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(parallax); ticking = true; }
    }, { passive: true });
    parallax();
  }

  /* 연도 */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
