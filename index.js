const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const WINS_CHANNEL = process.env.WINS_CHANNEL;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = 'Deals';

console.log('WINS_CHANNEL:', WINS_CHANNEL);
console.log('SLACK_BOT_TOKEN set:', !!SLACK_BOT_TOKEN);
console.log('AIRTABLE_TOKEN set:', !!AIRTABLE_TOKEN);
console.log('AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID);

// Write a deal into the Airtable Deals table (starts as "Pending Payment")
async function writeToAirtable(deal) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.log('Airtable not configured — skipping write');
    return;
  }
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const result = await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        fields: {
          'Deal Name': `${deal.agent} - ${deal.carrier}`,
          'Agent': [deal.agent],
          'Carrier': deal.carrier,
          'Product': deal.product,
          'Monthly Premium': deal.premium,
          'Status': 'Pending Payment',
          'Sold Date': today
        },
        typecast: true
      },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Airtable write OK, record id:', result.data.id);
  } catch (err) {
    console.error('Airtable write error:', err.response?.data || err.message);
  }
}

// /deal slash command — opens modal
app.post('/deal', async (req, res) => {
  console.log('Received /deal command');
  res.status(200).send('');

  const triggerId = req.body.trigger_id;
  console.log('trigger_id:', triggerId);

  const modal = {
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'deal_modal',
      title: { type: 'plain_text', text: 'Post a Closed Deal' },
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
              'GTL',
              'Goldstar'
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
          optional: true,
          label: { type: 'plain_text', text: 'Policy Term (skip for Goldstar)' },
          element: {
            type: 'static_select',
            action_id: 'term',
            placeholder: { type: 'plain_text', text: 'Select term...' },
            options: [
              { text: { type: 'plain_text', text: 'Monthly x 12' }, value: '12' },
              { text: { type: 'plain_text', text: 'Monthly x 10' }, value: '10' },
              { text: { type: 'plain_text', text: 'One-time / Single Premium' }, value: '1' }
            ]
          }
        }
      ]
    }
  };

  try {
    const result = await axios.post('https://slack.com/api/views.open', modal, {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('views.open result:', JSON.stringify(result.data));
  } catch (err) {
    console.error('Error opening modal:', err.response?.data || err.message);
  }
});

// Handle modal submission
app.post('/interactions', async (req, res) => {
  console.log('Received interaction');

  let payload;
  try {
    payload = JSON.parse(req.body.payload);
    console.log('Payload type:', payload.type);
    console.log('Callback ID:', payload.view?.callback_id);
  } catch (e) {
    console.error('Failed to parse payload:', e.message);
    return res.status(200).send('');
  }

  if (payload.type === 'view_submission' && payload.view.callback_id === 'deal_modal') {
    res.status(200).json({ response_action: 'clear' });

    const vals = payload.view.state.values;
    const deal = {
      agent: vals.agent_block.agent.selected_option.value,
      carrier: vals.carrier_block.carrier.selected_option.value,
      product: vals.product_block.product.selected_option.value,
      premium: parseFloat(vals.premium_block.premium.value) || 0,
      term: parseInt(vals.term_block?.term?.selected_option?.value) || 12
    };

    const isGoldstar = deal.carrier === 'Goldstar';

    // Build the Monthly Premium / Term lines depending on carrier
    let premiumLine;
    let termLine;
    if (isGoldstar) {
      premiumLine = `:moneybag: *Monthly Premium:* $${deal.premium.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      termLine = `:calendar: *Term:* Month-to-Month`;
    } else {
      const ap = deal.premium * deal.term;
      const termLabel = { '12': 'Monthly x 12', '10': 'Monthly x 10', '1': 'One-time' }[String(deal.term)];
      premiumLine = `:moneybag: *Monthly Premium:* $${deal.premium.toLocaleString('en-US', { minimumFractionDigits: 2 })}   |   :bar_chart: *AP:* $${ap.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      termLine = `:calendar: *Term:* ${termLabel}`;
    }

    const message = [
      `:trophy: *DEAL CLOSED* :trophy:`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `:bust_in_silhouette: *Agent:* ${deal.agent}`,
      `:office: *Carrier:* ${deal.carrier}`,
      `:clipboard: *Product:* ${deal.product}`,
      premiumLine,
      termLine,
      `━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');

    // Post the celebration to Slack
    try {
      const result = await axios.post('https://slack.com/api/chat.postMessage', {
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
      console.log('Slack post result:', JSON.stringify(result.data));
    } catch (err) {
      console.error('Error posting message:', err.response?.data || err.message);
    }

    // Log the deal into Airtable
    await writeToAirtable(deal);

  } else {
    console.log('Unhandled interaction type:', payload.type);
    res.status(200).send('');
  }
});

app.get('/', (req, res) => res.send('Deal Modal Server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
