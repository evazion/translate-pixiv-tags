# Release 2020.01.26

## Fixes

* #43: fixed artist translate spamming in some cases.
* Pawoo: fixed translating of authors of non-pawoo posts.
* Improved some translating rules.

## Changes

* Added translating of aliases.
* Pawoo: added translating of the expanded post author.
* Settings: option to print some debug info in the console.

# Release 2020.01.11

## Fixes

* #42: pixiv: was broken due new links to profile page.
* pixiv: artists were not translated on search page.
* fixed treating the asterisk in tags as wildcard.

## Changes

* #43: Twitter: now happy-birthday-somebody and someanime-one-hour-draw-challenge are translated.
* Added Safebooru for sending requests and using it in links.
* Settings: you can hide deleted posts.

# Release 2019.12.05

## Fixes

* BCY: new profile page support.
* DevianArt: added support of new layout.
* Pixiv: new search page support.
* Pixiv: added translating of artist in popups.
* Pawoo, Pixiv, pixivFanbox, SauceNAO, twitter: minor fixes and updates due site changes.
* English tags were not translated in some cases.
* Fixed hiding of the script tooltip when cursor hovers a browser tooltip.

## Changes

* #37: Now all links open new tab.
* Internal improvements.

# Release 2019.09.19

## Fixes

* #32: no obvious way to cancel settings changes.
* #33: settings menu doesn't open for some artist tags.
* DevianArt: fixed overridden color of the artist tag.
* Fixed breakages caused by sites updating.

## Changes

* Added TweetDeck support.
* Added pixivFanbox support.
* Added alternative way to open settings: via Tampermonkey menu.
* Added handling of network request limit (credit to BrokenEagle).
* Internal improvements.

# Release 2019.08.24

## Fixes

* #25: displayed incorrect image size
* BCY: everything was broken.
* DevianArt: uncolored tags.
* SauceNAO: could translated deleted artists.
* Simultaneous triggering of native and script tooltips.
* Tag translating could use deleted wikis.

## Changes

* Added UI for settings.
* Updated and cleaned CSS.
* Updated some selectors for translating.
* Pixiv: now native translations are removed only for translated tags.
* Mobile Twitter: removed.
* Improved choosing of background color in case of semi-transparent ones.

# Release 2019.08.06

## Fixes

* In some cases the artist tooltip could be mostly outside the viewport.
* The userscript couldn't automatically update if was installed via copy/paste (credit to BrokenEagle).

## Changes

* Now post preview also includes file size, resolution, source, rating, and time of upload.
* NSFW previews are blurred, hover over them to unblur. This behavior can be adjusted in settings.
* Limited size of main sections in the artist tooltip.
* Main parts of the artist tooltip can be customized via pseudoelement ::part().
* Added dark theme of the tooltip and adaptive background color.

# Release 2019.07.26

## Fixes

* Twitter: new design support
* ArtStation: fixed the followers and the following lists

## Changes

* Now the popup window mimics the background color of the sites

# Release 2019.07.04

## Fixes

* Added ignoring of false-positive results that Danbooru returns for some unsupported domains (bug #18)
* Sometimes the popup with artist info was empty
* Artist tag could be added multiple times (bug #9)
* Fixed running the script in iframes (bug #10)
* Pixiv: sometimes tags were not translated (bug #15)
* Twitter: fixed blocked thumbnails (credit to BrokenEagle)

## Changes

* Improved performance by adding caching and the "only" parameter in Danbooru API calls (credit to BrokenEagle)
* Now tags are also "translated" by their main name
* Added ability to choose Danbooru server, number of previews, and cache lifetime (credit to BrokenEagle)
* Twitter: added translating of hastags (credit to BrokenEagle)
* SauceNAO: added initial support
* Pawoo: added initial support
* CSS improvements

# Release 2019.01.14

## Fixes

* Pixiv: fix artist tag not being translated when the artist has zero followers.
* Artists: fix matches being returned for deleted artists.

## Changes

* ArtStation: add initial ArtStation support (credit to 7nik)

# Release 2018.12.04

## Changes

* Monappy: drop Monappy support (site is defunct)

# Release 2018.11.29

## Fixes

* Pixiv: Fix artist tags not being translated on work pages.
* Fixed exception when rendering artist names in artist tooltips.

# Release 2018.10.11

## Fixes

* Pixiv: Fix artist tags not being translated correctly on work pages.
* Pixiv: Fix artist tags not being translated on profile pages.
* Pixiv: Fix artist tags not being translated in the recommended posts section.

## Changes

* Cache tag and artist lookups for five minutes.

# Release 2018.07.17

## Fixes

* Pixiv: fix translated tags not appearing.
* Twitter: fix tooltips not appearing.

# Release 2018.06.08 18:32:14

## Fixes

* Pixiv: fix translated tags for compatibility with Pixiv redesign.
* Fix HTML escaping issues in tags and artist names.

# Release 2018.04.02 20:50:44

## Fixes

* Artist tooltips: fix artist URLs not working due to trailing slashes.
* Artist tooltips: fix tooltip being affected by the host site's CSS.
* Nico Seiga: fix the "Clip" button in the sidebar overlapping the artist tag.

# Release 2018.04.01 17:11:12

* Added artist tag tooltips. Hover over an artist tag to see their Danbooru
  artist entry, plus a preview of their recent posts.

## Fixes

* Pixiv: fix translated tags being broken by Pixiv's new romaji tags.
* Pixiv: fix artist tags not being translated on search pages.
* Pixiv: fix artist tags being added twice when using the Endless Pixiv Pages userscript.
* Nicoseiga: fix spacing issue in long lists of translated tags (http://seiga.nicovideo.jp/seiga/im7626097).
* BCY: fix tags not being translated on illust pages and on tag search pages.

# Release 2017.12.26 17:05:26

* Add artist tag translation support for twitter.com, nicoseiga.jp, bcy.net,
  tinami.com, deviantart.com, and hentaifoundry.net.
* Add "(banned)" after the artist name for banned artists.

## Fixes

* Pixiv: fixed "5000users入り" tags returning bogus matches.

# Release 2017.12.08 13:33:01

* Monappy: add tag translation support.
* Monappy: add artist tag translation support.
* Nijie: add artist tag translation support.
* Add Danbooru icon next to translated artist tags.

## Fixes

* Pixiv: don't translate artist tags in fanbox containers.
* Pixiv: fix artist tags not being translated on pages loaded by Endless Pixiv Pages.

# Release 2017.11.20 02:44:43

* Pixiv: add artist tag translation support.
* Add support for Danbooru 'meta' tags.

# Release 2017.11.12 12:00:29

* Initial release.
