const express = require("express");
const axios = require("axios");
const open = (...args) => import("open").then((m) => m.default(...args));
const app = express();

const client_id = "331f42ca05f04bf09fb5a1be2454eb83";
const client_secret = "e8a31e2009b64838b6e778fd5eb9e31d";
const redirect_uri = "http://127.0.0.1:8888/callback";

const scope = "playlist-modify-public playlist-modify-private";

app.get("/login", (req, res) => {
  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(
    scope
  )}&redirect_uri=${encodeURIComponent(redirect_uri)}`;
  res.redirect(authURL);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const tokenRes = await axios.post(
    "https://accounts.spotify.com/api/token",
    null,
    {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id,
        client_secret,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token } = tokenRes.data;
  res.send(
    `✅ Your refresh token: <br><br><code>${refresh_token}</code><br><br>Copy and paste it into your bot code.`
  );

  console.log("Refresh token:", refresh_token);
  app.get("/callback", async (req, res) => {
    const code = req.query.code;

    try {
      const tokenRes = await axios.post(
        "https://accounts.spotify.com/api/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            code,
            redirect_uri,
            client_id,
            client_secret,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, refresh_token } = tokenRes.data;
      res.send(
        `✅ Your refresh token is:<br><br><code>${refresh_token}</code>`
      );
      console.log("Refresh token:", refresh_token);
    } catch (err) {
      console.error(
        "❌ Failed to get tokens:",
        err.response?.data || err.message
      );
      res.send("❌ Error getting token. See terminal for details.");
    }
  });
});

app.listen(8888, () => {
  console.log(
    "🔗 Open http://localhost:8888/login to get your Spotify refresh token"
  );
  open("http://localhost:8888/login");
});
