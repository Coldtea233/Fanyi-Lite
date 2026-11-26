(() => {
  'use strict';
  const starSelector = '#transBottom .UjEKnoku :is(.Y51dAuDD, .hX9dqutt)';
  const systemName = '\u7cfb\u7edf\u5206\u7ec4';
  const busy = new WeakSet();
  let press;
  let canceledClick;
  let popup;
  let anchor;

  // Reuse Baidu's group callbacks and data without changing its saved default group.
  function groupActions(star) {
    const wrapper = star.closest('.UjEKnoku');
    const fiberKey = Object.keys(wrapper).find(key => key.startsWith('__reactFiber$'));
    if (!fiberKey) return;
    const entry = wrapper[fiberKey];
    const tree = [entry.child, entry.alternate?.child];
    for (const start of tree) {
      let fiber = start;
      for (let depth = 0; fiber && depth < 8; depth++, fiber = fiber.child) {
        const props = fiber.memoizedProps;
        const actions = props?.content?.props;
        if (!Array.isArray(actions?.listData) || typeof actions.checkPccollgroup !== 'function' ||
            typeof actions.addPccollgroup !== 'function') continue;
        return actions;
      }
    }
  }

  function getStar(target) {
    return target instanceof Element && target.closest(starSelector);
  }

  function closePopup(restoreFocus = false) {
    popup?.remove();
    if (restoreFocus) anchor?.focus({ preventScroll: true });
    popup = anchor = undefined;
  }

  function placePopup() {
    if (!popup || !anchor.isConnected || !anchor.getClientRects().length) {
      closePopup();
      return;
    }
    const bounds = anchor.getBoundingClientRect();
    const gap = 8;
    const above = bounds.top - gap * 2;
    const below = innerHeight - bounds.bottom - gap * 2;
    const opensUp = above >= Math.min(popup.scrollHeight, 200) || above >= below;
    popup.style.maxHeight = `${Math.max(44, opensUp ? above : below)}px`;
    popup.style.left = `${Math.max(gap, Math.min(bounds.left - 8, innerWidth - popup.offsetWidth - gap))}px`;
    popup.style.top = `${opensUp ? bounds.top - popup.offsetHeight - gap : bounds.bottom + gap}px`;
  }

  async function run(star, action) {
    if (busy.has(star)) return;
    busy.add(star);
    try {
      await action();
    } finally {
      busy.delete(star);
    }
  }

  function showPopup(star, actions) {
    closePopup();
    anchor = star;
    popup = document.createElement('div');
    popup.id = 'btf-collect-menu';
    popup.setAttribute('role', 'dialog');
    const title = document.createElement('div');
    title.className = 'btf-collect-title';
    const saved = star.matches('.hX9dqutt');
    title.textContent = saved ? '\u5df2\u6536\u85cf' : '\u6dfb\u52a0\u6536\u85cf\u5230';
    popup.setAttribute('aria-label', title.textContent);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btf-collect-close';
    close.setAttribute('aria-label', '\u5173\u95ed');
    close.addEventListener('click', () => closePopup(true));
    title.append(close);
    popup.append(title);
    const choices = document.createElement('div');
    choices.className = 'btf-collect-options';
    popup.append(choices);
    const addOption = (label, action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      choices.append(button);
      return button;
    };
    if (saved) {
      const link = document.createElement('a');
      link.href = '/mtpe-individual/collection';
      link.textContent = '\u7ba1\u7406\u6536\u85cf';
      choices.append(link);
      addOption('\u53d6\u6d88\u6536\u85cf', () => {
        closePopup();
        star.click();
      });
    } else {
      for (const { id, name } of actions.listData) {
        addOption(name, () => {
          closePopup(true);
          const latest = groupActions(star);
          if (star.isConnected && latest?.listData.some(group => group.id === id)) {
            void run(star, () => latest.checkPccollgroup(id));
          }
        });
      }
      addOption('\u65b0\u6536\u85cf\u5206\u7ec4', event => {
        const form = document.createElement('form');
        const input = document.createElement('input');
        input.required = true;
        input.placeholder = '\u5206\u7ec4\u540d\u79f0';
        input.setAttribute('aria-label', input.placeholder);
        const submit = document.createElement('button');
        submit.textContent = '\u521b\u5efa\u5e76\u6dfb\u52a0';
        form.append(input, submit);
        form.addEventListener('submit', event => {
          event.preventDefault();
          const name = input.value.trim();
          const latest = groupActions(star);
          if (!name || !latest || !star.isConnected) return;
          closePopup(true);
          void run(star, () => latest.addPccollgroup(name));
        });
        event.currentTarget.replaceWith(form);
        input.focus();
        placePopup();
      });
    }
    document.body.append(popup);
    placePopup();
    choices.firstElementChild?.focus({ preventScroll: true });
  }

  function activate(star, long) {
    if (!star.isConnected || star.matches('.L4BHthxB')) return;
    if (star.matches('.hX9dqutt')) {
      if (long) showPopup(star);
      return;
    }
    const actions = groupActions(star);
    const system = actions?.listData.find(group => group.name === systemName || String(group.id) === '0');
    const trans = window.store?.getState?.()?.multimodalV2?.trans;
    const parts = trans?.result?.transData;
    const result = parts instanceof Map ? [...parts.values()].flat().map(item => item?.dst ?? '').join('') : null;
    if (!system || typeof trans?.query !== 'string' || result === null ||
        trans.query.length > 2000 || result.length > 2000) {
      star.click();
      return;
    }
    if (long) showPopup(star, actions);
    else void run(star, () => actions.checkPccollgroup(system.id));
  }

  function clearPress() {
    clearTimeout(press?.timer);
    press = undefined;
  }
  document.addEventListener('pointerdown', event => {
    if (popup && !popup.contains(event.target) && !anchor.contains(event.target)) closePopup();
    const star = getStar(event.target);
    if (!event.isTrusted || event.button !== 0 || !star) return;
    clearPress();
    canceledClick = undefined;
    press = { star, x: event.clientX, y: event.clientY };
    press.timer = setTimeout(() => {
      canceledClick = star;
      activate(star, true);
      clearPress();
    }, 460);
  }, true);
  document.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) {
      canceledClick = press.star;
      clearPress();
    }
  }, true);
  for (const type of ['pointerup', 'pointercancel', 'blur']) addEventListener(type, clearPress, true);
  document.addEventListener('click', event => {
    const star = getStar(event.target);
    if (!event.isTrusted || !star) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (star !== canceledClick) activate(star, false);
    canceledClick = undefined;
  }, true);
  document.addEventListener('keydown', event => {
    if (!event.isTrusted) return;
    if (event.key === 'Escape' && popup) {
      closePopup(true);
      return;
    }
    const star = getStar(event.target);
    if (!star || event.repeat) return;
    if (['Enter', ' '].includes(event.key) || (event.key === 'ArrowDown' && event.altKey)) {
      event.preventDefault();
      activate(star, event.altKey || event.shiftKey);
    }
  });
  addEventListener('resize', placePopup);
  addEventListener('scroll', event => {
    if (popup && !popup.contains(event.target)) placePopup();
  }, true);
  addEventListener('pagehide', () => closePopup());
})();
