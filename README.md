# Translate Pixiv Tags

A userscript that translates tags and artist names on
[Pixiv](https://www.pixiv.net) to their corresponding Danbooru tags. Also works
on [Nijie](https://nijie.info), [NicoSeiga](https://seiga.nicovideo.jp),
[Tinami](https://www.tinami.com), [BCY](https://bcy.net),
[Twitter](https://twitter.com), [DeviantArt](https://www.deviantart.com), and
[Hentai-Foundry](https://www.hentai-foundry.com).

# Installation

* Install [Tampermonkey](https://tampermonkey.net/) (for Chrome users) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (for Firefox users).
* Download the script: https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
* An installation prompt will appear. Accept the installation.

# Screenshots

<img width="600" src="https://user-images.githubusercontent.com/8430473/32701834-3b127f76-c7a2-11e7-99b5-bb4fac0a09ee.png">
<img width="600" src="https://user-images.githubusercontent.com/8430473/38178147-f266d652-35d1-11e8-89c7-80730fcae865.png">

# Settings

Settings can be changed via the **Storage** tab for the userscript. The script will have to run once and the Tampermonkey console refreshed before that tab becomes available.

* **booru:** Danbooru domain to send requests to.
  * Subdomains include **danbooru**, **kagamihara**, **saitou**, and **shima**.
* **cache_lifetime:** The amount of time in seconds to cache data from Danbooru before querying again.
* **preview_limit:** The number of recent posts to show in artist tooltips.
* **show_preview_rating:** The upper level of rating for preview. Higher ratings will be blurred.
  * Possible values are "**s**", "**q**", "**e**" (safe, questionable, explicit).

<img width="600" src="https://user-images.githubusercontent.com/21149935/62501237-b6236700-b79e-11e9-826b-868a470bf050.png">

# How to add new translations

Often you'll find tags that aren't translated. In these cases you can add the translation yourself:

* Go to https://danbooru.donmai.us/wiki_pages.
* Use the search box (in the top left) to find the Danbooru tag. For example, to add a translation of `オリジナル` to `original`, search for `original` to find Danbooru's wiki page for the [original](https://danbooru.donmai.us/wiki_pages?title=original) tag.
* Click `Edit` in the menu bar at the top.
* In the `Other names` field, add the untranslated tag.
* Click `Submit` to save your changes.

Sometimes a tag will translate to multiple Danbooru tags. In these cases the Pixiv tag should be added to each Danbooru wiki entry. For example, `黒タイツ` ("black tights") on Pixiv corresponds to `pantyhose` and `black_legwear` on Danbooru, so it is listed as an "Other name" on both the `black_legwear` and `pantyhose` wikis.

Sometimes tags on other sites don't have an equivalent Danbooru tag. This is usually because the tag is too subjective ("cute", "sexy", "beautiful"), or too generic ("girl", "anime", "fanart", "illustration"). These tags can't be translated.

##### Adding a new translation
<img width="600" src="https://user-images.githubusercontent.com/8430473/51077237-2e8ed300-1669-11e9-8b0b-88a51804a9d3.png">
