// DOM要素
const keywordInput = document.getElementById('keywordInput');
const addKeywordBtn = document.getElementById('addKeyword');
const keywordList = document.getElementById('keywordList');

const userInput = document.getElementById('userInput');
const addUserBtn = document.getElementById('addUser');
const userList = document.getElementById('userList');

const exportBtn = document.getElementById('exportData');
const importBtn = document.getElementById('importData');
const clearAllBtn = document.getElementById('clearAll');
const fileInput = document.getElementById('fileInput');

const statusDiv = document.getElementById('status');

// ステータスメッセージを表示
function showStatus(message, isSuccess = true) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${isSuccess ? 'success' : 'error'}`;
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// キーワードリストを表示
function displayKeywords(keywords) {
  if (keywords.length === 0) {
    keywordList.innerHTML = '<div class="empty-state">登録されているキーワードはありません</div>';
    return;
  }
  
  keywordList.innerHTML = '';
  keywords.forEach((keyword, index) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <span>${keyword}</span>
      <button class="remove-btn" data-index="${index}">削除</button>
    `;
    keywordList.appendChild(item);
  });
  
  // 削除ボタンのイベントリスナー
  document.querySelectorAll('.list-item .remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeKeyword(index);
    });
  });
}

// ユーザーリストを表示
function displayUsers(users) {
  if (users.length === 0) {
    userList.innerHTML = '<div class="empty-state">サイレントブロックしているユーザーはいません</div>';
    return;
  }
  
  userList.innerHTML = '';
  users.forEach((user, index) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <span>@${user}</span>
      <button class="remove-btn" data-index="${index}">解除</button>
    `;
    userList.appendChild(item);
  });
  
  // 削除ボタンのイベントリスナー
  document.querySelectorAll('#userList .remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeUser(index);
    });
  });
}

// キーワードを追加
function addKeyword() {
  const keyword = keywordInput.value.trim();
  
  if (!keyword) {
    showStatus('キーワードを入力してください', false);
    return;
  }
  
  chrome.storage.sync.get(['keywords'], (result) => {
    const keywords = result.keywords || [];
    
    if (keywords.includes(keyword)) {
      showStatus('このキーワードは既に登録されています', false);
      return;
    }
    
    keywords.push(keyword);
    chrome.storage.sync.set({ keywords }, () => {
      keywordInput.value = '';
      displayKeywords(keywords);
      showStatus('キーワードを追加しました');
    });
  });
}

// キーワードを削除
function removeKeyword(index) {
  chrome.storage.sync.get(['keywords'], (result) => {
    const keywords = result.keywords || [];
    keywords.splice(index, 1);
    
    chrome.storage.sync.set({ keywords }, () => {
      displayKeywords(keywords);
      showStatus('キーワードを削除しました');
    });
  });
}

// ユーザーを追加
function addUser() {
  let username = userInput.value.trim();
  
  // @を削除
  username = username.replace('@', '');
  
  if (!username) {
    showStatus('ユーザー名を入力してください', false);
    return;
  }
  
  chrome.storage.sync.get(['blockedUsers'], (result) => {
    const users = result.blockedUsers || [];
    
    if (users.includes(username)) {
      showStatus('このユーザーは既にブロックされています', false);
      return;
    }
    
    users.push(username);
    chrome.storage.sync.set({ blockedUsers: users }, () => {
      userInput.value = '';
      displayUsers(users);
      showStatus('ユーザーをサイレントブロックしました');
    });
  });
}

// ユーザーを削除
function removeUser(index) {
  chrome.storage.sync.get(['blockedUsers'], (result) => {
    const users = result.blockedUsers || [];
    users.splice(index, 1);
    
    chrome.storage.sync.set({ blockedUsers: users }, () => {
      displayUsers(users);
      showStatus('サイレントブロックを解除しました');
    });
  });
}

// データをエクスポート
function exportData() {
  chrome.storage.sync.get(['keywords', 'blockedUsers'], (result) => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      keywords: result.keywords || [],
      blockedUsers: result.blockedUsers || []
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `x-filter-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('設定をエクスポートしました');
  });
}

// データをインポート
function importData() {
  fileInput.click();
}

// ファイル選択時の処理
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // データの検証
      if (!data.keywords && !data.blockedUsers) {
        showStatus('無効なファイル形式です', false);
        return;
      }
      
      // 確認ダイアログ
      const keywordCount = (data.keywords || []).length;
      const userCount = (data.blockedUsers || []).length;
      const message = `以下の設定をインポートします:\n・キーワード: ${keywordCount}件\n・ブロックユーザー: ${userCount}件\n\n現在の設定は上書きされます。よろしいですか？`;
      
      if (!confirm(message)) {
        fileInput.value = '';
        return;
      }
      
      // データを保存
      chrome.storage.sync.set({
        keywords: data.keywords || [],
        blockedUsers: data.blockedUsers || []
      }, () => {
        displayKeywords(data.keywords || []);
        displayUsers(data.blockedUsers || []);
        showStatus('設定をインポートしました');
        fileInput.value = '';
      });
      
    } catch (error) {
      showStatus('ファイルの読み込みに失敗しました', false);
      fileInput.value = '';
    }
  };
  
  reader.readAsText(file);
}

// すべてクリア
function clearAllData() {
  const message = 'すべてのキーワードとブロックユーザーを削除します。\nこの操作は取り消せません。\n\nよろしいですか？';
  
  if (!confirm(message)) {
    return;
  }
  
  chrome.storage.sync.set({
    keywords: [],
    blockedUsers: []
  }, () => {
    displayKeywords([]);
    displayUsers([]);
    showStatus('すべての設定をクリアしました');
  });
}

// イベントリスナー
addKeywordBtn.addEventListener('click', addKeyword);
keywordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addKeyword();
  }
});

addUserBtn.addEventListener('click', addUser);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addUser();
  }
});

// 初期表示
chrome.storage.sync.get(['keywords', 'blockedUsers'], (result) => {
  displayKeywords(result.keywords || []);
  displayUsers(result.blockedUsers || []);
});