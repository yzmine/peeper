# Spotify Playlist Discord Bot

This Node.js Discord bot monitors a text channel for Spotify links and automatically adds them to a predefined Spotify playlist. It supports track and album links, avoids adding duplicates, and can process full message history.

## Features

* `!wakeup` to activate the bot
* `!bye` to deactivate the bot
* `!readhistory` to scan all past messages in the channel and add valid Spotify links
* Automatically handles:

  * Individual Spotify track links
  * Full albums (all tracks)
  * Duplicate track prevention

---

## Requirements

* Node.js v18+
* Discord bot token
* Spotify Developer credentials

  * Client ID
  * Client Secret
  * Refresh Token
  * Playlist ID (must belong to the Spotify account that created the token)

---
