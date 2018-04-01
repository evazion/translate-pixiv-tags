# Translate Pixiv Tags

A userscript that translates tags and artist names on
[Pixiv](https://www.pixiv.net) to their corresponding
Danbooru tags. Also works on [Nijie](https://nijie.info),
[NicoSeiga](https://seiga.nicovideo.jp), [Tinami](https://www.tinami.com),
[BCY](https://bcy.net), [Monappy](https://monappy.jp),
[Twitter](https://twitter.com), [DeviantArt](https://www.deviantart.com), and
[Hentai-Foundry](https://www.hentai-foundry.com).

# Installation

* Install [Tampermonkey](https://tampermonkey.net/) (for Chrome users) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (for Firefox users).
* Download the script: https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
* An installation prompt will appear. Accept the installation.

# Screenshots

![translate-pixiv-tags-1](https://user-images.githubusercontent.com/8430473/32701834-3b127f76-c7a2-11e7-99b5-bb4fac0a09ee.png)
![translate-pixiv-tags-2](https://user-images.githubusercontent.com/8430473/38178147-f266d652-35d1-11e8-89c7-80730fcae865.png)

# Translating Tags

Often you'll find tags that aren't translated. In these cases you can add the translation yourself:

* Find the wiki page of the equivalent Danbooru tag. For example, to add a translation of `オリジナル` to `original`, go to Danbooru's wiki page for [original](https://danbooru.donmai.us/wiki_pages?title=original).
* Click `Edit`.
* In the `Other names` field, add the untranslated tag.
* Click `Submit` to save your changes.

Sometimes a tag will translate to multiple Danbooru tags. In these cases the Pixiv tag should be added to each Danbooru wiki entry. For example, `黒タイツ` ("black tights") on Pixiv corresponds to `pantyhose` and `black_legwear` on Danbooru, so it is listed as an "Other name" on both the `black_legwear` and `pantyhose` wikis.

Sometimes tags on other sites don't have an equivalent Danbooru tag. This is usually because the tag is too subjective ("cute", "sexy", "beautiful"), or too generic ("girl", "anime", "fanart", "illustration"). These tags can't be translated.
