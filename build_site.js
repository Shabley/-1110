/* =========================================================
   딥컴패스AI연구소 홈페이지 빌드 스크립트
   실행: node build_site.js   (추가 설치 필요 없음, Node.js 18 이상)

   하는 일
   1) 지금 있는 페이지·이미지·admin 폴더를 dist 폴더로 복사 (원본은 그대로)
   2) content/posts 의 .md 글을 읽어 소식 목록(news.html)과 글 페이지(news-*.html) 생성
   3) 상단 메뉴·푸터에 '소식'이 없으면 dist 쪽 파일에만 추가
   4) sitemap.xml 을 dist 에 새로 만들기 (소식 목록 + 공개 글 포함)
   ========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

/* ---------------------------------------------------------
   [공개 주소] 여기 한 곳만 바꾸면 됩니다.
   - 주소가 정해지면 아래 따옴표 안을 실제 주소로 바꾸세요. (끝에 / 없이)
   - 또는 Netlify 환경변수 SITE_URL 에 넣어도 됩니다. (그쪽이 우선)
   - 기존 페이지 안의 https://your-domain.kr 도 dist 로 복사할 때 이 주소로 바뀝니다.
   --------------------------------------------------------- */
const SITE_URL = (process.env.SITE_URL || "https://your-domain.kr").replace(/\/+$/, "");
const PLACEHOLDER_URL = "https://your-domain.kr";

/* 발행자 정보 (홈페이지에 이미 공개된 내용만) */
const ORG_NAME = "딥컴패스AI연구소";
const ORG_ALT = "DeepcompassAI연구소";
const AUTHOR_NAME = "고연심";

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIST = path.join(ROOT, "dist");

/* dist 로 복사하지 않을 것 */
const SKIP = new Set(["dist", "content", "node_modules", ".git", ".github", ".netlify", "build_site.js", "netlify.toml", "package.json", "package-lock.json", "sitemap.xml"]);

/* 분류 → 관련 업무 페이지 (분류 이름에 아래 단어가 들어 있으면 연결) */
const RELATED = [
  { match: ["교육"], href: "ai-training.html", label: "생성형 AI 실무 교육" },
  { match: ["에이전트"], href: "ai-agent.html", label: "AI 에이전트 구축" },
  { match: ["자동화"], href: "automation.html", label: "업무자동화 컨설팅" },
  { match: ["콘텐츠"], href: "ai-content.html", label: "AI 콘텐츠 제작" }
];
const RELATED_DEFAULT = { href: "services.html", label: "대표 업무 4가지" };

/* =========================================================
   도구 함수
   ========================================================= */
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const absUrl = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return SITE_URL + "/" + encodeURI(p.replace(/^\/+/, ""));
};

