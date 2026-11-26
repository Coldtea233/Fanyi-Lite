(() => {
  'use strict';
  const root = document.documentElement;
  root.style.setProperty('--btf-ai-mark', `url("${chrome.runtime.getURL('icons/ai-outline.png')}")`);
  const q = (selector, scope = document) => scope.querySelector(selector);
  const modes = [
    ['text', '/mtpe-individual/transText', '文本翻译'],
    ['doc', '/mtpe-individual/transDoc', '文档翻译', '?transType=1'],
    ['image', '/mtpe-individual/transImg', '图片翻译'],
    ['collection', '/mtpe-individual/collection', '\u6536\u85cf\u5939']
  ];
  const currentMode = () => modes.find(([, path]) => location.pathname.replace(/\/$/, '') === path)?.[0];
  const onPage = () => Boolean(currentMode());
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference, frame, accountSlot, themeButton, deepButton, lastMore, busy = false;
  let assistantRequested = false;
  let autoClosedDrawer;
  const assistantTrigger = '.GD40EXru, .OoXf2O55, .TnZmezJA, .RGZT5XFz';
  const languageMenu = '.IcHmn0gj, .Mt2tsfNw';
  const languageOption = '.XmMCA0XC, .ySRt6YgI, .QX6U7gsT:not([data-btf-recent])';
  const fixedLanguages = new Set(['auto', 'zh', 'en']);
  const names = Object.entries(BTF_LANGUAGE_NAMES);
  const nameIndex = [0, 1].map(index => new Map(names.map(([id, pair]) => [pair[index], id])));
  const recents = {};
  let modeNav;

  document.addEventListener('click', event => {
    if (!event.isTrusted || !onPage() || !(event.target instanceof Element)) return;
    const trigger = event.target.closest(assistantTrigger);
    if (trigger) assistantRequested = !trigger.matches('.OoXf2O55:not(.dn6qpcgq)');
    const option = event.target.closest(languageOption);
    const menu = option?.closest(languageMenu);
    if (menu) trackLanguage(menu, option);
  }, true);

  function menuLocale(menu) {
    return Number(q('.sFeoU0sy:nth-child(2).YiRrk7Pq', menu) !== null);
  }

  function optionId(option, locale) {
    const label = option.textContent.trim();
    if (option.matches('.ySRt6YgI')) {
      const [chinese, english] = label.split(/\u00a0{2}/);
      return nameIndex[0].get(chinese) ?? nameIndex[1].get(english);
    }
    return nameIndex[locale].get(label);
  }

  function menuKey(menu, list, locale) {
    const mode = menu.matches('.Mt2tsfNw') ? 'image' : 'text';
    const side = list.firstElementChild && optionId(list.firstElementChild, locale) === 'auto' ? 'from' : 'to';
    return `btfRecent-${mode}-${side}`;
  }

  const recentKeys = ['text', 'image'].flatMap(mode => ['from', 'to'].map(side => `btfRecent-${mode}-${side}`));
  chrome.storage.local.get(recentKeys).then(data => {
    for (const key of recentKeys) recents[key] ??= data[key];
    schedule();
  });

  function trackLanguage(menu, option) {
    if (option.matches('.gvobLB8c, [aria-disabled="true"], [disabled]')) return;
    const locale = menuLocale(menu);
    const id = optionId(option, locale);
    if (!id || fixedLanguages.has(id)) return;
    const list = q('.ENz4tU2V', menu);
    const header = menu.closest('.JTwpduw8');
    if (!list || !header) return;
    const key = menuKey(menu, list, locale);
    const side = key.endsWith('-from') ? 0 : 1;
    requestAnimationFrame(() => {
      const control = header.querySelectorAll('.pQHR0aqn')[side];
      const selected = control && q(':scope > span', control)?.textContent.trim();
      if (!BTF_LANGUAGE_NAMES[id].includes(selected)) return;
      const previous = Array.isArray(recents[key]) ? recents[key] : [];
      if (previous[0] === id) return;
      recents[key] = [id, ...previous.filter(entry => entry !== id)].slice(0, 12);
      chrome.storage.local.set({ [key]: recents[key] });
      schedule();
    });
  }

  function updateLanguageMenus() {
    for (const menu of document.querySelectorAll(languageMenu)) {
      const list = q('.ENz4tU2V', menu);
      if (!list) continue;
      const locale = menuLocale(menu);
      const history = recents[menuKey(menu, list, locale)];
      const nativeIds = new Set([...list.querySelectorAll('.QX6U7gsT:not([data-btf-recent])')]
        .map(option => optionId(option, locale)));
      const options = new Map();
      for (const option of menu.querySelectorAll('.XmMCA0XC:not(.gvobLB8c)')) {
        options.set(optionId(option, locale), option);
      }
      const ids = (Array.isArray(history) ? history : []).filter(id => options.has(id) && !nativeIds.has(id)).slice(0, 2);
      const current = [...list.querySelectorAll('[data-btf-recent]')];
      if (current.length === ids.length && current.every((chip, index) =>
        chip.dataset.btfRecent === ids[index] && chip.textContent === BTF_LANGUAGE_NAMES[ids[index]][locale] &&
        chip.getAttribute('aria-current') === (options.get(ids[index]).matches('.YiRrk7Pq') ? 'true' : null))) continue;
      current.forEach(chip => chip.parentElement.remove());
      for (const id of ids) {
        const wrapper = document.createElement('li');
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'QX6U7gsT';
        chip.dataset.btfRecent = id;
        chip.textContent = BTF_LANGUAGE_NAMES[id][locale];
        if (options.get(id).matches('.YiRrk7Pq')) chip.setAttribute('aria-current', 'true');
        chip.addEventListener('click', event => {
          const native = [...menu.querySelectorAll('.XmMCA0XC:not(.gvobLB8c)')]
            .find(option => optionId(option, menuLocale(menu)) === id);
          if (!native) return;
          if (event.isTrusted) trackLanguage(menu, native);
          native.click();
        });
        wrapper.append(chip);
        list.append(wrapper);
      }
    }
  }

  function button(id, label, action) {
    const el = document.createElement('button');
    el.id = id;
    el.type = 'button';
    el.title = label;
    el.setAttribute('aria-label', label);
    el.addEventListener('click', action);
    return el;
  }

  function paintTheme() {
    const dark = preference === undefined ? system.matches : preference === 'dark';
    root.toggleAttribute('data-btf-dark', dark && onPage());
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.title = dark ? '切换到浅色模式' : '切换到深色模式';
    }
  }
  function toggleTheme() {
    preference = root.hasAttribute('data-btf-dark') ? 'light' : 'dark';
    paintTheme();
    chrome.storage.local.set({ btfTheme: preference });
  }
  chrome.storage.local.get('btfTheme').then(data => {
    if (preference === undefined) preference = data.btfTheme;
    paintTheme();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.btfTheme) {
      preference = changes.btfTheme.newValue;
      paintTheme();
    }
  });
  system.addEventListener('change', paintTheme);

  // The account menu stays in Baidu's React tree so hover, login and logout still work.
  function alignAccount() {
    if (!accountSlot?.isConnected) return;
    const { x, y } = accountSlot.getBoundingClientRect();
    root.style.setProperty('--btf-account-x', `${x}px`);
    root.style.setProperty('--btf-account-y', `${y}px`);
  }
  const railSize = new ResizeObserver(alignAccount);
  addEventListener('resize', alignAccount);
  function dock(rail) {
    if (!rail.contains(themeButton)) {
      railSize.disconnect();
      themeButton = button('btf-theme', '深色模式', toggleTheme);
      accountSlot = document.createElement('div');
      accountSlot.id = 'btf-account-slot';
      rail.append(themeButton, accountSlot);
      railSize.observe(rail);
      rail.addEventListener('scroll', alignAccount, { passive: true });
      alignAccount();
      paintTheme();
    }
  }

  const foldedSwitch = '.MpsN6RSj.xLRXcidQ .U96wGxyK .XLLOw1r7';
  const enabled = node => node.classList.contains('Tiyz3l0s');
  function showState(state) {
    if (!deepButton) return;
    if (state === null) deepButton.removeAttribute('aria-pressed');
    else deepButton.setAttribute('aria-pressed', String(state));
  }
  async function useFolded(more, toggle) {
    if (busy) return;
    busy = true;
    const targetButton = deepButton;
    if (targetButton) targetButton.disabled = true;
    const openedHere = !q(foldedSwitch);
    try {
      if (openedHere) more.click();
      let control;
      for (let i = 0; i < 30 && more.isConnected; i++) {
        control = q(foldedSwitch);
        if (control) break;
        await new Promise(resolve => setTimeout(resolve, 24));
      }
      if (!control || !more.isConnected) {
        // If Baidu changes the menu, leave its original control accessible.
        more.closest('#transBottom')?.setAttribute('data-btf-fallback', '');
        return;
      }
      const before = enabled(control);
      if (toggle) control.click();
      showState(toggle ? !before : before);
    } finally {
      if (openedHere && q(foldedSwitch) && more.isConnected) more.click();
      busy = false;
      if (targetButton) targetButton.disabled = false;
      schedule();
    }
  }
  function toggleDeep() {
    const direct = q('#transBottom .EFflylzd');
    if (direct) {
      direct.click();
      schedule();
    } else {
      const more = q('#transBottom .euPPwBhP');
      if (more) void useFolded(more, true);
    }
  }
  function languageHint(bar, left) {
    const source = bar.closest('.JQvB9PmQ');
    const native = source && q('.rzYZuztX > span', source);
    const hint = q('#btf-language-hint', bar);
    const language = native?.textContent.trim();
    if (!language) {
      hint?.remove();
      return;
    }
    if (hint) {
      const choice = q('button', hint);
      if (choice.textContent !== language) choice.textContent = language;
      return;
    }
    const element = document.createElement('div');
    element.id = 'btf-language-hint';
    element.append(native.previousSibling?.textContent.trim() || '\u60a8\u8f93\u5165\u7684\u53ef\u80fd\u662f:');
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.textContent = language;
    choice.addEventListener('click', () => q('.rzYZuztX > span', source)?.click());
    element.append(choice);
    left.after(element);
  }

  function footer(bar) {
    const right = q('.PD_SBwjB', bar);
    const left = q('.tk4FR4Cn', bar);
    if (!left || !right) return;
    languageHint(bar, left);
    for (const item of left.children) {
      const label = item.textContent.trim();
      item.toggleAttribute('data-btf-hide', /^(参考知识|AI润色|个性指令)$/.test(label));
    }
    const more = q('.euPPwBhP', left);
    const direct = q('.EFflylzd', left);
    bar.toggleAttribute('data-btf-deep', !!(more || direct));
    if (!more && !direct) {
      deepButton?.remove();
      deepButton = lastMore = null;
      return;
    }
    if (!right.contains(deepButton)) {
      deepButton = button('btf-deep', '深度思考', toggleDeep);
      const label = document.createElement('span');
      label.className = 'btf-deep-label';
      label.textContent = '思考';
      deepButton.append(label);
      right.append(deepButton);
    }
    if (direct) {
      showState(enabled(direct));
      lastMore = null;
    } else if (more !== lastMore && !busy) {
      lastMore = more;
      showState(null);
      void useFolded(more, false);
    } else if (!busy && q(foldedSwitch)) showState(enabled(q(foldedSwitch)));
  }

  function updateModeNav(mode) {
    if (!modeNav) {
      modeNav = document.createElement('nav');
      modeNav.id = 'btf-modes';
      modeNav.setAttribute('aria-label', '翻译类型');
      for (const [id, path, label, query = ''] of modes) {
        const link = document.createElement('a');
        link.href = id === 'collection' ? path : `${path}${query}#/`;
        link.dataset.mode = id;
        link.textContent = label;
        modeNav.append(link);
      }
      document.body.append(modeNav);
    }
    for (const link of modeNav.children) {
      if (link.dataset.mode === mode) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function update() {
    frame = 0;
    const mode = currentMode();
    if (!mode) {
      assistantRequested = false;
      autoClosedDrawer = undefined;
      root.removeAttribute('data-btf');
      root.removeAttribute('data-btf-dark');
      return;
    }
    if (root.getAttribute('data-btf') !== mode) root.setAttribute('data-btf', mode);
    updateModeNav(mode);
    if (mode === 'collection' && !q('#btf-collection-tools')) {
      const tools = document.createElement('div');
      tools.id = 'btf-collection-tools';
      themeButton = button('btf-theme', '深色模式', toggleTheme);
      tools.append(themeButton);
      document.body.append(tools);
    }
    paintTheme();
    const rail = q('.fYmMHp6G .mxm5_Dyv');
    if (rail) {
      dock(rail);
      const toggle = q('.OoXf2O55', rail);
      if (toggle?.classList.contains('dn6qpcgq')) autoClosedDrawer = undefined;
      const assistant = q('.typUaL0G .FHkxPqai:has(#copilotRoot)');
      if (!assistantRequested && toggle && assistant?.getClientRects().length && autoClosedDrawer !== toggle) {
        autoClosedDrawer = toggle;
        toggle.click();
      }
    }
    const bar = document.getElementById('transBottom');
    if (bar) {
      footer(bar);
      const star = q('.UjEKnoku :is(.Y51dAuDD, .hX9dqutt)', bar);
      if (star && !star.hasAttribute('role')) {
        star.setAttribute('role', 'button');
        star.tabIndex = 0;
        star.setAttribute('aria-label', star.matches('.hX9dqutt') ? '\u5df2\u6536\u85cf' : '\u6536\u85cf\u539f\u6587');
      }
    }
    updateLanguageMenus();
    const expand = q('#machineRes .SiPM734t .NtN0QfXn:not([role])');
    if (expand) {
      expand.setAttribute('role', 'button');
      expand.setAttribute('aria-label', '展开');
      expand.tabIndex = 0;
      expand.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        expand.click();
      });
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  new MutationObserver(schedule).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class']
  });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  window.navigation?.addEventListener('navigatesuccess', schedule);
  update();
})();
