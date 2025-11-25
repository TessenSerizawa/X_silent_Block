// 設定を読み込む
let keywords = [];
let blockedUsers = [];

function loadSettings() {
  chrome.storage.sync.get(['keywords', 'blockedUsers'], (result) => {
    keywords = result.keywords || [];
    blockedUsers = result.blockedUsers || [];
    filterPosts();
  });
}

// 投稿をフィルタリング
function filterPosts() {
  // すべての投稿を取得
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  
  articles.forEach((article) => {
    if (article.dataset.filtered) return;
    article.dataset.filtered = 'true';
    
    // ユーザー名を取得
    const userLink = article.querySelector('a[href^="/"][role="link"]');
    let username = '';
    if (userLink) {
      const href = userLink.getAttribute('href');
      username = href.replace('/', '').split('/')[0];
    }
    
    // サイレントブロックチェック
    if (blockedUsers.includes(username)) {
      // 親要素ごと削除して境界線の重なりを防ぐ
      const parent = article.parentElement;
      if (parent) {
        parent.remove();
      }
      return;
    }
    
    // テキスト内容を取得
    const tweetText = article.innerText || '';
    
    // キーワードチェック
    const containsKeyword = keywords.some(keyword => 
      keyword && tweetText.includes(keyword)
    );
    
    if (containsKeyword) {
      // 親要素ごと削除して境界線の重なりを防ぐ
      const parent = article.parentElement;
      if (parent) {
        parent.remove();
      }
    }
  });
}

// ダークモードを検出
function isDarkMode() {
  // 背景色をチェック
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  const rgb = bgColor.match(/\d+/g);
  if (rgb) {
    const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
    return brightness < 128;
  }
  return false;
}

// メニュー項目のスタイルを取得
function getMenuItemStyle() {
  const isDark = isDarkMode();
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontSize: '15px',
    fontWeight: '400',
    color: isDark ? 'rgb(231, 233, 234)' : 'rgb(15, 20, 25)',
    gap: '12px'
  };
}

// サイレントブロックメニュー項目を作成
function createSilentBlockMenuItem(username) {
  const menuItem = document.createElement('div');
  menuItem.setAttribute('role', 'menuitem');
  menuItem.setAttribute('tabindex', '0');
  menuItem.setAttribute('data-silent-block', username);
  
  // スタイルを適用
  const styles = getMenuItemStyle();
  Object.assign(menuItem.style, styles);
  
  // ホバー効果
  menuItem.addEventListener('mouseenter', () => {
    menuItem.style.backgroundColor = isDarkMode() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.03)';
  });
  menuItem.addEventListener('mouseleave', () => {
    menuItem.style.backgroundColor = 'transparent';
  });
  
  // アイコンとテキストを作成
  menuItem.innerHTML = `
    <svg viewBox="0 0 24 24" width="18.75" height="18.75" style="flex-shrink: 0;">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
    </svg>
    <span style="flex: 1;">@${username}さんをサイレントブロック</span>
  `;
  
  // クリックイベント
  menuItem.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // サイレントブロックリストに追加
    chrome.storage.sync.get(['blockedUsers'], (result) => {
      const users = result.blockedUsers || [];
      if (!users.includes(username)) {
        users.push(username);
        chrome.storage.sync.set({ blockedUsers: users }, () => {
          blockedUsers = users;
          filterPosts();
          
          // 成功通知を表示
          showNotification(`@${username}をサイレントブロックしました`);
          
          // メニューを閉じる
          const backdrop = document.querySelector('[data-testid="app-bar-back"]') || 
                          document.querySelector('[role="presentation"]');
          if (backdrop) {
            backdrop.click();
          } else {
            document.body.click();
          }
        });
      }
    });
  });
  
  return menuItem;
}

// 通知を表示
function showNotification(message) {
  const isDark = isDarkMode();
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isDark ? 'rgba(29, 161, 242, 0.9)' : 'rgba(29, 161, 242, 0.95)'};
    color: white;
    padding: 12px 24px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, ${isDark ? '0.5' : '0.3'});
    animation: slideUp 0.3s ease-out;
  `;
  notification.textContent = message;
  
  // アニメーション
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s';
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 300);
  }, 3000);
}

// メニューを監視してサイレントブロック項目を追加
function observeMenus() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // メニューコンテナを探す
          let menu = null;
          
          // パターン1: role="menu"を持つ要素
          if (node.getAttribute('role') === 'menu') {
            menu = node;
          }
          
          // パターン2: 子要素にrole="menu"を持つ要素
          if (!menu) {
            menu = node.querySelector('[role="menu"]');
          }
          
          if (menu && !menu.querySelector('[data-silent-block]')) {
            // メニュー項目を取得
            const menuItems = menu.querySelectorAll('[role="menuitem"]');
            
            if (menuItems.length > 0) {
              // 現在表示されている投稿からユーザー名を取得
              const username = getCurrentTweetUsername(menu);
              
              if (username && !blockedUsers.includes(username)) {
                const silentBlockItem = createSilentBlockMenuItem(username);
                
                // メニューの最初に追加（「フォロー」の下）
                const firstItem = menuItems[0];
                if (firstItem && firstItem.parentNode) {
                  firstItem.parentNode.insertBefore(silentBlockItem, firstItem.nextSibling);
                }
              }
            }
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 現在のツイートのユーザー名を取得
function getCurrentTweetUsername(menuElement) {
  // メニューに最も近い投稿を探す
  let currentArticle = null;
  
  // メニューの位置から投稿を特定
  const allArticles = document.querySelectorAll('article[data-testid="tweet"]');
  
  for (const article of allArticles) {
    const moreButton = article.querySelector('[data-testid="caret"]');
    if (moreButton) {
      // このボタンが最近クリックされた可能性が高い
      currentArticle = article;
      break;
    }
  }
  
  // フォールバック: 最初の表示されている投稿
  if (!currentArticle) {
    currentArticle = allArticles[0];
  }
  
  if (currentArticle) {
    const userLink = currentArticle.querySelector('a[href^="/"][role="link"]');
    if (userLink) {
      const href = userLink.getAttribute('href');
      return href.replace('/', '').split('/')[0];
    }
  }
  
  return null;
}

// 定期的にフィルタリングを実行
function startFiltering() {
  // 初回実行
  filterPosts();
  
  // MutationObserverでDOM変更を監視
  const observer = new MutationObserver(() => {
    filterPosts();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 念のため定期実行も
  setInterval(filterPosts, 1000);
}

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes) => {
  if (changes.keywords) {
    keywords = changes.keywords.newValue || [];
  }
  if (changes.blockedUsers) {
    blockedUsers = changes.blockedUsers.newValue || [];
  }
  filterPosts();
});

// 初期化
loadSettings();
startFiltering();
observeMenus();