<p align="center">
  <a href="https://goafk.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/brand/afk-logo-dark.svg">
      <img alt="afk" src="assets/brand/afk-logo.svg" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>Away from keyboard, not away from control.</strong></p>

<p align="center">
  The <strong>afk phone app</strong>: Zed's agent panel, in your pocket.
  <br>
  <a href="https://goafk.dev">Website</a> · <a href="https://goafk.dev/docs/">Docs</a> · <a href="https://github.com/goafk/hub">Hub (install this on your computer)</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://goafk.dev/assets/shots/sidebar-dark-sm.webp">
    <img alt="Your projects and threads" src="https://goafk.dev/assets/shots/sidebar-light-sm.webp" width="240">
  </picture>
  &nbsp;
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://goafk.dev/assets/shots/thread-live-dark-sm.webp">
    <img alt="A live thread with a plan, a diff and queued messages" src="https://goafk.dev/assets/shots/thread-live-light-sm.webp" width="240">
  </picture>
  &nbsp;
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://goafk.dev/assets/shots/thread-permission-dark-sm.webp">
    <img alt="Approving a command from the phone" src="https://goafk.dev/assets/shots/thread-permission-light-sm.webp" width="240">
  </picture>
</p>

---

## What it does

Your AI coding agents keep working in [Zed](https://zed.dev) on your computer. The afk app keeps
you in the loop while you're away from the keyboard:

- **See everything live:** the same projects and threads as Zed's sidebar, with plans, diffs, tool
  calls and code rendered just like Zed.
- **Never miss "needs you":** a notification when an agent wants permission, asks a question, or
  finishes. Answer in a couple of taps.
- **Steer from anywhere:** reply, queue the next message, use `/` commands and `@` files, attach a
  photo, and switch model, mode or effort.
- **Review and ship:** see what changed in each project, then commit and push.
- **At a glance:** a "Needs you" inbox and home-screen widgets.
- **Several computers:** pair personal and work, and switch between them at the top.
- **Private:** your phone talks straight to your computer. Lock the app with your fingerprint.

## Get the app

| | |
| --- | --- |
| **Android** | Coming soon to Google Play (and as a direct APK download) |
| **iPhone** | Coming soon to the App Store |

Get notified when it lands in the stores at [goafk.dev](https://goafk.dev/#notify).

## Set it up

1. **Install the hub on your computer:**
   ```sh
   curl -fsSL https://goafk.dev/install.sh | sh
   ```
2. **Open the app** and **scan the QR code** the installer shows.

To add another computer later, tap the computer's name at the top of the app, then **Add a Mac**.

## Contributing

The app is built with Expo / React Native. How to run it, build it and ship updates is in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## The afk repos

| Repo | What |
| --- | --- |
| [goafk/hub](https://github.com/goafk/hub) | The hub that runs on your computer |
| **[goafk/app](https://github.com/goafk/app)** | This repo: the phone app |
| [goafk/website](https://github.com/goafk/website) | [goafk.dev](https://goafk.dev) |

---

<sub>MIT licensed. afk is an independent project, not affiliated with Zed Industries.</sub>
