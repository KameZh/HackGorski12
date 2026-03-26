const axios = require('axios');

// Setup Brevo API
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

if (!BREVO_API_KEY) {
  console.warn('Warning: BREVO_API_KEY not set in environment variables');
}

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const response = await axios.post(BREVO_API_URL, {
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
      sender: {
        name: 'Gorski ',
        email: 'kris.altawil@gmail.com'
      }
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Email sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw error;
  }
};

const sendSignupEmail = async (email) => {
  const subject = 'Welcome to HackGorski!';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #667eea;">Welcome to HackGorski!</h2>
        <p>Hi ${email},</p>
        <p>Your account has been successfully created! 🎉</p>
        <p>You can now log in to your account and start using all the features.</p>
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          If you didn't create this account, please ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">
          Best regards,<br>
          The HackGorski Team
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, htmlContent);
};

const sendLoginEmail = async (email) => {
  const subject = 'Successful Login - HackGorski';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #667eea;">Login Notification</h2>
        <p>Hi ${email},</p>
        <p>You have successfully logged into your HackGorski account! ✅</p>
        <p style="color: #666; font-size: 14px;">
          If this wasn't you, please secure your account immediately.
        </p>
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          Best regards,<br>
          The HackGorski Team
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, htmlContent);
};

module.exports = { sendEmail, sendSignupEmail, sendLoginEmail };