/* 이미지 경로: /images/a.jpg → images/a.jpg (내 컴퓨터에서 열어도 보이도록) */
const localSrc = (p) => (!p ? "" : /^https?:\/\//i.test(p) ? p : p.replace(/^\/+/, ""));

const jsonLd = (obj) => '<script type="application/ld+json">\n' +
  JSON.stringify(obj, null, 2).replace(/</g, "\\u003c") + "\n</script>";

function warn(msg) { console.warn("  [확인 필요] " + msg); }

/* ---------- front matter ---------- */
function parseFrontMatter(raw) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val === "|" || val === ">" || val === "|-" || val === ">-") {
      /* 여러 줄 값 */
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === "")) block.push(lines[++i].trim());
      val = val.startsWith("|") ? block.join("\n").trim() : block.join(" ").replace(/\s+/g, " ").trim();
    } else if (/^(['"]).*\1$/.test(val)) {
      val = val.slice(1, -1).replace(/''/g, "'").replace(/\\"/g, '"');
    } else if (/^(true|false)$/i.test(val)) {
      val = val.toLowerCase() === "true";
    } else {
      val = val.replace(/\s+#.*$/, ""); /* 줄 끝 주석 제거 */
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

/* 날짜: 2026-11-10, 2026-11-10T09:00:00 등 → { iso, label } */
function parseDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = m[1], mo = m[2].padStart(2, "0"), d = m[3].padStart(2, "0");
  return { iso: `${y}-${mo}-${d}`, label: `${y}년 ${Number(mo)}월 ${Number(d)}일`, sort: Number(y + mo + d) };
}

/* ---------- 마크다운 → HTML (외부 설치 없이 쓰는 간단 변환기) ---------- */
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, src) =>
    `<img src="${esc(localSrc(src.replace(/&amp;/g, "&")))}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
    const h = href.replace(/&amp;/g, "&");
    const ext = /^https?:\/\//i.test(h);
    return `<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}

function markdown(md, title) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let firstHeading = true;
  const isBlockStart = (l) => /^(#{1,6})\s|^```|^>\s?|^\s*([-*+]|\d+[.)])\s+|^(\*{3,}|-{3,}|_{3,})\s*$|^\|/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    /* 코드 블록 */
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    /* 제목: 글 제목(h1)이 따로 있으므로 # 은 h2 로 낮춤. 첫 제목이 글 제목과 같으면 생략 */
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const text = h[2];
      if (firstHeading && h[1].length === 1 && title && text.replace(/\s/g, "") === String(title).replace(/\s/g, "")) { i++; firstHeading = false; continue; }
      firstHeading = false;
      const level = Math.max(2, h[1].length);
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    /* 구분선 */
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    /* 인용 */
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${markdown(buf.join("\n"))}</blockquote>`);
      continue;
    }
    /* 목록 */
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (m && /\d/.test(m[1]) === ordered) { items.push(m[2]); i++; }
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += " " + lines[i].trim(); i++; }
        else break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    /* 표 */
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const row = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = row(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") + "</tbody></table>");
      continue;
    }
    /* 이미지만 있는 줄 → figure */
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      out.push(`<figure>${inline(line.trim())}${img[1] ? `<figcaption>${esc(img[1])}</figcaption>` : ""}</figure>`);
      i++;
      continue;
    }
    /* 문단 */
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push(`<p>${joinParagraph(buf)}</p>`);
  }
  return out.join("\n");
}

/* 문단: 여러 줄을 한 문단으로 (줄 끝 공백 두 칸은 줄바꿈 <br>) */
function joinParagraph(lines) {
  return lines.map((l, idx) => {
    const hard = /\s{2,}$/.test(l) && idx < lines.length - 1;
    return inline(l.trim()) + (hard ? "<br>" : "");
  }).join(" ");
}

/* =========================================================
   1. 글 읽기
   ========================================================= */
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
  const posts = [];
  const used = new Set();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const { data, body } = parseFrontMatter(raw);
    if (data.draft === true || String(data.draft).toLowerCase() === "true") {
      console.log("  - 임시저장 글이라 건너뜀: " + file);
      continue;
    }
    const title = (data.title || "").toString().trim();
    if (!title) warn(`${file}: title(제목)이 비어 있어 파일 이름을 제목으로 씁니다.`);
    const date = parseDate(data.date);
    if (!date) warn(`${file}: date(작성일)가 없거나 형식이 달라 날짜를 표시하지 않습니다. (예: 2026-11-10)`);

    /* 주소용 이름: 파일 이름에서 확장자를 빼고 영문·숫자·한글·- 만 남김 */
    let slug = file.replace(/\.(md|markdown)$/i, "").toLowerCase()
      .replace(/\s+/g, "-").replace(/[^a-z0-9가-힣-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "post";
    while (used.has(slug)) slug += "-1";
    used.add(slug);

    const plain = body.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*_`|~-]/g, " ").replace(/\s+/g, " ").trim();
    const summary = (data.summary || "").toString().trim();
    if (!summary) warn(`${file}: summary(요약)가 비어 있어 본문 앞부분을 설명 문구로 씁니다.`);

    posts.push({
      file,
      slug,
      url: `news-${slug}.html`,
      title: title || file.replace(/\.(md|markdown)$/i, ""),
      date,
      category: (data.category || "").toString().trim(),
      summary,
      description: summary || (plain.length > 110 ? plain.slice(0, 110) + "…" : plain),
      image: (data.image || "").toString().trim(),
      body
    });
  }
  posts.sort((a, b) => (b.date ? b.date.sort : 0) - (a.date ? a.date.sort : 0) || a.title.localeCompare(b.title, "ko"));
  return posts;
}

/* =========================================================
   2. 메뉴에 '소식' 넣기 + 주소 바꾸기 (dist 에 복사하는 파일에만)
   ========================================================= */
function addNewsMenu(html) {
  const insert = (block) => block.includes('href="news.html"') ? block
    : block.replace(/(\s*)<a href="contact\.html">문의<\/a>/, '$1<a href="news.html">소식</a>$1<a href="contact.html">문의</a>');
  html = html.replace(/<nav class="nav"[\s\S]*?<\/nav>/, insert);
  html = html.replace(/<nav class="footer-nav"[\s\S]*?<\/nav>/, insert);
  return html;
}
const swapUrl = (text) => SITE_URL === PLACEHOLDER_URL ? text : text.split(PLACEHOLDER_URL).join(SITE_URL);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (src === ROOT && SKIP.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) { copyDir(from, to); continue; }
    if (/\.html?$/i.test(name)) fs.writeFileSync(to, swapUrl(addNewsMenu(fs.readFileSync(from, "utf8"))));
    else if (/\.(xml|txt|yml|yaml|json|js|css)$/i.test(name) && src === ROOT) fs.writeFileSync(to, swapUrl(fs.readFileSync(from, "utf8")));
    else fs.copyFileSync(from, to);
  }
}

