const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN ="";
const CLIENT_ID = '';
const CLIENT_SECRET = '';
const REFRESH_TOKEN = '';
const PLAYLIST_ID = ''; 

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
