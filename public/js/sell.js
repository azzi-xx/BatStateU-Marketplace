/* ==========================================================================
   sell.js — create and edit a listing (multipart upload via FormData).
   ========================================================================== */

(async () => {
  const form = document.getElementById('sellForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id');
  const isEdit = Boolean(editId);

  const els = {
    heading: document.getElementById('formHeading'),
    subheading: document.getElementById('formSubheading'),
    title: document.getElementById('title'),
    category: document.getElementById('categoryId'),
    price: document.getElementById('price'),
    condition: document.getElementById('condition'),
    description: document.getElementById('description'),
    image: document.getElementById('image'),
    preview: document.getElementById('uploadPreview'),
    clearImage: document.getElementById('clearImage'),
    submit: document.getElementById('submitBtn'),
    cancel: document.getElementById('cancelBtn'),
    banner: document.getElementById('formBanner'),
  };

  let selectedFile = null;
  let previewUrl = null;

  const user = await App.loadUser();
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
    return;
  }

  /* ------------------------------------------------------------- helpers -- */

  function setError(name, message) {
    const slot = form.querySelector(`[data-error="${name}"]`);
    if (slot) slot.textContent = message || '';
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.classList.toggle('is-invalid', Boolean(message));
  }

  function clearErrors() {
    form.querySelectorAll('[data-error]').forEach((slot) => (slot.textContent = ''));
    form.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
    els.banner.hidden = true;
  }

  function showBanner(message) {
    els.banner.textContent = message;
    els.banner.hidden = false;
    els.banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showPreview(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    els.preview.innerHTML = `
      <img src="${previewUrl}" alt="Selected photo preview">
      <button class="upload__clear" type="button" id="clearImage" title="Remove photo">✕</button>`;
    els.preview.classList.add('has-image');

    document.getElementById('clearImage').addEventListener('click', (event) => {
      event.stopPropagation();
      clearImage();
    });
  }

  function clearImage() {
    selectedFile = null;
    els.image.value = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    els.preview.classList.remove('has-image');
    els.preview.innerHTML = blankUpload();
    els.preview.addEventListener('click', () => els.image.click(), { once: true });
  }

  function blankUpload() {
    return `
      <div class="upload__blank">
        <span class="upload__icon">📷</span>
        <strong>Add a photo</strong>
        JPG, PNG, WEBP or GIF · up to 5 MB
      </div>`;
  }

  /* ------------------------------------------------------------- loading -- */

  els.preview.addEventListener('click', () => els.image.click());

  els.image.addEventListener('change', () => {
    const file = els.image.files && els.image.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('image', 'Please choose an image file.');
      els.image.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('image', 'That image is larger than 5 MB.');
      els.image.value = '';
      return;
    }

    setError('image', '');
    selectedFile = file;
    showPreview(file);
  });

  try {
    const categoriesPayload = await API.get('/api/categories');
    els.category.innerHTML =
      '<option value="">Select a category</option>' +
      categoriesPayload.data
        .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
        .join('');
  } catch (error) {
    showBanner('Could not load categories. ' + error.message);
    return;
  }

  if (isEdit) {
    els.heading.textContent = 'Edit listing';
    els.subheading.textContent = 'Update the details, then save your changes.';
    els.submit.textContent = 'Save changes';
    els.cancel.href = `/listing.html?id=${editId}`;

    try {
      const payload = await API.get(`/api/listings/${editId}`);
      const listing = payload.data;

      if (!listing.isOwner) {
        App.toast('You can only edit your own listings.', 'error');
        window.location.replace(`/listing.html?id=${editId}`);
        return;
      }

      els.title.value = listing.title;
      els.category.value = String(listing.category.id);
      els.price.value = String(listing.price);
      els.condition.value = listing.condition;
      els.description.value = listing.description || '';

      if (listing.imagePath) {
        els.preview.innerHTML = `<img src="${escapeHtml(listing.imagePath)}" alt="Current photo">
          <button class="upload__clear" type="button" id="clearImage" title="Remove photo">✕</button>`;
        els.preview.classList.add('has-image');
        document.getElementById('clearImage').addEventListener('click', (event) => {
          event.stopPropagation();
          clearImage();
        });
      }
    } catch (error) {
      showBanner(error.message);
      els.submit.disabled = true;
      return;
    }
  }

  /* -------------------------------------------------------------- submit -- */

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const title = els.title.value.trim();
    const price = els.price.value.trim();
    const categoryId = els.category.value;
    const condition = els.condition.value;

    let valid = true;

    if (title.length < 4) {
      setError('title', 'Title must be at least 4 characters.');
      valid = false;
    }
    if (!price || Number(price) <= 0) {
      setError('price', 'Enter a price greater than zero.');
      valid = false;
    }
    if (!categoryId) {
      setError('categoryId', 'Choose a category.');
      valid = false;
    }
    if (!condition) {
      setError('condition', 'Choose the item condition.');
      valid = false;
    }
    if (!valid) return;

    const data = new FormData();
    data.append('title', title);
    data.append('price', price);
    data.append('categoryId', categoryId);
    data.append('condition', condition);
    data.append('description', els.description.value.trim());
    if (selectedFile) data.append('image', selectedFile);

    els.submit.disabled = true;
    const originalLabel = els.submit.textContent;
    els.submit.textContent = isEdit ? 'Saving…' : 'Posting…';

    try {
      const payload = isEdit
        ? await API.patchForm(`/api/listings/${editId}`, data)
        : await API.postForm('/api/listings', data);

      App.toast(isEdit ? 'Listing updated.' : 'Listing posted!');
      window.location.href = `/listing.html?id=${payload.data.id}`;
    } catch (error) {
      showBanner(error.message);
      els.submit.disabled = false;
      els.submit.textContent = originalLabel;
    }
  });
})();