/* =========================================================
   3. 공통 머리·메뉴·푸터 (기존 페이지에서 가져와 그대로 사용)
   ========================================================= */
function loadLayout() {
  const base = swapUrl(addNewsMenu(fs.readFileSync(path.join(ROOT, "contact.html"), "utf8")));
  const pick = (re, name) => {
    const m = base.match(re);
    if (!m) throw new Error(`contact.html 에서 ${name} 부분을 찾지 못했습니다.`);
    return m[0];
  };
  return {
    header: pick(/<header class="site-header">[\s\S]*?<\/header>/, "상단 메뉴"),
    footer: pick(/<footer class="site-footer">[\s\S]*?<\/footer>/, "푸터"),
    mbar: (base.match(/<div class="mbar">[\s\S]*?<\/div>/) || [""])[0]
  };
}

function page({ title, description, canonical, ogType, ogImage, ldBlocks, body, layout }) {
  return `<!doctype html>
<html lang="ko" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${ORG_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2e1065">
<link rel="icon" href="images/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="news.css">
<script src="script.js" defer></script>
${ldBlocks.map(jsonLd).join("\n")}
</head>
<body data-section="news.html">
<a class="skip" href="#main">본문 바로가기</a>

${layout.header}

<main id="main">
${body}
</main>

${layout.footer}

${layout.mbar}
</body>
</html>
`;
}

const crumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, idx) => ({ "@type": "ListItem", position: idx + 1, name: it.name, item: it.url }))
});

/* =========================================================
   4. 소식 목록 (news.html)
   ========================================================= */
function buildList(posts, layout) {
  const cards = posts.map((p) => {
    const thumb = p.image
      ? `<div class="news-thumb"><img src="${esc(localSrc(p.image))}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('news-thumb--empty');this.remove()"></div>`
      : `<div class="news-thumb news-thumb--empty" aria-hidden="true"></div>`;
    const meta = [
      p.category ? `<span class="news-cat">${esc(p.category)}</span>` : "",
      p.date ? `<time datetime="${p.date.iso}">${p.date.label}</time>` : ""
    ].join("");
    return `        <a class="news-card reveal" href="${esc(p.url)}">
          ${thumb}
          <div class="news-body">
            ${meta ? `<div class="news-meta">${meta}</div>` : ""}
            <h2>${esc(p.title)}</h2>
            ${p.description ? `<p>${esc(p.description)}</p>` : ""}
            <span class="news-more">자세히 보기 →</span>
          </div>
        </a>`;
  }).join("\n");

  const body = `  <section class="page-hero">
    <div class="container">
      <ol class="crumbs" aria-label="현재 위치"><li><a href="index.html">홈</a></li><li>소식</li></ol>
      <p class="overline">News</p>
      <h1>딥컴패스AI연구소 <span class="em">소식</span></h1>
      <p class="lead">생성형 AI 교육과 업무자동화에 관한 연구소 소식을 전합니다.</p>
    </div>
  </section>

  <section class="section section--white">
    <div class="container">
${posts.length ? `      <div class="news-grid" data-stagger>\n${cards}\n      </div>` : `      <p class="news-empty">아직 등록된 소식이 없습니다.</p>`}
    </div>
  </section>`;

  const canonical = absUrl("news.html");
  return page({
    title: "소식 | 생성형 AI 교육·업무자동화 | 딥컴패스AI연구소",
    description: "딥컴패스AI연구소(소장 고연심)의 소식입니다. 생성형 AI 교육, AI 에이전트 구축, 업무자동화 컨설팅에 관한 글을 모았습니다.",
    canonical,
    ogType: "website",
    ogImage: absUrl("images/og.jpg"),
    ldBlocks: [crumbLd([{ name: "홈", url: absUrl("") }, { name: "소식", url: canonical }])],
    body,
    layout
  });
}

/* =========================================================
   5. 글 페이지 (news-*.html)
   ========================================================= */
