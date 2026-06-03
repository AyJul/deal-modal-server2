const express = require('express');
const axios = require('axios');
const qs = require('qs');
 
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const WINS_CHANNEL = process.env.WINS_CHANNEL;
 
// /deal slash command — opens modal
app.post('/deal', async (req, res) => {
  res.status(200).send('');
 
  const triggerId = req.body.trigger_id;
 
  const modal = {
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'deal_modal',
      title: { type: 'plain_text', text: '🏆 Post a Closed Deal' },
      submit: { type: 'plain_text', text: 'Post Deal' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'input',
          block_id: 'agent_block',
          label: { type: 'plain_text', text: 'Agent Name' },
          element: {
            type: 'static_select',
            action_id: 'agent',
            placeholder: { type: 'plain_text', text: 'Select your name...' },
            options: [
              'Cameron Anderson',
              'Jovon Stewart',
              'Kinley Daudin',
              'Chanse Fearon',
              'Braeden Normil',
              'Tyler Olajide',
              'Shawn Boodhan'
            ].map(name => ({
              text: { type: 'plain_text', text: name },
              value: name
            }))
          }
        },
        {
          type: 'input',
          block_id: 'carrier_block',
          label: { type: 'plain_text', text: 'Carrier' },
          element: {
            type: 'static_select',
            action_id: 'carrier',
            placeholder: { type: 'plain_text', text: 'Select carrier...' },
            options: [
              'Ethos',
              'Americo',
              'American Amicable',
              'F&G',
              'Aetna',
              'CoreBridge',
              'GTL'
            ].map(c => ({
              text: { type: 'plain_text', text: c },
              value: c
            }))
          }
        },
        {
          type: 'input',
          block_id: 'product_block',
          label: { type: 'plain_text', text: 'Product' },
          element: {
            type: 'static_select',
            action_id: 'product',
            placeholder: { type: 'plain_text', text: 'Select product...' },
            options: [
              'Term Life',
              'Whole Life',
              'Final Expense',
              'Indexed Universal Life (IUL)',
              'Universal Life'
            ].map(p => ({
              text: { type: 'plain_text', text: p },
              value: p
            }))
          }
        },
        {
          type: 'input',
          block_id: 'premium_block',
          label: { type: 'plain_text', text: 'Monthly Premium ($)' },
          element: {
            type: 'plain_text_input',
            action_id: 'premium',
            placeholder: { type: 'plain_text', text: 'e.g. 148' }
          }
        },
        {
          type: 'input',
          block_id: 'term_block',
          label: { type: 'plain_text', text: 'Policy Term' },
          element: {
            type: 'static_select',
            action_id: 'term',
            placeholder: { type: 'plain_text', text: 'Select term...' },
            options: [
              { text: { type: 'plain_text', text: 'Monthly × 12' }, value: '12' },
              { text: { type: 'plain_text', text: 'Monthly × 10' }, value: '10' },
              { text: { type: 'plain_text', text: 'One-time / Single Premium' }, value: '1' }
            ]
          }
        }
      ]
    }
  };
 
  try {
    await axios.post('https://slack.com/api/views.open', modal, {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Error opening modal:', err.response?.data || err.message);
  }
});
 
// Handle modal submission
app.post('/interactions', async (req, res) => {
  const payload = JSON.parse(req.body.payload);
 
  if (payload.type === 'view_submission' && payload.view.callback_id === 'deal_modal') {
    res.status(200).send('');
 
    const vals = payload.view.state.values;
    const agent = vals.agent_block.agent.selected_option.value;
    const carrier = vals.carrier_block.carrier.selected_option.value;
    const product = vals.product_block.product.selected_option.value;
    const premium = parseFloat(vals.premium_block.premium.value) || 0;
    const term = parseInt(vals.term_block.term.selected_option.value) || 12;
    const ap = premium * term;
 
    const termLabel = { '12': 'Monthly × 12', '10': 'Monthly × 10', '1': 'One-time' }[String(term)];
 
    const message = [
      `:trophy: *DEAL CLOSED* :trophy:`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `:bust_in_silhouette: *Agent:* ${agent}`,
      `:office: *Carrier:* ${carrier}`,
      `:clipboard: *Product:* ${product}`,
      `:moneybag: *Monthly Premium:* $${premium.toLocaleString('en-US', { minimumFractionDigits: 2 })}   |   :bar_chart: *AP:* $${ap.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `:calendar: *Term:* ${termLabel}`,
      `━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');
 
    try {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel: WINS_CHANNEL,
        text: message,
        username: 'Money Maker',
        icon_emoji: ':trophy:'
      }, {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Error posting message:', err.response?.data || err.message);
    }
  } else {
    res.status(200).send('');
  }
});
 
app.get('/', (req, res) => res.send('Deal Modal Server is running!'));
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
