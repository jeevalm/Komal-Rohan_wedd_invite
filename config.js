/* =====================================================
   EDIT ONLY THIS FILE to personalise your invitation.
   Everything else (design + animations) is automatic.
   ===================================================== */
window.WEDDING = {
  theme: "heritage",         // "heritage" (default) | "western" | "editorial" | "boho"  — preview any without editing: index.html?theme=western
  timeZone: "Asia/Kolkata",

  /* Language: "en" starts in English, "kn" starts in Kannada. Guests can flip
     with the EN / ಕನ್ನಡ button; use ?lang=kn to open directly in Kannada.
     Kannada strings live in the `kn` block at the bottom of this file. */
  language: "en",
  showLanguageToggle: true,

  groom: "Rohan",
  bride: "Komal",
  groomFamily: "Ummannanavar",                // groom's surname / family name
  brideFamily: "Mahendrakar",                 // bride's surname / family name
  blessing: "SHUBHA VIVAHA",                    // shown on the intro, hero and booklet; set both language values to "" to hide
  tagline: "are getting married",            // line under the names
  // The bride's family is listed first (bride's side).
  invitationLine: "With joy and blessings, the Mahendrakar and Ummannanavar families invite you to the wedding of",
  // invitationLine: "The Mahendrakar's family joyfully invite you",
  heroPlace: "Jagajyothi Cultural Centre, Masuru, Karnataka",
  couplePhoto: "couplePhoto.webp",           // portrait photo at the project root (1080×1350)
  bookletPhotos: [                           // the 3D booklet is cover + one page per photo below
    "bookletPhoto-1.jpeg",
    "bookletPhoto-2.jpeg",
    "bookletPhoto-3.jpeg",
    "bookletPhoto-4.jpeg",
    "bookletPhoto-5.jpeg"
  ],

  intro: { tap: "Tap to open", top: "You're invited", bottom: "Save the date" },

  // Countdown target (ISO time with timezone) — counts down to the marriage
  countdownTo: "2026-12-04T10:30:00+05:30",
  countdownTitle: "Counting down to forever",

  // Add / remove events freely. Date & time are formatted automatically from startISO.
  events: [
    { badge: "Pre-wedding", name: "Engagement", startISO: "2026-12-03T19:00:00+05:30", hours: 3,
      venue: "Jagajyothi Cultural Centre", city: "Masuru, Karnataka 581210",
      map: "https://maps.app.goo.gl/uBuS3KwDwVHrGcgN7" },
    { badge: "The Wedding", name: "Marriage", startISO: "2026-12-04T10:30:00+05:30", hours: 4,
      venue: "Jagajyothi Cultural Centre", city: "Masuru, Karnataka 581210",
      map: "https://maps.app.goo.gl/uBuS3KwDwVHrGcgN7" },
    { badge: "Celebration", name: "Reception", startISO: "2026-12-04T19:30:00+05:30", hours: 4,
      venue: "Jagajyothi Cultural Centre", city: "Masuru, Karnataka 581210",
      map: "https://maps.app.goo.gl/uBuS3KwDwVHrGcgN7" }
  ],

  contacts: [
    { label: "Bride's family", phone: "+91 8792787765" },
    { label: "Groom's family", phone: "+91 9108643106" }
  ],
  footer: "We can't wait to celebrate with you",
  music: "",                                 // optional: "assets/song.mp3" (plays after the guest taps open)

  /* =====================================================
     ಕನ್ನಡ — edit only the text inside this block.
     Anything left blank falls back to the English text above.
     `events` and `contacts` follow the same order as above.
     ===================================================== */
  kn: {
    groom: "ರೋಹನ",
    bride: "ಕೋಮಲ್",
    conjunction: "ಮತ್ತು",
    blessing: "ಶುಭ ವಿವಾಹ",

    intro: { tap: "ತೆರೆಯಲು ಒತ್ತಿರಿ", top: "ನಿಮಗೆ ಆಮಂತ್ರಣ", bottom: "ದಿನಾಂಕ ನೆನಪಿಡಿ" },
    tagline: "ವಿವಾಹವಾಗುತ್ತಿದ್ದಾರೆ",
    invitationLine: "ಮಹೇಂದ್ರಕರ್ ಮತ್ತು ಉಮ್ಮಣ್ಣನವರ ಕುಟುಂಬಗಳ ಸಂತೋಷದ ಆಮಂತ್ರಣ",
    heroPlace: "ಜಗಜ್ಯೋತಿ ಸಾಂಸ್ಕೃತಿಕ ಕೇಂದ್ರ, ಮಾಸೂರು, ಕರ್ನಾಟಕ",
    countdownTitle: "ಶಾಶ್ವತ ಸಂಬಂಧದತ್ತ ಕ್ಷಣಗಣನೆ",

    events: [
      { badge: "ಪೂರ್ವ-ವಿವಾಹ", name: "ನಿಶ್ಚಿತಾರ್ಥ",
        venue: "ಜಗಜ್ಯೋತಿ ಸಾಂಸ್ಕೃತಿಕ ಕೇಂದ್ರ", city: "ಮಾಸೂರು, ಕರ್ನಾಟಕ 581210" },
      { badge: "ವಿವಾಹ", name: "ಮದುವೆ",
        venue: "ಜಗಜ್ಯೋತಿ ಸಾಂಸ್ಕೃತಿಕ ಕೇಂದ್ರ", city: "ಮಾಸೂರು, ಕರ್ನಾಟಕ 581210" },
      { badge: "ಸಂಭ್ರಮ", name: "ಸ್ವಾಗತ ಸಮಾರಂಭ",
        venue: "ಜಗಜ್ಯೋತಿ ಸಾಂಸ್ಕೃತಿಕ ಕೇಂದ್ರ", city: "ಮಾಸೂರು, ಕರ್ನಾಟಕ 581210" }
    ],

    contacts: [
      { label: "ವಧುವಿನ ಕುಟುಂಬ" },
      { label: "ವರನ ಕುಟುಂಬ" }
    ],
    footer: "ನಿಮ್ಮ ಆಗಮನವೇ ನಮಗೆ ಸಂತೋಷ",

    ui: {
      pageTitle: "ವಿವಾಹ ಆಮಂತ್ರಣ",
      countdown: "ಕ್ಷಣಗಣನೆ",
      days: "ದಿನ", hours: "ಗಂಟೆ", mins: "ನಿಮಿಷ", secs: "ಸೆಕೆಂಡ್",
      today: "ಇಂದೇ ಶುಭದಿನ",
      timeRemaining: "ಉಳಿದಿರುವ ಸಮಯ",
      schedule: "ಕಾರ್ಯಕ್ರಮ",
      celebrations: "ಸಂಭ್ರಮದ ಸಮಾರಂಭಗಳು",
      directions: "ದಾರಿ ಸೂಚನೆ",
      scroll: "ಕೆಳಗೆ ಸರಿಸಿ",
      scrollAria: "ಆಮಂತ್ರಣದ ಉಳಿದ ಭಾಗ ನೋಡಲು ಕೆಳಗೆ ಸರಿಸಿ",
      playMusic: "ಸಂಗೀತ ಆನ್ ಮಾಡಿ",
      pauseMusic: "ಸಂಗೀತ ನಿಲ್ಲಿಸಿ",
      langSwitch: "English",
      langAria: "Switch to English"
    },

    booklet: {
      kicker: "ಪುಟ ತಿರುಗಿಸಿ",
      title: "ನಮ್ಮ ಕ್ಷಣಗಳ ಪುಟ್ಟ ಪುಸ್ತಕ",
      open: "ನಮ್ಮ ಪ್ರೇಮ ಪಯಣದ ಸುಂದರ ನೋಟ ❤️",
      preparing: "ಪುಸ್ತಕ ಸಿದ್ಧವಾಗುತ್ತಿದೆ…",
      preparingPages: "ಪುಟಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…",
      prev: "← ಹಿಂದೆ", next: "ಮುಂದೆ →", close: "ಮುಚ್ಚಿ",
      moments: "ಕ್ಷಣಗಳು",
      momentTitles: ["ನಮ್ಮಿಬ್ಬರ ಕ್ಷಣ", "ಇನ್ನಷ್ಟು ನೆನಪುಗಳು", "ಪುಟ್ಟ ಕ್ಷಣಗಳು", "ನಿತ್ಯದ ನಗು", "ನಮ್ಮಿಬ್ಬರದು"],
      hint3d: "ಪುಟ ತಿರುಗಿಸಲು ಎಳೆಯಿರಿ ಅಥವಾ ಒತ್ತಿರಿ · ಬಾಣದ ಕೀಲಿಗಳೂ ಕೆಲಸ ಮಾಡುತ್ತವೆ",
      hintPlain: "ಪುಟ ತಿರುಗಿಸಲು ಪುಸ್ತಕದ ಬಲಭಾಗವನ್ನು ಒತ್ತಿರಿ · ಬಾಣದ ಕೀಲಿಗಳೂ ಕೆಲಸ ಮಾಡುತ್ತವೆ",
      retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
      pageLoadError: "ಪುಸ್ತಕದ ಕೆಲವು ಪುಟಗಳು ತೆರೆಯಲಿಲ್ಲ — ಸಿಗ್ನಲ್ ಸುಧಾರಿಸಿದರೆ ಮತ್ತೆ ಬರಬಹುದು. ",
      openError: "ಈ ಸಾಧನದಲ್ಲಿ 3D ಪುಸ್ತಕ ತೆರೆಯಲಿಲ್ಲ — ಕೆಳಗಿನ ಆಮಂತ್ರಣದಲ್ಲಿ ಎಲ್ಲ ವಿವರಗಳೂ ಇವೆ.",
      pageOf: "ಪುಟ {n} / {total}",
      pagesOf: "ಪುಟಗಳು {first}–{last} / {total}",
      prevAria: "ಹಿಂದಿನ ಪುಟ",
      nextAria: "ಮುಂದಿನ ಪುಟ",
      closeAria: "3D ಆಮಂತ್ರಣ ಪುಸ್ತಕ ಮುಚ್ಚಿ",
      dialogAria: "3D ಆಮಂತ್ರಣ ಪುಸ್ತಕ",
      langAria: "Switch to English"
    }
  }
};
