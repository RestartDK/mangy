---
name: evidence-capture
description: Recording screenshots or video of the running app for a pull request or issue in this repository. Use when asked for a demo video, a before and after comparison, or any screenshot of the UI. Covers redacting third-party cover art and publishing media without committing it.
---

# Evidence capture

## Two rules that override convenience

1. **Blur every remote image before the capture.** Series covers load from third-party hosts and must not appear in published media. The app's own assets (`/mangy-mark.png`, icons, text) stay sharp.
2. **Never commit captures to this repository.** Publish them as GitHub attachments so they render inline. `gh --attach` uploads an image or video and rewrites the body reference to a `user-attachments` URL, which renders images inline and video as a player. A committed mp4 is only ever a link, and `<video>` tags are stripped from markdown.

## Capture from a built revision

```
bunx turbo -F web build
cd apps/web && bunx vite preview --port 4173 --strictPort
```

Point the capture at `http://localhost:4173`. Dev server captures carry devtools overlays and an unreleased bundle. `CORS_ORIGIN` in `.env` must list the capture origin.

## Blur before first paint

Drive Chromium over CDP and install the marker as a new-document script, so every navigation starts blurred and both screenshots and screencast frames inherit it:

```js
const mark = `(() => {
  const apply = () => {
    const remote = (value) => /^https?:\\/\\//.test(value) && !value.includes("localhost");
    for (const image of document.querySelectorAll("img:not([data-pi-blur])")) {
      const src = image.currentSrc || image.getAttribute("src") || "";
      if (remote(src)) image.setAttribute("data-pi-blur", "");
    }
  };
  const boot = () => {
    if (!document.head) return false;
    if (!document.getElementById("pi-blur-style")) {
      const style = document.createElement("style");
      style.id = "pi-blur-style";
      style.textContent = "img[data-pi-blur] { filter: blur(18px); }";
      document.head.appendChild(style);
    }
    apply();
    window.__piBlurTick?.disconnect();
    window.__piBlurTick = new MutationObserver(apply);
    window.__piBlurTick.observe(document.documentElement, {
      attributeFilter: ["src", "style"], attributes: true, childList: true, subtree: true,
    });
    return true;
  };
  if (!boot()) document.addEventListener("DOMContentLoaded", boot, { once: true });
})();`;

await send("Page.addScriptToEvaluateOnNewDocument", { source: mark });
await evaluate(mark);
```

Guard on `document.head`: at document start it can be null, and an exception there silently disables the whole marker. Blur at 18px washes out cover art while leaving card size, spacing, titles, and states readable.

## Publish as attachments

```
gh pr edit <pr> --body-file body.md \
  --attach ./pr-media/ui-before-after.jpg \
  --attach ./pr-media/ui-tour.mp4
```

A body reference such as `![Interface before and after](./pr-media/ui-before-after.jpg)` is rewritten to the uploaded URL. Attachments need write permission on the repository, and up to 50 files go in one command. Keep the media outside the repository, for example `/tmp/<task>/pr-media/`.

After the edit, confirm the rendered page carries the media rather than assuming the rewrite landed:

```
curl -s https://github.com/RestartDK/mangy/pull/<pr> | grep -c "<video"
```

## Say that images were redacted

One line in the pull request body: "Cover art is blurred in these captures; layout and copy are unchanged." A reviewer who is not told reads blur as a design change.

## Do not keep unblurred artefacts

Delete local screenshot and frame dumps that hold unredacted cover art as soon as the redacted capture exists, so a later command cannot pick up the wrong file.
