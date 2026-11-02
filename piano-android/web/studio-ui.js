/* Offline artwork and a small shared visual vocabulary. No network assets. */
(() => {
  const paths={
    arrow:'M5 12h14m-6-6 6 6-6 6',
    anchors:'M12 3v18M5 8h14M5 16h14M8 3h8M8 21h8',
    contrast:'M4 7h6v10H4zM14 4h6v16h-6zM7 10v4m10-7v10',
    ledger:'M3 8h18M3 12h18M3 16h18M10 5v14m-4 0h8',
    reverse:'M4 5h16v14H4zM8 5v9m4-9v9m4-9v9M4 14h16',
    rhythm:'M4 16v-4m4 8V4m4 13V7m4 13V4m4 12v-4',
    phrase:'M9 18V5l11-2v12M9 8l11-2M9 18c0 3-6 4-6 1s6-4 6-1m11-3c0 3-6 4-6 1s6-4 6-1',
    clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    check:'m5 12 4 4L19 6',
    play:'m9 5 11 7-11 7Z',
    metro:'m9 3-5 18h16L15 3Zm3 14 5-11M9 17h6'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" class="studio-icon" aria-hidden="true"><path d="${paths[name]||paths.phrase}"/></svg>`;
  const heading=(index,title,copy,action='')=>`<div class="page-head"><div><span class="eyebrow">${index} / 练习室</span><h2>${title}</h2><p>${copy}</p></div>${action}</div>`;
  function artwork(){
    const lines=[104,126,148,170,192].map(y=>`<path d="M20 ${y}h340"/>`).join('');
    return `<svg viewBox="0 0 380 280" class="studio-score-art" aria-hidden="true"><circle cx="240" cy="140" r="112" fill="#e0e8c9"/><circle cx="310" cy="55" r="7" fill="#d39564"/><g fill="none" stroke="#426450" stroke-opacity=".28">${lines}<path d="M70 104v88M343 104v88"/></g><g fill="#294d3e" stroke="#294d3e" stroke-width="3"><ellipse cx="115" cy="181" rx="12" ry="8" transform="rotate(-20 115 181)"/><path d="M125 179v-63"/><ellipse cx="183" cy="158" rx="12" ry="8" transform="rotate(-20 183 158)"/><path d="M193 155V93"/><ellipse cx="251" cy="137" rx="12" ry="8" transform="rotate(-20 251 137)"/><path d="M261 134V71"/><ellipse cx="319" cy="148" rx="12" ry="8" transform="rotate(-20 319 148)"/><path d="M329 145V82"/></g><rect x="160" y="214" width="144" height="36" rx="18" fill="#fffdf5"/><text x="232" y="237" text-anchor="middle" font-size="12" fill="#48634f" font-family="sans-serif" letter-spacing="3">READ · PLAY · REPEAT</text></svg>`;
  }
  window.PianoStudio={icon,heading,artwork};
})();
