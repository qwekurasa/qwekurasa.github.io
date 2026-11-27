(() => {
  const isVideo = src => /\.mp4$/i.test(src);

  function mount(root, media) {
    if (!media.length) return () => {};
    const stage = root.querySelector('.design-carousel-stage');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    // A two-image loop also needs a copy on each side of the active card.
    const items = media.length === 2 ? [...media, ...media] : media;
    const count = items.length;
    const wrap = value => ((value % count) + count) % count;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    let width = 0, height = 0, angle = 0, target = 0, direction = 1;
    let frame = 0, timer = 0, drag = null, ignoreClick = false, visible = false;
    const viewer = document.createElement('dialog');
    viewer.className = 'design-viewer';
    viewer.setAttribute('aria-label', 'Просмотр медиа проекта');
    viewer.innerHTML = `<header class="design-viewer-bar">
      <span class="design-viewer-dots" aria-hidden="true"></span>
      <span class="design-viewer-count" aria-live="polite"></span>
      <button type="button" data-previous aria-label="Предыдущее изображение">←</button>
      <button type="button" data-next aria-label="Следующее изображение">→</button>
      <button type="button" data-original-size aria-label="Исходный масштаб" aria-pressed="false">1:1</button>
      <button type="button" data-close aria-label="Закрыть" autofocus>×</button>
    </header><div class="design-viewer-media"><img alt=""><video controls playsinline preload="metadata" hidden></video></div>`;
    root.append(viewer);
    const hint = document.createElement('p');
    hint.className = 'interaction-hint gallery-hint';
    hint.id = 'designGalleryHint';
    hint.innerHTML = `<span class="hint-arrow" aria-hidden="true">↖</span>
      <span class="hint-mouse">${media.length>1?'Потяните, чтобы листать · нажмите, чтобы открыть':'Нажмите, чтобы открыть'}</span>
      <span class="hint-touch">${media.length>1?'Смахните, чтобы листать · коснитесь, чтобы открыть':'Коснитесь, чтобы открыть'}</span>`;
    root.append(hint);
    stage.setAttribute('aria-describedby',hint.id);
    trackInteractionHint(stage,hint,root,event=>!viewer.open&&Boolean(event.target.closest('.design-slide[aria-hidden="false"]')));
    const viewerMedia = viewer.querySelector('.design-viewer-media');
    const fullImage = viewerMedia.querySelector('img');
    const fullVideo = viewerMedia.querySelector('video');
    const countLabel = viewer.querySelector('.design-viewer-count');
    const originalSize = viewer.querySelector('[data-original-size]');
    const previous = viewer.querySelector('[data-previous]');
    const next = viewer.querySelector('[data-next]');
    let selected = 0;
    previous.hidden = next.hidden = media.length === 1;

    function setOriginalSize(original) {
      viewer.toggleAttribute('data-original', original);
      originalSize.setAttribute('aria-pressed', String(original));
      viewerMedia.scrollTo(0, 0);
    }

    function stopVideo() {
      if (!fullVideo.hasAttribute('src')) return;
      fullVideo.pause();
      fullVideo.removeAttribute('src');
      fullVideo.load();
    }

    function showItem(index) {
      selected = (index + media.length) % media.length;
      const { src } = media[selected];
      const video = isVideo(src);
      stopVideo();
      fullImage.hidden = video;
      fullVideo.hidden = !video;
      if (video) {
        fullVideo.setAttribute('aria-label', slides[selected].label);
        fullVideo.src = src;
        fullImage.removeAttribute('src');
      } else {
        fullImage.alt = slides[selected].label;
        fullImage.src = src;
      }
      countLabel.textContent = (selected + 1) + ' / ' + media.length;
      setOriginalSize(false);
    }

    previous.onclick = () => showItem(selected - 1);
    next.onclick = () => showItem(selected + 1);
    originalSize.onclick = () => setOriginalSize(!viewer.hasAttribute('data-original'));
    viewer.querySelector('[data-close]').onclick = () => viewer.close();
    viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
    viewer.addEventListener('keydown', event => {
      if (media.length < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.stopPropagation();
      if (event.target === fullVideo) return;
      event.preventDefault();
      showItem(selected + (event.key === 'ArrowRight' ? 1 : -1));
    });
    viewer.addEventListener('close', () => {
      fullImage.removeAttribute('src');
      stopVideo();
      schedule();
    });

    const slides = items.map(({ src, alt, width: sourceWidth, height: sourceHeight }, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'design-slide';
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-describedby',hint.id);
      const video = isVideo(src);
      const element = video ? document.createElement('video') : new Image();
      const label = document.createElement('textarea');
      label.innerHTML = alt;
      if (video) {
        element.muted = true;
        element.loop = true;
        element.playsInline = true;
        element.preload = 'metadata';
        card.dataset.video = '';
      } else {
        element.alt = label.value;
        element.decoding = 'async';
      }
      element.draggable = false;
      card.setAttribute('aria-label', label.value || (video ? 'Видео ' : 'Изображение ') + (i % media.length + 1));
      card.append(element);
      stage.append(card);
      card.addEventListener('click', () => {
        showItem(i % media.length);
        viewer.showModal();
        schedule();
      });
      const ratio = sourceWidth / sourceHeight;
      const slide = { card, element, src, video, label: label.value, ratio: ratio > 0 && Number.isFinite(ratio) ? ratio : 1 };
      element.addEventListener(video ? 'loadedmetadata' : 'load', () => {
        const width = video ? element.videoWidth : element.naturalWidth;
        const height = video ? element.videoHeight : element.naturalHeight;
        if (!width || !height || !stage.isConnected) return;
        slide.ratio = width / height;
        resize();
      }, { once: true });
      return slide;
    });

    function resize() {
      width = stage.clientWidth;
      height = stage.clientHeight;
      const maxWidth = Math.max(0, Math.min(width * .62, 680));
      const maxHeight = Math.max(0, height * .94);
      for (const slide of slides) {
        const innerHeight = Math.min(maxHeight, maxWidth / slide.ratio);
        slide.width = innerHeight * slide.ratio;
        slide.card.style.width = slide.width + 'px';
        slide.card.style.height = innerHeight + 'px';
      }
      draw();
    }

    function offsetFor(index, current) {
      const forward = wrap(index - current);
      const backward = forward - count;
      if (forward === -backward) return direction > 0 ? forward : backward;
      return forward < -backward ? forward : backward;
    }

    function draw() {
      const base = Math.floor(angle), fraction = angle - base;
      const leftWidth = slides[wrap(base)].width;
      const centerWidth = leftWidth + (slides[wrap(base + 1)].width - leftWidth) * fraction;
      slides.forEach((slide, index) => {
        const offset = offsetFor(index, angle);
        const slot = clamp(offset, -2, 2);
        const depth = Math.abs(slot);
        const yaw = -slot * 34;
        const radians = yaw * Math.PI / 180;
        const z = -depth * 168;
        // Bound the projected card corners so the frame stays inside the stage while turning.
        const nearEdge = z + Math.abs(Math.sin(radians)) * slide.width / 2;
        const magnification = 900 / (900 - nearEdge);
        const halfCard = Math.abs(Math.cos(radians)) * slide.width / 2;
        const maxShift = Math.max(0, (width / 2 - 4) / magnification - halfCard);
        const shift = Math.sign(slot) * Math.min(depth * (centerWidth * .43 + slide.width * .38), maxShift);
        const opacity = depth < 1 ? 1 - depth * .37 : .63 * (1 - Math.min(1, (depth - 1) * 2));
        if (depth <= 1.5 && !slide.element.hasAttribute('src')) slide.element.src = slide.src;
        slide.card.style.opacity = opacity;
        slide.card.style.zIndex = Math.round(100 - depth * 40);
        slide.card.style.transform = 'translate3d(' + shift + 'px,0,' + z + 'px) rotateY(' + yaw + 'deg)';
      });
    }

    function updateControls() {
      slides.forEach(({ card }, index) => {
        const offset = offsetFor(index, target);
        const side = Math.abs(offset) === 1;
        card.setAttribute('aria-hidden', String(Math.abs(offset) > 1));
        card.toggleAttribute('data-active', offset === 0);
        card.tabIndex = side || offset === 0 ? 0 : -1;
      });
    }

    function schedule() {
      clearTimeout(timer);
      for (const [index, slide] of slides.entries()) {
        if (!slide.video) continue;
        if (index === wrap(target) && visible && !document.hidden && !viewer.open && !drag && !motion.matches) {
          slide.element.play().catch(() => {});
        } else slide.element.pause();
      }
      if (count < 2 || !stage.isConnected || viewer.open || !visible || document.hidden || motion.matches || drag) return;
      timer = setTimeout(() => go(target + 1), 3000);
    }

    function go(next) {
      cancelAnimationFrame(frame);
      if (next !== target) direction = Math.sign(next - target);
      target = next;
      updateControls();
      const start = angle;
      if (motion.matches || Math.abs(start - target) < .001) {
        angle = target;
        draw();
      } else {
        const started = performance.now();
        function turn(now) {
          const t = clamp((now - started) / 580, 0, 1);
          const eased = t * t * (3 - 2 * t);
          angle = start + (target - start) * eased;
          draw();
          if (t < 1) frame = requestAnimationFrame(turn);
        }
        frame = requestAnimationFrame(turn);
      }
      schedule();
    }

    resize();
    updateControls();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(stage);
    if (count < 2 && !slides[0].video) return () => { viewer.remove(); sizeObserver.disconnect(); };

    if (count > 1) {
      stage.classList.add('is-draggable');
      stage.tabIndex = 0;
    }
    stage.addEventListener('pointerdown', event => {
      if (count < 2 || !event.isPrimary || event.button !== 0) return;
      ignoreClick = false;
      drag = { pointer: event.pointerId, x: event.clientX, angle, moved: false };
      clearTimeout(timer);
      for (const slide of slides) if (slide.video) slide.element.pause();
    });
    stage.addEventListener('pointermove', event => {
      if (drag?.pointer !== event.pointerId) return;
      const delta = event.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(delta) < 6) return;
        cancelAnimationFrame(frame);
        drag.angle = angle;
        drag.moved = true;
        stage.setPointerCapture(event.pointerId);
        stage.classList.add('is-dragging');
      }
      direction = delta < 0 ? 1 : -1;
      const distance = Math.max(80, width * .28);
      angle = drag.angle - clamp(delta / distance, -2, 2);
      draw();
    });
    function endDrag(event) {
      if (drag?.pointer !== event.pointerId) return;
      const { moved, angle: start } = drag;
      drag = null;
      stage.classList.remove('is-dragging');
      if (!moved) { schedule(); return; }
      ignoreClick = true;
      const delta = angle - start;
      const next = Math.round(angle + (Math.abs(delta) > .16 ? Math.sign(delta) * .34 : 0));
      go(next);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    stage.addEventListener('pointerleave', event => { if (!drag?.moved) endDrag(event); });
    stage.addEventListener('click', event => {
      if (!ignoreClick || !event.detail) return;
      event.preventDefault();
      event.stopPropagation();
      ignoreClick = false;
    }, true);
    root.addEventListener('keydown', event => {
      if (count < 2 || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
      event.preventDefault();
      go(target + (event.key === 'ArrowRight' ? 1 : -1));
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    observer.observe(stage);
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      stopVideo();
      for (const slide of slides) if (slide.video) slide.element.pause();
      viewer.remove();
      observer.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      motion.removeEventListener('change', schedule);
    };
  }

  window.DesignCarousel = { mount };
})();
