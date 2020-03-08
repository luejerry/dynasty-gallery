# Dynasty Gallery Viewer

Adds a modal lightbox image viewer to Dynasty for streamlined image browsing.

## Changelog
* 2.1.0: Show loading progress bar in loading indicator.
* 2.0.4: Prevent arrow key navigation from triggering when editing a comment box.
* 2.0.1: Fix tags/comments failing to update on Safari.
* 2.0.0: Enabled arrow key next/prev navigation. Viewer is now lazy loaded on first open.
* 1.9.1: Fix minor issues with tooltip behavior.
* 1.9.0: Added image source and open image buttons to viewer. Styling adjustments.
* 1.8.7: Fix image and comment windows sometimes not aligning with each other.
* 1.8.5: Comments button now shows number of comments. Comments now load instantly.
* 1.8.0: Can now view and post image comments directly in the viewer.
* 1.7.1: Fix issue where invisible loading indicator blocks mouse events.
* 1.7: Breaking change - now uses async-await for asynchronous requests.
* 1.6.4: Added small delay before loading indicator appears.
* 1.6.2: Improved scrolling performance of viewer (Chrome).
* 1.6: Enabled autoupdate. Resolve issue with reduced scrolling performance even when viewer is not open (Chrome/Safari).
* 1.5: Added image prefetching for improved responsivness.
* 1.4.5: Fix "???" tags not being parsed correctly.
* 1.4.4: Displayed tags now link to their respective pages.
* 1.4.3: Fix scroll position carrying over between images (changing images now always starts at top)
* 1.4.2: Minor style changes to be more consistent with site style
* 1.4.1: Fix tag list showing "undefined" for images opened from some parts of the site (tag list is hidden in these cases)
* 1.4: Now displays tag list when hovering on the image.
* 1.3.1: No longer causes annoying page reflow when viewer is opened/closed on non-macOS platforms.
* 1.3: Tall images now scroll without scrolling the entire page.
* 1.2: Now displays a loading indicator.
* 1.1: Performance improvement. No longer performs full array scan when the viewer is opened.
* 1.01: Code cleanup and documentation. No functionality changes.
* 1.0: Initial release.