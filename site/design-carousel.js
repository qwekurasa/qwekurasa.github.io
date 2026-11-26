(() => {
  function mount(root, media) {
    if (!media.length) return () => {};
    const stage = root.querySelector('.design-carousel-stage');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const step = Math.PI / 4;
    const stripCount = 15;
    const speed = 1 / 1050;
    const multiple = media.length > 1;
    const count = multiple ? Math.ceil(6 / media.length) * media.length : 1;
    let radius = 0, width = 0, position = 0, velocity = 0, active = -1;
    let frame = 0, last = 0, visible = false, drag = null, turn = null, ignoreClick = false;
    let resumeAt = 0;

    const wrap = value => ((value % count) + count) % count;
    const offsetFor = (index, current) => wrap(index - current + count / 2) - count / 2;
    const slides = Array.from({ length:count }, (_,index) => {
      const {src,alt,width:sourceWidth,height:sourceHeight}=media[index % media.length];
      const label = document.createElement('textarea');
      label.innerHTML = alt;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'design-slide';
      card.setAttribute('aria-label',label.value || 'Изображение ' + (index % media.length + 1));
      card.addEventListener('click',() => {
        const offset = offsetFor(index,Math.round(position));
        if (offset) go(Math.round(position) + offset);
      });
      stage.append(card);
      const ratio = sourceWidth / sourceHeight;
      return {card,src,alt:label.value,ratio:Number.isFinite(ratio) && ratio > 0 ? ratio : 1,strips:[]};
    });

    function addStrips(slide) {
      const imageCount = multiple ? stripCount : 1;
      for (let i=0;i<imageCount;i++) {
        const strip = document.createElement('span');
        strip.className = 'design-slide-strip';
        const image = new Image();
        image.alt = i===0 ? slide.alt : '';
        image.draggable = false;
        image.src = slide.src;
        strip.append(image);
        slide.card.append(strip);
        slide.strips.push({strip,image});
      }
      const image = slide.strips[0].image;
      const fitImage = () => {
        if (!image.naturalHeight || !stage.isConnected) return;
        slide.ratio = image.naturalWidth / image.naturalHeight;
        sizeSlide(slide);
      };
      if (image.complete) fitImage();
      else image.addEventListener('load',fitImage,{once:true});
      sizeSlide(slide);
    }

    function sizeSlide(slide) {
      const height = Math.min(stage.clientHeight * .88,width / slide.ratio);
      const imageWidth = height * slide.ratio;
      slide.card.style.width = imageWidth + 'px';
      slide.card.style.height = height + 'px';
      const strips = slide.strips.length;
      const arc = multiple && radius ? imageWidth / radius / strips : 0;
      const stripWidth = arc ? 2 * radius * Math.tan(arc / 2) : imageWidth;
      slide.strips.forEach(({strip,image},i) => {
        const theta = (i + .5 - strips / 2) * arc;
        const overlap = i===strips-1 ? 0 : .55;
        strip.style.width = stripWidth + overlap + 'px';
        strip.style.transform = 'translate3d(' + (radius*Math.sin(theta)-stripWidth/2) +
          'px,0,' + (radius*(Math.cos(theta)-1)) + 'px) rotateY(' + theta + 'rad)';
        image.style.width = imageWidth + 'px';
        image.style.left = -i * imageWidth / strips + 'px';
      });
    }

    function resize() {
      width = Math.min(stage.clientWidth * .48,380);
      radius = width / (step * .95);
      slides.forEach(sizeSlide);
      draw();
    }

    function draw() {
      const nearest = Math.round(position);
      slides.forEach((slide,index) => {
        const angle = offsetFor(index,position)*step;
        const show = Math.abs(angle) < 1.62;
        slide.card.style.visibility = show ? 'visible' : 'hidden';
        if (show) {
          if (!slide.strips.length) addStrips(slide);
          const x = radius*Math.sin(angle);
          const z = radius*(Math.cos(angle)-1);
          slide.card.style.transform = 'translate3d(' + x + 'px,0,' + z + 'px) rotateY(' + angle + 'rad)';
          slide.card.style.zIndex = Math.round(150-Math.abs(angle)*50);
        }
        if (active!==nearest) {
          const offset = offsetFor(index,nearest);
          slide.card.setAttribute('aria-hidden',String(Math.abs(offset)>2));
          slide.card.setAttribute('aria-disabled',String(offset===0));
          slide.card.tabIndex = offset && Math.abs(offset)<=2 ? 0 : -1;
          if (offset && Math.abs(offset)<=2) slide.card.dataset.side=offset;
          else delete slide.card.dataset.side;
        }
      });
      active=nearest;
    }

    function tick(now) {
      frame=0;
      const dt=last ? Math.min(now-last,40) : 0;
      last=now;
      if (turn) {
        const t=Math.min((now-turn.since)/460,1);
        position=turn.from+(turn.to-turn.from)*(1-Math.pow(1-t,3));
        if (t===1) turn=null;
      } else if (!drag && !reducedMotion.matches) {
        const target=now>=resumeAt ? speed : 0;
        velocity+=(target-velocity)*(1-Math.exp(-dt/250));
        position+=velocity*dt;
      }
      draw();
      schedule();
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame=0;
      if (visible && !document.hidden && (turn || (!drag && !reducedMotion.matches))) {
        frame=requestAnimationFrame(tick);
      } else last=0;
    }

    function go(to) {
      velocity=0;
      resumeAt=performance.now()+850;
      if (reducedMotion.matches) {
        position=to;
        draw();
      } else turn={from:position,to,since:performance.now()};
      schedule();
    }

    resize();
    const sizeObserver=new ResizeObserver(resize);
    sizeObserver.observe(stage);
    if (!multiple) return () => sizeObserver.disconnect();

    stage.classList.add('is-draggable');
    stage.tabIndex=0;
    stage.addEventListener('pointerdown',event => {
      if (!event.isPrimary || event.button!==0) return;
      ignoreClick=false;
      drag={id:event.pointerId,x:event.clientX,lastX:event.clientX,time:performance.now(),from:position,moved:false,velocity:0};
      velocity=0;
      turn=null;
      schedule();
    });
    stage.addEventListener('pointermove',event => {
      if (drag?.id!==event.pointerId) return;
      const delta=event.clientX-drag.x;
      if (!drag.moved) {
        if (Math.abs(delta)<5) return;
        drag.moved=true;
        stage.setPointerCapture(event.pointerId);
        stage.classList.add('is-dragging');
      }
      const now=performance.now();
      const distance=Math.max(65,width*.92);
      drag.velocity=-(event.clientX-drag.lastX)/distance/Math.max(8,now-drag.time);
      drag.lastX=event.clientX;
      drag.time=now;
      position=drag.from-delta/distance;
      draw();
    });
    function endDrag(event) {
      if (drag?.id!==event.pointerId) return;
      if (drag.moved) {
        ignoreClick=true;
        if (!reducedMotion.matches && performance.now()-drag.time<110 && event.type==='pointerup') {
          velocity=Math.max(-.007,Math.min(.007,drag.velocity));
        }
      }
      drag=null;
      stage.classList.remove('is-dragging');
      resumeAt=performance.now()+700;
      schedule();
    }
    stage.addEventListener('pointerup',endDrag);
    stage.addEventListener('pointercancel',endDrag);
    stage.addEventListener('lostpointercapture',endDrag);
    stage.addEventListener('pointerleave',event => { if (!drag?.moved) endDrag(event); });
    stage.addEventListener('click',event => {
      if (!ignoreClick || !event.detail) return;
      event.preventDefault();
      event.stopPropagation();
      ignoreClick=false;
    },true);
    root.addEventListener('keydown',event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      go(Math.round(position)+(event.key==='ArrowRight' ? 1 : -1));
    });

    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();});
    observer.observe(stage);
    document.addEventListener('visibilitychange',schedule);
    reducedMotion.addEventListener('change',schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener('visibilitychange',schedule);
      reducedMotion.removeEventListener('change',schedule);
    };
  }
  window.DesignCarousel={mount};
})();
