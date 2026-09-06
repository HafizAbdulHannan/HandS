const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;
  
  if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const message = {
      from: `${process.env.FROM_NAME || 'HandS'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    await transporter.sendMail(message);
  } else {
    // Mock the email sending instead of using Ethereal which hangs on Render
    console.log('\n=================== MOCK EMAIL ===================');
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('==================================================\n');
    console.log('Note: To send real emails, configure SMTP_EMAIL and SMTP_PASSWORD in .env');
  }
};

module.exports = sendEmail;
