
(() => {
  const data = window.PORTFOLIO_DATA;
  if (!data) return;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const state = {
    category: 'All samples',
    query: '',
    activeId: null,
    view: 'summary',
    readerOpen: false
  };

  const pdfObjectUrls = new Map();

  // All local images, PDFs and documents are in the same folder
  // as index.html, styles.css, data.js and app.js.
  function localFilePath(href) {
    if (!href || typeof href !== 'string') return href;

    const path = href.trim();

    // Preserve external URLs, embedded data, blob URLs and anchors.
    if (
      /^(https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(path)
    ) {
      return path;
    }

    // Preserve query strings and fragments.
    const match = path.match(/^([^?#]*)(.*)$/);
    const filePath = match ? match[1] : path;
    const suffix = match ? match[2] : '';

    // Use only the filename, since every asset is in one folder.
    const normalized = filePath.replace(/\\/g, '/');
    const filename = normalized.split('/').filter(Boolean).pop();

    if (!filename) return path;

    return `./${filename}${suffix}`;
  }

  function documentUrl(href) {
    if (!href) return href;

    if (!href.startsWith('data:application/pdf;base64,')) {
      return localFilePath(href);
    }

    if (pdfObjectUrls.has(href)) {
      return pdfObjectUrls.get(href);
    }

    const binary = atob(href.slice(href.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const url = URL.createObjectURL(
      new Blob([bytes], { type: 'application/pdf' })
    );

    pdfObjectUrls.set(href, url);
    return url;
  }

  const byId = id => data.works.find(w => w.id === id);

  const clean = value => String(value ?? '').trim();

  const yearLabel = item => {
    const y = clean(item.year);
    if (!y || y === 'Writing sample') return '';
    return y;
  };

  const visibleWorks = () => data.works.filter(w => {
    const categoryMatch =
      state.category === 'All samples' ||
      w.category === state.category;

    const haystack = [
      w.title,
      w.kind,
      w.summary,
      ...(w.topics || []),
      ...(w.methods || [])
    ].join(' ').toLowerCase();

    return categoryMatch &&
      (!state.query || haystack.includes(state.query.toLowerCase()));
  });

  const safeUrl = raw => {
    try {
      const url = new URL(
        raw.startsWith('www.') ? `https://${raw}` : raw
      );

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : null;
    } catch {
      return null;
    }
  };

  function appendLinkedText(parent, text) {
    const regex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/g;
    let cursor = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        parent.append(
          document.createTextNode(text.slice(cursor, match.index))
        );
      }

      let raw = match[0];
      let suffix = '';

      while (/[.,;:)\]]$/.test(raw)) {
        suffix = raw.slice(-1) + suffix;
        raw = raw.slice(0, -1);
      }

      const href = safeUrl(raw);

      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = raw;
        parent.append(a);
      } else {
        parent.append(document.createTextNode(raw));
      }

      if (suffix) {
        parent.append(document.createTextNode(suffix));
      }

      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      parent.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function appendRuns(parent, runs) {
    (runs || []).forEach(run => {
      const node = document.createElement(
        run.bold ? 'strong' : run.italic ? 'em' : 'span'
      );

      if (run.italic && run.bold) {
        const strong = document.createElement('strong');
        const em = document.createElement('em');

        appendLinkedText(em, run.text);
        strong.append(em);
        parent.append(strong);
        return;
      }

      if (run.underline) node.style.textDecoration = 'underline';
      if (run.superscript) node.style.verticalAlign = 'super';
      if (run.subscript) node.style.verticalAlign = 'sub';

      if (run.superscript || run.subscript) {
        node.style.fontSize = '.72em';
      }

      appendLinkedText(node, run.text);
      parent.append(node);
    });
  }

  function renderFullText(item) {
    const holder = $('#reader-content');
    holder.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'full-document';

    const blocks = item.contentBlocks ||
      (item.id === 'forest-cover' ? data.forestText : []);

    if (!blocks.length) {
      const pdf = item.fullTextPdf ||
        (item.download &&
          item.download.toLowerCase().endsWith('.pdf')
          ? item.download
          : null);

      if (pdf) {
        const iframe = document.createElement('iframe');
        iframe.src = documentUrl(pdf);
        iframe.title = 'Full original document';
        iframe.style.cssText =
          'width:100%;height:75vh;border:1px solid #dce5dd;border-radius:4px';

        wrap.append(iframe);
        holder.append(wrap);
        return;
      }

      const p = document.createElement('p');
      p.className = 'summary-copy';

      p.textContent =
        'The complete source text for this piece has not been added to this first website build. Its full text should be inserted from the original document so the wording, paragraph boundaries and formatting remain faithful to the source.';

      wrap.append(p);
    }

    if (item.pageImages && item.pageImages.length) {
      const intro = document.createElement('p');
      intro.className = 'original-layout-note';

      intro.textContent =
        'Original document layout, including figures, tables and captions. The downloadable PDF preserves selectable text.';

      wrap.append(intro);

      item.pageImages.forEach((src, i) => {
        const fig = document.createElement('figure');
        fig.className = 'original-page';

        const img = document.createElement('img');
        img.src = localFilePath(src);
        img.alt = `Original document page ${i + 1}`;
        img.loading = 'lazy';

        fig.append(img);

        const cap = document.createElement('figcaption');
        cap.textContent = `Page ${i + 1}`;

        fig.append(cap);
        wrap.append(fig);
      });

      holder.append(wrap);
      return;
    }

    blocks.forEach(block => {
      if (block.type === 'table') {
        const container = document.createElement('div');
        container.className = 'doc-table-wrap';

        const table = document.createElement('table');
        table.className = 'doc-table';

        (block.rows || []).forEach((cells, i) => {
          const tr = document.createElement('tr');

          cells.forEach(v => {
            const c = document.createElement(i === 0 ? 'th' : 'td');
            c.textContent = v;
            tr.append(c);
          });

          table.append(tr);
        });

        container.append(table);
        wrap.append(container);
        return;
      }

      if (block.type === 'figure') {
        const figure = document.createElement('figure');
        figure.className = 'doc-figure';

        const img = document.createElement('img');
        img.src = localFilePath(block.src);
        img.alt = block.alt || block.caption || 'Research figure';
        img.loading = 'lazy';

        img.addEventListener('click', () => {
          openLightbox(img.src, img.alt);
        });

        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Open figure larger');

        img.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openLightbox(img.src, img.alt);
          }
        });

        figure.append(img);

        if (block.caption) {
          const cap = document.createElement('figcaption');
          cap.textContent = block.caption;
          figure.append(cap);
        }

        wrap.append(figure);
        return;
      }

      if (block.type === 'missing-figure') {
        const figure = document.createElement('aside');
        figure.className = 'doc-figure-missing';

        const icon = document.createElement('span');
        icon.className = 'missing-figure-icon';
        icon.textContent = '▧';

        const msg = document.createElement('p');
        msg.textContent = block.text || 'Original figure not supplied.';

        figure.append(icon, msg);
        wrap.append(figure);
        return;
      }

      let el;

      switch (block.type) {
        case 'title':
          el = document.createElement('h4');
          el.className = 'doc-title';
          break;

        case 'author':
          el = document.createElement('div');
          el.className = 'doc-author';
          break;

        case 'heading':
          el = document.createElement('h5');
          el.className = 'doc-heading';
          break;

        case 'references-heading':
          el = document.createElement('h5');
          el.className = 'doc-heading references-heading';
          break;

        case 'reference':
          el = document.createElement('p');
          el.className = 'doc-reference';
          break;

        default:
          el = document.createElement('p');
          el.className = 'doc-paragraph';
      }

      appendRuns(el, block.runs || [
        { text: block.text || '' }
      ]);

      wrap.append(el);
    });

    holder.append(wrap);
  }

  function openLightbox(src, alt) {
    let box = $('#figure-lightbox');

    if (!box) {
      box = document.createElement('div');
      box.id = 'figure-lightbox';
      box.className = 'figure-lightbox';

      box.innerHTML =
        '<button type="button" class="lightbox-close" aria-label="Close image">×</button><img alt="" /><div class="lightbox-caption"></div>';

      document.body.append(box);

      box.addEventListener('click', e => {
        if (
          e.target === box ||
          e.target.closest('.lightbox-close')
        ) {
          box.classList.remove('open');
        }
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          box.classList.remove('open');
        }
      });
    }

    box.querySelector('img').src = localFilePath(src);
    box.querySelector('img').alt = alt || '';

    box.querySelector('.lightbox-caption').textContent = alt || '';
    box.classList.add('open');
  }

  function renderSummary(item) {
    const holder = $('#reader-content');
    holder.innerHTML = '';

    const p = document.createElement('p');
    p.className = 'summary-copy';
    p.textContent = item.summary || '';

    holder.append(p);

    if (item.researchQuestion) {
      const heading = document.createElement('h4');
      heading.className = 'reader-summary-heading';
      heading.textContent = 'Research question';

      holder.append(heading);

      const question = document.createElement('p');
      question.className = 'summary-copy';
      question.textContent = item.researchQuestion;

      holder.append(question);
    }

    if (item.approach?.length) {
      const heading = document.createElement('h4');
      heading.className = 'reader-summary-heading';
      heading.textContent = 'Approach';

      holder.append(heading);

      const list = document.createElement('ul');
      list.className = 'academic-summary-list';

      item.approach.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        list.append(li);
      });

      holder.append(list);
    }

    if (item.findings?.length) {
      const heading = document.createElement('h4');
      heading.className = 'reader-summary-heading';
      heading.textContent = 'Findings / argument';

      holder.append(heading);

      const list = document.createElement('ul');
      list.className = 'academic-summary-list';

      item.findings.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        list.append(li);
      });

      holder.append(list);
    }

    if (item.featuredFigure) {
      const figure = document.createElement('figure');
      figure.className = 'doc-figure';

      const img = document.createElement('img');
      img.src = localFilePath(item.featuredFigure.src);
      img.alt = item.featuredFigure.caption || '';
      img.loading = 'lazy';

      figure.append(img);

      const cap = document.createElement('figcaption');
      cap.textContent = item.featuredFigure.caption || '';

      figure.append(cap);
      holder.append(figure);
    }

    if (item.methods?.length) {
      const head = document.createElement('h4');
      head.className = 'reader-summary-heading';
      head.textContent = 'Approach & methods';

      holder.append(head);

      const chips = document.createElement('div');
      chips.className = 'method-list';

      item.methods.forEach(m => {
        const c = document.createElement('span');
        c.className = 'method-chip';
        c.textContent = m;
        chips.append(c);
      });

      holder.append(chips);
    }

    if (item.authors) {
      const head = document.createElement('h4');
      head.className = 'reader-summary-heading';
      head.textContent = 'Authorship';

      holder.append(head);

      const ap = document.createElement('p');
      ap.className = 'summary-copy';
      ap.style.fontSize = '12px';
      ap.textContent = item.authors;

      holder.append(ap);
    }

    const msg = document.createElement('div');
    msg.className = 'reader-source-note';

    if (item.id === 'forest-cover') {
      msg.textContent =
        'The full paper is available in this reader. Use “Read full text” to move through the original section and paragraph order, or open the Word document.';

      holder.append(msg);
    } else if (item.id === 'green-hydrogen') {
      msg.textContent =
        'This co-authored article is also available on the Jindal India Institute website.';

      holder.append(msg);
    } else if (item.fullTextPdf) {
      msg.textContent =
        'The complete source document is available in the Read full text tab. It is displayed in its original page sequence so maps, charts, captions and tables stay with the surrounding text.';

      holder.append(msg);
    }
  }

  function renderReaderActions(item) {
    const box = $('#reader-actions');
    box.innerHTML = '';

    const addLink = (
      href,
      label,
      secondary = false,
      download = false
    ) => {
      if (!href) return;

      const a = document.createElement('a');

      a.className = `action-link${secondary ? ' secondary' : ''}`;
      a.href = documentUrl(href);

      if (download) {
        a.setAttribute('download', '');
      }

      if (/^https?:/i.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }

      a.innerHTML =
        `${escapeHtml(label)} <span aria-hidden="true">↗</span>`;

      box.append(a);
    };

    if (
      item.download &&
      item.fullTextPdf &&
      item.download === item.fullTextPdf
    ) {
      addLink(
        item.download,
        item.downloadLabel || 'Open original PDF',
        true,
        false
      );
    } else {
      if (item.download) {
        addLink(
          item.download,
          item.downloadLabel || 'Open original document',
          true,
          true
        );
      }

      if (item.fullTextPdf) {
        addLink(
          item.fullTextPdf,
          'Open formatted PDF in a new tab',
          false,
          false
        );
      }
    }

    if (item.url) {
      addLink(
        item.url,
        item.urlLabel || 'Open original article',
        false,
        false
      );
    }

    if (item.additionalDocument) {
      addLink(
        item.additionalDocument,
        'Open related GIS map document',
        true,
        false
      );
    }

    if (
      !item.download &&
      !item.fullTextPdf &&
      !item.url &&
      !(item.contentBlocks && item.contentBlocks.length) &&
      state.view === 'summary'
    ) {
      const span = document.createElement('span');
      span.className = 'reader-action-hint';
      span.textContent =
        'A full source file has not been added for this item yet.';

      box.append(span);
    }
  }

  function renderPdfDocument(item) {
    const holder = $('#reader-content');
    holder.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'source-pdf-reader';

    const lead = document.createElement('div');
    lead.className = 'pdf-reader-lead';

    const note = document.createElement('p');
    note.textContent =
      'Reading the source document in its original page sequence. Paragraphs, page breaks, maps, figures, captions and tables stay in context.';

    lead.append(note);

    const pdfHref = documentUrl(item.fullTextPdf);

    const link = document.createElement('a');
    link.href = pdfHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'pdf-open-link';
    link.textContent = 'Open PDF in a separate tab ↗';

    lead.append(link);

    if (item.featuredFigure) {
      const figure = document.createElement('figure');
      figure.className = 'doc-figure';

      const image = document.createElement('img');
      image.src = localFilePath(item.featuredFigure.src);
      image.alt =
        item.featuredFigure.caption || 'Original research map';

      image.style.cssText =
        'width:100%;max-height:780px;object-fit:contain;cursor:zoom-in';

      image.addEventListener('click', () => {
        openLightbox(image.src, image.alt);
      });

      figure.append(image);

      if (item.featuredFigure.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.featuredFigure.caption;
        figure.append(caption);
      }

      wrap.append(figure);
    }

    const frame = document.createElement('iframe');
    frame.className = 'source-pdf-frame';
    frame.src = pdfHref;
    frame.title = `Full text: ${item.title}`;
    frame.loading = 'lazy';
    frame.setAttribute('allowfullscreen', 'true');

    wrap.append(lead, frame);
    holder.append(wrap);
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch])
    );
  }

  function renderReader() {
    const panel = $('#reader-panel');
    panel.hidden = !state.readerOpen;

    if (!state.readerOpen) return;

    let item = byId(state.activeId);

    if (!item) {
      const first = visibleWorks()[0];
      if (!first) return;

      item = first;
      state.activeId = item.id;
    }

    $('#selected-kind').textContent = item.kind;
    $('#selected-year').textContent = yearLabel(item).toUpperCase();
    $('#selected-year').hidden = !yearLabel(item);
    $('#selected-title').textContent = item.title;

    $('#selected-authors').textContent =
      item.authors || 'Vanshika Singh';

    const tags = $('#selected-topics');
    tags.innerHTML = '';

    (item.topics || []).forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'topic-tag';
      tag.textContent = t;
      tags.append(tag);
    });

    $('#summary-tab').classList.toggle(
      'active',
      state.view === 'summary'
    );

    $('#summary-tab').setAttribute(
      'aria-selected',
      String(state.view === 'summary')
    );

    $('#fulltext-tab').classList.toggle(
      'active',
      state.view === 'full'
    );

    $('#fulltext-tab').setAttribute(
      'aria-selected',
      String(state.view === 'full')
    );

    const publishedTab = $('#published-article-tab');
    publishedTab.hidden = !item.url;

    if (item.url) {
      publishedTab.href = documentUrl(item.url);

      publishedTab.setAttribute(
        'aria-label',
        'Read published article: ' +
          (item.publishedArticleTitle || item.title)
      );
    }

    if (state.view === 'summary') {
      renderSummary(item);
    } else if (item.pageImages?.length) {
      renderFullText(item);
    } else if (item.fullTextPdf) {
      renderPdfDocument(item);
    } else if (
      item.url &&
      !(item.contentBlocks && item.contentBlocks.length) &&
      !(item.id === 'forest-cover' && data.forestText?.length)
    ) {
      const holder = $('#reader-content');
      holder.innerHTML = '';

      if (
        item.download &&
        item.download.toLowerCase().endsWith('.pdf')
      ) {
        const iframe = document.createElement('iframe');

        iframe.src = documentUrl(item.download);
        iframe.title = 'Full original document';
        iframe.style.cssText =
          'width:100%;height:75vh;border:1px solid #dce5dd;border-radius:4px';

        holder.append(iframe);
      } else {
        const p = document.createElement('p');
        p.className = 'summary-copy';

        p.textContent =
          'The publisher-hosted article is available from the original source. Use the link below to read the complete article.';

        holder.append(p);
      }
    } else {
      renderFullText(item);
    }

    renderReaderActions(item);

    const filtered = visibleWorks();
    const position = filtered.findIndex(w => w.id === item.id);

    $('#reader-position').textContent =
      `${String(Math.max(position + 1, 1)).padStart(2, '0')} / ${String(filtered.length).padStart(2, '0')}`;

    $('#previous-work').disabled = filtered.length < 2;
    $('#next-work').disabled = filtered.length < 2;
  }

  function renderList() {
    const grid = $('#sample-grid');
    grid.innerHTML = '';

    const filtered = visibleWorks();

    $('#work-count').textContent =
      String(filtered.length).padStart(2, '0');

    $('#filter-count').textContent =
      `${filtered.length} ITEM${filtered.length === 1 ? '' : 'S'}`;

    $('#no-results').hidden = filtered.length > 0;

    if (
      state.readerOpen &&
      filtered.length &&
      !filtered.some(w => w.id === state.activeId)
    ) {
      state.activeId = filtered[0].id;
    }

    if (state.readerOpen && !filtered.length) {
      state.readerOpen = false;
      state.activeId = null;
    }

    filtered.forEach((item, index) => {
      const card = document.createElement('article');

      card.className =
        'work-tile' +
        (item.id === state.activeId && state.readerOpen
          ? ' selected'
          : '');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-tile-button';

      button.setAttribute(
        'aria-pressed',
        String(item.id === state.activeId && state.readerOpen)
      );

      button.setAttribute(
        'aria-label',
        `Open ${item.title}`
      );

      const visual = document.createElement('span');

      visual.className =
        'tile-visual' +
        (item.imageFit === 'contain' ? ' image-contain' : '');

      const img = document.createElement('img');

      // Image is loaded directly from the same folder.
      img.src = localFilePath(item.image || '');
      img.alt =
        item.imageAlt || `Visual related to ${item.title}`;

      img.loading = 'lazy';
      img.decoding = 'async';

      img.addEventListener('error', () => {
        img.remove();
        visual.classList.add('image-unavailable');

        const fallback = document.createElement('span');
        fallback.className = 'tile-image-fallback';

        fallback.textContent =
          (item.topics || ['Research'])[0];

        visual.append(fallback);
      }, { once: true });

      const visualRole = document.createElement('span');
      visualRole.className = 'tile-visual-role';

      visualRole.textContent =
        item.imageRole || 'RESEARCH';

      const arrow = document.createElement('span');
      arrow.className = 'tile-open-arrow';

      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';

      visual.append(img, visualRole, arrow);

      const body = document.createElement('span');
      body.className = 'tile-body';

      const meta = document.createElement('span');
      meta.className = 'tile-meta';

      const category = document.createElement('span');
      category.className = 'tile-category';

      category.textContent =
        item.category || item.kind;

      const num = document.createElement('span');
      num.className = 'tile-number';

      num.textContent =
        String(index + 1).padStart(2, '0');

      meta.append(category, num);

      const title = document.createElement('strong');
      title.className = 'tile-title';
      title.textContent = item.title;

      const summary = document.createElement('span');
      summary.className = 'tile-summary';
      summary.textContent = item.summary || '';

      const action = document.createElement('span');
      action.className = 'tile-action';

      action.innerHTML =
        'Open sample <span aria-hidden="true">↗</span>';

      body.append(meta, title, summary, action);
      button.append(visual, body);

      button.addEventListener('click', () => {
        selectWork(item.id, true);
      });

      card.append(button);

      const credit = document.createElement('div');
      credit.className = 'tile-credit';

      if (item.imageSource) {
        const a = document.createElement('a');

        a.href = documentUrl(item.imageSource);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        a.textContent =
          `Image: ${item.imageCredit || 'source'} ↗`;

        credit.append(a);
      } else {
        credit.textContent =
          item.imageCredit ||
          (item.imageRole === 'MAP FROM PAPER'
            ? 'Original map from supplied paper'
            : 'Visual from supplied paper');
      }

      card.append(credit);
      grid.append(card);
    });

    renderReader();
  }

  function selectWork(id, announce) {
    state.activeId = id;
    state.readerOpen = true;
    state.view = 'summary';

    renderList();

    if (announce) {
      requestAnimationFrame(() => {
        $('#reader-panel')?.scrollIntoView({
          behavior: window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    }
  }

  $$('.category-tab').forEach(button =>
    button.addEventListener('click', () => {
      state.category = button.dataset.category;

      $$('.category-tab').forEach(b => {
        const active = b === button;

        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });

      renderList();
    })
  );

  $('#work-search').addEventListener('input', e => {
    state.query = e.target.value.trim();
    renderList();
  });

  $('#summary-tab').addEventListener('click', () => {
    state.view = 'summary';
    renderReader();
  });

  $('#fulltext-tab').addEventListener('click', () => {
    state.view = 'full';
    renderReader();
  });

  function stepWork(direction) {
    const filtered = visibleWorks();
    if (!filtered.length) return;

    let index = filtered.findIndex(
      w => w.id === state.activeId
    );

    index =
      (index + direction + filtered.length) % filtered.length;

    selectWork(filtered[index].id, false);
  }

  $('#previous-work').addEventListener('click', () => {
    stepWork(-1);
  });

  $('#next-work').addEventListener('click', () => {
    stepWork(1);
  });

  $('#close-reader').addEventListener('click', () => {
    state.readerOpen = false;
    state.activeId = null;

    renderList();

    $('#writing-title').scrollIntoView({
      behavior: window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches ? 'auto' : 'smooth',
      block: 'start'
    });
  });

  document.addEventListener('keydown', e => {
    if (
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === 'k'
    ) {
      e.preventDefault();
      $('#work-search').focus();
    }
  });

  const lensCopy = {
    implementation:
      'Reading administrative data alongside field evidence to understand how public programmes reach people.',
    measurement:
      'Checking how definitions, classifications and indicators shape the picture presented by official data.',
    place:
      'Using spatial evidence to understand access, mobility and the differences that location can make.'
  };

  $$('.lens-row').forEach(button =>
    button.addEventListener('click', () => {
      $$('.lens-row').forEach(b =>
        b.classList.toggle('selected', b === button)
      );

      const description = $('#lens-description');

      if (description) {
        description.textContent =
          lensCopy[button.dataset.lens] ||
          lensCopy.implementation;
      }
    })
  );

  const themeCopy = {
    access:
      'I compare official programme data with the experience of people using public services, asking where enrolment, access and real outcomes diverge.',
    environment:
      'I examine how definitions, regulatory frameworks and measurement choices affect the way environmental change is described.',
    spatial:
      'I use maps and spatial analysis to make patterns of proximity, mobility and uneven access easier to see.'
  };

  $$('.theme-pick').forEach(button =>
    button.addEventListener('click', () => {
      $$('.theme-pick').forEach(b =>
        b.classList.toggle('active', b === button)
      );

      $('#theme-copy').textContent =
        themeCopy[button.dataset.theme] ||
        themeCopy.access;
    })
  );

  const courseDescriptions = {
    'Introduction to Public Policy':
      'Foundational ways to understand policy problems, institutions, decision-making and implementation.',

    'Social Foundations of Public Policy':
      'Social and institutional conditions that shape policy choices, access and outcomes.',

    'Gender and Development':
      'Gendered dimensions of development, participation, rights and distributional outcomes.',

    'Program Design and Evaluation':
      'How interventions are framed, designed and assessed, including the role of evidence and evaluation.',

    'Law and Public Policy':
      'The relationship between statutes, legal interpretation, institutions and policy implementation.',

    'Technology, Politics and Society':
      'Questions about technology, power, institutions and the social consequences of technological systems.',

    'Policy Action Lab':
      'Applied policy work focused on analysing a defined problem and communicating practical recommendations.',

    'Environment':
      'Environmental governance, conservation and the policy choices surrounding ecological outcomes.',

    'Energy Efficiency':
      'Policy and institutional questions around energy use and efficiency.',

    'Public Finance':
      'Public revenue, spending, fiscal choices and the financing of public priorities.'
  };

  const courseGrid = $('#course-grid');

  data.courses.forEach((course, i) => {
    const d = document.createElement('details');
    d.className = 'course-card';

    const s = document.createElement('summary');

    const number = document.createElement('span');
    number.className = 'course-number';
    number.textContent =
      String(i + 1).padStart(2, '0');

    const title = document.createElement('span');
    title.className = 'course-title-line';
    title.textContent = course.title;

    const chevron = document.createElement('span');
    chevron.className = 'course-chevron';
    chevron.textContent = '+';

    s.append(number, title, chevron);
    d.append(s);

    const group = document.createElement('div');
    group.className = 'course-group';
    group.textContent = course.group;

    d.append(group);

    const detail = document.createElement('div');
    detail.className = 'course-detail';

    detail.textContent =
      courseDescriptions[course.title] ||
      'Course title supplied by the researcher.';

    d.append(detail);
    courseGrid.append(d);
  });

  const chips = $('#method-chips');

  data.methods.forEach(method => {
    const c = document.createElement('span');
    c.className = 'method-chip';
    c.textContent = method;
    chips.append(c);
  });

  const outputMap = [
    [
      'forest-cover',
      'Forest-cover measurement and conservation law',
      'Environmental measurement · legal analysis'
    ],
    [
      'beedi-workers',
      'Women beedi workers and labour-law protections',
      'Labour regulation · statutory analysis'
    ],
    [
      'crop-residue',
      'Crop residue management in Punjab and Haryana',
      'Comparative policy memo · feasibility assessment'
    ],
    [
      'growth-rajasthan',
      'Growth Analysis of Rajasthan’s Economy',
      'Public data · economic trends'
    ],
    [
      'urban-river',
      'Urban-River Intersections',
      'QGIS · buffer analysis'
    ],
    [
      'evm-perceptions',
      'Voter perceptions of electronic voting machines',
      'Field report · interviews'
    ],
    [
      'urban-forest-memo',
      'Sustainable urbanisation and forest conservation in Rajasthan',
      'Spatial analysis · policy recommendations'
    ]
  ];

  const outputList = $('#course-output-list');

  outputMap.forEach((output, i) => {
    const item = byId(output[0]);
    if (!item) return;

    const row = document.createElement('div');
    row.className = 'course-output';

    const n = document.createElement('span');
    n.className = 'output-n';
    n.textContent =
      String(i + 1).padStart(2, '0');

    const text = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'output-title';
    title.textContent = output[1];

    const desc = document.createElement('div');
    desc.className = 'output-description';
    desc.textContent = output[2];

    text.append(title, desc);

    const link = document.createElement('button');
    link.className = 'output-open';
    link.type = 'button';

    link.setAttribute(
      'aria-label',
      `Open ${output[1]} in writing collection`
    );

    link.textContent = '↗';

    link.addEventListener('click', () => {
      state.category = 'All samples';
      state.query = '';

      $('#work-search').value = '';

      $$('.category-tab').forEach(b => {
        const active =
          b.dataset.category === 'All samples';

        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });

      selectWork(item.id, true);
    });

    row.append(n, text, link);
    outputList.append(row);
  });

  // Mobile navigation
  const menuButton = $('.mobile-menu-toggle');
  const mobileNav = $('#mobile-nav');

  menuButton.addEventListener('click', () => {
    const open =
      menuButton.getAttribute('aria-expanded') !== 'true';

    menuButton.setAttribute(
      'aria-expanded',
      String(open)
    );

    menuButton.setAttribute(
      'aria-label',
      open ? 'Close navigation' : 'Open navigation'
    );

    mobileNav.hidden = !open;
  });

  $$('#mobile-nav a').forEach(a =>
    a.addEventListener('click', () => {
      menuButton.setAttribute(
        'aria-expanded',
        'false'
      );

      menuButton.setAttribute(
        'aria-label',
        'Open navigation'
      );

      mobileNav.hidden = true;
    })
  );

  // Track the current section in the header.
  const navLinks = $$('.main-nav .nav-link');

  if ('IntersectionObserver' in window) {
    const targets = [
      'writing',
      'coursework',
      'about'
    ].map(id => document.getElementById(id)).filter(Boolean);

    const observer = new IntersectionObserver(
      entries => {
        const active = entries
          .filter(e => e.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio
          )[0];

        if (!active) return;

        navLinks.forEach(a =>
          a.classList.toggle(
            'active',
            a.getAttribute('href') === `#${active.target.id}`
          )
        );
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0, .1, .25, .5]
      }
    );

    targets.forEach(t => observer.observe(t));
  }

  renderList();
})();
