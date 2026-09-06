const axios = require('axios');

const sendEmail = async (options) => {
  // Use EmailJS API
  const serviceId = 'service_gebbac7';
  const templateId = 'template_l6bl0ij';
  const publicKey = 'BHVO2cVPIDVUB-NPc';

  try {
    const response = await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: options.email,
          subject: options.subject,
          message: options.message,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Email sent successfully via EmailJS!');
  } catch (error) {
    console.error('Error sending email via EmailJS:', error.response?.data || error.message);
    throw new Error('EmailJS failed to send email');
  }
};

module.exports = sendEmail;
