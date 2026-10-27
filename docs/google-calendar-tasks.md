# Your Google Calendar and Tasks on the TV

This guide connects **your own** Google Calendar and Google Tasks to the Ink edition: the Calendar and Tasks rows on
the e-ink Home, their previews, the full Calendar and Tasks screens (where OK ticks a task off), the morning board
and the "Next" line on the screensaver. It takes about fifteen minutes, in a web browser, and needs no programming.

You need a Google account with your calendar in it, and a computer with this repository on it (the same one you
build the apps with).

## How it works

```
 Google Calendar ─┐                                    ┌─> Today add-on on the TV ─> e-ink Home
 Google Tasks ────┼─> your Apps Script (your account) ─┤     (asks every 15 minutes
                  │    answers with today's agenda     │      while a screen shows it)
                  └─   as JSON, only to the right key  ┘
```

Google's sign-in for TVs can't give an app access to Calendar or Tasks, so the TV never signs in to Google. Instead
a small script runs **in your own Google account**, reads today's events and your open tasks, and answers the TV.

- The script is yours: it runs under your account, from code you paste in, and you can delete it at any time.
- It answers only a request that carries its **key**, a long random password it makes for itself. The web address and
  the key are built into your copy of the Today app, and nowhere else.
- Nothing goes through this project, Google Cloud billing or anyone else's server. There is no account on the TV.

## 1. Create the script

