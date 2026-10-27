(() => {
  const DB_NAME = "aipri-commission-local";
  const DB_VERSION = 1;
  const STORE = "or-photos";
  const upload = document.getElementById("orUpload");
  const gallery = document.getElementById("orGallery");
  const empty = document.getElementById("emptyState");
  const status = document.getElementById("status");
  const clearAll = document.getElementById("clearAll");
  const memo = document.getElementById("memo");
  if (!upload || !gallery) return;

  let db;
  const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const storeRequest = (mode, action) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let req;
    try { req = action(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("저장 작업이 취소되었습니다."));
  });
  const getAll = () => storeRequest("readonly", s => s.getAll());
  const add = item => storeRequest("readwrite", s => s.add(item));
  const remove = id => storeRequest("readwrite", s => s.delete(id));
  const clear = () => storeRequest("readwrite", s => s.clear());

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  async function render() {
    const photos = await getAll();
    gallery.replaceChildren();
    photos.forEach(photo => {
      const card = document.createElement("article");
      card.className = "photo-card";
      const img = document.createElement("img");
      const url = URL.createObjectURL(photo.blob);
      img.src = url;
      img.alt = photo.name;
      img.loading = "lazy";
      img.onload = () => URL.revokeObjectURL(url);
      const meta = document.createElement("div");
      meta.className = "photo-meta";
      const name = document.createElement("p");
      name.className = "photo-name";
      name.textContent = photo.name;
      const size = document.createElement("p");
      size.className = "photo-name";
      size.style.color = "#817b8c";
      size.textContent = formatSize(photo.blob.size);
      const actions = document.createElement("div");
      actions.className = "photo-actions";
      const download = document.createElement("button");
      download.type = "button";
      download.textContent = "다운로드";
      download.addEventListener("click", () => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(photo.blob);
        link.download = photo.name || "or-photo";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "삭제";
      del.addEventListener("click", async () => {
        if (!confirm(`‘${photo.name}’ 사진을 삭제할까요?`)) return;
        await remove(photo.id);
        await render();
        status.textContent = "사진을 삭제했습니다.";
      });
      actions.append(download, del);
      meta.append(name, size, actions);
      card.append(img, meta);
      gallery.append(card);
    });
    empty.hidden = photos.length > 0;
    status.textContent = photos.length ? `저장된 OR 사진 ${photos.length}장` : "저장된 OR 사진이 없습니다.";
  }

  upload.addEventListener("change", async () => {
    const files = Array.from(upload.files || []).filter(file => file.type.startsWith("image/"));
    if (!files.length) return;
    try {
      for (const file of files) await add({ name: file.name, type: file.type, blob: file, addedAt: Date.now() });
      await render();
      status.textContent = `${files.length}장 추가했습니다. 새로고침 후에도 이 브라우저에 저장됩니다.`;
    } catch (error) {
      console.error(error);
      status.textContent = "사진을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.";
      alert("사진 저장에 실패했습니다. 이미지 용량이나 브라우저 저장 공간을 확인해 주세요.");
    } finally {
      upload.value = "";
    }
  });

  clearAll.addEventListener("click", async () => {
    const photos = await getAll();
    if (!photos.length) {
      alert("삭제할 OR 사진이 없습니다.");
      return;
    }
    if (!confirm(`저장된 OR 사진 ${photos.length}장을 모두 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await clear();
    await render();
    status.textContent = "OR 사진을 모두 삭제했습니다.";
  });

  const MEMO_KEY = "aipri-commission-memo";
  memo.value = localStorage.getItem(MEMO_KEY) || "";
  memo.addEventListener("input", () => localStorage.setItem(MEMO_KEY, memo.value));

  openDB().then(database => {
    db = database;
    return render();
  }).catch(error => {
    console.error(error);
    status.textContent = "이 브라우저에서 사진 저장 기능을 사용할 수 없습니다.";
    alert("브라우저 저장소를 열 수 없습니다. 일반 브라우저 창에서 사이트를 열어 주세요.");
  });
})();
