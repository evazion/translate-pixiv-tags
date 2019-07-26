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