1. Open [script.google.com](https://script.google.com) signed in to the Google account whose calendar you want, and
   click **New project**.
2. Click **Untitled project** at the top and name it, for example **TV agenda**. The name only helps you find it later.
3. Select everything in the editor (`Code.gs`), delete it, and paste in the whole of
   [`addons/morning-board/apps-script/Code.gs`](../addons/morning-board/apps-script/Code.gs). Click the save icon.
4. **Project Settings** (the gear in the left column) › tick **Show "appsscript.json" manifest file in editor**.
   Back in the editor, open `appsscript.json`, replace everything in it with
   [`apps-script/appsscript.json`](../addons/morning-board/apps-script/appsscript.json), and save. This file turns on
   Google Tasks for the script and limits what it may ask for: your calendars **read-only**, and your tasks with the
   right to change them, which OK on the TV needs to tick one off.

The time zone comes from your Google Calendar (Calendar › Settings › General › Time zone), so there is nothing to
set for it here.

## 2. Allow it to read your calendar and tasks

1. In the toolbar, choose **setup** in the function list next to **Debug**, and click **Run**.
2. Google asks for permission: **Review permissions**, pick your account.
3. Google warns **"Google hasn't verified this app"**. That is expected: it is your own script, not a published app.
   Click **Advanced**, then **Go to TV agenda (unsafe)**. It asks for two things: to **view** your calendars (it
   can't change them) and to **create, edit and delete** your tasks (so OK on the TV can tick one off; it never
   creates or deletes any). Click **Allow**. If it asks to edit or delete your calendars, the manifest from step 1.4
   is missing: go back and paste it.
4. The **Execution log** opens at the bottom. Its first line is `key=` followed by 32 letters and digits: **that is
   your key**. Below it is today's agenda as the TV will see it. Check that `timeZone` is where you live and that
   today's events are there.

Running **setup** again later shows the same key; it never changes on its own.

## 3. Publish it as a web app

1. **Deploy** (top right) › **New deployment**.
2. Click the gear next to **Select type** and choose **Web app**.
3. Description: anything, for example `TV`. **Execute as: Me**. **Who has access: Anyone**.
   "Anyone" is needed because the TV can't sign in to Google; the key is what keeps others out.
4. **Deploy**, then copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfy…/exec`.

## 4. Try it in your browser

Open your web app URL with `?key=` and your key on the end:

```
https://script.google.com/macros/s/AKfy…/exec?key=YOUR_KEY
```

You should see a page of text starting `{"ok":true,"timeZone":…` with your events and tasks. That is exactly what
the TV will get. With a wrong key you get `{"ok":false,"error":"key"}`, and no agenda.

Treat this address with the key like a password: anyone who has both can read today's agenda and tick off your
tasks. Don't post it, screenshot it or paste it into an issue.

## 5. Build it into the app

1. In the repository, copy `addons/morning-board/board.properties.example` to `addons/morning-board/board.properties`
   (git ignores this file, so it can't be committed by mistake) and fill in the two lines:

   ```properties
   url=https://script.google.com/macros/s/AKfy…/exec
   key=YOUR_KEY
   ```

2. Build and install Today again, and the launcher if it isn't installed yet, both on this computer
   ([README › Set it up](../README.md#set-it-up)). If you set things up with a coding agent through
   [INK-PROMPT.md](../INK-PROMPT.md), tell it the file is filled in and it will rebuild.
3. On the TV, open **Calendar** from Home. The first time, it says **Fetching today…** for a moment, then shows your
   day. Home's previews fill in from then on.

## What shows up

- **Events:** today's and tomorrow's from every calendar that is **ticked** in the left column of Google Calendar
  (on the web, under My calendars and Other calendars). Untick a calendar there to keep it off the TV. Events you
  declined are left out, and an event on two calendars appears once. On a day with nothing on, the next day that has
  something (within 60 days) is shown instead.
- **Tasks:** the open tasks from all your task lists, overdue and due today first, then by date, undated last; and
  what you ticked off today. OK on a task on the TV marks it done in Google Tasks.
- **When it updates:** the TV asks while Calendar, Tasks or the morning board is on screen (every 15 minutes) and when
  Home comes up (at most every 5 minutes). When the network is down it shows the last answer and when it came.

### A family calendar

The script shows the calendars of the account that deployed it. For a household TV, either add the family's shared
calendars to that account (Google Calendar › Other calendars › **+** › Subscribe, or accept the share), or make one
Google account for the TV, share everyone's calendars with it, and deploy the script from that account.

## Changing it later

- **Edited the script** (a new version from this repo, say): paste it in, save, then **Deploy › Manage deployments ›**
  the pencil › **Version: New version** › **Deploy**. The URL stays the same, so the TV needs nothing. Choosing
  **New deployment** instead gives a new URL, and Today has to be rebuilt with it.
- **A new key** (if the URL and key ever got out): Project Settings › Script properties › delete `KEY`, run **setup**
  again for the new key, put it in `board.properties` and rebuild Today. The old key stops working at once.
- **Turning it off:** Deploy › Manage deployments › **Archive** stops the web app. To withdraw its access to your
  account as well, remove it at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), or
  delete the project in [script.google.com](https://script.google.com).

## When something is wrong

| What you see | What it means, and what to do |
|---|---|
| The TV says **Today needs its address** | Today was built without `board.properties`. Fill it in and rebuild Today. |
| The TV says **Can't reach your calendar yet** | The TV got no agenda. Try the address from step 4 in a browser. If that works, check the TV is online and that `board.properties` has the same URL and key, then rebuild. |
| The browser shows a Google sign-in page or "Sorry, unable to open the file" | The deployment isn't open to **Anyone**. Manage deployments › the pencil › Who has access: Anyone. |
| `{"ok":false,"error":"key"}` | The key in the address doesn't match. Run **setup** to see the right one; copy all 32 characters. |
| `Authorization is required` or `Exception: …` in the browser | The script changed since you allowed it. Run **setup** again and allow it, then make a new version (above). |
| Times are an hour or a whole zone off | Check `timeZone` in the browser answer against Google Calendar › Settings › Time zone, and the TV's own time zone (Settings › System › Date & time). |
| An event is missing | Its calendar is unticked or hidden in Google Calendar, you declined it, or it is on a calendar this account can't see. |
| A task is missing | It is completed, has no title, or is in a list of another account. |
| Google says the app is blocked | A work or school (Google Workspace) account whose admin doesn't allow unverified scripts. Use a personal account, or ask the admin. |

## For the curious

The whole script is about 170 lines: [`Code.gs`](../addons/morning-board/apps-script/Code.gs). It uses Google's
built-in `CalendarApp` (with the read-only calendar scope) and the Tasks API (with the full tasks scope, the only
one that can mark a task done; so anyone with the URL and the key could tick your tasks off too), both free for
personal use, and reaches
nothing else: no Gmail, no Drive, no outside address; the TV's few requests a day are far inside
Google's daily limits. You can also push it from the command line with
[clasp](https://github.com/google/clasp) (`clasp push`, then `clasp deploy -i <deployment id>` to keep the URL).
