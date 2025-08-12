## PodMail β

Podmail is a web application for accessing and sending in-game EVE Online EVEmails directly from your browser. Your EVEmail data is stored locally in your browser, meaning server admins cannot spy on your messages.

The long term goal of Podmail is to deliver an excellent experience for managing EVEmails that is comparable to modern web-based email clients.

### Current Features

* Compose and send EVEmails  
* When necessary, adjusted colors in an EVEmail to improve contrast and readability. 
* Delete mails or mark mails as read or unread 
* Bulk selection and actions such as mark unread and delete all
* Loads the latest 500 EVEmails (subject to increase)  
* Displays unread counts across all folders including mailing lists (not natively supported by ESI)
* Marks mails as read when opened  
* Resolves and displays names for labels, mailing lists, characters, corporations, and alliances  
* Links character, corporation, and alliance names in EveMails to EveWho  
* Detects and links killmails in EveMails to zKillboard
* UI improvements including mobile responsiveness
* Rudimentary offline mode
* Pre-caching of evemails related to loaded evemail headers for faster access as well as to help with offline mode and upcoming search implementation.
* Adjusts font sizes based on browser defaults (on browsers that support advanced attr handling, Firefox is currently not one of them)

 ### Upcoming Features

* Multiple characters!  Have multiple characters logged in and check evemail on each with just a couple of clicks.
* Cross-Tab communication, for those with multiple tabs of PodMail open, ensuring only one tab makes fetches and communicats this to other tabs
* Compose mail formatting, bold, italic, links, colors, etc.
* For offline mode, queueing events to happen later, such as sending an evemail or deleting evemail
* Option for PodMail trash (since in game Trash is not exposed properly)
* Configure the total amount of evemails to load (default 500)
* Search functionality!  It will be limited to the loaded evemails.
* Custom settings (e.g. max evemails to load, CSPA charge, show red dot, etc)
* Additional features planned

