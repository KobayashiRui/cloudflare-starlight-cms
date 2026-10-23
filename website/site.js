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
  const motion = window.matchMedia('(min-height: 700px) and (prefers-reduced-motion: no-preference)');
  const stage = walkthrough.querySelector('.walkthrough-stage');
  const scenes = [...walkthrough.querySelectorAll('[data-walkthrough-scene]')];
  const current = walkthrough.querySelector('[data-walkthrough-current]');
  let frame = 0;
  const update = () => {
    frame = 0;
    walkthrough.classList.toggle('walkthrough-motion', motion.matches);
    if (!motion.matches) {
      for (const scene of scenes) {
        scene.removeAttribute('style');
        scene.querySelector('.walkthrough-copy').style.removeProperty('visibility');
        scene.inert = false;
      }
      return;
    }
    const bounds = walkthrough.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(stage).top);
    const progress = Math.min(1,Math.max(0,(top-bounds.top)/Math.max(1,bounds.height-stage.offsetHeight)));
    const position = progress * (scenes.length-1);
    const active = Math.round(position);
    current.textContent = String(active+1);
    scenes.forEach((scene,index) => {
      scene.style.opacity = index === active ? '1' : '0';
      scene.style.transform = `translateY(${index === active ? 0 : 12}px)`;
      scene.style.visibility = 'visible';
      scene.querySelector('.walkthrough-copy').style.visibility = index === active ? 'visible' : 'hidden';
      scene.inert = index !== active;
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  motion.addEventListener('change',schedule);
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
