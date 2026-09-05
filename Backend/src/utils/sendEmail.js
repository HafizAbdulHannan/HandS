const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;
  
  if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
    // Use real SMTP if credentials are provided in .env
    transporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred service
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else {
    // Fallback to ethereal for testing if no credentials are provided
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Using Ethereal email for testing. Please set SMTP_EMAIL and SMTP_PASSWORD in .env for production.');
  }

  const message = {
    from: `${process.env.FROM_NAME || 'HandS - Heart and Soul'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL || 'noreply@hands.local'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  const info = await transporter.sendMail(message);

  if (!process.env.SMTP_EMAIL) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

module.exports = sendEmail;
