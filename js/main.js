/**
 * BizHack AI - Interactive & Performance Scripts
 * Lightweight, zero-dependency, Core Web Vitals friendly
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 読了プログレスバー
  const progressBar = document.getElementById('read-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }
    }, { passive: true });
  }

  // 2. クリップボードコピー共通関数（navigator.clipboard + execCommandフォールバック）
  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => {
        return fallbackCopyText(text);
      });
    } else {
      return fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    return new Promise((resolve, reject) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand failed'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // 2a. 補助関数群：プロンプトテキスト・タイトル抽出 ＆ ChatGPT直接起動
  // プロンプト本文の先頭に読者向けの親切な貼り付けガイドを付与（ChatGPTのAIは#行を注釈として扱うため精度に無影響）
  const PROMPT_GUIDE_HEADER = '# 📋【BizHack AI】貼り付け完了！このまま送信（Enter）してください\n# ----------------------------------------------------------------------\n';

  function attachGuideHeader(rawText) {
    if (!rawText) return '';
    if (rawText.startsWith('# 📋【BizHack AI】')) {
      return rawText;
    }
    return PROMPT_GUIDE_HEADER + rawText;
  }

  function getPromptTextForButton(btn) {
    const rawTarget = btn.getAttribute('data-target') || btn.getAttribute('data-copy-target') || '';
    const targetId = rawTarget.replace(/^#/, '');
    let textToCopy = '';
    let targetElement = null;

    if (targetId) {
      targetElement = document.getElementById(targetId);
      if (targetElement) {
        textToCopy = targetElement.innerText || targetElement.textContent;
      }
    }

    if (!textToCopy) {
      const container = btn.closest('.code-box, .prompt-box, .fv-try-box, .fv-instant-tool, section, div');
      const codeBlock = container?.querySelector('pre, code');
      if (codeBlock) {
        targetElement = codeBlock;
        textToCopy = codeBlock.innerText || codeBlock.textContent;
      }
    }

    return { text: (textToCopy || '').trim(), element: targetElement, targetId: targetId };
  }

  function getPromptTitleForButton(btn, targetId) {
    return (
      btn.closest('.code-box')?.querySelector('.code-title')?.textContent?.trim() ||
      btn.closest('.prompt-box')?.querySelector('.prompt-title')?.textContent?.trim() ||
      btn.closest('.fv-try-box')?.querySelector('.fv-try-title')?.textContent?.trim() ||
      btn.closest('.fv-instant-tool')?.querySelector('.fv-tool-label span')?.textContent?.trim() ||
      targetId ||
      'prompt'
    );
  }

  // ChatGPT起動ステップ案内モーダルの表示関数
  function showLaunchGuidanceModal() {
    let overlay = document.getElementById('bizhack-launch-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bizhack-launch-modal';
      overlay.className = 'bizhack-launch-overlay';
      overlay.innerHTML = `
        <div class="bizhack-launch-card">
          <div class="launch-icon">🚀</div>
          <h3 class="launch-title">ChatGPTを起動しました！</h3>
          <p class="launch-lead">クリップボードにプロンプトがコピーされています</p>
          
          <div class="launch-steps">
            <div class="launch-step-item">
              <span class="step-num">Step 1</span>
              <span class="step-desc">開いたChatGPTの入力欄をクリック</span>
            </div>
            <div class="launch-step-arrow">▼</div>
            <div class="launch-step-item highlight">
              <span class="step-num">Step 2</span>
              <span class="step-desc">キーボードで <strong>【Ctrl + V】</strong>（スマホは長押し貼付）</span>
            </div>
            <div class="launch-step-arrow">▼</div>
            <div class="launch-step-item">
              <span class="step-num">Step 3</span>
              <span class="step-desc"><strong>Enter</strong> を押してAIを実行！</span>
            </div>
          </div>

          <button type="button" class="launch-close-btn" onclick="this.closest('.bizhack-launch-overlay').classList.remove('active');">わかりました！</button>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    }

    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  }

  // クリップボード用テキスト整形（先頭に案内コメントを付与）
  function formatPromptWithGuidance(rawText) {
    if (!rawText) return '';
    const trimmed = rawText.trim();
    if (trimmed.startsWith('# 📋【BizHack AI】') || trimmed.startsWith('/* 📋【BizHack AI】')) {
      return trimmed;
    }
    const guideHeader = '# 📋【BizHack AI】貼り付け完了！このまま送信（Enter）してください\n# --------------------------------------------------\n';
    return guideHeader + trimmed;
  }

  function launchChatGPTWithPrompt(promptText) {
    const ts = Date.now();
    window.open('https://chatgpt.com/', `chatgpt_${ts}`, 'noopener,noreferrer');
    showLaunchGuidanceModal();
  }

  // 2b. プロンプトコピー時のトースト表示関数（ChatGPT直行アクション付き）
  function showPromptCopyToast(copiedText, launchedDirectly) {
    let toast = document.getElementById('prompt-copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'prompt-copy-toast';
      toast.className = 'bizhack-toast';
      document.body.appendChild(toast);
    }

    const currentUrl = encodeURIComponent(window.location.href.split('?')[0] + '?utm_source=twitter&utm_medium=social_share&utm_campaign=prompt_copy');
    const shareText = encodeURIComponent(`【コピペで時短】${document.title.replace('｜BizHack AI', '')}\n#BizHackAI #ChatGPT #業務効率化`);
    const xShareUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${currentUrl}`;

    const msgHtml = launchedDirectly
      ? `<span class="toast-icon">🚀</span><div><strong>プロンプトをコピーしました！</strong><br><span style="color:#38bdf8;font-size:0.8rem;font-weight:600;">ChatGPTで【Ctrl+V】（スマホは長押し貼付）で実行！</span></div>`
      : `<span class="toast-icon">✓</span><div><strong>プロンプトをコピーしました！</strong><br><span style="color:#94a3b8;font-size:0.75rem;">ChatGPTの入力欄に貼り付けて使えます</span></div>`;

    let actionBtnHtml = '';
    if (!launchedDirectly && copiedText) {
      actionBtnHtml = `
        <button type="button" class="toast-chatgpt-btn" id="toast-chatgpt-action">
          🚀 ChatGPTで開く
        </button>
      `;
    }

    toast.innerHTML = `
      <div class="toast-msg">
        ${msgHtml}
      </div>
      <div class="toast-actions">
        ${actionBtnHtml}
        <a href="${xShareUrl}" target="_blank" rel="noopener noreferrer" class="toast-share-btn" onclick="if(typeof gtag==='function'){gtag('event','social_share_click',{platform:'x_toast',article_title:document.title});}">
          𝕏 でシェア
        </a>
        <button type="button" class="toast-close-btn" aria-label="閉じる" onclick="this.closest('.bizhack-toast').classList.remove('show');">✕</button>
      </div>
    `;

    if (actionBtnHtml) {
      const gptAction = toast.querySelector('#toast-chatgpt-action');
      if (gptAction) {
        gptAction.addEventListener('click', () => {
          if (typeof gtag === 'function') {
            gtag('event', 'chatgpt_copy_launch', {
              article_path: window.location.pathname,
              article_title: document.title,
              source: 'toast_action'
            });
          }
          launchChatGPTWithPrompt(copiedText);
          toast.classList.remove('show');
        });
      }
    }

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      if (toast) toast.classList.remove('show');
    }, 6000);
  }

  // 2c. コピペボタン ＆ 「🚀 ChatGPTではめ込み実行」ボタンの動的生成・リスナー設定
  const copyButtons = document.querySelectorAll('.copy-btn, .fv-copy-btn, [data-copy-target]');
  copyButtons.forEach(btn => {
    // 既存ボタンの隣に「🚀 ChatGPTではめ込み実行」ボタンを自動配置
    const parentHeader = btn.parentElement;
    if (parentHeader && !parentHeader.querySelector('.chatgpt-direct-btn')) {
      const gptBtn = document.createElement('button');
      gptBtn.type = 'button';
      gptBtn.className = 'chatgpt-direct-btn';
      if (btn.classList.contains('fv-copy-btn')) {
        gptBtn.classList.add('fv-chatgpt-btn');
      }
      gptBtn.innerHTML = '🚀 コピーしてChatGPTを開く';
      gptBtn.title = 'プロンプトをコピーして別タブでChatGPTを開きます（あとは貼り付けるだけ！）';

      let group = parentHeader.querySelector('.prompt-btn-group');
      if (!group) {
        group = document.createElement('div');
        group.className = 'prompt-btn-group';
        btn.parentNode.insertBefore(group, btn);
        group.appendChild(btn);
      }
      group.appendChild(gptBtn);

      // ChatGPT直接はめ込み実行ボタンのクリックイベント
      gptBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const data = getPromptTextForButton(btn);
        if (data.text) {
          const originalGptHtml = gptBtn.innerHTML;
          gptBtn.innerHTML = '✓ コピー＆起動中...';

          // クリップボードにもコピー（万が一のバックアップ）
          copyTextToClipboard(formatPromptWithGuidance(data.text)).catch(() => {});

          // GA4イベント送信
          if (typeof gtag === 'function') {
            const promptTitle = getPromptTitleForButton(btn, data.targetId);
            gtag('event', 'chatgpt_copy_launch', {
              article_path: window.location.pathname,
              article_title: document.title,
              prompt_id: data.targetId || 'inline',
              prompt_title: promptTitle
            });
            gtag('event', 'prompt_copy', {
              article_path: window.location.pathname,
              article_title: document.title,
              prompt_id: data.targetId || 'inline',
              prompt_title: promptTitle,
              launch_method: 'direct_chatgpt'
            });
          }

          // ChatGPT起動 ＆ トースト表示
          launchChatGPTWithPrompt(data.text);
          showPromptCopyToast(data.text, true);

          setTimeout(() => {
            gptBtn.innerHTML = originalGptHtml;
          }, 2500);
        }
      });
    }

    // 既存のコピーボタンの処理
    btn.addEventListener('click', () => {
      const data = getPromptTextForButton(btn);
      if (data.text) {
        const originalText = btn.innerHTML;
        const originalBg = btn.style.backgroundColor;
        const originalColor = btn.style.color;

        copyTextToClipboard(formatPromptWithGuidance(data.text)).then(() => {
          btn.innerHTML = '✓ コピー完了！';
          btn.style.backgroundColor = '#059669';
          btn.style.color = '#ffffff';

          // GA4 カスタムイベント送信: prompt_copy
          if (typeof gtag === 'function') {
            const promptTitle = getPromptTitleForButton(btn, data.targetId);
            gtag('event', 'prompt_copy', {
              article_path: window.location.pathname,
              article_title: document.title,
              prompt_id: data.targetId || 'inline',
              prompt_title: promptTitle,
              launch_method: 'clipboard_copy'
            });
          }

          // トースト表示（ChatGPT直行ボタン付き）
          try {
            showPromptCopyToast(data.text, false);
          } catch (e) {
            console.warn('Toast display failed:', e);
          }

          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = originalBg;
            btn.style.color = originalColor;
          }, 2000);
        }).catch(err => {
          console.error('コピー失敗:', err);
          if (data.element) {
            const range = document.createRange();
            range.selectNodeContents(data.element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }
          btn.innerHTML = '選択完了（Ctrl+Cでコピー）';
          setTimeout(() => {
            btn.innerHTML = originalText;
          }, 3000);
        });
      }
    });
  });
  // 3. 自動目次（TOC）のアクティブ追従ハイライト
  const tocLinks = document.querySelectorAll('.toc-list a');
  if (tocLinks.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          tocLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.style.fontWeight = '700';
              link.style.color = '#2563eb';
            } else {
              link.style.fontWeight = '';
              link.style.color = '';
            }
          });
        }
      });
    }, { rootMargin: '0px 0px -70% 0px' });

    document.querySelectorAll('.article-content h2, .article-content h3, article h2, article h3').forEach(heading => {
      if (heading.id) {
        observer.observe(heading);
      }
    });
  }

  // 4. カテゴリー別クイック絞り込みタブ（動的件数カウント ＆ ロードマップ連携対応）
  const filterTabs = document.querySelectorAll('.filter-tab');
  const articleCards = document.querySelectorAll('.articles-grid .article-card');
  const filterHint = document.getElementById('filter-hint');
  const roadmapFilterBtns = document.querySelectorAll('.roadmap-filter-btn');

  if (filterTabs.length > 0 && articleCards.length > 0) {
    const counts = { all: articleCards.length, beginner: 0, routine: 0, data: 0, automate: 0 };
    articleCards.forEach(card => {
      const cat = card.getAttribute('data-category');
      if (cat && counts[cat] !== undefined) {
        counts[cat]++;
      }
    });

    // タブ内の件数バッジを実数で自動更新
    filterTabs.forEach(tab => {
      const filterKey = tab.getAttribute('data-filter');
      const badge = tab.querySelector('.tab-badge');
      if (badge && filterKey && counts[filterKey] !== undefined) {
        badge.textContent = filterKey === 'all' ? `全${counts.all}弾` : `${counts[filterKey]}本`;
      }
    });

    // ロードマップボタン内の件数テキストも自動更新
    roadmapFilterBtns.forEach(btn => {
      const filterKey = btn.getAttribute('data-filter');
      if (filterKey && counts[filterKey] !== undefined) {
        btn.textContent = `この分野の記事を見る（${counts[filterKey]}本） ↓`;
      }
    });

    const hintMessages = {
      all: `※お探しの業務領域・職種に合わせて瞬時に切り替えられます（全${counts.all}弾を表示中）`,
      beginner: `🔰 超入門・安心活用向け（ChatGPT基本操作・職場安全ルール・情報収集・職歴作成など ${counts.beginner}本）を表示中`,
      routine: `✉️ 日常実務・文書向け（メール作成・議事録・パワポ構成・契約書要約など ${counts.routine}本）を表示中`,
      data: `📊 Excel・データ集計・経理向け（関数丸投げ・PDF仕訳・スプシ集計・個人経理など ${counts.data}本）を表示中`,
      automate: `⚙️ 自動化・自作Webツール向け（GAS自動化・Office Copilot・社内Webアプリ自作など ${counts.automate}本）を表示中`
    };

    function applyFilter(targetFilter, scrollToFeatured = false) {
      // タブのアクティブ切り替え
      filterTabs.forEach(t => {
        if (t.getAttribute('data-filter') === targetFilter) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      // ヒント文の更新
      if (filterHint && hintMessages[targetFilter]) {
        filterHint.textContent = hintMessages[targetFilter];
      }

      // 記事カードの表示/非表示およびアニメーション
      articleCards.forEach(card => {
        const category = card.getAttribute('data-category');
        card.classList.remove('is-animating');

        if (targetFilter === 'all' || category === targetFilter) {
          card.classList.remove('is-hidden');
          requestAnimationFrame(() => {
            card.classList.add('is-animating');
          });
        } else {
          card.classList.add('is-hidden');
        }
      });

      // スクロール処理
      if (scrollToFeatured) {
        const featuredSection = document.getElementById('featured');
        if (featuredSection) {
          const headerOffset = 80;
          const elementPosition = featuredSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    }

    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetFilter = tab.getAttribute('data-filter');
        applyFilter(targetFilter, false);
      });
    });

    // ロードマップからの連携トリガー
    roadmapFilterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetFilter = btn.getAttribute('data-filter');
        applyFilter(targetFilter, true);
      });
    });
  }

  // 5. GA4 カスタムイベント計測: アフィリエイト広告クリック (affiliate_click) & 関連記事回遊 (internal_circulation_click)
  const affiliateLinks = document.querySelectorAll('a[rel*="nofollow"]');
  affiliateLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (typeof gtag === 'function') {
        const imgAlt = link.querySelector('img')?.getAttribute('alt') || '';
        const label = (link.textContent || imgAlt || link.href).trim().replace(/\s+/g, ' ').slice(0, 100);
        const placement = link.closest('.article-sidebar') ? 'sidebar' : 'in_article';
        gtag('event', 'affiliate_click', {
          article_path: window.location.pathname,
          article_title: document.title,
          link_url: link.href,
          link_label: label,
          placement: placement
        });
      }
    });
  });

  const relatedLinks = document.querySelectorAll('.related-article-card, .quick-start-link, .step-up-link, .fv-quick-btn');
  relatedLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (typeof gtag === 'function') {
        let component = 'related_articles_box';
        if (link.classList.contains('quick-start-link')) component = 'quick_start_banner';
        else if (link.classList.contains('step-up-link')) component = 'in_article_step_up';
        else if (link.classList.contains('fv-quick-btn')) component = 'fv_quick_jump';
        gtag('event', 'internal_circulation_click', {
          from_path: window.location.pathname,
          to_url: link.getAttribute('href') || '',
          component: component
        });
      }
    });
  });

  // 6. 動的サイドバー生成（案A × 案B ハイブリッド方式）
  // window.BIZHACK_ARTICLES マスターから「最新5選 ＋ 現在閲覧中ハイライト ＋ 全記事一覧導線」を自動描画
  const sidebarContainer = document.getElementById('sidebar-latest-articles') || document.querySelector('.sidebar-card[data-dynamic="articles"]');
  if (sidebarContainer && Array.isArray(window.BIZHACK_ARTICLES) && window.BIZHACK_ARTICLES.length > 0) {
    const articles = window.BIZHACK_ARTICLES;
    const currentPath = window.location.pathname;
    const currentFileMatch = currentPath.match(/article-(\d+)\.html/);
    const currentId = currentFileMatch ? parseInt(currentFileMatch[1], 10) : null;

    const totalCount = articles.length;
    const top5 = articles.slice(0, 5);
    const isInTop5 = currentId ? top5.some(a => a.id === currentId) : false;

    let itemsHtml = '';
    top5.forEach(art => {
      const isCurrent = (art.id === currentId);
      if (isCurrent) {
        itemsHtml += `
          <div class="recent-article-item is-current">
            <div class="item-meta">
              <span>第${art.id}弾（閲覧中）</span>
              ${art.isNew ? '<span class="sidebar-badge-new">NEW</span>' : ''}
            </div>
            <a href="${art.url}">${art.title}</a>
          </div>`;
      } else {
        itemsHtml += `
          <div class="recent-article-item">
            <div class="item-meta">
              <span>第${art.id}弾</span>
              ${art.isNew ? '<span class="sidebar-badge-new">NEW</span>' : ''}
              <span>${art.date ? '・' + art.date : ''}</span>
            </div>
            <a href="${art.url}">${art.title}</a>
          </div>`;
      }
    });

    // もし現在閲覧中の記事がトップ5圏外（過去記事）の場合、セパレーターを挟んで現在記事を表示
    if (currentId && !isInTop5) {
      const currentArt = articles.find(a => a.id === currentId);
      if (currentArt) {
        itemsHtml += `
          <div class="sidebar-divider" style="display:flex; align-items:center; gap:0.5rem; margin:0.6rem 0; font-size:0.72rem; color:var(--text-muted, #94a3b8);">
            <span style="flex:1; border-top:1px dashed var(--border-color, #cbd5e1);"></span>
            <span>現在閲覧中の記事</span>
            <span style="flex:1; border-top:1px dashed var(--border-color, #cbd5e1);"></span>
          </div>
          <div class="recent-article-item is-current">
            <div class="item-meta">
              <span>第${currentArt.id}弾（閲覧中）</span>
            </div>
            <a href="${currentArt.url}">${currentArt.title}</a>
          </div>`;
      }
    }

    sidebarContainer.innerHTML = `
      <div class="sidebar-title">
        <span>最新おすすめ記事</span>
        <span style="font-size:0.75rem; color:var(--text-muted, #64748b); font-weight:normal;">全${totalCount}弾</span>
      </div>
      <div class="sidebar-articles-list">
        ${itemsHtml}
      </div>
      <div class="sidebar-cta-wrap" style="margin-top:0.85rem; padding-top:0.75rem; border-top:1px dashed var(--border-color, #e2e8f0);">
        <a href="index.html#featured" class="sidebar-all-articles-btn">
          全${totalCount}弾の実践特集一覧を見る →
        </a>
      </div>
    `;
  }

  // 動的サイドバー・トップ最新枠・お知らせバーへの回遊クリック計測追加
  const extraCirculationLinks = document.querySelectorAll('#sidebar-latest-articles a, .latest-card a, .announcement-bar-link, .related-articles-box a:not(.related-article-card)');
  extraCirculationLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (typeof gtag === 'function') {
        let component = 'other_internal_link';
        if (link.closest('#sidebar-latest-articles')) component = 'sidebar_latest_articles';
        else if (link.closest('.latest-card')) component = 'index_latest_pickup';
        else if (link.classList.contains('announcement-bar-link')) component = 'announcement_bar';
        else if (link.closest('.related-articles-box')) component = 'related_articles_box';
        gtag('event', 'internal_circulation_click', {
          from_path: window.location.pathname,
          to_url: link.getAttribute('href') || '',
          component: component
        });
      }
    });
  });

  // 6. 記事末尾の「ワンクリック共有＆保存バー」動的生成
  renderArticleShareBox();

  function renderArticleShareBox() {
    // 記事ページ（.article-content）が存在する場合のみ描画
    const articleContent = document.querySelector('.article-content');
    const relatedBox = document.querySelector('.related-articles-box');
    if (!articleContent || !relatedBox) return;

    if (document.getElementById('article-share-box')) return;

    const pageUrl = window.location.href.split('?')[0];
    const pageTitle = document.title.replace('｜BizHack AI', '').trim();

    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle + '\n#BizHackAI #ChatGPT #業務効率化')}&url=${encodeURIComponent(pageUrl + '?utm_source=twitter&utm_medium=social_share&utm_campaign=bottom_share')}`;
    const hatenaUrl = `https://b.hatena.ne.jp/entry/${encodeURIComponent(pageUrl)}`;
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl + '?utm_source=line&utm_medium=social_share&utm_campaign=bottom_share')}`;

    const shareBox = document.createElement('section');
    shareBox.id = 'article-share-box';
    shareBox.className = 'article-share-box';
    shareBox.setAttribute('aria-label', 'この記事をシェア・保存する');

    shareBox.innerHTML = `
      <div class="share-box-header">
        <div class="share-box-title">
          <span>📢</span>
          <span>この記事を役立てる・保存する</span>
        </div>
        <span class="share-box-subtitle">社内共有・ブックマーク・SNSシェアにどうぞ</span>
      </div>
      <div class="share-buttons-grid">
        <a href="${xUrl}" target="_blank" rel="noopener noreferrer" class="share-btn btn-x" onclick="if(typeof gtag==='function'){gtag('event','social_share_click',{platform:'x_bottom',article_title:document.title});}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          𝕏 でポスト
        </a>
        <a href="${hatenaUrl}" target="_blank" rel="noopener noreferrer" class="share-btn btn-hatena" onclick="if(typeof gtag==='function'){gtag('event','social_share_click',{platform:'hatena',article_title:document.title});}">
          <strong style="font-family:serif; font-size:1rem; line-height:1;">B!</strong>
          はてブに追加
        </a>
        <a href="${lineUrl}" target="_blank" rel="noopener noreferrer" class="share-btn btn-line" onclick="if(typeof gtag==='function'){gtag('event','social_share_click',{platform:'line',article_title:document.title});}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.026c-.053.303-.242 1.185 1.039.646 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.572-3.844 2.572-5.99"/></svg>
          LINEで送る
        </a>
        <button type="button" class="share-btn btn-copy" id="share-copy-url-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>URLをコピー</span>
        </button>
      </div>
    `;

    // 関連記事の手前に挿入
    relatedBox.parentNode.insertBefore(shareBox, relatedBox);

    // URLコピーボタンの動作
    const copyBtn = document.getElementById('share-copy-url-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const originalHtml = copyBtn.innerHTML;
        const originalBg = copyBtn.style.backgroundColor;
        copyTextToClipboard(pageUrl).then(() => {
          copyBtn.innerHTML = '<span>✓ コピー完了！</span>';
          copyBtn.style.backgroundColor = '#059669';
          if (typeof gtag === 'function') {
            gtag('event', 'social_share_click', { platform: 'url_copy', article_title: document.title });
          }
          setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
            copyBtn.style.backgroundColor = originalBg;
          }, 2000);
        }).catch(err => {
          console.error('URLコピー失敗:', err);
          prompt('以下のURLをコピーしてください:', pageUrl);
        });
      });
    }
  }

  // 7. 編集部デスクエール（今日のささやかな一言・ページ更新＆リロード毎にランダム切り替え / 全100パターン）
  const deskCheerText = document.getElementById('desk-cheer-text');

  if (deskCheerText) {
    const cheerMessages = [
      // 1-10
      "完璧な100点より、まずは動く60点。残りの40点はAIと一緒に後からのんびり埋めれば大丈夫ですよ。",
      "今日やらなくていい仕事は、堂々と明日に回しましょう。あなたの健康と睡眠より締め切りが優先される仕事なんてありません。",
      "抱え込みすぎていませんか？ 誰かやツールに頼ることは「甘え」ではなく、立派な「業務効率化」です。",
      "キーボードから少し手を離して、深呼吸をひとつ。いまのあなたの毎日の頑張りは、誰かにしっかり届いています。",
      "真面目な人ほど一人で全部やろうとして疲れてしまうもの。今日くらいは「これAIに丸投げしちゃお」でいいんです。",
      "全部を自分の手で作り上げる必要はありません。巨人の肩（AI）には、遠慮なくドカンと乗っかりましょう。",
      "メールの文面で3分以上悩んだら、AIに下書きを頼む合図。推敲は30秒で終わらせて、早く次の仕事へ行きましょう。",
      "複雑なExcel数式と1時間格闘する前に、プロンプトに貼り付けて「この式直して」と聞いてみてください。3秒で解決します。",
      "会議の議事録は要約AIに任せてしまいませんか？ 人間は「次のアクションを決めること」に頭を使いましょう。",
      "資料作成の白紙スライドで手が止まったら、構成案だけでもAIに出させましょう。ゼロから書くより10倍楽になります。",
      // 11-20
      "AIはあなたの仕事を奪う敵ではなく、愚痴も言わずに手伝ってくれる「24時間スタンバイの頼れる後輩」です。",
      "毎日繰り返しているそのコピペ作業、もしかしたらワンクリックで自動化できるかもしれませんよ。",
      "「自分の言葉」にこだわりすぎなくて大丈夫。AIにたたき台を作らせて、最後にあなたの体温を1行足すだけで最高のアウトプットになります。",
      "「最新版_確定_最終_本当に最終.xlsx」……そのファイル名、栞も痛いほどよくわかります（笑）。今日も本当にお疲れ様です。",
      "「共有フォルダのどこにあるかわからない問題」、あれは現代の迷宮です。見つからなくても自分を責めないでくださいね。",
      "カタカナだらけのアジェンダにうんざりしていませんか？ 難しそうな用語も、AIに「小学生向けに解説して」で一発解決です。",
      "「急ぎで！」と言われた依頼に限って、相手は明日まで読まない説。焦らず自分のペースで進めましょう。",
      "PCの再起動待ち時間は、神様がくれた合法的な休憩タイムです。思いっきり背伸びして窓の外を眺めましょう。",
      "おはようございます！ 今日の目標は「無事に定時を迎えること」で満点。気負わずマイペースでいきましょう。",
      "お昼休みはちゃんと画面から離れられましたか？ 美味しいランチを食べて、午後のエネルギーをチャージしましょう。",
      // 21-30
      "午後2時の魔の眠気タイム。無理して集中しようとせず、軽いストレッチや単純作業で上手にやり過ごしましょう。",
      "夕方まで走り抜いたあなた、本当にお疲れ様です！ 今日のタスクはここまでにして、帰り道の美味しいものを考えませんか？",
      "日が暮れてきました。そろそろPCを閉じる準備を。会社を一歩出たら、仕事のことは忘れて自分の時間を楽しみましょう。",
      "今日も一日、誰にも見えないところでたくさんの調整と気遣い、お疲れ様でした。今夜はあたたかいお風呂に入ってぐっすり休んでくださいね。",
      "金曜夕方の「ちょっといいですか？」は全デスクワーカーの天敵。笑顔で「週明けイチで確認しますね！」とかわして早く帰りましょう。",
      "何を決めるでもない長時間の定例会議、本当にお疲れ様でした。AIを使った新しい効率化の作戦タイムにしちゃいましょう。",
      "お気に入りのマグカップに温かい飲み物を淹れましたか？ まずは一口飲んでから、最初の一歩を踏み出しましょう。",
      "「できない」と言う勇気もプロの技術。キャパシティを超えた依頼は、丁寧にお断りするか納期を延ばしてもらいましょう。",
      "人は誰でも午前中は頭が冴え、午後は疲れる生き物です。ペース配分を間違えた自分を責める必要はありません。",
      "「念のため確認」のメールを打つ前に一呼吸。AIに「角の立たない簡潔な文面」を作らせてサクッと送りましょう。",
      // 31-40
      "不機嫌な人が職場にいても、それは相手の課題であってあなたの責任ではありません。心の境界線をしっかり引きましょう。",
      "難しいタスクは、サイコロステーキのように細かく切り刻むこと。1ミリでも進んだら自分に大きな花丸をあげてください。",
      "誰も褒めてくれない地味な入力作業。でも、その正確さに助けられている人が必ずいます。見ている人は見ていますよ。",
      "エクセルのセル結合で怒られたこと、誰にでも一度はあります。失敗はAIに正しいやり方を聞けば全部スキルに化けます。",
      "「とりあえずボールを相手に返す」。完璧な返事を用意するより、「受領しました、明日確認します」の1行で相手も安心します。",
      "100通溜まった未読メール、本当に今日読まなきゃいけないものは3通くらいです。まずは深呼吸して優先度をつけましょう。",
      "「これ、前にも教えたよね？」と言われて凹んだら、AIにコピペして「いつでも確認できる自分専用マニュアル」を作っちゃいましょう。",
      "プレゼン資料は「見た目の綺麗さ」より「言いたいことが1つ伝わるか」。AIにスライド構成を作らせれば迷いません。",
      "あなたの代わりは職場にいても、あなたの人生の代わりはいません。会社より自分自身を一番大切にしてください。",
      "忙しいときほど、椅子に深く腰掛けて肩甲骨を寄せてみてください。姿勢を正すだけで呼吸が深くなり、頭がスッキリします。",
      // 41-50
      "「何か質問ある？」と聞かれて思い浮かばなくても大丈夫。AIに「この議題で聞いておくべき論点」をこっそり聞いてみましょう。",
      "お礼のメール1通に15分かけるのは今日で卒業。「感謝と今後のアクション」をAIに箇条書きで投げて30秒で完成させましょう。",
      "職場の人間関係は「適度な距離感」が一番の処方箋。みんなと無理に仲良くならなくても、仕事が回れば100点満点です。",
      "月曜日の朝はエンジンがかからなくて当たり前。助走期間だと思って、午前中は簡単なルーティン作業から始めましょう。",
      "急な仕様変更や理不尽な差し戻しに遭ったら、「まあ、お給料分は働いたし」と心の中でつぶやいて受け流しましょう。",
      "契約書や規程集の難解な文章は、人間が読むように書かれていません。AIに「要するにどういうこと？」と翻訳させましょう。",
      "デスクの上に小さな癒やし（好きなお菓子、お気に入りの文房具）はありますか？ 自分へのご褒美はこまめに用意しましょう。",
      "「自分がやらなきゃ職場が回らない」と思ったら、少し休んでみてください。意外と職場はなんとかなるものです。",
      "提案書が通らなくても、あなたの人間性が否定されたわけではありません。切り口を変えてAIと一緒に再チャレンジしましょう。",
      "誰かのミスをフォローした優しいあなた。その優しさは巡り巡って、いつか必ずあなたを救ってくれます。",
      // 51-60
      "「ちょっと雑談」のつもりが1時間経っていた……そんな日もあります。人間関係の潤滑油代だと思って気にしないでおきましょう。",
      "仕事の納期は「自分が思っている1.5倍」で伝えるのが大人の知恵。早く終われば喜ばれ、遅れても焦りません。",
      "パソコンのブルーライト、思っている以上に目を疲れさせています。1時間に一度は5メートル先をぼんやり眺めましょう。",
      "長文のPDFを読むのに疲れたら、AIに投げて「3行で要約して」とお願いしましょう。概要を掴んでから読めば疲れ激減です。",
      "「すみません」を「ありがとうございます」に言い換えるだけで、職場の空気も自分の気分もぐっと明るくなります。",
      "どんなに仕事ができる人でも、最初はみんな新人でミスばかりしていました。焦らず一歩ずつ経験を積み上げましょう。",
      "集中力が切れたら、それは脳が「糖分か水分をくれ」と出しているサイン。チョコをひとかけ口に入れてひと息つきましょう。",
      "社内チャットの絵文字リアクションは、業務を円滑にする最強の時短ツール。文字を打たずにスタンプ1つで済ませましょう。",
      "業務マニュアルは読むものではなく、AIに学習させて「質問したら答えてくれるコンシェルジュ」にする時代です。",
      "今日の失敗は、来年の今頃には居酒屋の良い笑い話になっています。引きずらずに美味しいご飯を食べて忘れましょう。",
      // 61-70
      "退勤時間の5分前に新しいタスクに着手するのは禁止。明日のToDoを付箋に書いて、パソコンをスリープにしましょう。",
      "「AIを使いこなせないと取り残される？」そんな不安は不要です。検索感覚で日本語で話しかけるだけで十分使いこなせています。",
      "朝の通勤電車を乗り切っただけで、今日の仕事の半分は終わったようなもの。自分をたくさん褒めてあげてください。",
      "上司の機嫌が悪いのは天気の雨と同じ。傘を差して濡れないようにやり過ごすのが正解です。",
      "「自分の強みがわからない」と悩んだら、同僚に感謝された些細な瞬間を思い出してください。それがあなたの立派な武器です。",
      "スプレッドシートの関数エラー（#N/A, #VALUE!）で頭を抱えたら、エラー文ごとAIに貼れば一瞬で修正してくれます。",
      "休日は仕事の連絡通知をオフにしましょう。オンとオフの切り替えができる人ほど、平日のパフォーマンスも高くなります。",
      "「完璧な企画」を1ヶ月練るより、「そこそこの企画」をAIと半日で作って上司に壁打ちする方が10倍早く進みます。",
      "デスクの引き出しに忍ばせたお菓子は、大人の合法的なMP回復ポーションです。堂々とチャージしましょう。",
      "残業をしている人が偉いわけではありません。効率よく仕事を終わらせて定時で帰るあなたの方がずっとスマートです。",
      // 71-80
      "誰かの愚痴に付き合わされそうになったら、笑顔で「あ、次の打ち合わせの準備が！」とフェードアウトしましょう。",
      "資料のフォントや余白で1時間悩むのはやめましょう。デザインはテンプレートとAIに任せて、内容で勝負です。",
      "仕事で一番大事なスキルは、実は「適当に息を抜くこと」。息が抜けない人は、いつか酸欠になって倒れてしまいます。",
      "「これ、どうやってやるんだっけ？」と検索窓を何往復もする前に、AIに状況をそのまま話した方が早いですよ。",
      "締め切り直前にPCがフリーズしても、泣かないで。深呼吸して再起動。失われた作業はAIと爆速でリカバリーできます。",
      "今週も折り返し地点を過ぎました。ここまで頑張ってきた自分に、今夜は好きなお酒やスイーツをプレゼントしましょう。",
      "「自分の仕事に意味があるのか」と悩んだら、目の前の一つのタスクを丁寧に終わらせるだけで十分尊いことです。",
      "メールのCCにたくさん入っているからといって、全員が読んでいるわけではありません。気楽にいきましょう。",
      "お風呂上がりのストレッチは、デスクワークで固まった肩と腰を救う最高の習慣。今夜はゆっくり湯船に浸かりましょう。",
      "相手の言っていることが理解できないときは、相手の説明不足の確率が大。恥ずかしがらずに「具体例をいただけますか？」と聞き返しましょう。",
      // 81-90
      "新しいツールを使うときは、最初から全部覚えようとせず「これ1つだけ便利になればいい」から始めればOKです。",
      "会社の看板ではなく、あなたという個人が持っているスキルと経験こそが一番の財産。AIはその財産を増やす相棒です。",
      "挨拶をしっかり交わすだけで、職場の摩擦の8割は防げます。笑顔で「お疲れ様です」が言えたら今日も合格点。",
      "「自分は要領が悪い」なんて思わないで。丁寧に物事と向き合えることは、AI時代にますます価値を持つ素晴らしい才能です。",
      "アイデアが何も浮かばないときは、脳が疲れている証拠。散歩するか、AIに「面白い切り口を10個出して」と壁打ちしましょう。",
      "不安なことは紙に書き出すと、頭の外に吐き出されてスッキリします。悩みは頭の中で飼い慣らさないこと。",
      "ランチの後のコーヒーの香り、楽しめましたか？ 五感を動かすささやかな瞬間が、午後の集中力を支えてくれます。",
      "取引先への催促メール、気まずいですよね。角が立たない優しい言い回しは、AIに丸投げして作ってもらいましょう。",
      "「定時で帰るなんて申し訳ない」という罪悪感はゴミ箱へ。あなたの時間はあなた自身のものです。",
      "今日できたことが1つしかなかったとしても、ゼロより1歩進んでいます。明日はまた新しい日。",
      // 91-100
      "誰かと自分を比べる必要は1ミリもありません。昨日の自分より1分早く仕事が終われば、それだけで大勝利です。",
      "嫌なことがあった日は、帰り道に夜空を見上げてみてください。宇宙の広さに比べたら、職場のトラブルなんて豆粒です。",
      "スマホの充電と同じで、人間の気力も充電が必要です。週末は罪悪感ゼロで思いっきりゴロゴロしましょう。",
      "面倒な社内アンケートや日報の文章作成、AIに箇条書きを渡して「体裁を整えて」で一瞬で終わらせましょう。",
      "「自分ばかり損している」と感じたら、少し仕事をセーブするサイン。いつも全力疾走しなくていいんです。",
      "明日の自分を信じて、今日のところは早めに布団に入りましょう。たっぷりの睡眠が明日のあなたを無敵にします。",
      "困ったときは周りに「助けて」と言っていいんです。助けを求められる人は、周りからも信頼される強い人です。",
      "どんなにAIが進化しても、あなたの「気遣い」や「体温」の代わりにはなれません。誇りを持って仕事に向き合いましょう。",
      "いつも家族のため、会社のため、誰かのために頑張っているあなた。世界で一番あなたを大切にできるのは、あなた自身です。",
      "さあ、今日も無事にここまで乗り切りました！ 画面を閉じて、肩の力を抜いて。今日も一日、本当にお疲れ様でした。"
    ];

    // 直前と同じメッセージが連続しないようセッションストレージ等で制御
    const lastIndex = parseInt(sessionStorage.getItem('lastDeskCheerIndex') || '-1', 10);
    let newIndex = Math.floor(Math.random() * cheerMessages.length);
    if (cheerMessages.length > 1 && newIndex === lastIndex) {
      newIndex = (newIndex + 1) % cheerMessages.length;
    }
    sessionStorage.setItem('lastDeskCheerIndex', newIndex.toString());
    deskCheerText.textContent = cheerMessages[newIndex];
  }

  // 8. 今後の発行予定タイムラインの動的ステータス判定（日付連動自動繰り上がり）
  const upcomingTimeline = document.getElementById('upcoming-timeline');
  if (upcomingTimeline && window.BIZHACK_UPCOMING_ARTICLES) {
    try {
      const now = new Date();
      const jstFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = jstFormatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      const todayStr = `${year}-${month}-${day}`;

      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tParts = jstFormatter.formatToParts(tomorrow);
      const tomorrowStr = `${tParts.find(p => p.type === 'year').value}-${tParts.find(p => p.type === 'month').value}-${tParts.find(p => p.type === 'day').value}`;

      const upcomingList = window.BIZHACK_UPCOMING_ARTICLES.filter(item => {
        const itemDate = item.publishDate || item.date;
        return itemDate >= todayStr;
      }).slice(0, 7);

      if (upcomingList.length > 0) {
        let html = '';
        upcomingList.forEach((item, index) => {
          const itemDate = item.publishDate || item.date;
          const isTomorrow = (itemDate === tomorrowStr);
          const isToday = (itemDate === todayStr);
          const isNext = (index === 0);

          let badgeHtml = '';
          if (isToday) {
            badgeHtml = '<span class="timeline-badge badge-next">本日公開！</span>';
          } else if (isTomorrow || isNext) {
            badgeHtml = '<span class="timeline-badge badge-next">明日公開</span>';
          }

          const nextClass = (isNext || isTomorrow || isToday) ? 'timeline-item-next' : '';

          html += `
            <div class="timeline-item ${nextClass}">
              <div class="timeline-meta">
                <span class="timeline-date">${item.dateDisplay}</span>
                ${badgeHtml}
              </div>
              <div class="timeline-body">
                <span class="timeline-series-tag">${item.series}・${item.category}</span>
                <h4 class="timeline-title">${item.title}</h4>
                <p class="timeline-desc">${item.summary}</p>
              </div>
            </div>
          `;
        });
        upcomingTimeline.innerHTML = html;
      }
    } catch (e) {
      console.warn('Upcoming timeline auto-update fallback:', e);
    }
  }
});

