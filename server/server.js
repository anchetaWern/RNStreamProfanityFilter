const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const StreamChat = require('stream-chat').StreamChat;
const axios = require('axios');

require('dotenv').config();
const app = express();

const server_side_client = new StreamChat(
  process.env.APP_KEY,
  process.env.APP_SECRET
);

const COGNITIVE_SERVICES_API_KEY = process.env.COGNITIVE_SERVICES_API_KEY;

const axios_base_instance_opt = {
  baseURL: `https://api.cognitive.microsofttranslator.com`,
  timeout: 3000,
  headers: {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': COGNITIVE_SERVICES_API_KEY
  }
};


app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  bodyParser.text({
    type: (req) => {
      const is_webhook = req.headers['x-signature'];
      if (is_webhook) {
        return true;
      }
      return false;
    },
  }),
);

app.use(bodyParser.json({
  type: (req) => {
    const is_webhook = req.headers['x-signature'];
    if (is_webhook) {
      return false;
    }
    return true;
  }
}));
app.use(cors());

app.get("/", async (req, res) => {
  res.send('all green!');
});

app.post("/auth", async (req, res) => {
  const user_id = req.body.user_id;
  console.log('user ID: ', user_id);
  if (!user_id) {
    return res.status(400);
  }

  return res.send({
    token: server_side_client.createToken(user_id)
  });
});

app.get("/create-channel", async (req, res) => {
  const user_id = req.query.user_id;
  const sample_channel = server_side_client.channel('messaging', 'sample-room1', {
    name: 'Sample Room 1',
    image: 'http://bit.ly/2O35mws',
    created_by_id: user_id,
  });

  const create_channel = await sample_channel.create();
  console.log("channel: ", create_channel);

  res.send('ok');
});

app.post("/add-member", async (req, res) => {
  const user_id = req.body.user_id;
  const sample_channel = server_side_client.channel('messaging', 'sample-room1');
  const add_member = await sample_channel.addMembers([user_id]);
  console.log("members: ", add_member);
  res.send('ok');
});

app.get("/send-message", async (req, res) => {
  const user_id = req.query.user_id;
  const sample_channel = server_side_client.channel('messaging', 'sample-room1');

  const text = `hi from ${user_id}`;
  const message = {
    text,
    user_id,
  }
  const send_message = await sample_channel.sendMessage(message);
  console.log('send message: ', send_message);

  res.send('ok');
});

app.post("/webhook", async (req, res) => {
  try {
    const is_valid = server_side_client.verifyWebhook(req.body, req.headers['x-signature']);
    const event = JSON.parse(req.body);

    if (is_valid && event.type === 'message.new') {
      const { message } = JSON.parse(req.body);
      const user = message.user;
      const text = message.text;

      const content = JSON.stringify([{
        'Text': text
      }]);

      const language = 'en';
      const filter_instance = axios.create(axios_base_instance_opt);
      const profanity_action = 'Marked';
      const profanity_marker = 'Asterisk';
      const filter_response = await filter_instance.post(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${language}&profanityAction=${profanity_action}&profanityMarker=${profanity_marker}`,
        content
      );
      const filtered_text = filter_response.data[0].translations[0].text;

      if (filtered_text.includes('***')) {
        const updated_message = { id: message.id, user_id: user.id, text: filtered_text };
        const updated_response = await server_side_client.updateMessage(updated_message);

        let warn_count = (user.warn_count) ? user.warn_count : 0;
        warn_count += 1;
        if (warn_count < 3) {

          const updated_user_data = await server_side_client.updateUsers([{
            id: user.id,
            warn_count: warn_count
          }]);

        } else {
          const ban_data = await server_side_client.banUser(user.id, {
            user_id: user.id,
            reason: 'Colorful words',
          });
        }
      }
    }

  } catch (err) {
    console.log("webhook error: ", err);
  }

  res.send('ok');
});

app.get('/unban', async (req, res) => {
  const user_id = req.query.user_id;
  await server_side_client.unbanUser(user_id);
  res.send('ok');
});

const PORT = 5000;
app.listen(PORT, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Running on ports ${PORT}`);
  }
});