function buildPost(p, layout) {
  const canonical = absUrl(p.url);
  const rel = RELATED.find((r) => r.match.some((w) => p.category.includes(w))) || RELATED_DEFAULT;

  /* Article: 제목·작성일·요약·대표이미지·발행자만 (없는 항목은 넣지 않음) */
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    mainEntityOfPage: canonical
  };
  if (p.date) article.datePublished = p.date.iso;
  if (p.summary) article.description = p.summary;
  if (p.image) article.image = absUrl(p.image);
  article.author = { "@type": "Person", name: AUTHOR_NAME };
  article.publisher = { "@type": "Organization", name: ORG_NAME, alternateName: ORG_ALT };

  const body = `  <section class="page-hero post-hero">
    <div class="container">
      <ol class="crumbs" aria-label="현재 위치"><li><a href="index.html">홈</a></li><li><a href="news.html">소식</a></li><li>${esc(p.title)}</li></ol>
      ${p.category ? `<p class="overline">${esc(p.category)}</p>` : ""}
      <h1>${esc(p.title)}</h1>
      <div class="post-meta">
        ${p.date ? `<time datetime="${p.date.iso}">${p.date.label}</time><span aria-hidden="true">·</span>` : ""}
        <span>${ORG_NAME} ${AUTHOR_NAME} 소장</span>
      </div>
    </div>
  </section>

  <section class="section section--white">
    <div class="container">
      <article class="post-wrap">
        ${p.image ? `<figure class="post-cover"><img src="${esc(localSrc(p.image))}" alt="" decoding="async" onerror="this.parentNode.remove()"></figure>` : ""}
        <div class="prose">
${markdown(p.body, p.title)}
        </div>

        <aside class="post-next" aria-label="관련 업무와 문의">
          <p class="overline">Related</p>
          <h2>이 글과 관련된 업무: ${esc(rel.label)}</h2>
          <p>우리 기관에 맞는 방법이 궁금하시면 관련 업무 소개를 보거나 바로 문의해 주세요.</p>
          <div class="btn-row">
            <a class="btn btn-primary" href="contact.html" data-contact data-subject="${esc("소식 글 관련 문의: " + p.title)}">상담 문의하기</a>
            <a class="btn btn-ghost" href="${rel.href}">${esc(rel.label)} 보기</a>
          </div>
        </aside>
        <a class="text-link post-back" href="news.html">← 소식 목록으로</a>
      </article>
    </div>
  </section>`;

  return page({
    title: `${p.title} | 소식 | ${ORG_NAME}`,
    description: p.description,
    canonical,
    ogType: "article",
    ogImage: p.image ? absUrl(p.image) : absUrl("images/og.jpg"),
    ldBlocks: [article, crumbLd([{ name: "홈", url: absUrl("") }, { name: "소식", url: absUrl("news.html") }, { name: p.title, url: canonical }])],
    body,
    layout
  });
}

/* =========================================================
   6. sitemap.xml
   ========================================================= */
function buildSitemap(posts) {
  const src = path.join(ROOT, "sitemap.xml");
  const urls = [];
  if (fs.existsSync(src)) {
    const xml = fs.readFileSync(src, "utf8");
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>(?:<priority>([^<]+)<\/priority>)?/g)) {
      urls.push({ loc: m[1].trim().split(PLACEHOLDER_URL).join(SITE_URL), priority: m[2] || "0.7" });
    }
  }
  urls.push({ loc: absUrl("news.html"), priority: "0.7" });
  for (const p of posts) urls.push({ loc: absUrl(p.url), priority: "0.6", lastmod: p.date && p.date.iso });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- build_site.js 가 자동으로 만든 파일입니다. 직접 고치지 말고 원본 sitemap.xml 또는 글을 고치세요. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
}

/* =========================================================
   실행
   ========================================================= */
function main() {
  console.log("홈페이지 만들기 시작");
  console.log("  공개 주소: " + SITE_URL + (SITE_URL === PLACEHOLDER_URL ? "  (아직 임시 주소입니다)" : ""));

  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(ROOT, DIST);
  console.log("  - 기존 페이지·이미지·admin 을 dist 로 복사했습니다.");

  const posts = readPosts();
  const layout = loadLayout();
  fs.writeFileSync(path.join(DIST, "news.html"), buildList(posts, layout));
  for (const p of posts) fs.writeFileSync(path.join(DIST, p.url), buildPost(p, layout));
  console.log(`  - 소식 목록(news.html)과 글 페이지 ${posts.length}개를 만들었습니다.`);
  posts.forEach((p) => console.log(`      · ${p.url}  ←  ${p.file}`));

  fs.writeFileSync(path.join(DIST, "sitemap.xml"), buildSitemap(posts));
  console.log("  - sitemap.xml 을 만들었습니다.");
  console.log("완료: dist 폴더를 확인하세요.");
}

main();
