for (const select of document.querySelectorAll('[data-language-select]')) {
  select.addEventListener('change', () => {
    window.location.assign(select.value + window.location.hash);
  });
}

const story = document.querySelector('[data-story]');
if (story) {
  const motion = window.matchMedia('(min-height: 600px) and (prefers-reduced-motion: no-preference)');
  const stage = story.querySelector('.story-stage');
  const scenes = [...story.querySelectorAll('[data-story-scene]')];
  const smooth = (from, to, value) => {
    const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  let frame = 0;
  const update = () => {
    frame = 0;
    story.classList.toggle('story-motion', motion.matches);
    if (!motion.matches) {
      for (const scene of scenes) {
        scene.removeAttribute('style');
        scene.inert = false;
      }
      return;
    }
    const bounds = story.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(stage).top);
    const distance = Math.max(1, bounds.height - stage.offsetHeight);
    const progress = Math.min(1, Math.max(0, (top - bounds.top) / distance));
    const heroOut = smooth(.08, .28, progress);
    const editorIn = smooth(.24, .38, progress);
    const editorOut = smooth(.61, .73, progress);
    const publicIn = smooth(.70, .84, progress);
    const states = [
      [1 - heroOut, -30 * heroOut, 1 + .12 * heroOut],
      [editorIn * (1 - editorOut), 45 * (1 - editorIn) - 35 * editorOut, .9 + .1 * editorIn + .04 * editorOut],
      [publicIn, 45 * (1 - publicIn), .9 + .1 * publicIn],
    ];
    scenes.forEach((scene, index) => {
      const [opacity, y, scale] = states[index];
      scene.style.opacity = opacity.toFixed(4);
      scene.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      scene.style.visibility = opacity > .001 ? 'visible' : 'hidden';
      scene.inert = opacity < .1;
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  motion.addEventListener('change', schedule);
  update();
}

const walkthrough = document.querySelector('[data-walkthrough]');
if (walkthrough) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = walkthrough.querySelector('.walkthrough-scenes');
  const scenes = [...walkthrough.querySelectorAll('[data-walkthrough-scene]')];
  const current = walkthrough.querySelector('[data-walkthrough-current]');
  const previous = walkthrough.querySelector('[data-walkthrough-previous]');
  const next = walkthrough.querySelector('[data-walkthrough-next]');
  const position = (index) => scenes[index].offsetLeft - scenes[0].offsetLeft;
  const activeIndex = () => scenes.reduce((closest, scene, index) =>
    Math.abs(position(index) - track.scrollLeft) < Math.abs(position(closest) - track.scrollLeft) ? index : closest, 0);
  let frame = 0;
  const update = () => {
    frame = 0;
    const active = activeIndex();
    current.textContent = String(active+1);
    previous.disabled = active === 0;
    next.disabled = active === scenes.length - 1;
  };
  const goTo = (index) => track.scrollTo({
    left: position(Math.max(0, Math.min(scenes.length - 1, index))),
    behavior: reducedMotion.matches ? 'instant' : 'smooth',
  });
  previous.addEventListener('click', () => goTo(activeIndex() - 1));
  next.addEventListener('click', () => goTo(activeIndex() + 1));
  track.addEventListener('keydown', (event) => {
    if (event.target !== track) return;
    const targets = { ArrowLeft: activeIndex() - 1, ArrowRight: activeIndex() + 1, Home: 0, End: scenes.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    goTo(targets[event.key]);
  });
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  track.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  update();
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const terminal = button.closest('.terminal');
    const code = terminal?.querySelector('code');
    const status = terminal?.querySelector('[data-copy-status]');
    if (!code || !status) return;
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = button.dataset.copied;
      status.textContent = button.dataset.copied;
      button.disabled = true;
      setTimeout(() => { button.textContent = label; button.disabled = false; status.textContent = ''; }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = button.dataset.failed;
    }
  });
}
