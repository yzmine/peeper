const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

//invit link https://discord.com/oauth2/authorize?client_id=1387417859231187025&permissions=8&response_type=code&redirect_uri=https%3A%2F%2Fdiscord.gg%2FS2QRcubB&integration_type=0&scope=bot+messages.read
const DISCORD_TOKEN =
  "MTM4NzQxNzg1OTIzMTE4NzAyNQ.G_BrRR.BemdIGNQoXCSxBYbSaUXpt3ODh9dmAqBKbYbmg";
//const SPOTIFY_ACCESS_TOKEN ="BQAPU-IAQ58Z1DgAFmO6-QGn0uvrwFE7-wkl3ATfFx_zIZ8tGuVSGbz-WpS-j_fEG0iSMwGwF8TMQUvscXP0hiop0n5FH_pT7AfjHvcVLX9TK_TeoOQcSGDeKUi_f5EAFCuzsEqs3KilYJ1Ok4ry8ckrRIakjMbznyQuRZ8Bly7hADGqiA3q5mT7CfBqg1uyKufADzNjfbRAb4JiZlt7t72Kx8RZPeEXa95aB3uvR9674S0WdSBsDeDqvJJhhdnjRVv61xLHTezLICi9DokL8F_Ymdd3USb7Gz67Ajapitg";
const CLIENT_ID = '331f42ca05f04bf09fb5a1be2454eb83';
const CLIENT_SECRET = 'e8a31e2009b64838b6e778fd5eb9e31d';
const REFRESH_TOKEN = 'AQAKg7vnJ1dsXNvks4eU1xFky0t8TRf6Gf7TKblLuM4Y4G6ixG-ckIRxnmiyOpEDE_YlIWUqG2JjJuNnPOu3mz0jqk8Y8MQ4lkqkNmrd8bJ7B1VdyXHLol6Jdbmt16povdw';
const PLAYLIST_ID = '4DkImy9QRjRDHANy1NExAx'; 

let accessToken = null;
let isAwake = false; // Bot state toggle

// 🔄 Refresh Spotify Access Token
async function refreshAccessToken() {
  try {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    accessToken = res.data.access_token;
    console.log('✅ Spotify access token refreshed');
  } catch (err) {
    console.error('❌ Token refresh error:', err.response?.data || err.message);
  }
}

// 🧠 Get track IDs already in the playlist
async function getPlaylistTrackIds() {
  let allIds = new Set();
  let next = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?fields=items(track(id)),next&limit=100`;

  while (next) {
    const res = await axios.get(next, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    for (const item of res.data.items) {
      const id = item.track?.id;
      if (id) allIds.add(id);
    }
    next = res.data.next;
  }
  return allIds;
}

// ➕ Add new tracks only
async function addTracksToPlaylist(trackIds, message) {
  try {
    const existingIds = await getPlaylistTrackIds();
    const newTracks = trackIds.filter(id => !existingIds.has(id));
    if (newTracks.length === 0) return message.reply('⚠️ All tracks already in playlist.');

    const uris = newTracks.map(id => `spotify:track:${id}`);
    const chunkSize = 100;
    for (let i = 0; i < uris.length; i += chunkSize) {
      const chunk = uris.slice(i, i + chunkSize);
      await axios.post(
        `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks`,
        { uris: chunk },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    message.reply(`✅ Added ${newTracks.length} new track(s) to the playlist!`);
  } catch (err) {
    console.error('❌ Error adding tracks:', err.response?.data || err.message);
    message.reply('❌ Failed to add tracks.');
  }
}


// 🚀 Discord Bot Init
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await refreshAccessToken();
  setInterval(refreshAccessToken, 1000 * 60 * 50); // Refresh every 50 mins
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // 🔛 Wake up bot
  if (content === '!wakeup') {
    if (isAwake) return message.reply('sup');
    isAwake = true;
    message.reply('sup');
    return;
  }

  // 🔴 Shut down bot
  if (content === '!bye') {
    if (!isAwake) return message.reply('💤');
    isAwake = false;
    message.reply('💤');
    return;
  }

  if (!isAwake) return; // Do nothing if bot is asleep

  // 📝 Read History Command
  if (content === '!readhistory') {
    message.reply('⏳ Reading message history...');
    try {
      let allMessages = [];
      let lastMessageId;
      let hasMore = true;

      while (hasMore) {
        const options = { limit: 100 };
        if (lastMessageId) options.before = lastMessageId;

        const fetched = await message.channel.messages.fetch(options);
        if (fetched.size === 0) hasMore = false;
        else {
          allMessages.push(...fetched.values());
          lastMessageId = fetched.last().id;
        }
        await new Promise(res => setTimeout(res, 500));
      }

      let trackIds = [];
      for (const msg of allMessages) {
        const text = msg.content;
        const trackMatches = [...text.matchAll(/https:\/\/open\.spotify\.com\/track\/([\w\d]+)/g)];
        trackIds.push(...trackMatches.map(m => m[1]));

        const albumMatches = [...text.matchAll(/https:\/\/open\.spotify\.com\/album\/([\w\d]+)/g)];
        for (const match of albumMatches) {
          let albumId = match[1];
          let next = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
          while (next) {
            const res = await axios.get(next, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            trackIds.push(...res.data.items.map(t => t.id));
            next = res.data.next;
          }
        }
      }

      trackIds = [...new Set(trackIds)];
      await addTracksToPlaylist(trackIds, message);
    } catch (err) {
      console.error('❌ History read error:', err.response?.data || err.message);
      message.reply('❌ Failed to process history.');
    }
    return;
  }

  // 🎵 Handle single track
  const trackMatch = content.match(/https:\/\/open\.spotify\.com\/track\/([\w\d]+)/);
  if (trackMatch) return addTracksToPlaylist([trackMatch[1]], message);

  // 💿 Handle album
  const albumMatch = content.match(/https:\/\/open\.spotify\.com\/album\/([\w\d]+)/);
  if (albumMatch) {
    try {
      let trackIds = [];
      let next = `https://api.spotify.com/v1/albums/${albumMatch[1]}/tracks?limit=50`;
      while (next) {
        const res = await axios.get(next, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        trackIds.push(...res.data.items.map(t => t.id));
        next = res.data.next;
      }
      return addTracksToPlaylist(trackIds, message);
    } catch (err) {
      console.error('❌ Album fetch error:', err.response?.data || err.message);
      message.reply('❌ Failed to fetch album tracks.');
    }
  }
});

client.login(DISCORD_TOKEN);
