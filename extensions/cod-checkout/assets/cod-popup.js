(function () {
  'use strict';

  // ─── Money formatter ────────────────────────────────────────────────────────
  function formatMoney(cents, fmt) {
    var amount = (cents / 100).toFixed(2);
    var amountND = String(Math.round(cents / 100));
    return (fmt || '${{amount}}')
      .replace('{{amount}}', amount)
      .replace('{{amount_no_decimals}}', amountND)
      .replace('{{amount_with_comma_separator}}', amount.replace('.', ','))
      .replace('{{amount_no_decimals_with_comma_separator}}', amountND);
  }

  // ─── Init per block ─────────────────────────────────────────────────────────
  function initCOD(config) {
    var blockId    = config.blockId;
    var variantId  = config.variantId;
    var basePrice  = config.basePrice;   // cents
    var moneyFmt   = config.moneyFormat;
    var offersUrl  = config.offersUrl;
    var orderUrl   = config.orderUrl;

    var wrapper    = document.querySelector('.cod-button-wrapper[data-variant-id="' + variantId + '"]');
    var overlay    = document.getElementById('cod-overlay-' + blockId);
    if (!wrapper || !overlay) return;

    var modal           = overlay.querySelector('.cod-modal');
    var closeBtn        = overlay.querySelector('.cod-close-btn');
    var form            = overlay.querySelector('.cod-form');
    var offersSection   = overlay.querySelector('.cod-offers-section');
    var offersGrid      = overlay.querySelector('.cod-offers-grid');
    var qtySection      = overlay.querySelector('.cod-qty-section');
    var qtyInput        = overlay.querySelector('.cod-qty-input');
    var qtyMinus        = overlay.querySelector('.cod-qty-minus');
    var qtyPlus         = overlay.querySelector('.cod-qty-plus');
    var loadingDiv      = overlay.querySelector('.cod-loading');
    var successDiv      = overlay.querySelector('.cod-success');
    var errorEl         = overlay.querySelector('.cod-error');
    var orderBtn        = wrapper.querySelector('.cod-order-btn');
    var closeSuccessBtn = overlay.querySelector('.cod-close-success-btn');
    var totalEl         = document.getElementById('cod-total-' + blockId);

    // Track selected offer
    var selectedOffer = null; // { quantity, totalCents }

    // ── Price display ──────────────────────────────────────────────────────────
    function updateTotal() {
      if (!totalEl) return;
      var cents = selectedOffer
        ? selectedOffer.totalCents
        : basePrice * (parseInt(qtyInput.value) || 1);
      totalEl.textContent = formatMoney(cents, moneyFmt);
    }

    // ── Offer cards ────────────────────────────────────────────────────────────
    function calcOfferCents(offer) {
      var origCents = basePrice * offer.quantity;
      if (offer.discountType === 'percentage') {
        return Math.round(origCents * (1 - offer.discountValue / 100));
      }
      if (offer.discountType === 'fixed') {
        return Math.round(offer.discountValue * 100);
      }
      return origCents;
    }

    function selectCard(card, offer, totalCents) {
      overlay.querySelectorAll('.cod-offer-card').forEach(function (c) {
        c.classList.remove('cod-offer-selected');
      });
      card.classList.add('cod-offer-selected');
      selectedOffer = { quantity: offer.quantity, totalCents: totalCents };
      updateTotal();
    }

    function renderOffers(offers) {
      if (!offers || !offers.length) return;

      offersGrid.innerHTML = '';
      var defaultSet = false;

      offers.forEach(function (offer) {
        var origCents      = basePrice * offer.quantity;
        var discCents      = calcOfferCents(offer);
        var hasDisc        = discCents < origCents;
        var isSelected     = offer.isDefault && !defaultSet;
        if (isSelected) defaultSet = true;

        var card = document.createElement('div');
        card.className = 'cod-offer-card' + (isSelected ? ' cod-offer-selected' : '');
        card.dataset.quantity = offer.quantity;

        var badgeHtml = offer.badgeText
          ? '<div class="cod-offer-badge">' + offer.badgeText + '</div>'
          : '';
        var origHtml = hasDisc
          ? '<span class="cod-offer-original">' + formatMoney(origCents, moneyFmt) + '</span>'
          : '';

        card.innerHTML =
          badgeHtml +
          '<div class="cod-offer-label">' + offer.label + '</div>' +
          '<div class="cod-offer-prices">' +
            origHtml +
            '<span class="cod-offer-current">' + formatMoney(discCents, moneyFmt) + '</span>' +
          '</div>';

        card.addEventListener('click', function () {
          selectCard(card, offer, discCents);
        });

        offersGrid.appendChild(card);

        if (isSelected) {
          selectedOffer = { quantity: offer.quantity, totalCents: discCents };
        }
      });

      // Show offers, hide simple qty stepper
      offersSection.style.display = 'block';
      qtySection.style.display    = 'none';
      updateTotal();
    }

    function fetchOffers() {
      fetch(offersUrl)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.offers && data.offers.length) {
            renderOffers(data.offers);
          }
        })
        .catch(function () { /* silently keep qty stepper */ });
    }

    // ── Modal open/close ───────────────────────────────────────────────────────
    var offersLoaded = false;

    function openModal() {
      overlay.classList.add('cod-open');
      document.body.style.overflow = 'hidden';
      if (!offersLoaded) {
        offersLoaded = true;
        fetchOffers();
      }
      updateTotal();
    }

    function closeModal() {
      overlay.classList.remove('cod-open');
      document.body.style.overflow = '';
      form.style.display      = '';
      loadingDiv.style.display = 'none';
      successDiv.style.display = 'none';
      errorEl.style.display    = 'none';
      errorEl.textContent      = '';
      form.reset();
      if (qtyInput) qtyInput.value = 1;
      selectedOffer = null;
      updateTotal();
    }

    orderBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('cod-open')) closeModal();
    });

    // ── Simple qty stepper ─────────────────────────────────────────────────────
    if (qtyMinus) {
      qtyMinus.addEventListener('click', function () {
        var v = parseInt(qtyInput.value) || 1;
        if (v > 1) { qtyInput.value = v - 1; updateTotal(); }
      });
    }
    if (qtyPlus) {
      qtyPlus.addEventListener('click', function () {
        var v = parseInt(qtyInput.value) || 1;
        if (v < 99) { qtyInput.value = v + 1; updateTotal(); }
      });
    }

    // ── Form submit ────────────────────────────────────────────────────────────
    function showError(msg) {
      loadingDiv.style.display = 'none';
      form.style.display       = '';
      errorEl.textContent      = msg;
      errorEl.style.display    = 'block';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameEl       = form.querySelector('[name="name"]');
      var phoneEl      = form.querySelector('[name="phone"]');
      var addressEl    = form.querySelector('[name="address"]');
      var cityEl       = form.querySelector('[name="city"]');
      var governEl     = form.querySelector('[name="governorate"]');

      var name     = nameEl.value.trim();
      var phone    = phoneEl.value.trim();
      var address  = addressEl.value.trim();
      var city     = cityEl ? cityEl.value.trim() : '';
      var govern   = governEl ? governEl.value.trim() : '';

      if (!name)    { showError('Please enter your name.');            nameEl.focus();    return; }
      if (!phone)   { showError('Please enter your phone number.');    phoneEl.focus();   return; }
      if (!address) { showError('Please enter your delivery address.'); addressEl.focus(); return; }

      var qty        = selectedOffer ? selectedOffer.quantity : (parseInt(qtyInput ? qtyInput.value : '1') || 1);
      var offerPrice = selectedOffer ? selectedOffer.totalCents : 0;

      form.style.display       = 'none';
      errorEl.style.display    = 'none';
      loadingDiv.style.display = 'flex';

      fetch(orderUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name,
          phone:       phone,
          city:        city,
          governorate: govern,
          address:     address,
          quantity:    qty,
          variant_id:  variantId,
          offer_price: offerPrice || undefined
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            loadingDiv.style.display = 'none';
            successDiv.style.display = 'flex';
          } else {
            showError(data.error || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () {
          showError('Network error. Please check your connection and try again.');
        });
    });
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function boot() {
    var queue = window.__COD__ || [];
    queue.forEach(function (cfg) { initCOD(cfg); });
    window.__COD__ = { push: function (cfg) { initCOD(cfg); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
