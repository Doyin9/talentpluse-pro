                                <!-- Signup Form with Full Details -->
        <form id="signupForm" style="display:none;" onsubmit="handleSignup(event)">
          <input type="text" id="signupFirstName" placeholder="First Name" required>
          <input type="text" id="signupMiddleName" placeholder="Middle Name (Optional)">
          <input type="text" id="signupUsername" placeholder="Username" required>
          <input type="email" id="signupEmail" placeholder="Email Address" required>
          <input type="password" id="signupPassword" placeholder="Password" required>
          <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">
            <input type="checkbox" id="termsCheck" required style="width:auto; margin-right:5px;"> I agree to the terms and privacy policy.
          </div>
          <button type="submit" id="signupSubmitBtn" class="submit-btn" style="background:#2563eb;">Create Account</button>
          <p id="signupError" style="color:#ef4444; font-size:12px; text-align:center; margin-top:10px; display:none;"></p>
        </form>
