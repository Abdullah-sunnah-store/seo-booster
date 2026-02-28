(function () {
  'use strict';

  function initCOD(config) {
    var blockId = config.blockId;
    var proxyUrl = config.proxyUrl;
    var variantId = config.variantId;

    var wrapper = document.querySelector('.cod-button-wrapper[data-variant-id="' + variantId + '"]');
    var overlay = document.getElementById('cod-overlay-' + blockId);
    if (!wrapper || !overlay) return;

    var modal       = overlay.querySelector('.cod-modal');
    var closeBtn    = overlay.querySelector('.cod-close-btn');
    var form        = overlay.querySelector('.cod-form');
    var qtyInput    = overlay.querySelector('.cod-qty-input');
    var qtyMinus    = overlay.querySelector('.cod-qty-minus');
    var qtyPlus     = overlay.querySelector('.cod-qty-plus');
    var loadingDiv  = overlay.querySelector('.cod-loading');
    var successDiv  = overlay.querySelector('.cod-success');
    var errorEl     = overlay.querySelector('.cod-error');
    var orderBtn    = wrapper.querySelector('.cod-order-btn');
    var closeSuccessBtn = overlay.querySelector('.cod-close-success-btn');

    function openModal() {
      overlay.classList.add('cod-open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      overlay.classList.remove('cod-open');
      document.body.style.overflow = '';
      // Reset to form view
      form.style.display = '';
      loadingDiv.style.display = 'none';
      successDiv.style.display = 'none';
      errorEl.style.display = 'none';
      errorEl.textContent = '';
      form.reset();
      qtyInput.value = 1;
    }

    function showError(msg) {
      loadingDiv.style.display = 'none';
      form.style.display = '';
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }

    function showSuccess() {
      loadingDiv.style.display = 'none';
      successDiv.style.display = 'flex';
    }

    // Open popup
    orderBtn.addEventListener('click', openModal);

    // Close via X button
    closeBtn.addEventListener('click', closeModal);

    // Close via overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Close success
    if (closeSuccessBtn) {
      closeSuccessBtn.addEventListener('click', closeModal);
    }

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('cod-open')) closeModal();
    });

    // Quantity controls
    qtyMinus.addEventListener('click', function () {
      var val = parseInt(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    });
    qtyPlus.addEventListener('click', function () {
      var val = parseInt(qtyInput.value) || 1;
      if (val < 99) qtyInput.value = val + 1;
    });

    // Form submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameInput    = form.querySelector('[name="name"]');
      var phoneInput   = form.querySelector('[name="phone"]');
      var addressInput = form.querySelector('[name="address"]');

      var name    = nameInput.value.trim();
      var phone   = phoneInput.value.trim();
      var address = addressInput.value.trim();
      var quantity = parseInt(qtyInput.value) || 1;

      // Basic validation
      if (!name) { showError('Please enter your name.'); nameInput.focus(); return; }
      if (!phone) { showError('Please enter your phone number.'); phoneInput.focus(); return; }
      if (!address) { showError('Please enter your delivery address.'); addressInput.focus(); return; }

      // Show loading
      form.style.display = 'none';
      errorEl.style.display = 'none';
      loadingDiv.style.display = 'flex';

      fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: phone,
          address: address,
          quantity: quantity,
          variant_id: variantId
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            showSuccess();
          } else {
            showError(data.error || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () {
          showError('Network error. Please check your connection and try again.');
        });
    });
  }

  // Initialize all blocks queued before script loaded
  function boot() {
    var queue = window.__COD__ || [];
    queue.forEach(function (config) { initCOD(config); });
    // Support dynamically added blocks (e.g. theme editor preview)
    window.__COD__ = { push: function (config) { initCOD(config); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
