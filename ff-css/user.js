// Firefox prefs for this setup. Firefox applies user.js from the profile folder at
// every startup, so hard-link it there like the CSS files. A pref set here wins over
// any change made to it in about:config once Firefox restarts.

// Load userChrome.css and userContent.css.
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Expand the vertical tab sidebar on hover right away, with a 150ms slide.
// Firefox defaults to a 200ms delay and a 400ms slide. Even with no delay, Firefox
// waits for a moment when the browser isn't busy before it expands.
user_pref("sidebar.animation.expand-on-hover.delay-duration-ms", 0);
user_pref("sidebar.animation.expand-on-hover.duration-ms", 150);
