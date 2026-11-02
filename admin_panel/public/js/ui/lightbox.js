// Full-screen preview of a picture or a video. Loaded before the feature modules.
//   NopaLightbox.image(src, { title })                    a picture
//   NopaLightbox.video(url, { title, poster })            Aparat links play in Aparat's player, files in <video>
//   NopaLightbox.open([{ type, src, title, poster }], i)  a set with next / previous (arrow keys too)
// Any <img data-zoom> opens on click; images sharing data-zoom-group="name" are browsed together.
// It is a .modal-overlay, so the modal manager (js/ui/modal.js) gives it Escape, backdrop click and focus.
(function () {
  const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogg|ogv|m3u8)(\?|#|$)/i;

  // What the CSP allows: Aparat frames, video files over https / from this site
  function videoSource(url) {
    const u = String(url || '').trim();
    if (!u) return null;
    const aparat = u.match(/aparat\.com\/(?:v|video\/video\/embed\/videohash)\/([A-Za-z0-9]+)/);
    if (aparat) return { kind: 'frame', src: `https://www.aparat.com/video/video/embed/videohash/${aparat[1]}/vt/frame` };
    if (/youtube\.com|youtu\.be/i.test(u)) return { kind: 'external', src: u };
    return { kind: 'file', src: u };
  }

  function isVideoUrl(url) {
    const u = String(url || '');
    return VIDEO_FILE.test(u) || /aparat\.com\/(v|video)\//i.test(u);
  }

  let current = null; // { overlay, items, index }

  function fallback(stage, src, text) {
    stage.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'nopa-lightbox-fallback';
    const msg = document.createElement('p');
    msg.textContent = text;
    box.appendChild(msg);
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) {
      const a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'lsv-pill';
      a.textContent = 'باز کردن لینک در برگه جدید';
      box.appendChild(a);
    }
    stage.appendChild(box);
  }

  function show(index) {
    const { overlay, items } = current;
    current.index = (index + items.length) % items.length;
    const item = items[current.index];
    const stage = overlay.querySelector('.nopa-lightbox-stage');
    const caption = overlay.querySelector('.nopa-lightbox-caption');
    stage.innerHTML = '';
    stage.classList.toggle('is-video', item.type === 'video');

    if (item.type === 'video') {
      const source = videoSource(item.src);
      if (!source) fallback(stage, '', 'لینک ویدیو خالی است.');
      else if (source.kind === 'frame') {
        const frame = document.createElement('iframe');
        frame.src = source.src;
        frame.title = item.title || 'پیش‌نمایش ویدیو';
        frame.allow = 'autoplay; fullscreen; picture-in-picture';
        frame.allowFullscreen = true;
        stage.appendChild(frame);
      } else if (source.kind === 'external') {
        fallback(stage, source.src, 'این لینک در پنل پخش نمی‌شود؛ آن را در برگه جدید ببینید.');
      } else {
        const video = document.createElement('video');
        video.src = source.src;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = 'metadata';
        if (item.poster) video.poster = item.poster;
        video.addEventListener('error', () => fallback(stage, source.src, 'این ویدیو در مرورگر پخش نشد (لینک یا قالب فایل را بررسی کنید).'));
        stage.appendChild(video);
      }
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title || '';
      img.addEventListener('error', () => fallback(stage, item.src, 'تصویر بارگذاری نشد.'));
      img.addEventListener('click', () => img.classList.toggle('is-actual'));
      stage.appendChild(img);
    }

    caption.textContent = [item.title, items.length > 1 ? `${current.index + 1} از ${items.length}` : ''].filter(Boolean).join(' · ');
    overlay.querySelectorAll('.nopa-lightbox-nav').forEach(b => { b.hidden = items.length < 2; });
  }

  function close() {
    if (!current) return;
    const { overlay } = current;
    current = null;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  function onKey(e) {
    if (!current || current.items.length < 2) return;
    // RTL: the right arrow goes back, the left arrow forward
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current.index + 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(current.index - 1); }
  }

  function open(items, index) {
    items = (items || []).filter(it => it && it.src !== undefined);
    if (!items.length) return;
    close();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay nopa-lightbox';
    overlay.style.zIndex = 'var(--z-modal-confirm)';
    overlay.innerHTML = `
      <button type="button" class="lsv-round modal-close-round nopa-lightbox-close" data-modal-close aria-label="بستن" title="بستن (Esc)"><i class="fa-solid fa-xmark"></i></button>
      <button type="button" class="lsv-round nopa-lightbox-nav is-prev" aria-label="قبلی" title="قبلی"><i class="fa-solid fa-arrow-right"></i></button>
      <figure class="nopa-lightbox-figure">
        <div class="nopa-lightbox-stage"></div>
        <figcaption class="nopa-lightbox-caption"></figcaption>
      </figure>
      <button type="button" class="lsv-round nopa-lightbox-nav is-next" aria-label="بعدی" title="بعدی"><i class="fa-solid fa-arrow-left"></i></button>`;
    overlay.setAttribute('aria-label', 'پیش‌نمایش');
    overlay.querySelector('.nopa-lightbox-close').addEventListener('click', close);
    overlay.querySelector('.is-prev').addEventListener('click', () => show(current.index - 1));
    overlay.querySelector('.is-next').addEventListener('click', () => show(current.index + 1));
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
    current = { overlay, items, index: 0 };
    document.addEventListener('keydown', onKey);
    show(index || 0);
  }

  const zoomable = img => img && img.getAttribute('src') && !img.classList.contains('app-station-noimg') && img.style.visibility !== 'hidden' && img.naturalWidth !== 0;

  // <img data-zoom>: click to enlarge (a drag that ends on it swallows the click: js/features/lms/station-dnd.js)
  document.addEventListener('click', e => {
    const img = e.target instanceof Element ? e.target.closest('img[data-zoom]') : null;
    if (!img || !zoomable(img)) return;
    e.preventDefault();
    e.stopPropagation();
    const group = img.getAttribute('data-zoom-group');
    const imgs = group ? Array.from(document.querySelectorAll(`img[data-zoom-group="${CSS.escape(group)}"]`)).filter(zoomable) : [img];
    open(imgs.map(i => ({ type: 'image', src: i.currentSrc || i.src, title: i.getAttribute('data-zoom-title') || i.alt || '' })), Math.max(0, imgs.indexOf(img)));
  });

  window.NopaLightbox = {
    open,
    close,
    image: (src, opts = {}) => open([{ type: 'image', src, title: opts.title }], 0),
    video: (url, opts = {}) => open([{ type: 'video', src: url, title: opts.title, poster: opts.poster }], 0),
    isVideoUrl
  };
})();
