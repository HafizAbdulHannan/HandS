const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send push notification via Expo
 * @param {string} pushToken - The Expo push token of the recipient
 * @param {string} title - The title of the notification
 * @param {string} body - The body message of the notification
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  }];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification chunk:', error);
    }
  }

  return tickets;
};

module.exports = { sendPushNotification };
