# Security

The Ink edition talks to TVs over ADB, installs two apps on them, and connects one of them to your Google Calendar
and Tasks, so a security bug here can reach people's living rooms and their agendas. Please report anything you find
privately, not in a public issue.

## How to report

Use GitHub's private vulnerability reporting: open the
[Security tab](https://github.com/mrfritzdjango/cleanyourtv-ink/security) and choose **Report a vulnerability**.
Only the maintainer sees the report.

Please include what is affected (the prompt, a tool in `tools/`, the launcher, Today, the Apps Script, a debloat
list), the steps to reproduce it, and what an attacker could do with it.

## What counts

- The launcher (`com.gathin.tvhome`) doing something it shouldn't: reaching the network, exposing data to other
  apps, or being made to open something it shouldn't.
- Today (`io.github.mrfritzdjango.morningboard`) exposing the agenda, the song or the last watched show to an app
  that isn't your launcher build, leaking the Apps Script address or key, or being made to wake the screen.
- The Apps Script (`addons/morning-board/apps-script/Code.gs`) answering without the right key, or doing more with
  your calendar or tasks than it says.
- The tools (`tools/tv.py`, `disable.sh`, `restore.sh`, `recovery.py`) running commands on a device or computer they
  weren't pointed at, or mishandling paths and input.
- A debloat list or the prompt leading to a TV that can't be restored with `tools/restore.sh`.

ADB itself is powerful by design. Turning on USB or network debugging lets any computer on your network ask to
connect, and the TV asks you to allow it. Turn debugging off when you're done.

## What happens next

You'll get a reply within a few days. Fixes go into `main` with credit to you, unless you'd rather stay anonymous.
Problems that come from Clean Your TV itself (the debloat tools and lists) are passed on
[upstream](https://github.com/Gathin23/cleanyourtv/security) as well.
