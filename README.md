# Translate Pixiv Tags

A userscript that translates tags and artist names on
[Pixiv](https://www.pixiv.net) to their corresponding Danbooru tags. Also works on
[ArtStation](https://www.artstation.com/),
[BCY](https://bcy.net),
[DeviantArt](https://www.deviantart.com),
[Hentai-Foundry](https://www.hentai-foundry.com),
[NicoSeiga](https://seiga.nicovideo.jp),
[Nijie](https://nijie.info),
[Pawoo](https://pawoo.net/about),
[pixivFANBOX](https://fanbox.pixiv.net),
[SauceNAO](http://saucenao.com/),
[Tinami](https://www.tinami.com),
[TweetDeck](https://tweetdeck.twitter.com),
and [Twitter](https://twitter.com).

# Installation

* Install [Tampermonkey](https://tampermonkey.net/) extension, it's available for Chrome, Microsoft Edge, Safari, Opera Next, and Firefox.
* Download the script: https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js
* An installation prompt will appear. Accept the installation.

# Screenshots

<img width="600" src="https://user-images.githubusercontent.com/29704098/64010410-6710ed80-cb22-11e9-81de-141f5e1fb7e2.png">
<img width="600" src="https://user-images.githubusercontent.com/29704098/64010491-945d9b80-cb22-11e9-83d0-1e89f6bd9405.png">
<img width="600" src="https://user-images.githubusercontent.com/29704098/64010663-e7375300-cb22-11e9-8a7a-9c5cf9912033.png">
<img width="600" src="https://user-images.githubusercontent.com/29704098/64010716-033af480-cb23-11e9-995d-85791910bb7e.png">

# Settings

<img width="600" src="https://user-images.githubusercontent.com/29704098/64245098-f64b4600-cf12-11e9-83f2-6be8a6da59db.png">

### Via Tampermonkey menu

Click "Settings" under this script's item in the Tampermonkey menu.

<img width="600" src="https://user-images.githubusercontent.com/29704098/64924663-ad876d00-d7ef-11e9-8a22-d123579d6181.png">

### Via artist tag

You can open the settings by clicking a button in the upper right corner of any artist's tooltip.

<img width="600" src="https://user-images.githubusercontent.com/29704098/64924739-4b7b3780-d7f0-11e9-885e-a0559ae67ef7.png">

### Via Storage tab

Settings are stored in the **Storage** tab of the userscript.
To be able to edit settings of the userscript, you must set **advanced config mode** in Tampermonkey settings.
<img width="600" src="https://user-images.githubusercontent.com/21149935/62814848-16c8e180-bac8-11e9-93a5-61c65d4c8297.png">

To see default settings, the userscript should be run once.

* **booru:** Danbooru domain to send requests to.
  * Subdomains include **danbooru**, **kagamihara**, **saitou**, and **shima**.
* **cache_lifetime:** The amount of time in seconds to cache data from Danbooru before querying again.
* **preview_limit:** The number of recent posts to show in artist tooltips.
* **show_preview_rating:** The upper level of rating for preview. Higher ratings will be blurred.
  * Possible values are "**s**", "**q**", "**e**" (safe, questionable, explicit).

<img width="600" src="https://user-images.githubusercontent.com/21149935/62501237-b6236700-b79e-11e9-826b-868a470bf050.png">

# FAQ

* [How to add new translations](https://github.com/evazion/translate-pixiv-tags/wiki/How-to-add-new-translations)
* [How to add or update artist links](https://github.com/evazion/translate-pixiv-tags/wiki/How-to-add-or-update-artist-links)
* [How to add support of one more site](https://github.com/evazion/translate-pixiv-tags/wiki/How-to-add-support-of-one-more-site)
